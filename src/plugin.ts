import { ItemView, Plugin } from "obsidian";

import type { Canvas } from "./types";
import { CanvasKeyboardPanSettingsTab } from "./settings";
import { getCanvasFromEvent, isCanvasEditing, isEditableTarget } from "./canvas-context";
import { KeyboardEventGuard } from "./keyboard-event-guard";
import { xor } from "./util";

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
	keys: {
		[Direction.North]: "w",
		[Direction.West]: "a",
		[Direction.South]: "s",
		[Direction.East]: "d",
	},
	maxSpeed: 250,
};

interface PanWindowState {
	canvas?: Canvas;
	panStart: number | null;
	panInterval?: number;
	keyDown: Record<Direction, boolean>;
}

const PAN_INTERVAL_MS = 10;

export class CanvasKeyboardPan extends Plugin {
	settings: CanvasKeyboardPanSettings = {
		keys: { ...DEFAULT_SETTINGS.keys },
		maxSpeed: DEFAULT_SETTINGS.maxSpeed,
	};

	private readonly windowStates = new Map<Window, PanWindowState>();
	private readonly registeredWindows = new WeakSet<Window>();
	private readonly handledKeyboardEvents = new KeyboardEventGuard();

	async onload() {
		const data = (await this.loadData()) as Partial<CanvasKeyboardPanSettings> | null;
		if (data) {
			this.settings = {
				...DEFAULT_SETTINGS,
				...data,
				keys: { ...DEFAULT_SETTINGS.keys, ...(data.keys ?? {}) },
			};
		}
		this.addSettingTab(new CanvasKeyboardPanSettingsTab(this.app, this));
		this.registerCanvasKeyListeners();

		this.registerEvent(this.app.workspace.on("layout-change", () => this.stopAllPan(true)));
		for (const event of ["active-leaf-change", "file-open", "file-menu", "files-menu"] as const) {
			this.registerEvent(this.app.workspace.on(event as never, () => this.stopAllPan(true)));
		}
	}

	onunload(): void {
		this.stopAllPan(true);
		this.windowStates.clear();
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
			if (!eventWindow || this.registeredWindows.has(eventWindow)) return;

			this.registeredWindows.add(eventWindow);
			const state = this.createWindowState();
			this.windowStates.set(eventWindow, state);

			this.registerDomEvent(eventWindow, "keydown", (event: KeyboardEvent) => {
				if (event.repeat || event.isComposing || isEditableTarget(event.target)) return;

				const canvas = getCanvasFromEvent(this.app, event);
				if (!canvas || isCanvasEditing(canvas) || !this.handledKeyboardEvents.consume(event)) return;

				const direction = this.getDirectionForKey(event.key);
				if (!direction) return;

				state.canvas = canvas;
				state.keyDown[direction] = true;
				state.keyDown[this.getOppositeDirection(direction)] = false;
				this.startPan(eventWindow);
				event.preventDefault();
			});

			this.registerDomEvent(eventWindow, "keyup", (event: KeyboardEvent) => {
				if (!this.handledKeyboardEvents.consume(event)) return;

				const direction = this.getDirectionForKey(event.key);
				if (!direction) return;
				state.keyDown[direction] = false;
				this.stopPan(eventWindow);
			});

			const clearWindowState = () => this.clearWindowState(eventWindow);
			this.registerDomEvent(eventWindow, "blur", clearWindowState);
			this.registerDomEvent(eventWindow.document, "visibilitychange", () => {
				if (eventWindow.document.visibilityState !== "visible") clearWindowState();
			});
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
			this.clearWindowState(eventWindow);
		}));
	}

	private getDirectionForKey(key: string): Direction | undefined {
		for (const direction of Object.values(Direction)) {
			if (this.settings.keys[direction] === key) return direction;
		}
		return undefined;
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

	private clearWindowState(eventWindow: Window): void {
		const state = this.windowStates.get(eventWindow);
		if (!state) return;
		this.stopPan(eventWindow, true);
		this.windowStates.delete(eventWindow);
	}

	private stopAllPan(force = false): void {
		for (const eventWindow of this.windowStates.keys()) this.stopPan(eventWindow, force);
	}

	public startPan(eventWindow: Window = this.getWorkspaceWindow()): void {
		const state = this.windowStates.get(eventWindow);
		if (!state || state.panInterval !== undefined) return;

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
		const zoom = (canvas.zoom ?? -4) + 5;
		canvas.tx += dx / zoom;
		canvas.ty += dy / zoom;
		if (isNaN(canvas.tx)) canvas.tx = 0;
		if (isNaN(canvas.ty)) canvas.ty = 0;
		canvas.markViewportChanged();
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
