/**
 * Prevent one physical KeyboardEvent from being consumed twice if a host
 * window forwards it through more than one listener path.
 */
export class KeyboardEventGuard {
	private readonly consumed = new WeakSet<object>();

	public consume(event: object): boolean {
		if (this.consumed.has(event)) return false;
		this.consumed.add(event);
		return true;
	}
}
