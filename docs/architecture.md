# 运行架构

## 输入链路

每个 Obsidian 主窗口或浮动窗口拥有独立的监听、按键状态、Canvas 上下文和清理函数。键盘事件先经过以下边界：

1. 从事件的 `Window`、`Document` 和 DOM 路径解析 Canvas。
2. 拒绝输入控件、Canvas 编辑态、组合输入、重复键与带修饰键的输入。
3. 解析物理 `KeyboardEvent.code` 到一个方向；同一事件只处理一次。
4. 在所属 Window 的短周期 interval 中计算速度并调用 `panCanvas`。
5. keyup、blur、隐藏、标签变化、窗口关闭或插件 unload 立即停止并清理。

`panCanvas` 是唯一视口写入口：更新当前已验证的视口字段，调用 `markViewportChanged()`，并在运行时存在时调用 `requestFrame()`。Obsidian 的 Canvas 视图不是公开 API，因此不得仅凭桌面对象形状切换到未经移动端验证的内部方法。

## Android 指针租约

Android 输入法退出后，实体键盘事件可能继续发给 `BODY/HTML`，导致 DOM 路径不再包含 Canvas。插件以同 Window 的真实 Canvas `pointerdown` 建立一份有界租约：

- 只有 DOM 能直接解析到 Canvas 时才能建立或刷新。
- 只有同一 Document 的 `BODY/HTML` 壳层事件可以复用。
- 当前活动元素是输入控件、出现菜单／Modal、Canvas 已关闭或不再属于该 Window 时拒绝复用。
- 外部具体元素、标签变化、blur、隐藏、窗口关闭与 unload 都会清除。

它是最近一次真实交互的归属证明，不是 `activeLeaf`、当前文件或“窗口里只有一个 Canvas”的推断。

## 多窗口与伴生插件

`WindowRegistrationRegistry` 保证每个 Window 只注册一次，并让 cleanup 精确对应所属 Window。Pan 与 ARC 可以各自接收相同方向键：ARC 负责节点导航，Pan 负责视口平移；事件消费协定必须避免一个插件无条件阻断另一个插件。

Pan 暴露可选诊断桥，供 ARC 在用户手动开始诊断时共享 session ID 并合并报告。插件缺失或桥不可用不能影响正常平移。

## 按需诊断

正常使用没有常驻遥测循环。诊断开启后才会：

- 记录有限的 Window、Document、守卫结果、租约原因、视口 before/after 和异常；
- 对 Canvas 原型做深度、属性数和 JSON 大小均受限的能力快照；
- 以约 100 ms 采样正常 pan tick，而非记录每个 10 ms tick；异常不抽样；
- 临时监听所属 Window 的 `error` 与 `unhandledrejection`。

诊断停止或插件卸载会移除监听并清空缓冲。不得直接序列化 Canvas 对象，也不得记录正文、真实输入、`KeyboardEvent.key`、剪贴板或本机路径。
