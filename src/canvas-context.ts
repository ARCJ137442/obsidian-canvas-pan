import type { App } from "obsidian";
import type { Canvas } from "./types";
import type { CanvasPointerLeaseReason, CanvasPointerLeaseRegistry } from "./canvas-pointer-lease";

type CanvasViewLike = {
	getViewType?: () => string;
	canvas?: Canvas;
	containerEl?: HTMLElement;
};

/** Resolve the Canvas that owns the keyboard event's DOM tree. */
export function getCanvasFromEvent(app: App, event: Event, eventWindow?: Window): Canvas | undefined {
	const targets = getEventTargets(event);
	const candidates: Array<{ canvas: Canvas; container: HTMLElement; view: CanvasViewLike }> = [];
	let directCanvas: Canvas | undefined;

	app.workspace.iterateAllLeaves((leaf) => {
		const view = leaf.view as CanvasViewLike | null;
		if (!view || view.getViewType?.() !== "canvas" || !view.canvas || !view.containerEl) return;
		candidates.push({ canvas: view.canvas, container: view.containerEl, view });
		if (targets.some((target) => isInsideContainer(view.containerEl!, target))) {
			directCanvas = view.canvas;
		}
	});

	if (directCanvas) return directCanvas;
	if (!eventWindow) return undefined;

	// A keyboard event from a note, modal, menu, or another application surface
	// must not be guessed as belonging to the only Canvas in the window. The
	// fallback below is only safe for Window/Document-level events, where there
	// is no concrete element target to disambiguate.
	if (targets.some((target) => isElementTarget(target)
		&& !candidates.some((candidate) => isInsideContainer(candidate.container, target)))) {
		return undefined;
	}

	const windowCandidates = candidates.filter(candidate => candidate.container.ownerDocument.defaultView === eventWindow);
	if (windowCandidates.length === 1) return windowCandidates[0].canvas;

	const activeElement = eventWindow.document.activeElement;
	const activeCandidate = windowCandidates.find(candidate => isInsideContainer(candidate.container, activeElement));
	if (activeCandidate) return activeCandidate.canvas;

	const activeLeafView = app.workspace.activeLeaf?.view as CanvasViewLike | null | undefined;
	const activeLeafCandidate = windowCandidates.find(candidate => candidate.view === activeLeafView);
	return activeLeafCandidate?.canvas;
}

export type CanvasContextResolution = {
	canvas?: Canvas;
	source: "event-dom" | "pointer-lease" | "none";
	leaseReason?: CanvasPointerLeaseReason;
};

export function resolveCanvasFromEvent(
	app: App,
	event: Event,
	eventWindow: Window,
	leases: CanvasPointerLeaseRegistry<Canvas>,
): CanvasContextResolution {
	const direct = getCanvasFromEvent(app, event, eventWindow);
	if (direct) return { canvas: direct, source: "event-dom" };
	const leased = leases.resolve(event, eventWindow, {
		blocked: hasBlockingCanvasOverlay(eventWindow.document),
		isCanvasAvailable: canvas => isCanvasAvailableInWindow(app, canvas, eventWindow),
	});
	return leased.canvas
		? { canvas: leased.canvas, source: "pointer-lease", leaseReason: leased.reason }
		: { source: "none", leaseReason: leased.reason };
}

export function updateCanvasPointerLeaseFromEvent(
	app: App,
	event: Event,
	eventWindow: Window,
	leases: CanvasPointerLeaseRegistry<Canvas>,
): CanvasContextResolution {
	const direct = getCanvasFromEvent(app, event, eventWindow);
	if (direct) {
		leases.remember(eventWindow, direct);
		return { canvas: direct, source: "event-dom", leaseReason: "lease-hit" };
	}
	leases.clear(eventWindow);
	return { source: "none", leaseReason: "lease-non-shell-target" };
}

function isCanvasAvailableInWindow(app: App, canvas: Canvas, eventWindow: Window): boolean {
	let available = false;
	app.workspace.iterateAllLeaves((leaf) => {
		if (available) return;
		const view = leaf.view as (typeof leaf.view & { canvas?: Canvas; containerEl?: HTMLElement }) | null;
		if (view?.canvas === canvas && view.containerEl?.ownerDocument.defaultView === eventWindow) available = true;
	});
	return available;
}

function hasBlockingCanvasOverlay(document: Document): boolean {
	try { return Boolean(document.querySelector?.(".modal-container, .prompt")); } catch { return true; }
}

function isElementTarget(target: unknown): target is Element {
	return Boolean(target && (target as { nodeType?: number }).nodeType === 1);
}

function getEventTargets(event: Event): unknown[] {
	const path = typeof event.composedPath === "function" ? event.composedPath() : [];
	return [event.target, ...path];
}

function isInsideContainer(container: HTMLElement, target: unknown): boolean {
	if (!target || target === container) return target === container;

	const rootDocument = container.ownerDocument;
	const targetDocument = (target as { ownerDocument?: Document }).ownerDocument;
	if (rootDocument && targetDocument && rootDocument !== targetDocument) return false;

	try {
		return container.contains(target as Node);
	} catch {
		return false;
	}
}

/** Do not steal keys from text inputs, editors, or other editable controls. */
export function isEditableTarget(target: EventTarget | null): boolean {
	let current = target as (Element & {
		isContentEditable?: boolean;
		parentElement?: Element | null;
		parentNode?: Node | null;
	}) | null;

	for (let depth = 0; current && depth < 32; depth++) {
		const tagName = current.tagName?.toLowerCase();
		if (["input", "textarea", "select", "option"].includes(tagName)) return true;
		if (current.getAttribute?.("role")?.toLowerCase() === "textbox") return true;
		if (current.isContentEditable) return true;

		const contentEditable = current.getAttribute?.("contenteditable")?.toLowerCase();
		if (["", "true", "plaintext-only"].includes(contentEditable ?? "false")) return true;

		current = current.parentElement ?? (current.parentNode as Element | null) ?? null;
	}

	return false;
}

/** Canvas text editing must keep ownership of its keyboard input. */
export function isCanvasEditing(canvas: Canvas): boolean {
	for (const element of canvas.selection ?? []) {
		if ((element as { isEditing?: boolean }).isEditing) return true;
	}
	return false;
}
