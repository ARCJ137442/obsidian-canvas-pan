/** Shared wire shape for on-demand Canvas keyboard/pan diagnostics. */
export const DIAGNOSTIC_SCHEMA_VERSION = 1
export const DEFAULT_DIAGNOSTIC_MAX_ENTRIES = 1024

export type DiagnosticElement = {
	elementType?: string
	role?: string
	contenteditable?: boolean
}

export type DiagnosticRecord = {
	schemaVersion: number
	sessionId: string
	pluginId: string
	timestampMs: number
	seq: number
	event: string
	[key: string]: unknown
}

export type DiagnosticReport = {
	schemaVersion: number
	sessionId: string
	pluginId: string
	records: DiagnosticRecord[]
}

export type DiagnosticInput = {
	event: string
	code?: string
	pointerType?: string
	vaultName?: string
	canvasPath?: string
	viewType?: string
	nodeId?: string
	selectionCount?: number
	isEditing?: boolean
	windowId?: string
	documentId?: string
	target?: DiagnosticElement
	activeElement?: DiagnosticElement
	accepted?: boolean
	shortcutId?: string
	effectObserved?: boolean
	reason?: string
	phase?: string
	contextSource?: string
	leaseReason?: string
	pluginVersion?: string
	diagnosticRevision?: string
	before?: { x?: number; y?: number; tx?: number; ty?: number; zoom?: number; tZoom?: number }
	after?: { x?: number; y?: number; tx?: number; ty?: number; zoom?: number; tZoom?: number }
	callPath?: string
	exception?: string
	redrawRequested?: boolean
	strategy?: string
	tick?: number
	durationMs?: number
	tickCount?: number
	sampledTickCount?: number
	errorKind?: string
	exceptionName?: string
	exceptionMessage?: string
	exceptionStack?: string
	platform?: DiagnosticPlatformSnapshot
	apiVersion?: string
	canvasCapabilities?: CanvasCapabilitiesSnapshot
}

export type DiagnosticPlatformSnapshot = {
	apiVersion?: string
	isMobile?: boolean
	isDesktop?: boolean
	isAndroid?: boolean
	isIos?: boolean
}

export type CanvasCapabilitiesSnapshot = {
	constructorName?: string
	prototypeLayers: Array<{
		constructorName?: string
		properties: string[]
		propertyDetails: Array<{
			name: string
			kind: "value" | "accessor"
			type?: string
			arity?: number
		}>
	}>
	methods: Record<string, { exists: boolean; type?: string; arity?: number }>
	viewportFields: Record<string, { type: string; finite?: boolean }>
	truncated?: boolean
}

type DiagnosticOptions = {
	maxEntries?: number
	now?: () => number
	idFactory?: () => string
}

const windowIds = new WeakMap<object, string>()
const documentIds = new WeakMap<object, string>()
let nextWindowId = 1
let nextDocumentId = 1

export function describeDiagnosticElement(value: unknown): DiagnosticElement | undefined {
	if (!value || typeof value !== "object") return undefined
	const element = value as {
		tagName?: unknown
		getAttribute?: (name: string) => string | null
		isContentEditable?: unknown
	}
	const elementType = typeof element.tagName === "string" ? element.tagName.toUpperCase() : undefined
	const roleValue = element.getAttribute?.("role")
	const contentEditableValue = element.getAttribute?.("contenteditable")
	const contenteditable = typeof element.isContentEditable === "boolean"
		? element.isContentEditable
		: contentEditableValue === "" || contentEditableValue?.toLowerCase() === "true" || contentEditableValue?.toLowerCase() === "plaintext-only"
	if (!elementType && !roleValue && contentEditableValue === null && contenteditable === undefined) return undefined
	return {
		...(elementType ? { elementType } : {}),
		...(roleValue ? { role: roleValue.toLowerCase() } : {}),
		...(contenteditable !== undefined ? { contenteditable } : {}),
	}
}

export function getDiagnosticWindowIds(eventWindow: Window | null | undefined): { windowId?: string; documentId?: string } {
	if (!eventWindow || typeof eventWindow !== "object") return {}
	const windowObject = eventWindow as unknown as object
	let windowId = windowIds.get(windowObject)
	if (!windowId) {
		windowId = `window-${nextWindowId++}`
		windowIds.set(windowObject, windowId)
	}
	const documentObject = eventWindow.document as unknown as object | undefined
	if (!documentObject) return { windowId }
	let documentId = documentIds.get(documentObject)
	if (!documentId) {
		documentId = `document-${nextDocumentId++}`
		documentIds.set(documentObject, documentId)
	}
	return { windowId, documentId }
}

