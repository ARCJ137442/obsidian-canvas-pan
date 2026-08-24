export const MIN_PAN_SPEED = 50;
export const MAX_PAN_SPEED = 500;
export const DEFAULT_PAN_SPEED = 250;

export function normalizePanSpeed(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_PAN_SPEED;
	return Math.min(MAX_PAN_SPEED, Math.max(MIN_PAN_SPEED, value));
}

export function getPanDistance(msPanning = 0, max = DEFAULT_PAN_SPEED): number {
	if (msPanning < 1) return 0;
	const safeMax = normalizePanSpeed(max);
	return Math.min((Math.log10(msPanning) * safeMax) / 3, safeMax);
}
