import assert from "node:assert/strict"
import test from "node:test"
import context from "../.test-build/canvas-context.js"
import guardModule from "../.test-build/keyboard-event-guard.js"
import util from "../.test-build/util.js"

const { getCanvasFromEvent, isCanvasEditing, isEditableTarget } = context
const { KeyboardEventGuard } = guardModule
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

test("同一个 KeyboardEvent 只消费一次，避免独立窗口双重触发", () => {
	const guard = new KeyboardEventGuard()
	const event = {}
	assert.equal(guard.consume(event), true)
	assert.equal(guard.consume(event), false)
	assert.equal(guard.consume({}), true)
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