const VIEWPORT_METHOD_NAMES = ["zoomBy", "panBy", "panTo", "setViewport", "markViewportChanged", "requestFrame", "getViewportBBox"] as const
const VIEWPORT_FIELD_NAMES = ["x", "y", "tx", "ty", "zoom", "tZoom"] as const
const MAX_PROTOTYPE_LAYERS = 3
const MAX_PROPERTIES_PER_LAYER = 200
const MAX_PROPERTY_NAME_LENGTH = 120
const MAX_CAPABILITY_JSON_BYTES = 32 * 1024
const MAX_ERROR_MESSAGE_LENGTH = 240
const MAX_ERROR_STACK_LINES = 8
export const PAN_DIAGNOSTIC_SAMPLE_INTERVAL_MS = 100

function safeType(value: unknown): string {
	if (value === null) return "null"
	if (Array.isArray(value)) return "array"
	return typeof value
}

function findDescriptor(target: object, property: string): PropertyDescriptor | undefined {
	let current: object | null = target
	for (let depth = 0; current && depth < MAX_PROTOTYPE_LAYERS + 1; depth++) {
		const descriptor = Object.getOwnPropertyDescriptor(current, property)
		if (descriptor) return descriptor
		current = Object.getPrototypeOf(current)
	}
	return undefined
}

function readSafe(target: object, property: string): unknown {
	try { return (target as Record<string, unknown>)[property] } catch { return undefined }
}

function truncatePropertyName(name: string): string {
	return name.length > MAX_PROPERTY_NAME_LENGTH ? `${name.slice(0, MAX_PROPERTY_NAME_LENGTH - 1)}…` : name
}

function findConstructorName(target: object): string | undefined {
	let current: object | null = target
	for (let depth = 0; current && depth < MAX_PROTOTYPE_LAYERS + 1; depth++) {
		try {
			const constructorValue = Object.getOwnPropertyDescriptor(current, "constructor")?.value
			if (typeof constructorValue === "function" && constructorValue.name) return truncatePropertyName(constructorValue.name)
			current = Object.getPrototypeOf(current)
		} catch {
			return undefined
		}
	}
	return undefined
}

function utf8ByteLength(value: string): number {
	let bytes = 0
	for (let index = 0; index < value.length; index++) {
		const code = value.charCodeAt(index)
		if (code <= 0x7f) bytes += 1
		else if (code <= 0x7ff) bytes += 2
		else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
			bytes += 4
			index += 1
		} else bytes += 3
	}
	return bytes
}

function fitCapabilitySnapshot(snapshot: CanvasCapabilitiesSnapshot): CanvasCapabilitiesSnapshot {
	let serializedBytes = utf8ByteLength(JSON.stringify(snapshot))
	if (serializedBytes <= MAX_CAPABILITY_JSON_BYTES) return snapshot

	snapshot.truncated = true
	while (serializedBytes > MAX_CAPABILITY_JSON_BYTES) {
		const layer = snapshot.prototypeLayers.reduce<(typeof snapshot.prototypeLayers)[number] | undefined>(
			(longest, candidate) => !longest || candidate.propertyDetails.length > longest.propertyDetails.length ? candidate : longest,
			undefined,
		)
		if (!layer?.propertyDetails.length) break
		layer.propertyDetails.pop()
		layer.properties.pop()
		serializedBytes = utf8ByteLength(JSON.stringify(snapshot))
	}
	return snapshot
}

/**
 * Bounded Canvas introspection for a manually-started diagnostic session.
 * Never serializes the Canvas object: it may contain cycles, DOM references,
 * node bodies and large collections. Only descriptors and scalar viewport
 * field metadata are retained.
 */
