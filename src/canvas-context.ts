import type { App } from "obsidian";
import type { Canvas } from "./types";

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

	const windowCandidates = candidates.filter(candidate => candidate.container.ownerDocument.defaultView === eventWindow);
	if (windowCandidates.length === 1) return windowCandidates[0].canvas;

	const activeElement = eventWindow.document.activeElement;
	const activeCandidate = windowCandidates.find(candidate => isInsideContainer(candidate.container, activeElement));
	if (activeCandidate) return activeCandidate.canvas;

	const activeLeafView = app.workspace.activeLeaf?.view as CanvasViewLike | null | undefined;
	const activeLeafCandidate = windowCandidates.find(candidate => candidate.view === activeLeafView);
	return activeLeafCandidate?.canvas;
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
