import assert from "node:assert/strict"
import test from "node:test"
import context from "../.test-build/canvas-context.js"
import guardModule from "../.test-build/keyboard-event-guard.js"
import modifierModule from "../.test-build/keyboard-modifiers.js"
import registryModule from "../.test-build/window-registration.js"
import util from "../.test-build/util.js"

const { getCanvasFromEvent, isCanvasEditing, isEditableTarget } = context
const { KeyboardEventGuard } = guardModule
const { hasKeyboardModifier } = modifierModule
const { WindowRegistrationRegistry } = registryModule
const { xor } = util

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
	assert.equal(Math.min((Math.log10(1000) * 250) / 3, 250), 250)
})