export function captureCanvasCapabilities(canvas: unknown): CanvasCapabilitiesSnapshot {
	const target = canvas && typeof canvas === "object" ? canvas as object : {}
	const prototypeLayers: CanvasCapabilitiesSnapshot["prototypeLayers"] = []
	let current: object | null = target
	for (let depth = 0; current && depth < MAX_PROTOTYPE_LAYERS; depth++) {
		let names: string[] = []
		try { names = Object.getOwnPropertyNames(current).sort().slice(0, MAX_PROPERTIES_PER_LAYER) } catch { /* bounded best-effort introspection */ }
		const propertyDetails = names.map(name => {
			let descriptor: PropertyDescriptor | undefined
			try { descriptor = Object.getOwnPropertyDescriptor(current as object, name) } catch { /* descriptor remains unavailable */ }
			const value = descriptor?.value
			return {
				name: truncatePropertyName(name),
				kind: descriptor?.get || descriptor?.set ? "accessor" as const : "value" as const,
				...(descriptor && !descriptor.get && !descriptor.set ? { type: safeType(value) } : {}),
				...(typeof value === "function" && Number.isFinite(value.length) ? { arity: value.length } : {}),
			}
		})
		let constructorName: string | undefined
		try {
			const constructorValue = Object.getOwnPropertyDescriptor(current, "constructor")?.value
			constructorName = typeof constructorValue === "function" && constructorValue.name
				? truncatePropertyName(constructorValue.name)
				: undefined
		} catch { /* constructor stays unknown */ }
		prototypeLayers.push({
			...(constructorName ? { constructorName } : {}),
			properties: propertyDetails.map(property => property.name),
			propertyDetails,
		})
		try { current = Object.getPrototypeOf(current) } catch { current = null }
	}

	const methods: CanvasCapabilitiesSnapshot["methods"] = {}
	for (const name of VIEWPORT_METHOD_NAMES) {
		const descriptor = findDescriptor(target, name)
		const value = descriptor?.value
		methods[name] = {
			exists: descriptor !== undefined,
			...(descriptor ? { type: descriptor.get || descriptor.set ? "accessor" : safeType(value) } : {}),
			...(typeof value === "function" && Number.isFinite(value.length) ? { arity: value.length } : {}),
		}
	}

	const viewportFields: CanvasCapabilitiesSnapshot["viewportFields"] = {}
	for (const name of VIEWPORT_FIELD_NAMES) {
		const value = readSafe(target, name)
		viewportFields[name] = {
			type: safeType(value),
			...(typeof value === "number" ? { finite: Number.isFinite(value) } : {}),
		}
	}
	const constructorName = findConstructorName(target)
	return fitCapabilitySnapshot({
		...(constructorName ? { constructorName } : {}),
		prototypeLayers,
		methods,
		viewportFields,
	})
}

