import { ItemView, Notice, Plugin } from "obsidian";

import type { Canvas } from "./types";
import { CanvasKeyboardPanSettingsTab } from "./settings";
import { getCanvasFromEvent, isCanvasEditing, isEditableTarget } from "./canvas-context";
import { KeyboardEventGuard } from "./keyboard-event-guard";
import { WindowRegistrationRegistry } from "./window-registration";
import { hasKeyboardModifier } from "./keyboard-modifiers";
import { xor } from "./util";
import { DEFAULT_KEY_BINDINGS, normalizeKeyBindings } from "./key-bindings";
import { panCanvas } from "./canvas-viewport";

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
	maxSpeed: 250,
};

interface PanWindowState {
	canvas?: Canvas;
	panStart: number | null;
	panInterval?: number;
	debugFirstTickLogged: boolean;
	keyDown: Record<Direction, boolean>;
}

type WindowCleanup = () => void;
type WindowWithPanCleanup = Window & {
	__obsidianCanvasKeyboardPanCleanup?: WindowCleanup;
};

const PAN_INTERVAL_MS = 10;
const DIAGNOSTIC_LOGGING = true;

export class CanvasKeyboardPan extends Plugin {
	settings: CanvasKeyboardPanSettings = {
		keys: { ...DEFAULT_SETTINGS.keys },
		maxSpeed: DEFAULT_SETTINGS.maxSpeed,
	};

	private readonly windowStates = new Map<Window, PanWindowState>();
	private readonly registeredWindows = new WindowRegistrationRegistry<Window>();
	private readonly windowCleanups = new Map<Window, WindowCleanup>();
	private readonly handledKeyboardEvents = new KeyboardEventGuard();

	async onload() {
		const data = (await this.loadData()) as Partial<CanvasKeyboardPanSettings> | null;
		const loadedKeys = normalizeKeyBindings(data?.keys);
		this.settings = {
			...DEFAULT_SETTINGS,
			maxSpeed: typeof data?.maxSpeed === "number" && Number.isFinite(data.maxSpeed)
				? data.maxSpeed
				: DEFAULT_SETTINGS.maxSpeed,
			keys: loadedKeys.keys as Record<Direction, string>,
		};
		this.log("settings-loaded", { settings: this.settings, repaired: loadedKeys.repaired });
		if (loadedKeys.repaired) {
			console.warn("[CanvasKeyboardPan] invalid or duplicate key bindings detected; restoring default WASD", data?.keys);
			await this.saveData(this.settings);
			new Notice("Canvas Keyboard Pan：检测到重复按键配置，已恢复默认 WASD");
		}
		this.addSettingTab(new CanvasKeyboardPanSettingsTab(this.app, this));
		this.registerCanvasKeyListeners();

		this.registerEvent(this.app.workspace.on("layout-change", () => this.stopAllPan(true)));
		this.registerEvent(this.app.workspace.on("active-leaf-change" as never, ((leaf: unknown, previousLeaf: unknown) => {
			const currentWindow = this.getWindowFromLeaf(leaf);
			const previousWindow = this.getWindowFromLeaf(previousLeaf);
			if (currentWindow) this.stopPan(currentWindow, true);
			if (previousWindow && previousWindow !== currentWindow) this.stopPan(previousWindow, true);
		}) as never));
		this.registerEvent(this.app.workspace.on("file-open" as never, ((_file: unknown, view: unknown) => {
			const eventWindow = this.getWindowFromView(view);
			if (eventWindow) this.stopPan(eventWindow, true);
		}) as never));
	}

	onunload(): void {
		this.stopAllPan(true);
		for (const cleanup of [...this.windowCleanups.values()]) cleanup();
		this.windowCleanups.clear();
		this.windowStates.clear();
		this.registeredWindows.clear();
	}

	private createWindowState(): PanWindowState {
		return {
			panStart: null,
			debugFirstTickLogged: false,
			keyDown: {
				[Direction.North]: false,
				[Direction.West]: false,
				[Direction.South]: false,
				[Direction.East]: false,
			},
		};
	}

