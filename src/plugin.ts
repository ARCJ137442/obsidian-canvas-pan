import { ItemView, Notice, Platform, Plugin, apiVersion } from "obsidian";

import type { Canvas } from "./types";
import { CanvasKeyboardPanSettingsTab } from "./settings";
import { isCanvasEditing, isEditableTarget, resolveCanvasFromEvent, updateCanvasPointerLeaseFromEvent } from "./canvas-context";
import { CanvasPointerLeaseRegistry } from "./canvas-pointer-lease";
import { KeyboardEventGuard } from "./keyboard-event-guard";
import { WindowRegistrationRegistry } from "./window-registration";
import { hasKeyboardModifier } from "./keyboard-modifiers";
import { xor } from "./util";
import { DEFAULT_KEY_BINDINGS, normalizeKeyBindings } from "./key-bindings";
import { panCanvas } from "./canvas-viewport";
import { CanvasDiagnostics, captureCanvasCapabilities, describeDiagnosticElement, describeDiagnosticError, DiagnosticWindowErrorListeners, getDiagnosticWindowIds, runPanIntervalSafely, shouldSamplePanTick } from "./diagnostics";
import type { DiagnosticReport } from "./diagnostics";
import { DEFAULT_PAN_SPEED, getPanDistance, normalizePanSpeed } from "./pan-speed";

export enum Direction {
	North = "north",
	West = "west",
	South = "south",
	East = "east",
}

export interface CanvasKeyboardPanSettings {
	keys: Record<Direction, string>;
	maxSpeed: number;
}

export const DEFAULT_SETTINGS: CanvasKeyboardPanSettings = {
	keys: { ...DEFAULT_KEY_BINDINGS },
	maxSpeed: DEFAULT_PAN_SPEED,
};

interface PanWindowState {
	canvas?: Canvas;
	panStart: number | null;
	panInterval?: number;
	keyDown: Record<Direction, boolean>;
	tick: number;
	normalTickCount: number;
	sampledTickCount: number;
	lastSampleAt: number | null;
}

type WindowCleanup = () => void;
type ViewportSnapshot = { x?: number; y?: number; tx?: number; ty?: number; zoom?: number; tZoom?: number };
type WindowWithPanCleanup = Window & {
	__obsidianCanvasKeyboardPanCleanup?: WindowCleanup;
};

export interface CanvasPanDiagnosticsApi {
	startDiagnostics(sessionId?: string): string;
	stopDiagnostics(): DiagnosticReport;
}

const PAN_INTERVAL_MS = 10;

export class CanvasKeyboardPan extends Plugin {
	settings: CanvasKeyboardPanSettings = {
		keys: { ...DEFAULT_SETTINGS.keys },
		maxSpeed: DEFAULT_SETTINGS.maxSpeed,
	};

	private readonly windowStates = new Map<Window, PanWindowState>();
	private readonly registeredWindows = new WindowRegistrationRegistry<Window>();
	private readonly windowCleanups = new Map<Window, WindowCleanup>();
	private readonly handledKeyboardEvents = new KeyboardEventGuard();
	private readonly canvasPointerLeases = new CanvasPointerLeaseRegistry<Canvas>();
	private readonly diagnostics = new CanvasDiagnostics("canvas-keyboard-pan");
	private readonly diagnosticErrorListeners = new DiagnosticWindowErrorListeners();

