export interface KeyboardModifierState {
	altKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	code?: string;
	key?: string;
}

const MODIFIER_CODES = new Set([
	"AltLeft", "AltRight",
	"ControlLeft", "ControlRight",
	"MetaLeft", "MetaRight",
	"ShiftLeft", "ShiftRight",
]);

const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);

/**
 * A modifier key cancels panning, and a key pressed while a modifier is held
 * must remain available to Obsidian's native shortcuts.
 */
export function hasKeyboardModifier(event: KeyboardModifierState): boolean {
	return Boolean(
		event.altKey
		|| event.ctrlKey
		|| event.metaKey
		|| event.shiftKey
		|| (event.code && MODIFIER_CODES.has(event.code))
		|| (event.key && MODIFIER_KEYS.has(event.key))
	);
}
