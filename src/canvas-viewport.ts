import type { Canvas } from "./types";

/** Apply a viewport delta and schedule the Canvas renderer for the same frame. */
export type PanViewportResult = {
	tx: number;
	ty: number;
	zoom: number;
	redrawRequested: boolean;
}

export function panCanvas(canvas: Canvas, dx: number, dy: number): PanViewportResult {
	const zoom = (canvas.zoom ?? -4) + 5;
	canvas.tx += dx / zoom;
	canvas.ty += dy / zoom;
	if (!Number.isFinite(canvas.tx)) canvas.tx = 0;
	if (!Number.isFinite(canvas.ty)) canvas.ty = 0;
	canvas.markViewportChanged();
	canvas.requestFrame?.();
	return { tx: canvas.tx, ty: canvas.ty, zoom: canvas.zoom, redrawRequested: typeof canvas.requestFrame === "function" };
}
