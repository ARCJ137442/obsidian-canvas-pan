import type { Canvas } from "./types";

/** Apply a viewport delta and schedule the Canvas renderer for the same frame. */
export function panCanvas(canvas: Canvas, dx: number, dy: number): void {
	const zoom = (canvas.zoom ?? -4) + 5;
	canvas.tx += dx / zoom;
	canvas.ty += dy / zoom;
	if (isNaN(canvas.tx)) canvas.tx = 0;
	if (isNaN(canvas.ty)) canvas.ty = 0;
	canvas.markViewportChanged();
	canvas.requestFrame?.();
}
