import assert from "node:assert/strict"
import test from "node:test"
import context from "../.test-build/canvas-context.js"
import guardModule from "../.test-build/keyboard-event-guard.js"
import modifierModule from "../.test-build/keyboard-modifiers.js"
import registryModule from "../.test-build/window-registration.js"
import keyBindingsModule from "../.test-build/key-bindings.js"
import viewportModule from "../.test-build/canvas-viewport.js"
import util from "../.test-build/util.js"
import panSpeed from "../.test-build/pan-speed.js"
import leaseModule from "../.test-build/canvas-pointer-lease.js"

const { getCanvasFromEvent, isCanvasEditing, isEditableTarget, resolveCanvasFromEvent, updateCanvasPointerLeaseFromEvent } = context
const { CanvasPointerLeaseRegistry } = leaseModule
const { KeyboardEventGuard } = guardModule
const { hasKeyboardModifier } = modifierModule
const { WindowRegistrationRegistry } = registryModule
const { DEFAULT_KEY_BINDINGS, normalizeKeyBindings } = keyBindingsModule
const { panCanvas } = viewportModule
const { xor } = util
const { getPanDistance, normalizePanSpeed } = panSpeed

test("从事件所在的 Canvas DOM 解析上下文，而不是猜 active view", () => {
	const documentA = {}
	const documentB = {}
	const targetA = { ownerDocument: documentA }
	const targetB = { ownerDocument: documentB }
	const rootA = { ownerDocument: documentA, contains: target => target === targetA }
	const rootB = { ownerDocument: documentB, contains: target => target === targetB }
	const canvasA = { name: "A" }
	const canvasB = { name: "B" }
	const view = (root, canvas) => ({
		containerEl: root,
		canvas,
		getViewType: () => "canvas",
	})
	const app = {
		workspace: {
			iterateAllLeaves(callback) {
				callback({ view: view(rootA, canvasA) })
				callback({ view: view(rootB, canvasB) })
			},
		},
	}

	assert.equal(getCanvasFromEvent(app, { target: targetA, composedPath: () => [targetA] }), canvasA)
	assert.equal(getCanvasFromEvent(app, { target: targetB, composedPath: () => [targetB] }), canvasB)
	assert.equal(getCanvasFromEvent(app, { target: { ownerDocument: documentB }, composedPath: () => [] }), undefined)
})

test("窗口级键盘事件只回退到同一窗口的唯一 Canvas", () => {
	const windowA = {}
	const windowB = {}
	const documentA = { defaultView: windowA, activeElement: null }
	const documentB = { defaultView: windowB, activeElement: null }
	const rootA = { ownerDocument: documentA, contains: () => false }
	const rootB = { ownerDocument: documentB, contains: () => false }
	const canvasA = { name: "A" }
	const canvasB = { name: "B" }
	const view = (root, canvas) => ({
		containerEl: root,
		canvas,
		getViewType: () => "canvas",
	})
	const app = {
		workspace: {
			iterateAllLeaves(callback) {
				callback({ view: view(rootA, canvasA) })
				callback({ view: view(rootB, canvasB) })
			},
		},
	}
	const event = { target: documentA, composedPath: () => [documentA] }

	assert.equal(getCanvasFromEvent(app, event, windowA), canvasA)
	assert.equal(getCanvasFromEvent(app, event, windowB), canvasB)
	assert.equal(getCanvasFromEvent(app, event), undefined)
})

test("具体元素在 Canvas 外部时不回退到同窗口的唯一 Canvas", () => {
	const documentA = {}
	const windowA = { document: documentA }
	documentA.defaultView = windowA
	const canvasRoot = { ownerDocument: documentA, contains: target => target === canvasRoot }
	const outsideTarget = { ownerDocument: documentA, nodeType: 1 }
	const canvas = { name: "A" }
	const app = {
		workspace: {
			iterateAllLeaves(callback) {
				callback({ view: { containerEl: canvasRoot, canvas, getViewType: () => "canvas" } })
			},
		},
	}

	assert.equal(getCanvasFromEvent(app, { target: outsideTarget, composedPath: () => [outsideTarget] }, windowA), undefined)
	assert.equal(getCanvasFromEvent(app, { target: canvasRoot, composedPath: () => [canvasRoot] }, windowA), canvas)
})