	async onload() {
		const data = (await this.loadData()) as Partial<CanvasKeyboardPanSettings> | null;
		const loadedKeys = normalizeKeyBindings(data?.keys);
		const loadedMaxSpeed = normalizePanSpeed(data?.maxSpeed);
		const speedRepaired = loadedMaxSpeed !== data?.maxSpeed;
		this.settings = {
			...DEFAULT_SETTINGS,
			maxSpeed: loadedMaxSpeed,
			keys: loadedKeys.keys as Record<Direction, string>,
		};
		if (loadedKeys.repaired || speedRepaired) {
			await this.saveData(this.settings);
			new Notice(
				loadedKeys.repaired
					? "Canvas Keyboard Pan：检测到重复按键配置，已恢复默认 WASD"
					: "Canvas Keyboard Pan：速度配置超出范围，已恢复到有效范围",
			);
		}
		this.addSettingTab(new CanvasKeyboardPanSettingsTab(this.app, this));
		this.registerCanvasKeyListeners();

		this.registerEvent(this.app.workspace.on("layout-change", () => this.stopAllPan(true)));
		this.registerEvent(this.app.workspace.on("active-leaf-change" as never, ((leaf: unknown, previousLeaf: unknown) => {
			const currentWindow = this.getWindowFromLeaf(leaf);
			const previousWindow = this.getWindowFromLeaf(previousLeaf);
			if (currentWindow) this.stopPan(currentWindow, true);
			if (previousWindow && previousWindow !== currentWindow) this.stopPan(previousWindow, true);
			this.canvasPointerLeases.clear(currentWindow);
			this.canvasPointerLeases.clear(previousWindow);
		}) as never));
		this.registerEvent(this.app.workspace.on("file-open" as never, ((_file: unknown, view: unknown) => {
			const eventWindow = this.getWindowFromView(view);
			if (eventWindow) {
				this.stopPan(eventWindow, true);
				this.canvasPointerLeases.clear(eventWindow);
			}
		}) as never));
		this.registerEvent(this.app.workspace.on("active-leaf-change" as never, ((leaf: unknown) => {
			const eventWindow = this.getWindowFromLeaf(leaf);
			const view = (leaf as { view?: { file?: { path?: string }; getViewType?: () => string } } | null | undefined)?.view;
			this.diagnostics.record({
				event: "tab",
				phase: "active-leaf-change",
				viewType: view?.getViewType?.(),
				canvasPath: view?.file?.path,
				activeElement: describeDiagnosticElement(eventWindow?.document.activeElement),
				...getDiagnosticWindowIds(eventWindow),
			});
		}) as never));
	}

	onunload(): void {
		if (this.diagnostics.enabled) this.stopDiagnostics();
		this.stopAllPan(true);
		for (const cleanup of [...this.windowCleanups.values()]) cleanup();
		this.windowCleanups.clear();
		this.windowStates.clear();
		this.registeredWindows.clear();
	}

	/** Public optional bridge used by ARC to share one diagnostic session. */
	public startDiagnostics(sessionId?: string): string {
		const started = this.diagnostics.start(sessionId);
		this.attachDiagnosticErrorListeners();
		const workspaceWindow = this.app.workspace.containerEl.ownerDocument.defaultView;
		this.diagnostics.record({ event: "session", phase: "start" });
		this.diagnostics.record({
			event: "runtime",
			phase: "platform",
			apiVersion,
			pluginVersion: this.manifest.version,
			diagnosticRevision: "mobile-canvas-pointer-lease-v1",
			platform: {
				isMobile: Platform.isMobile,
				isDesktop: Platform.isDesktop,
				isAndroid: Platform.isAndroidApp,
				isIos: Platform.isIosApp,
			},
		});
		this.diagnostics.record({ event: "listener", phase: "active", ...getDiagnosticWindowIds(workspaceWindow) });
		this.recordCanvasCapabilities();
		this.app.workspace.iterateAllLeaves((leaf) => {
			const eventWindow = leaf.view?.containerEl?.ownerDocument.defaultView;
			this.diagnostics.record({ event: "listener", phase: "active", ...getDiagnosticWindowIds(eventWindow) });
		});
		return started;
	}

	public stopDiagnostics(): DiagnosticReport {
		this.diagnosticErrorListeners.clear();
		return this.diagnostics.stop();
	}

	private attachDiagnosticErrorListeners(): void {
		for (const eventWindow of this.windowCleanups.keys()) {
			this.diagnosticErrorListeners.attach(eventWindow, (kind, error) => {
				this.diagnostics.record({ event: "error", errorKind: kind, ...describeDiagnosticError(error), ...getDiagnosticWindowIds(eventWindow) });
			});
		}
	}

