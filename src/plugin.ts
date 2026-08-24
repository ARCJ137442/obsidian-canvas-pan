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
}

type WindowCleanup = () => void;
type WindowWithPanCleanup = Window & {
	__obsidianCanvasKeyboardPanCleanup?: WindowCleanup;
};

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
				return;
			}

			const windowWithCleanup = eventWindow as WindowWithPanCleanup;
			windowWithCleanup.__obsidianCanvasKeyboardPanCleanup?.();

			const state = this.createWindowState();
			this.windowStates.set(eventWindow, state);

			const onKeyDown = (event: KeyboardEvent): void => {
				if (hasKeyboardModifier(event)) {
					this.stopPan(eventWindow, true);
					return;
				}
				if (event.repeat || event.isComposing || isEditableTarget(event.target)) {
					return;
				}

				const canvas = getCanvasFromEvent(this.app, event, eventWindow);
				if (!canvas) {
					return;
				}
				if (isCanvasEditing(canvas)) {
					return;
				}
				if (!this.handledKeyboardEvents.consume(event)) {
					return;
				}

				const direction = this.getDirectionForEvent(event);
				if (!direction) {
					return;
				}

				state.canvas = canvas;
				state.keyDown[direction] = true;
				state.keyDown[this.getOppositeDirection(direction)] = false;
				this.startPan(eventWindow);
				event.preventDefault();
		};

			const onKeyUp = (event: KeyboardEvent): void => {
				if (hasKeyboardModifier(event)) {
					this.stopPan(eventWindow, true);
					return;
				}
				if (!this.handledKeyboardEvents.consume(event)) {
					return;
				}

				const direction = this.getDirectionForEvent(event);
				if (!direction) {
					return;
				}
				state.keyDown[direction] = false;
				this.stopPan(eventWindow);
		};

			const clearWindowState = (): void => {
				this.resetWindowState(eventWindow);
			};
			const onBlur = (): void => clearWindowState();
			const onVisibilityChange = (): void => {
				if (eventWindow.document.visibilityState !== "visible") clearWindowState();
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
		const interval = eventWindow.setInterval(() => this.handlePanKeys(eventWindow), PAN_INTERVAL_MS);
		state.panInterval = this.registerInterval(interval);
	}

	public stopPan(eventWindow: Window = this.getWorkspaceWindow(), force = false): void {
		const state = this.windowStates.get(eventWindow);
		if (!state) return;

		if (force || !this.isPanning(state)) {
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

		this.pan(dx, dy, canvas);
	}

	public pan(dx: number, dy: number, canvas = this.getActiveCanvas()): void {
		if (!canvas) return;
		panCanvas(canvas, dx, dy);
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