test("BODY 与 HTML 即使位于活动 Canvas 窗口也不回退", () => {
	const windowA = {}
	const body = { nodeType: 1, tagName: "BODY" }
	const html = { nodeType: 1, tagName: "HTML" }
	const documentA = { defaultView: windowA, activeElement: body }
	body.ownerDocument = documentA
	html.ownerDocument = documentA
	windowA.document = documentA
	const canvasRoot = { ownerDocument: documentA, contains: () => false }
	const canvas = { name: "A" }
	const canvasView = { containerEl: canvasRoot, canvas, getViewType: () => "canvas" }
	const app = {
		workspace: {
			activeLeaf: { view: canvasView },
			iterateAllLeaves(callback) { callback({ view: canvasView }) },
		},
	}

	assert.equal(getCanvasFromEvent(app, { target: body, composedPath: () => [body, html] }, windowA), undefined)
	assert.equal(getCanvasFromEvent(app, { target: html, composedPath: () => [html] }, windowA), undefined)
})

test("Pan 仅凭同窗口 Canvas 指针租约恢复 BODY/HTML 键盘上下文", () => {
	const body = { nodeType: 1, tagName: "BODY" }
	const html = { nodeType: 1, tagName: "HTML" }
	const canvasTarget = { nodeType: 1, tagName: "DIV" }
	const documentA = { activeElement: body, querySelector: () => null }
	const windowA = { document: documentA }
	documentA.defaultView = windowA
	for (const element of [body, html, canvasTarget]) element.ownerDocument = documentA
	const canvasRoot = { ownerDocument: documentA, contains: target => target === canvasTarget }
	const canvas = { name: "A", selection: new Set() }
	const view = { containerEl: canvasRoot, canvas, getViewType: () => "canvas" }
	const app = { workspace: { iterateAllLeaves(callback) { callback({ view }) } } }
	const leases = new CanvasPointerLeaseRegistry()

	updateCanvasPointerLeaseFromEvent(app, { target: canvasTarget, composedPath: () => [canvasTarget] }, windowA, leases)
	const resolved = resolveCanvasFromEvent(app, { target: body, composedPath: () => [body, html] }, windowA, leases)
	assert.equal(resolved.canvas, canvas)
	assert.equal(resolved.source, "pointer-lease")
})

test("Pan 指针租约在 Modal、外部焦点、跨窗口和 Canvas 关闭后失效", () => {
	const bodyA = { nodeType: 1, tagName: "BODY" }
	const bodyB = { nodeType: 1, tagName: "BODY" }
	const inputA = { nodeType: 1, tagName: "INPUT" }
	const documentA = { activeElement: bodyA, querySelector: () => null }
	const documentB = { activeElement: bodyB, querySelector: () => null }
	const windowA = { document: documentA }
	const windowB = { document: documentB }
	documentA.defaultView = windowA
	documentB.defaultView = windowB
	for (const element of [bodyA, inputA]) element.ownerDocument = documentA
	bodyB.ownerDocument = documentB
	const canvas = { name: "A" }
	const root = { ownerDocument: documentA, contains: () => false }
	let open = true
	const app = { workspace: { iterateAllLeaves(callback) { if (open) callback({ view: { containerEl: root, canvas, getViewType: () => "canvas" } }) } } }
	const leases = new CanvasPointerLeaseRegistry()
	leases.remember(windowA, canvas)

	assert.equal(resolveCanvasFromEvent(app, { target: bodyB, composedPath: () => [bodyB] }, windowB, leases).canvas, undefined)
	documentA.activeElement = inputA
	assert.equal(resolveCanvasFromEvent(app, { target: bodyA, composedPath: () => [bodyA] }, windowA, leases).leaseReason, "lease-active-element-blocked")
	leases.remember(windowA, canvas)
	documentA.activeElement = bodyA
	documentA.querySelector = () => ({ className: "prompt" })
	assert.equal(resolveCanvasFromEvent(app, { target: bodyA, composedPath: () => [bodyA] }, windowA, leases).leaseReason, "lease-overlay-blocked")
	leases.remember(windowA, canvas)
	documentA.querySelector = () => null
	open = false
	assert.equal(resolveCanvasFromEvent(app, { target: bodyA, composedPath: () => [bodyA] }, windowA, leases).leaseReason, "lease-canvas-unavailable")
})

test("同一个 KeyboardEvent 只消费一次，避免独立窗口双重触发", () => {
	const guard = new KeyboardEventGuard()
	const event = {}
	assert.equal(guard.consume(event), true)
	assert.equal(guard.consume(event), false)
	assert.equal(guard.consume({}), true)
})

