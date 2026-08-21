export type CanvasDirection = "north" | "west" | "south" | "east";

export type CanvasKeyBindings = Record<CanvasDirection, string>;

const DIRECTIONS: CanvasDirection[] = ["north", "west", "south", "east"];

export const DEFAULT_KEY_BINDINGS: CanvasKeyBindings = {
	north: "KeyW",
	west: "KeyA",
	south: "KeyS",
	east: "KeyD",
};

export function normalizeKeyBindings(data: Partial<Record<CanvasDirection, unknown>> | null | undefined): {
	keys: CanvasKeyBindings;
	repaired: boolean;
} {
	const rawKeys: Record<CanvasDirection, unknown> = {
		...DEFAULT_KEY_BINDINGS,
		...(data ?? {}),
	};
	const candidateKeys = {} as Record<CanvasDirection, unknown>;

	for (const direction of DIRECTIONS) {
		const key = rawKeys[direction];
		if (typeof key !== "string") {
			candidateKeys[direction] = key;
			continue;
		}
		const normalized = key.trim();
		candidateKeys[direction] = /^[a-z]$/i.test(normalized)
			? `Key${normalized.toUpperCase()}`
			: normalized;
	}

	const keys = DIRECTIONS.map((direction) => {
		const key = candidateKeys[direction];
		return typeof key === "string" ? key.trim() : "";
	});
	const hasInvalidKeys = keys.some((key) => key.length === 0)
		|| new Set(keys.map((key) => key.toLowerCase())).size !== keys.length;

	return {
		keys: hasInvalidKeys ? { ...DEFAULT_KEY_BINDINGS } : candidateKeys as CanvasKeyBindings,
		repaired: hasInvalidKeys,
	};
}
