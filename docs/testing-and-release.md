# 测试、真机验收与发布

## 自动验证

正式测试与构建从仓库根目录执行：

```powershell
./scripts/measure-command.ps1 -Command "npm test" -Label "canvas-pan-<版本>-tests"
./scripts/measure-command.ps1 -Command "npm run build" -Label "canvas-pan-<版本>-build"
git diff --check
```

把两条 `RESOURCE_USAGE` 原样转录到 `tests/resource-usage.md`。失败记录也必须保留，修复后用新标签重跑；不得修改历史数值。

测试至少覆盖：

- DOM 直接解析与 Android `BODY/HTML` 指针租约正负路径；
- 输入、编辑、Modal、composition、repeat 与 modifier 闸门；
- Window 注册、隔离、释放与重复 reload；
- 物理键绑定迁移和速度归一化；
- `panCanvas` 视口变更与显式重绘契约；
- 诊断默认零记录、容量上限、脱敏、能力快照上限、采样和异常清理。

## 运行时验收

桌面至少检查主窗口、分栏、浮动窗口、编辑态、输入框、Modal、窗口切换和插件重载。移动端平台问题必须使用真实设备与实体键盘验证；DOM 合成或 CDP 合成事件只能作为辅助探针。

Android 的关键回归序列：

1. 打开 Canvas，在未编辑节点前验证 W/A/S/D。
2. 编辑一个节点并唤起输入法。
3. 点击 Canvas 空白退出编辑，不切换标签。
4. 再次验证 W/A/S/D；节点仍编辑时必须保持不响应。
5. 若失败，手动开启 ARC 联合诊断，复现后立即停止并复制报告，再输入文字反馈。

2026-08-26 的手机和平板验收已经证明 1.0.10 这一修复链在编辑后命中 `pointer-lease / lease-hit`，平移视口发生真实变化，且没有放宽输入与覆盖层边界。

## 发布顺序

1. 同步 `package.json`、`package-lock.json`、`manifest.json`、`versions.json` 与 Changelog。
2. 完成测试、构建、diff、敏感信息和许可证检查。
3. 提交并推送 `main`，用 `gh` 等待 Build 工作流通过。
4. 创建不带 `v` 的版本 Tag 并推送；Tag 工作流生成 Draft Release。
5. 核对 Draft 的版本 ZIP、`main.js`、`manifest.json`、`styles.css`，补齐发行说明后发布。
6. 再次检查 Release 工作流和资产列表；CI 未通过不算完成。

GitHub Actions 使用 Node 22、`npm ci`、`npm test` 和 `npm run build`，与本地发布门禁保持一致。

本仓库是上游项目的 fork；首次启用自动 CI 时需在 GitHub Actions 页面确认运行本 fork 的 workflow，或执行 `gh workflow enable build.yml`。仓库启用后，后续 `main` push 才会自动进入上述门禁。