test("修饰键和修饰键组合不会触发平移", () => {
	assert.equal(hasKeyboardModifier({ code: "ControlLeft", key: "Control" }), true)
	assert.equal(hasKeyboardModifier({ code: "ShiftLeft", key: "Shift" }), true)
	assert.equal(hasKeyboardModifier({ code: "AltLeft", key: "Alt" }), true)
	assert.equal(hasKeyboardModifier({ code: "MetaLeft", key: "Meta" }), true)
	assert.equal(hasKeyboardModifier({ key: "s", code: "KeyS", ctrlKey: true }), true)
	assert.equal(hasKeyboardModifier({ key: "w", code: "KeyW", shiftKey: true }), true)
	assert.equal(hasKeyboardModifier({ key: "a", code: "KeyA" }), false)
})

test("插件重载后窗口可以重新注册，重复注册不会叠加", () => {
	const registry = new WindowRegistrationRegistry()
	const mainWindow = {}
	const popoutWindow = {}

	assert.equal(registry.claim(mainWindow), true)
	assert.equal(registry.claim(mainWindow), false)
	assert.equal(registry.claim(popoutWindow), true)
	assert.equal(registry.size, 2)

	registry.clear()
	assert.equal(registry.size, 0)
	assert.equal(registry.claim(mainWindow), true)
	registry.release(mainWindow)
	assert.equal(registry.claim(mainWindow), true)
})

test("输入控件与 Canvas 编辑态不会被抢走", () => {
	const input = { tagName: "INPUT", getAttribute: () => null, parentElement: null, parentNode: null }
	const editor = { tagName: "DIV", getAttribute: name => name === "contenteditable" ? "true" : null, parentElement: null, parentNode: null }
	const nested = { tagName: "SPAN", getAttribute: () => null, parentElement: editor, parentNode: editor }
	assert.equal(isEditableTarget(input), true)
	assert.equal(isEditableTarget(nested), true)
	assert.equal(isCanvasEditing({ selection: new Set([{ isEditing: true }]) }), true)
	assert.equal(isCanvasEditing({ selection: new Set([{ isEditing: false }]) }), false)
})

test("方向冲突与速度函数保持原有语义", () => {
	assert.equal(xor(true, false), true)
	assert.equal(xor(true, true), false)
	assert.equal(xor(false, false), false)
	assert.equal(getPanDistance(1000, 250), 250)
	assert.equal(getPanDistance(1000, 500), 500)
	assert.equal(getPanDistance(10_000, 50), 50)
})

test("速度配置会限制到有效范围并恢复非法值", () => {
	assert.equal(normalizePanSpeed(-1), 50)
	assert.equal(normalizePanSpeed(999), 500)
	assert.equal(normalizePanSpeed("fast"), 250)
})

test("键位配置按顺序归一化，旧单字母可迁移，重复键会恢复默认", () => {
	assert.deepEqual(normalizeKeyBindings({ north: "w", west: "a", south: "s", east: "d" }), {
		keys: DEFAULT_KEY_BINDINGS,
		repaired: false,
	})
	assert.deepEqual(normalizeKeyBindings({ north: "d", west: "d", south: "d", east: "d" }), {
		keys: DEFAULT_KEY_BINDINGS,
		repaired: true,
	})
	assert.deepEqual(normalizeKeyBindings({ north: "", west: "KeyA", south: "KeyS", east: "KeyD" }), {
		keys: DEFAULT_KEY_BINDINGS,
		repaired: true,
	})
})

test("Canvas 视口变更契约包含显式 requestFrame 重绘", () => {
	const calls = []
	const canvas = {
		tx: 10,
		ty: 20,
		zoom: 0,
		markViewportChanged: () => calls.push("markViewportChanged"),
		requestFrame: () => calls.push("requestFrame"),
	}
	panCanvas(canvas, 12, -6)
	assert.equal(canvas.tx, 12.4)
	assert.equal(canvas.ty, 18.8)
	assert.deepEqual(calls, ["markViewportChanged", "requestFrame"])
})

test("Canvas 视口变更返回诊断所需的前后状态与重绘标记", () => {
	const canvas = {
		tx: 10,
		ty: 20,
		zoom: 0,
		markViewportChanged: () => {},
		requestFrame: () => {},
	}
	const result = panCanvas(canvas, 12, -6)
	assert.deepEqual(result, { tx: 12.4, ty: 18.8, zoom: 0, redrawRequested: true })
})
