import assert from "node:assert/strict"
import test from "node:test"
import diagnosticsModule from "../.test-build/diagnostics.js"

const {
	CanvasDiagnostics,
	DEFAULT_DIAGNOSTIC_MAX_ENTRIES,
	captureCanvasCapabilities,
	describeDiagnosticError,
	DiagnosticWindowErrorListeners,
	shouldSamplePanTick,
	runPanIntervalSafely,
} = diagnosticsModule

test("Pan 诊断默认关闭且关闭后释放缓冲", () => {
	const diagnostics = new CanvasDiagnostics("canvas-keyboard-pan", { idFactory: () => "pan-session" })
	diagnostics.record({ event: "keydown", code: "KeyW" })
	assert.equal(diagnostics.snapshot().records.length, 0)
	diagnostics.start()
	diagnostics.record({ event: "guard", accepted: false, reason: "canvas-editing" })
	assert.equal(diagnostics.snapshot().records.length, 1)
	diagnostics.stop()
	assert.equal(diagnostics.snapshot().records.length, 0)
})

test("Pan 诊断环形上限与字段白名单", () => {
	const diagnostics = new CanvasDiagnostics("canvas-keyboard-pan", { maxEntries: 1, idFactory: () => "pan-session" })
	diagnostics.start()
	diagnostics.record({ event: "pan", code: "KeyW", text: "secret", before: { tx: 1, ty: 2, zoom: 0 }, after: { tx: 2, ty: 2, zoom: 0 } })
	diagnostics.record({ event: "pointer", pointerType: "touch", viewType: "canvas", shortcutId: "pan-north", effectObserved: false, key: "secret" })
	const report = diagnostics.snapshot()
	assert.equal(report.records.length, 1)
	assert.equal(report.records[0].event, "pointer")
	assert.equal(report.records[0].pointerType, "touch")
	assert.equal(report.records[0].viewType, "canvas")
	assert.equal(report.records[0].shortcutId, "pan-north")
	assert.equal(report.records[0].effectObserved, false)
	assert.equal(JSON.stringify(report).includes("secret"), false)
})

test("Pan 诊断默认容量保留 1024 条连续记录", () => {
	assert.equal(DEFAULT_DIAGNOSTIC_MAX_ENTRIES, 1024)
	const diagnostics = new CanvasDiagnostics("canvas-keyboard-pan", { idFactory: () => "pan-long" })
	diagnostics.start()
	for (let index = 1; index <= 1100; index++) diagnostics.record({ event: "guard", reason: String(index) })
	const records = diagnostics.snapshot().records
	assert.equal(records.length, 1024)
	assert.equal(records[0].seq, 77)
	assert.equal(records.at(-1).seq, 1100)
})

test("Canvas 能力快照只读取有界原型和视口元数据，不读取正文", () => {
	class BaseCanvas { baseMethod() {} }
	class CanvasRuntime extends BaseCanvas {
		zoomBy(delta, center) { return [delta, center] }
		markViewportChanged() {}
		x = 1
		y = 2
		tx = 3
		ty = 4
		zoom = 0.5
		tZoom = Number.NaN
		text = "secret body"
	}
	const canvas = new CanvasRuntime()
	const snapshot = captureCanvasCapabilities(canvas)
	assert.equal(snapshot.prototypeLayers.length, 3)
	assert.equal(snapshot.constructorName, "CanvasRuntime")
	assert.equal(snapshot.methods.zoomBy.arity, 2)
	assert.equal(snapshot.methods.panBy.exists, false)
	assert.equal(snapshot.viewportFields.tZoom.finite, false)
	assert.equal(snapshot.prototypeLayers[1].propertyDetails.some(property => property.name === "zoomBy" && property.type === "function" && property.arity === 2), true)
	assert.equal(JSON.stringify(snapshot).includes("secret body"), false)
	assert.equal(snapshot.prototypeLayers.length <= 3, true)
	assert.equal(Buffer.byteLength(JSON.stringify(snapshot), "utf8") <= 32 * 1024, true)
})

test("Canvas 能力快照即使面对大量超长属性名也受单条大小硬限制", () => {
	const canvas = {}
	for (let index = 0; index < 600; index++) canvas[`${String(index).padStart(3, "0")}-${"x".repeat(500)}`] = index
	const snapshot = captureCanvasCapabilities(canvas)
	assert.equal(snapshot.truncated, true)
	assert.equal(Buffer.byteLength(JSON.stringify(snapshot), "utf8") <= 32 * 1024, true)
})

test("异常记录会截断、脱敏并限制堆栈", () => {
	const error = new Error("failed at C:\\Users\\ARC\\vault\\home.canvas with /private/secret")
	const described = describeDiagnosticError(error)
	assert.equal(described.exceptionName, "Error")
	assert.equal(described.exceptionMessage.includes("C:\\Users"), false)
	assert.equal(described.exceptionMessage.includes("<path>"), true)
	assert.equal(described.exceptionStack.split("\n").length <= 8, true)
})

test("ErrorEvent 仅提供字符串消息时仍会记录并脱敏", () => {
	const described = describeDiagnosticError("failed at C:\\Users\\ARC\\vault\\home.canvas")
	assert.equal(described.exceptionName, "ErrorEvent")
	assert.equal(described.exceptionMessage.includes("C:\\Users"), false)
	assert.equal(described.exceptionMessage.includes("<path>"), true)
})

test("诊断窗口异常监听在停止时成对释放", () => {
	const listeners = new Map()
	const eventWindow = {
		addEventListener(type, listener) { listeners.set(type, listener) },
		removeEventListener(type, listener) {
			assert.equal(listeners.get(type), listener)
			listeners.delete(type)
		},
	}
	const errors = []
	const manager = new DiagnosticWindowErrorListeners()
	manager.attach(eventWindow, (kind, error) => errors.push([kind, error]))
	assert.equal(manager.size, 1)
	listeners.get("error")({ error: new Error("boom") })
	listeners.get("unhandledrejection")({ reason: "rejected" })
	assert.equal(errors.length, 2)
	manager.clear()
	assert.equal(manager.size, 0)
	assert.equal(listeners.size, 0)
})

test("正常 tick 按 100ms 降采样，首个 tick 保留", () => {
	assert.equal(shouldSamplePanTick(null, 0), true)
	assert.equal(shouldSamplePanTick(0, 99), false)
	assert.equal(shouldSamplePanTick(0, 100), true)
})

test("interval 异常先停止再记录且不向宿主重抛", () => {
	const calls = []
	assert.doesNotThrow(() => runPanIntervalSafely(
		() => { throw new Error("tick failed") },
		() => calls.push("stop"),
		error => calls.push(`record:${error.message}`),
	))
	assert.deepEqual(calls, ["stop", "record:tick failed"])
})
