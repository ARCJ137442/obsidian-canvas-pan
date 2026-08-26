# AGENTS.md — Canvas Keyboard Pan

> 更新：2026-08-26。先读本文件，再按任务进入 [`docs/`](docs/) 的专题文档。

## 不变量

- 运行时兼容 Obsidian Desktop 与 Mobile，不使用 Node 专属运行时 API，也不在源码中写死本机、设备或 Vault 路径。
- 键盘事件必须从事件所属 Window/Document/Canvas 解析；输入控件、Canvas 编辑态、组合输入、重复键和修饰键保持宿主控制权。
- Android 编辑退出后若事件退化为 `BODY/HTML`，只能复用同 Window 中真实 Canvas `pointerdown` 建立的有界租约；禁止 `activeLeaf`／唯一 Canvas 猜测。
- 具体外部元素、Modal、blur、隐藏、标签变化、Canvas 关闭或 unload 必须使租约失效。
- 主窗口、分栏和独立窗口各自注册一次监听；reload、blur、visibility、window-close 和 unload 必须幂等清理。
- 视口修改必须经过 `panCanvas`，同时标记 viewport、请求重绘；未经真机证据不得把内部 `panBy` 假设成跨平台公开 API。
- 诊断默认关闭，只保留有上限的内存记录，不写 Vault，不采集正文、实际输入文本、剪贴板或 `KeyboardEvent.key`。
- 真机日志是平台根因判断的依据；没有真机证据前不得删除编辑态安全闸门或宣称根因已修复。

## 开发与发布

1. 开始前执行 `git status --short --branch` 与 `git log -5 --oneline --decorate`，保护既有工作区。
2. 新行为补测试。使用 `scripts/measure-command.ps1` 运行正式测试／构建，并把原始资源结果如实追加到 `tests/resource-usage.md`。
3. 最低验证为 `npm test`、`npm run build`、`git diff --check`；发布前还要检查版本一致性与敏感信息。
4. `main` 是长期维护分支。推送后必须等待 GitHub Actions 的 Build 通过，才可创建版本 Tag。
5. Fix 版本使用仓库既有的不带 `v` Tag 约定。Release 必须包含版本 ZIP、`main.js`、`manifest.json` 和 `styles.css`。

## 文档路由

- 运行结构和安全边界：[`docs/architecture.md`](docs/architecture.md)
- 测试、真机验收与发布：[`docs/testing-and-release.md`](docs/testing-and-release.md)
- 已排序的后续开发项：[`docs/roadmap.md`](docs/roadmap.md)
- 用户可见变化：[`CHANGELOG.md`](CHANGELOG.md)

文档只保留当前规则与可执行计划；历史行为证据进入 Changelog、测试资源记录或 Git 历史，不把一次性的运行输出写进长期规范。