	private registerCanvasKeyListeners(): void {
		const registerForWindow = (eventWindow: Window | null): void => {
			if (!eventWindow) return;
			if (!this.registeredWindows.claim(eventWindow)) {
				this.log("register-window-skipped-duplicate", this.describeWindow(eventWindow));
				return;
			}

			const windowWithCleanup = eventWindow as WindowWithPanCleanup;
			windowWithCleanup.__obsidianCanvasKeyboardPanCleanup?.();

			const state = this.createWindowState();
			this.windowStates.set(eventWindow, state);
			this.log("register-window", this.describeWindow(eventWindow));

			const onKeyDown = (event: KeyboardEvent): void => {
				this.log("keydown", {
					window: this.describeWindow(eventWindow), key: event.key, code: event.code,
					shift: event.shiftKey, ctrl: event.ctrlKey, alt: event.altKey, meta: event.metaKey,
					repeat: event.repeat, target: this.describeTarget(event.target),
				});
				if (hasKeyboardModifier(event)) {
					this.log("keydown-blocked-modifier", { window: this.describeWindow(eventWindow), key: event.key, code: event.code });
					this.stopPan(eventWindow, true);
					return;
				}
				if (event.repeat || event.isComposing || isEditableTarget(event.target)) {
					this.log("keydown-blocked-input-state", { repeat: event.repeat, composing: event.isComposing, editable: isEditableTarget(event.target) });
					return;
				}

				const canvas = getCanvasFromEvent(this.app, event, eventWindow);
				if (!canvas) {
					this.log("keydown-ignored-no-canvas", { window: this.describeWindow(eventWindow) });
					return;
				}
				if (isCanvasEditing(canvas)) {
					this.log("keydown-blocked-canvas-editing", { window: this.describeWindow(eventWindow) });
					return;
				}
				if (!this.handledKeyboardEvents.consume(event)) {
					this.log("keydown-ignored-duplicate-event", { window: this.describeWindow(eventWindow) });
					return;
				}

				const direction = this.getDirectionForEvent(event);
				if (!direction) {
					this.log("keydown-ignored-unbound-key", { key: event.key, code: event.code, configured: this.settings.keys });
					return;
				}

				state.canvas = canvas;
				state.keyDown[direction] = true;
				state.keyDown[this.getOppositeDirection(direction)] = false;
				this.startPan(eventWindow);
				this.log("keydown-accepted", { window: this.describeWindow(eventWindow), direction, configured: this.settings.keys[direction] });
				event.preventDefault();
		};

			const onKeyUp = (event: KeyboardEvent): void => {
				this.log("keyup", {
					window: this.describeWindow(eventWindow), key: event.key, code: event.code,
					shift: event.shiftKey, ctrl: event.ctrlKey, alt: event.altKey, meta: event.metaKey,
				});
				if (hasKeyboardModifier(event)) {
					this.log("keyup-blocked-modifier", { window: this.describeWindow(eventWindow), key: event.key, code: event.code });
					this.stopPan(eventWindow, true);
					return;
				}
				if (!this.handledKeyboardEvents.consume(event)) {
					this.log("keyup-ignored-duplicate-event", { window: this.describeWindow(eventWindow) });
					return;
				}

				const direction = this.getDirectionForEvent(event);
				if (!direction) {
					this.log("keyup-ignored-unbound-key", { key: event.key, code: event.code, configured: this.settings.keys });
					return;
				}
				state.keyDown[direction] = false;
				this.stopPan(eventWindow);
		};

			const clearWindowState = (reason: string): void => {
				this.log("clear-window-state", { reason, window: this.describeWindow(eventWindow) });
				this.resetWindowState(eventWindow);
			};
			const onBlur = (): void => clearWindowState("blur");
			const onVisibilityChange = (): void => {
				if (eventWindow.document.visibilityState !== "visible") clearWindowState(`visibility:${eventWindow.document.visibilityState}`);
			};
			// Register on the owning document: Obsidian popouts can expose a
			// Window wrapper whose event path is not identical to the document
			// receiving the physical keyboard event.
			eventWindow.document.addEventListener("keydown", onKeyDown, true);
			eventWindow.document.addEventListener("keyup", onKeyUp, true);
			eventWindow.addEventListener("blur", onBlur);
			eventWindow.document.addEventListener("visibilitychange", onVisibilityChange);

			let cleaned = false;
			const cleanup: WindowCleanup = () => {
				if (cleaned) return;
				cleaned = true;
				eventWindow.document.removeEventListener("keydown", onKeyDown, true);
				eventWindow.document.removeEventListener("keyup", onKeyUp, true);
				eventWindow.removeEventListener("blur", onBlur);
				eventWindow.document.removeEventListener("visibilitychange", onVisibilityChange);
				if (windowWithCleanup.__obsidianCanvasKeyboardPanCleanup === cleanup) {
					delete windowWithCleanup.__obsidianCanvasKeyboardPanCleanup;
				}
				this.windowCleanups.delete(eventWindow);
				this.log("cleanup-window", this.describeWindow(eventWindow));
				this.removeWindowState(eventWindow);
				this.registeredWindows.release(eventWindow);
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
			this.log("workspace-window-open", this.describeWindow(eventWindow));
			registerForWindow(eventWindow);
		}));
		this.registerEvent(this.app.workspace.on("window-close", (_workspaceWindow, eventWindow) => {
			this.log("workspace-window-close", this.describeWindow(eventWindow));
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

	private describeWindow(eventWindow: Window): Record<string, unknown> {
		return {
			main: eventWindow === this.getWorkspaceWindow(),
			url: eventWindow.location?.href,
			visibility: eventWindow.document.visibilityState,
			focused: eventWindow.document.hasFocus?.(),
		};
	}

	private describeTarget(target: EventTarget | null): string {
		if (!target) return "null";
		const element = target as Element;
		return element.tagName ? `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).replace(/\s+/g, ".")}` : ""}` : target.constructor?.name ?? "unknown";
	}

	private log(message: string, details?: unknown): void {
		if (DIAGNOSTIC_LOGGING) {
			let serialized = "";
			try {
				serialized = details === undefined ? "" : ` ${JSON.stringify(details)}`;
			} catch {
				serialized = " [unserializable-details]";
			}
			console.info(`[CanvasKeyboardPan] ${message}${serialized}`);
		}
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
			this.log("start-pan-skipped-no-window-state", this.describeWindow(eventWindow));
			return;
		}
		if (state.panInterval !== undefined) {
			this.log("start-pan-skipped-already-running", this.describeWindow(eventWindow));
			return;
		}

		state.panStart = Date.now();
		state.debugFirstTickLogged = false;
		const interval = eventWindow.setInterval(() => this.handlePanKeys(eventWindow), PAN_INTERVAL_MS);
		state.panInterval = this.registerInterval(interval);
		this.log("start-pan", { window: this.describeWindow(eventWindow), interval: state.panInterval });
	}

	public stopPan(eventWindow: Window = this.getWorkspaceWindow(), force = false): void {
		const state = this.windowStates.get(eventWindow);
		if (!state) return;

		const wasRunning = state.panInterval !== undefined;
		if (force || !this.isPanning(state)) {
			if (state.panInterval !== undefined) eventWindow.clearInterval(state.panInterval);
			state.panInterval = undefined;
			state.panStart = null;
			state.debugFirstTickLogged = false;
			if (wasRunning) this.log("stop-pan", { window: this.describeWindow(eventWindow), force });
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

		const before = { tx: canvas.tx, ty: canvas.ty };
		this.pan(dx, dy, canvas);
		if (!state.debugFirstTickLogged) {
			state.debugFirstTickLogged = true;
			const runtimeCanvas = canvas as Canvas & { viewportChanged?: boolean; frame?: number };
			this.log("pan-first-tick", {
				window: this.describeWindow(eventWindow), direction: { dx, dy },
				before, after: { tx: canvas.tx, ty: canvas.ty },
				viewportChanged: runtimeCanvas.viewportChanged, frame: runtimeCanvas.frame,
			});
		}
	}

	public pan(dx: number, dy: number, canvas = this.getActiveCanvas()): void {
		if (!canvas) return;
		panCanvas(canvas, dx, dy);
	}

	public getPanDistance(msPanning = 0, max = 250): number {
		if (msPanning < 1) return 0;
		return Math.min((Math.log10(msPanning) * max) / 3, 250);
	}

	public resetCanvas(): void {
		this.getActiveCanvas()?.panTo(0, 0);
	}

	private getWorkspaceWindow(): Window {
		return this.app.workspace.containerEl.ownerDocument.defaultView ?? window;
	}
}