function sanitizeErrorText(value: unknown, maxLength = MAX_ERROR_MESSAGE_LENGTH): string | undefined {
	if (typeof value !== "string" || !value) return undefined
	const sanitized = value
		.replace(/file:\/\/[^\s)]+/gi, "<path>")
		.replace(/[A-Za-z]:\\[^\s)]+/g, "<path>")
		.replace(/(?:^|\s)\/[^\s)]+/g, " <path>")
		.replace(/\s+/g, " ")
		.trim()
	return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength - 1)}…` : sanitized
}

export function describeDiagnosticError(error: unknown): {
	exceptionName: string
	exceptionMessage?: string
	exceptionStack?: string
} {
	if (typeof error === "string") {
		const exceptionMessage = sanitizeErrorText(error)
		return {
			exceptionName: "ErrorEvent",
			...(exceptionMessage ? { exceptionMessage } : {}),
		}
	}
	const value = error as { name?: unknown; message?: unknown; stack?: unknown } | null
	const exceptionName = typeof value?.name === "string" && value.name ? sanitizeErrorText(value.name, 80) ?? "Error" : "unknown"
	const exceptionMessage = sanitizeErrorText(value?.message ?? (error === null || error === undefined ? undefined : String(error)))
	const stackLines = typeof value?.stack === "string" ? value.stack.split(/\r?\n/).slice(0, MAX_ERROR_STACK_LINES).map(line => sanitizeErrorText(line, 240)).filter(Boolean) : []
	return {
		exceptionName,
		...(exceptionMessage ? { exceptionMessage } : {}),
		...(stackLines.length ? { exceptionStack: stackLines.join("\n") } : {}),
	}
}

export type DiagnosticWindowEventTarget = {
	addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
	removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
}

/** Owns temporary error listeners so a diagnostic session cannot leak them. */
export class DiagnosticWindowErrorListeners {
	private readonly cleanups = new Map<DiagnosticWindowEventTarget, () => void>()

	attach(eventWindow: DiagnosticWindowEventTarget, onError: (kind: string, error: unknown) => void): void {
		if (this.cleanups.has(eventWindow)) return
		const onWindowError = (event: Event): void => {
			const value = event as ErrorEvent & { error?: unknown }
			onError("error", value.error ?? value.message)
		}
		const onUnhandledRejection = (event: Event): void => {
			const value = event as PromiseRejectionEvent
			onError("unhandledrejection", value.reason)
		}
		eventWindow.addEventListener("error", onWindowError)
		eventWindow.addEventListener("unhandledrejection", onUnhandledRejection)
		this.cleanups.set(eventWindow, () => {
			eventWindow.removeEventListener("error", onWindowError)
			eventWindow.removeEventListener("unhandledrejection", onUnhandledRejection)
		})
	}

	detach(eventWindow: DiagnosticWindowEventTarget): void {
		this.cleanups.get(eventWindow)?.()
		this.cleanups.delete(eventWindow)
	}

	clear(): void {
		for (const eventWindow of this.cleanups.keys()) this.detach(eventWindow)
	}

	get size(): number { return this.cleanups.size }
}

export function shouldSamplePanTick(lastSampleAt: number | null, now: number, intervalMs = PAN_DIAGNOSTIC_SAMPLE_INTERVAL_MS): boolean {
	return lastSampleAt === null || now - lastSampleAt >= intervalMs
}

/** Timer boundary used by the plugin; an interval exception is never rethrown. */
export function runPanIntervalSafely(run: () => void, stop: () => void, record: (error: unknown) => void): void {
	try {
		run()
	} catch (error) {
		let stopError: unknown
		try { stop() } catch (cleanupError) { stopError = cleanupError }
		record(error)
		if (stopError !== undefined) record(stopError)
	}
}

function createSessionId(pluginId: string): string {
	try {
		const cryptoObject = globalThis.crypto
		if (cryptoObject?.getRandomValues) {
			const values = new Uint32Array(2)
			cryptoObject.getRandomValues(values)
			return `${pluginId}-${Date.now().toString(36)}-${values[0].toString(36)}${values[1].toString(36)}`
		}
	} catch {
		// Fall through to a browser-compatible fallback.
	}
	return `${pluginId}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000).toString(36)}`
}

export class CanvasDiagnostics {
	private readonly maxEntries: number
	private readonly now: () => number
	private readonly idFactory: () => string
	private records: DiagnosticRecord[] = []
	private currentSessionId = ""
	private active = false

	constructor(private readonly pluginId: string, options: DiagnosticOptions = {}) {
		this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_DIAGNOSTIC_MAX_ENTRIES))
		this.now = options.now ?? (() => Date.now())
		this.idFactory = options.idFactory ?? (() => createSessionId(pluginId))
	}

	get enabled(): boolean {
		return this.active
	}

	get sessionId(): string {
		return this.currentSessionId
	}

	start(sessionId?: string): string {
		this.records = []
		this.currentSessionId = sessionId || this.idFactory()
		this.active = true
		return this.currentSessionId
	}

	stop(): DiagnosticReport {
		const report = this.snapshot()
		this.active = false
		this.records = []
		this.currentSessionId = ""
		return report
	}

	snapshot(): DiagnosticReport {
		return {
			schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
			sessionId: this.currentSessionId,
			pluginId: this.pluginId,
			records: this.records.map(record => ({ ...record })),
		}
	}

	record(input: DiagnosticInput): void {
		if (!this.active) return
		const record: DiagnosticRecord = {
			schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
			sessionId: this.currentSessionId,
			pluginId: this.pluginId,
			timestampMs: this.now(),
			seq: this.records.length ? this.records[this.records.length - 1].seq + 1 : 1,
			event: input.event,
		}
		const keys: Array<keyof DiagnosticInput> = [
			"code", "pointerType", "vaultName", "canvasPath", "viewType", "nodeId", "selectionCount", "isEditing",
			"windowId", "documentId", "target", "activeElement", "accepted", "shortcutId", "effectObserved", "reason",
			"phase", "contextSource", "leaseReason", "pluginVersion", "diagnosticRevision",
			"before", "after", "callPath", "exception", "redrawRequested",
			"strategy", "tick", "durationMs", "tickCount", "sampledTickCount", "errorKind", "exceptionName", "exceptionMessage", "exceptionStack", "platform", "apiVersion", "canvasCapabilities",
		]
		for (const key of keys) {
			const value = input[key]
			if (value !== undefined) (record as Record<string, unknown>)[key] = value
		}
		this.records.push(record)
		if (this.records.length > this.maxEntries) this.records.shift()
	}
}