	private recordCanvasCapabilities(): void {
		const seen = new Set<object>();
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view as (ItemView & { canvas?: Canvas; file?: { path?: string } }) | null;
			const canvas = view?.canvas;
			if (!canvas) return;
			let identity: object = canvas as object;
			try { identity = Object.getPrototypeOf(canvas as object) ?? identity; } catch { /* use instance identity */ }
			if (seen.has(identity)) return;
			seen.add(identity);
			try {
				this.diagnostics.record({
					event: "capability",
					phase: "canvas-runtime",
					canvasPath: view?.file?.path,
					canvasCapabilities: captureCanvasCapabilities(canvas),
				});
			} catch (error) {
				this.diagnostics.record({
					event: "error",
					errorKind: "capability-introspection",
					canvasPath: view?.file?.path,
					...describeDiagnosticError(error),
				});
			}
		});
	}

	private diagnosticContext(eventWindow: Window, event?: Event, canvas?: Canvas) {
		const selected = canvas ? [...(canvas.selection ?? [])] : [];
		const first = selected.find(element => typeof (element as { id?: unknown }).id === "string") as { id?: string } | undefined;
		const view = canvas as (Canvas & { view?: { file?: { path?: string } } }) | undefined;
		let vaultName: string | undefined;
		try { vaultName = this.app.vault.getName(); } catch { /* host may not expose a vault in tests */ }
		return {
			...(vaultName ? { vaultName } : {}),
			...(view?.view?.file?.path ? { canvasPath: view.view.file.path } : {}),
			...(first?.id && vaultName && view?.view?.file?.path ? { nodeId: first.id } : {}),
			...(canvas ? { selectionCount: selected.length, isEditing: isCanvasEditing(canvas) } : {}),
			...getDiagnosticWindowIds(eventWindow),
			...(event ? {
				target: describeDiagnosticElement(event.target),
				activeElement: describeDiagnosticElement(eventWindow.document.activeElement),
			} : {}),
		};
	}

	private recordWindowError(eventWindow: Window, kind: string, error: unknown): void {
		this.diagnostics.record({ event: "error", errorKind: kind, ...describeDiagnosticError(error), ...getDiagnosticWindowIds(eventWindow) });
	}

	private recordKeyboard(
		eventWindow: Window,
		event: KeyboardEvent,
		canvas: Canvas | undefined,
		accepted: boolean,
		reason: string,
		details: { phase?: string; contextSource?: string; leaseReason?: string } = {},
	): void {
		if (!this.diagnostics.enabled) return;
		this.diagnostics.record({
			event: "guard",
			code: event.code,
			accepted,
			reason,
			...details,
			...this.diagnosticContext(eventWindow, event, canvas),
		});
	}

	private createWindowState(): PanWindowState {
		return {
			panStart: null,
			keyDown: {
				[Direction.North]: false,
				[Direction.West]: false,
				[Direction.South]: false,
				[Direction.East]: false,
			},
			tick: 0,
			normalTickCount: 0,
			sampledTickCount: 0,
			lastSampleAt: null,
		};
	}

	private registerCanvasKeyListeners(): void {
		const registerForWindow = (eventWindow: Window | null): void => {
			if (!eventWindow) return;
			if (!this.registeredWindows.claim(eventWindow)) {
				return;
			}

			const windowWithCleanup = eventWindow as WindowWithPanCleanup;
			windowWithCleanup.__obsidianCanvasKeyboardPanCleanup?.();

			const state = this.createWindowState();
			this.windowStates.set(eventWindow, state);
			this.diagnostics.record({ event: "listener", phase: "registered", ...getDiagnosticWindowIds(eventWindow) });
			if (this.diagnostics.enabled) {
				this.diagnosticErrorListeners.attach(eventWindow, (kind, error) => this.recordWindowError(eventWindow, kind, error));
			}

			const onKeyDown = (event: KeyboardEvent): void => {
				if (hasKeyboardModifier(event)) {
					this.recordKeyboard(eventWindow, event, undefined, false, "modifier", { phase: "keydown" });
					this.stopPan(eventWindow, true);
					return;
				}
				if (event.repeat || event.isComposing || isEditableTarget(event.target)) {
					this.recordKeyboard(eventWindow, event, undefined, false,
						event.repeat ? "repeat" : event.isComposing ? "composing" : "editable-target", { phase: "keydown" });
					return;
				}

				const context = resolveCanvasFromEvent(this.app, event, eventWindow, this.canvasPointerLeases);
				const canvas = context.canvas;
				if (!canvas) {
					this.recordKeyboard(eventWindow, event, undefined, false, "canvas-context-unresolved", {
						phase: "keydown",
						contextSource: context.source,
						leaseReason: context.leaseReason,
					});
					return;
				}
				if (isCanvasEditing(canvas)) {
					this.recordKeyboard(eventWindow, event, canvas, false, "canvas-editing", { phase: "keydown", contextSource: context.source, leaseReason: context.leaseReason });
					return;
				}
				if (!this.handledKeyboardEvents.consume(event)) {
					this.recordKeyboard(eventWindow, event, canvas, false, "event-already-consumed", { phase: "keydown", contextSource: context.source, leaseReason: context.leaseReason });
					return;
				}

				const direction = this.getDirectionForEvent(event);
				if (!direction) {
					this.recordKeyboard(eventWindow, event, canvas, false, "unbound-key", { phase: "keydown", contextSource: context.source, leaseReason: context.leaseReason });
					return;
				}
				this.recordKeyboard(eventWindow, event, canvas, true, "accepted", {
					phase: "keydown",
					contextSource: context.source,
					leaseReason: context.leaseReason,
				});

				state.canvas = canvas;
				state.keyDown[direction] = true;
				state.keyDown[this.getOppositeDirection(direction)] = false;
				this.startPan(eventWindow);
				event.preventDefault();
		};

			const onKeyUp = (event: KeyboardEvent): void => {
				if (hasKeyboardModifier(event)) {
					this.recordKeyboard(eventWindow, event, undefined, false, "modifier", { phase: "keyup" });
					this.stopPan(eventWindow, true);
					return;
				}
				if (!this.handledKeyboardEvents.consume(event)) {
					this.recordKeyboard(eventWindow, event, undefined, false, "event-already-consumed", { phase: "keyup" });
					return;
				}

				const direction = this.getDirectionForEvent(event);
				if (!direction) {
					this.recordKeyboard(eventWindow, event, undefined, false, "unbound-key", { phase: "keyup" });
					return;
				}
				state.keyDown[direction] = false;
				this.recordKeyboard(eventWindow, event, state.canvas, true, "released", { phase: "keyup" });
				this.stopPan(eventWindow);
			};

			const clearWindowState = (): void => {
				this.resetWindowState(eventWindow);
				this.canvasPointerLeases.clear(eventWindow);
			};
			const onBlur = (): void => clearWindowState();
			const onCompositionStart = (event: CompositionEvent): void => this.diagnostics.record({ event: "composition", phase: "start", ...this.diagnosticContext(eventWindow, event) });
			const onCompositionEnd = (event: CompositionEvent): void => this.diagnostics.record({ event: "composition", phase: "end", ...this.diagnosticContext(eventWindow, event) });
			const onFocusIn = (event: FocusEvent): void => this.diagnostics.record({ event: "focus", phase: "in", ...this.diagnosticContext(eventWindow, event) });
			const onFocusOut = (event: FocusEvent): void => this.diagnostics.record({ event: "focus", phase: "out", ...this.diagnosticContext(eventWindow, event) });
			const onPointerDown = (event: PointerEvent): void => {
				const context = updateCanvasPointerLeaseFromEvent(this.app, event, eventWindow, this.canvasPointerLeases);
				if (!this.diagnostics.enabled) return;
				this.diagnostics.record({
					event: "pointer",
					phase: "down",
					pointerType: event.pointerType,
					contextSource: context.source,
					leaseReason: context.leaseReason,
					...this.diagnosticContext(eventWindow, event, context.canvas),
				});
			};
			const onVisibilityChange = (): void => {
				this.diagnostics.record({ event: "visibility", phase: eventWindow.document.visibilityState, ...getDiagnosticWindowIds(eventWindow) });
				if (eventWindow.document.visibilityState !== "visible") clearWindowState();
			};
			// Register on the owning document: Obsidian popouts can expose a
			// Window wrapper whose event path is not identical to the document
			// receiving the physical keyboard event.
			eventWindow.document.addEventListener("keydown", onKeyDown, true);
			eventWindow.document.addEventListener("keyup", onKeyUp, true);
			eventWindow.addEventListener("blur", onBlur);
			eventWindow.document.addEventListener("visibilitychange", onVisibilityChange);
			eventWindow.document.addEventListener("compositionstart", onCompositionStart);
			eventWindow.document.addEventListener("compositionend", onCompositionEnd);
			eventWindow.document.addEventListener("focusin", onFocusIn);
			eventWindow.document.addEventListener("focusout", onFocusOut);
			eventWindow.addEventListener("pointerdown", onPointerDown, true);

			let cleaned = false;
			const cleanup: WindowCleanup = () => {
				if (cleaned) return;
				cleaned = true;
				eventWindow.document.removeEventListener("keydown", onKeyDown, true);
				eventWindow.document.removeEventListener("keyup", onKeyUp, true);
				eventWindow.removeEventListener("blur", onBlur);
				eventWindow.document.removeEventListener("visibilitychange", onVisibilityChange);
				eventWindow.document.removeEventListener("compositionstart", onCompositionStart);
				eventWindow.document.removeEventListener("compositionend", onCompositionEnd);
				eventWindow.document.removeEventListener("focusin", onFocusIn);
				eventWindow.document.removeEventListener("focusout", onFocusOut);
				eventWindow.removeEventListener("pointerdown", onPointerDown, true);
				this.diagnostics.record({ event: "listener", phase: "cleanup", ...getDiagnosticWindowIds(eventWindow) });
				this.diagnosticErrorListeners.detach(eventWindow);
				if (windowWithCleanup.__obsidianCanvasKeyboardPanCleanup === cleanup) {
					delete windowWithCleanup.__obsidianCanvasKeyboardPanCleanup;
				}
				this.windowCleanups.delete(eventWindow);
				this.removeWindowState(eventWindow);
				this.registeredWindows.release(eventWindow);
				this.canvasPointerLeases.clear(eventWindow);
			};
			windowWithCleanup.__obsidianCanvasKeyboardPanCleanup = cleanup;
			this.windowCleanups.set(eventWindow, cleanup);
			this.register(cleanup);
		};

		const workspaceDocument = this.app.workspace.containerEl.ownerDocument;
		registerForWindow(workspaceDocument.defaultView ?? null);
		this.app.workspace.iterateAllLeaves((leaf) => {
			registerForWindow(leaf.view?.containerEl?.ownerDocument?.defaultView ?? null);
		});

		this.registerEvent(this.app.workspace.on("window-open", (_workspaceWindow, eventWindow) => {
			registerForWindow(eventWindow);
		}));
		this.registerEvent(this.app.workspace.on("window-close", (_workspaceWindow, eventWindow) => {
			this.windowCleanups.get(eventWindow)?.();
		}));
	}

	private getDirectionForEvent(event: KeyboardEvent): Direction | undefined {
		for (const direction of Object.values(Direction)) {
			const configuredKey = this.settings.keys[direction];
			if (configuredKey === event.code || configuredKey.toLowerCase() === event.key.toLowerCase()) {
				return direction;
			}
		}
		return undefined;
	}

	private getWindowFromLeaf(leaf: unknown): Window | undefined {
		const view = (leaf as { view?: unknown } | null | undefined)?.view ?? leaf;
		return this.getWindowFromView(view);
	}

	private getWindowFromView(view: unknown): Window | undefined {
		const containerEl = (view as { containerEl?: HTMLElement } | null | undefined)?.containerEl;
		return containerEl?.ownerDocument.defaultView ?? undefined;
	}

	private getOppositeDirection(direction: Direction): Direction {
		switch (direction) {
			case Direction.North: return Direction.South;
			case Direction.West: return Direction.East;
			case Direction.South: return Direction.North;
			case Direction.East: return Direction.West;
		}
	}

	private isPanning(state: PanWindowState): boolean {
		return xor(state.keyDown[Direction.East], state.keyDown[Direction.West])
			|| xor(state.keyDown[Direction.North], state.keyDown[Direction.South]);
	}

	private resetWindowState(eventWindow: Window): void {
		const state = this.windowStates.get(eventWindow);
		if (!state) return;
		this.stopPan(eventWindow, true);
	}

	private removeWindowState(eventWindow: Window): void {
		this.resetWindowState(eventWindow);
		this.windowStates.delete(eventWindow);
	}

	private stopAllPan(force = false): void {
		for (const eventWindow of this.windowStates.keys()) this.stopPan(eventWindow, force);
	}

	public startPan(eventWindow: Window = this.getWorkspaceWindow()): void {
		const state = this.windowStates.get(eventWindow);
		if (!state) {
			return;
		}
		if (state.panInterval !== undefined) {
			return;
		}

		state.panStart = Date.now();
		state.tick = 0;
		state.normalTickCount = 0;
		state.sampledTickCount = 0;
		state.lastSampleAt = null;
		const interval = eventWindow.setInterval(() => {
			const intervalStartedAt = Date.now();
			const intervalCanvas = state.canvas;
			const intervalTick = state.tick;
			runPanIntervalSafely(
				() => this.handlePanKeys(eventWindow),
				() => this.stopPan(eventWindow, true),
				(error) => this.recordPanException(eventWindow, intervalCanvas, error, intervalTick, Date.now() - intervalStartedAt),
			);
		}, PAN_INTERVAL_MS);
		state.panInterval = this.registerInterval(interval);
	}

	public stopPan(eventWindow: Window = this.getWorkspaceWindow(), force = false): void {
		const state = this.windowStates.get(eventWindow);
		if (!state) return;

		if (force || !this.isPanning(state)) {
			this.flushPanSummary(eventWindow, state);
			if (state.panInterval !== undefined) eventWindow.clearInterval(state.panInterval);
			state.panInterval = undefined;
			state.panStart = null;
		}
		if (force) {
			for (const direction of Object.values(Direction)) state.keyDown[direction] = false;
			state.canvas = undefined;
		}
	}

	public get panning(): boolean {
		const state = this.windowStates.get(this.getWorkspaceWindow());
		return state ? this.isPanning(state) : false;
	}

	public getActiveCanvas(eventWindow?: Window): Canvas | undefined {
		if (!eventWindow) return this.app.workspace.getActiveViewOfType(ItemView)?.canvas;

		const state = this.windowStates.get(eventWindow);
		if (state?.canvas) return state.canvas;

		let canvas: Canvas | undefined;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (canvas) return;
			const view = leaf.view as (ItemView & { canvas?: Canvas }) | null;
			if (view?.canvas && view.containerEl?.ownerDocument.defaultView === eventWindow) canvas = view.canvas;
		});
		return canvas;
	}

	public handlePanKeys(eventWindow: Window = this.getWorkspaceWindow()): void {
		const state = this.windowStates.get(eventWindow);
		if (!state || !this.isPanning(state)) {
			this.stopPan(eventWindow);
			return;
		}

		state.tick += 1;
		const tick = state.tick;
		const canvas = state.canvas ?? this.getActiveCanvas(eventWindow);
		if (!canvas) {
			this.stopPan(eventWindow, true);
			return;
		}
		state.canvas = canvas;

		const ms = state.panStart === null ? 0 : Date.now() - state.panStart;
		let dx = 0;
		let dy = 0;
		if (state.keyDown[Direction.North] && !state.keyDown[Direction.South]) {
			dy -= this.getPanDistance(ms, this.settings.maxSpeed);
		} else if (state.keyDown[Direction.South] && !state.keyDown[Direction.North]) {
			dy += this.getPanDistance(ms, this.settings.maxSpeed);
		}
		if (state.keyDown[Direction.West] && !state.keyDown[Direction.East]) {
			dx -= this.getPanDistance(ms, this.settings.maxSpeed);
		} else if (state.keyDown[Direction.East] && !state.keyDown[Direction.West]) {
			dx += this.getPanDistance(ms, this.settings.maxSpeed);
		}

		const diagnosticsEnabled = this.diagnostics.enabled;
		const before = diagnosticsEnabled ? this.readViewport(canvas) : undefined;
		const startedAt = diagnosticsEnabled ? Date.now() : 0;
		const result = this.applyPan(dx, dy, canvas, eventWindow, tick, startedAt, true, before);
		if (!result) return;
		if (!diagnosticsEnabled) return;
		state.normalTickCount += 1;
		const now = Date.now();
		if (shouldSamplePanTick(state.lastSampleAt, now)) {
			state.lastSampleAt = now;
			state.sampledTickCount += 1;
			const syncAfter = this.readViewport(canvas);
			const diagnosticSessionId = this.diagnostics.sessionId;
			this.diagnostics.record({
				event: "pan",
				phase: "tick-sample",
				strategy: "legacy-tx-ty",
				tick,
				durationMs: now - startedAt,
				callPath: "CanvasKeyboardPan.handlePanKeys",
				before,
				after: syncAfter,
				redrawRequested: result.redrawRequested,
				...this.diagnosticContext(eventWindow, undefined, canvas),
			});
			eventWindow.requestAnimationFrame(() => {
				if (!this.diagnostics.enabled || this.diagnostics.sessionId !== diagnosticSessionId) return;
				const frameAfter = this.readViewport(canvas);
				this.diagnostics.record({
					event: "pan-effect",
					phase: "next-animation-frame",
					strategy: "legacy-tx-ty",
					tick,
					before: syncAfter,
					after: frameAfter,
					effectObserved: this.didViewportChange(syncAfter, frameAfter),
					callPath: "CanvasKeyboardPan.handlePanKeys",
					...this.diagnosticContext(eventWindow, undefined, canvas),
				});
			});
		}
	}

	public pan(dx: number, dy: number, canvas = this.getActiveCanvas(), eventWindow = this.getWorkspaceWindow()): void {
		if (!canvas) return;
		const diagnosticsEnabled = this.diagnostics.enabled;
		this.applyPan(dx, dy, canvas, eventWindow, undefined, diagnosticsEnabled ? Date.now() : 0, false,
			diagnosticsEnabled ? this.readViewport(canvas) : undefined);
	}

	private readViewport(canvas: Canvas): ViewportSnapshot {
		const value = canvas as unknown as Record<string, unknown>;
		const snapshot: ViewportSnapshot = {};
		for (const name of ["x", "y", "tx", "ty", "zoom", "tZoom"] as const) {
			const candidate = value[name];
			if (typeof candidate === "number" && Number.isFinite(candidate)) snapshot[name] = candidate;
		}
		return snapshot;
	}

	private didViewportChange(before: ViewportSnapshot, after: ViewportSnapshot): boolean {
		return before.x !== after.x || before.y !== after.y || before.tx !== after.tx || before.ty !== after.ty
			|| before.zoom !== after.zoom || before.tZoom !== after.tZoom;
	}

	private applyPan(dx: number, dy: number, canvas: Canvas, eventWindow: Window, tick: number | undefined, startedAt: number, interval: boolean, before?: ViewportSnapshot) {
		try {
			return panCanvas(canvas, dx, dy);
		} catch (error) {
			if (interval) this.stopPan(eventWindow, true);
			this.recordPanException(eventWindow, canvas, error, tick,
				this.diagnostics.enabled ? Date.now() - startedAt : undefined, before);
			if (!interval) throw error;
			return undefined;
		}
	}

	private recordPanException(eventWindow: Window, canvas: Canvas | undefined, error: unknown, tick?: number, durationMs?: number, before?: ViewportSnapshot): void {
		this.diagnostics.record({
			event: "pan-error",
			phase: "exception",
			strategy: "legacy-tx-ty",
			...(tick === undefined ? {} : { tick }),
			...(durationMs === undefined ? {} : { durationMs }),
			before: before ?? (canvas ? this.readViewport(canvas) : undefined),
			after: canvas ? this.readViewport(canvas) : undefined,
			callPath: "CanvasKeyboardPan.handlePanKeys",
			...describeDiagnosticError(error),
			...this.diagnosticContext(eventWindow, undefined, canvas),
		});
	}

	private flushPanSummary(eventWindow: Window, state: PanWindowState): void {
		if (!this.diagnostics.enabled || state.normalTickCount === 0) return;
		this.diagnostics.record({
			event: "pan-summary",
			phase: "stop",
			strategy: "legacy-tx-ty",
			tick: state.tick,
			tickCount: state.normalTickCount,
			sampledTickCount: state.sampledTickCount,
			...getDiagnosticWindowIds(eventWindow),
		});
		state.normalTickCount = 0;
		state.sampledTickCount = 0;
		state.lastSampleAt = null;
	}

	public getPanDistance(msPanning = 0, max = DEFAULT_PAN_SPEED): number {
		return getPanDistance(msPanning, max);
	}

	public resetCanvas(): void {
		this.getActiveCanvas()?.panTo(0, 0);
	}

	private getWorkspaceWindow(): Window {
		return this.app.workspace.containerEl.ownerDocument.defaultView ?? window;
	}
}
