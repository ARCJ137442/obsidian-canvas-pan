# 测试资源记录

本文件记录本轮多窗口修复期间的测试采样。命令通过 Windows 进程树采样器每 100 ms 汇总工作集与累计 CPU 时间；峰值工作集是进程树采样期间的最大汇总值，CPU 是采样到的进程树累计 CPU 时间。失败测试也保留记录。

| 日期 | 标签 | 命令 | 结果 | 墙钟 | 峰值工作集 | 进程树 CPU | 采样数 |
|---|---|---|---:|---:|---:|---:|---:|
| 2026-08-21 | `canvas-pan-window-context-tests-v1` | `npm test` | 失败，TypeScript 缺少 `Canvas.selection` 类型 | 2091.99 ms | 298,516,480 B（284.69 MiB） | 2.766 s | 3 |
| 2026-08-21 | `canvas-pan-window-context-tests-v2` | `npm test` | 4/4，退出码 0 | 2031.68 ms | 298,250,240 B（284.43 MiB） | 3.031 s | 3 |
| 2026-08-21 | `canvas-pan-window-context-build-v1` | `npm run build` | 成功，退出码 0 | 1457.74 ms | 15,540,224 B（14.82 MiB） | 0.047 s | 2 |
| 2026-08-21 | `canvas-pan-window-context-tests-v3` | `npm test` | 4/4，退出码 0 | 2892.99 ms | 295,763,968 B（282.06 MiB） | 2.578 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.2-final-tests` | `npm test` | 4/4，退出码 0 | 3168.93 ms | 74,231,808 B（70.79 MiB） | 0.391 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.2-final-build` | `npm run build` | 成功，退出码 0 | 2530.23 ms | 15,536,128 B（14.82 MiB） | 0.078 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.3-reload-registry-tests-v1` | `npm test` | 5/5，退出码 0 | 2865.14 ms | 309,792,768 B（295.44 MiB） | 4.000 s | 3 |
| 2026-08-21 | `canvas-pan-1.0.3-reload-registry-build-v1` | `npm run build` | 成功，退出码 0 | 1501.24 ms | 66,285,568 B（63.21 MiB） | 0.375 s | 1 |
| 2026-08-21 | `canvas-pan-window-isolation-registry-context-tests-v1` | `npm test` | 5/5，退出码 0 | 2913.85 ms | 315,006,976 B（300.41 MiB） | 4.172 s | 3 |
| 2026-08-21 | `canvas-pan-window-isolation-registry-context-build-v1` | `npm run build` | 成功，退出码 0 | 1620.65 ms | 15,556,608 B（14.84 MiB） | 0.094 s | 1 |
| 2026-08-21 | `canvas-pan-1.0.4-window-isolation-tests-final` | `npm test` | 6/6，退出码 0 | 2664.36 ms | 280,842,240 B（267.83 MiB） | 2.844 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.4-window-isolation-build-final` | `npm run build` | 成功，退出码 0 | 1853.75 ms | 15,540,224 B（14.82 MiB） | 0.094 s | 2 |
| 2026-08-21 | `life-panel-deploy-reload-pan-1.0.3-v1` | 部署并重载 | 重载命令 0，但紧接 Vault reload 后插件命令暂不可用 | 754.32 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.3-window-state-after-reload-v1` | CLI 状态检查 | 版本 1.0.3，窗口状态 2 | 541.25 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.5-state-reset-tests-final` | `npm test` | 6/6，退出码 0 | 3072.83 ms | 322,592,768 B（307.65 MiB） | 4.031 s | 3 |
| 2026-08-21 | `canvas-pan-1.0.5-state-reset-build-final` | `npm run build` | 成功，退出码 0 | 1674.24 ms | 15,540,224 B（14.82 MiB） | 0.094 s | 1 |
| 2026-08-21 | `life-panel-deploy-reload-pan-1.0.5-v1` | 部署并重载 | 成功，退出码 0 | 687.48 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.5-state-after-reload-v1` | CLI 状态检查 | 版本 1.0.5，状态/注册/清理均为 2 | 775.01 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.5-capture-isolation-tests-final` | `npm test` | 6/6，退出码 0 | 2473.23 ms | 66,637,824 B（63.55 MiB） | 0.344 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.5-capture-isolation-build-final` | `npm run build` | 成功，退出码 0 | 2045.73 ms | 15,556,608 B（14.84 MiB） | 0.078 s | 2 |
| 2026-08-21 | `life-panel-deploy-reload-pan-1.0.5-capture-v1` | 部署并重载 | 成功，退出码 0 | 618.10 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.5-capture-state-v1` | CLI 状态检查 | 版本 1.0.5，状态/注册/清理均为 2 | 606.54 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.5-main-popout-capture-single-listener-v2` | 主/副窗口 DOM 与窗口级探针 | DOM 路径均 12 tick；主窗口级 12 tick；副窗口级受 CLI 焦点影响为 0 | 1164.36 ms | 22,859,776 B（21.80 MiB） | 0.031 s | 2 |
| 2026-08-21 | `life-panel-pan-1.0.5-popout-window-focused-probe-v1` | 副窗口 `focus()` 后窗口级探针 | CLI 中副窗口仍未获得焦点，未作为功能失败计 | 683.06 ms | 14,995,456 B（14.30 MiB） | 0.047 s | 2 |
| 2026-08-21 | `life-panel-pan-1.0.5-cross-window-isolation-blur-probe-v1` | 主/副窗口隔离与 blur 探针 | 目标窗口移动约 12 tick，另一窗口增量 0；blur 后状态仍为 2 | 971.18 ms | 15,015,936 B（14.32 MiB） | 0.031 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.6-modifier-tests-wrapper-v0` | 未执行：采样器相对路径不存在，未启动测试进程 | — | — | — | — | 0 |
| 2026-08-21 | `canvas-pan-1.0.6-modifier-tests-v1` | 7/7，退出码 0 | 2554.21 ms | 294,232,064 B（280.60 MiB） | 2.672 s | 3 |
| 2026-08-21 | `canvas-pan-1.0.6-modifier-build-v1` | 成功，退出码 0 | 1613.13 ms | 15,659,008 B（14.93 MiB） | 0.078 s | 2 |
| 2026-08-21 | `life-panel-deploy-canvas-pan-1.0.6-wrapper-v0` | 未执行：采样器绝对路径误写，未启动复制或 CLI 进程 | — | — | — | — | 0 |
| 2026-08-21 | `life-panel-deploy-canvas-pan-1.0.6-v1` | 复制构建产物并 CLI 重载成功 | 525.53 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-canvas-pan-1.0.6-runtime-main-popout-modifier-v1` | 主/副窗口均先正常移动约 56–58 px；Ctrl 按下后增量 0；Ctrl+S 增量 0；最终均停止 | 1305.76 ms | 22,941,696 B（21.88 MiB） | 0.062 s | 2 |
| 2026-08-21 | `life-panel-pan-1.0.6-restart-reproduction-v1` | 重启成功，退出码 0 | 9231.79 ms | 88,522,752 B（84.42 MiB） | 0.484 s | 12 |
| 2026-08-21 | `life-panel-pan-1.0.6-after-restart-dom-was-v1` | DOM 合成事件探针：3 个 Canvas 均无位移；该探针不能代表真实物理键盘事件 | 1130.38 ms | 27,111,424 B（25.86 MiB） | 0.109 s | 2 |
| 2026-08-21 | `life-panel-pan-1.0.6-after-restart-instrumented-was-v1` | 插件 `startPan`/`handlePanKeys` 未被合成事件调用，确认 Window/DOM 合成路径不可作为最终实测 | 764.70 ms | 27,140,096 B（25.88 MiB） | 0.062 s | 1 |
| 2026-08-21 | `life-panel-pan-1.0.6-cdp-w-keydown-v1` | Obsidian CLI CDP 实际 keyDown 成功返回 `{}` | 398.79 ms | 短 CLI 进程未采到峰值 | 0 s（可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.6-cdp-w-keydown-state-v1` | keyDown 后状态探针可见 Canvas 视口已变化 | 359.49 ms | 短 CLI 进程未采到峰值 | 0 s（可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.6-cdp-w-keyup-v1` | Obsidian CLI CDP 实际 keyUp 成功返回 `{}` | 576.39 ms | 短 CLI 进程未采到峰值 | 0 s（可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-document-window-context-tests-v1` | 8/8，退出码 0 | 2991.35 ms | 275,816,448 B（263.04 MiB） | 2.828 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.7-document-window-context-build-v1` | 失败：工作区事件回调类型需显式适配 | 1539.17 ms | 78,581,760 B（74.94 MiB） | 0.453 s | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-document-window-context-build-v2` | 成功，退出码 0 | 2163.10 ms | 78,561,280 B（74.92 MiB） | 0.766 s | 1 |
| 2026-08-21 | `life-panel-deploy-canvas-pan-1.0.7-document-window-v2` | 复制构建产物并 CLI reload 成功，退出码 0 | 947.75 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-after-reload-state-v1` | 版本 1.0.7，窗口/注册/清理均为 2 | 423.95 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-after-reload-baseline-v1` | 3 个 Canvas 位移基线读取成功 | 407.70 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-after-reload-cdp-w-keydown-v1` | CDP keyDown 返回 `{}`，但未进入插件事件世界 | 900.40 ms | 27,119,616 B（25.86 MiB） | 0.094 s | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-after-reload-cdp-w-state-v1` | keyDown 后 Canvas 位移未改变；确认 CDP 合成键不能作为物理键盘验证 | 434.02 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-cdp-listener-probe-read-v1` | 监听器探针调用数为 0，证实调试事件未进入插件监听器 | 460.22 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-physical-main-w-hold-v2` | Windows 真实按键注入命令执行成功，但 Canvas 位移未改变；当前桌面自动化焦点未能证明物理事件进入 Obsidian | 2259.00 ms | 97,296,384 B（92.79 MiB） | 0.438 s | 2 |
| 2026-08-21 | `life-panel-pan-1.0.7-physical-main-after-w-v1` | CLI 读取真实注入后的位移，仍未改变 | 498.39 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-final-tests-v1` | 8/8，退出码 0 | 3199.20 ms | 290,639,872 B（277.18 MiB） | 3.672 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.7-final-build-v1` | 成功，退出码 0 | 2224.10 ms | 6,131,712 B（5.85 MiB） | 0.109 s | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-post-focus-removal-build-v1` | 成功，退出码 0 | 2100.69 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-deploy-canvas-pan-1.0.7-post-focus-removal-v1` | 文件复制成功，但首次 reload 参数格式错误，插件未由该命令重载 | 424.23 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-reload-canvas-pan-1.0.7-post-focus-removal-v1` | `id=canvas-keyboard-pan` 重载成功，退出码 0 | 476.04 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-post-focus-errors-v1` | CLI 返回既有 `advanced-canvas` 的 `edges` 错误；未指向 Pan | 1341.65 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-post-focus-console-v1` | 捕获到新版本 settings、双窗口注册及运行日志 | 859.61 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-post-focus-settings-state-v3` | settings 为 `KeyW/KeyA/KeyS/KeyD`，退出码 0 | 424.35 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-post-focus-runtime-both-windows-v3` | CLI 合成探针返回空数组（重载后 state 尚未挂 Canvas），不作为功能通过依据 | 1190.25 ms | 27,230,208 B（25.97 MiB） | 0.094 s | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-post-focus-runtime-console-v4` | 控制台确认主窗、副窗均执行 `start-pan`/`pan-first-tick`，`viewportChanged=true` 且 frame 递增 | 418.25 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-post-focus-stop-leftover-pan-v1` | 强制停止探针遗留计时器，退出码 0 | 531.23 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-post-focus-removal-tests-v1` | 8/8，退出码 0 | 3222.76 ms | 317,665,280 B（302.95 MiB） | 4.688 s | 2 |
| 2026-08-21 | `life-panel-pan-1.0.7-post-focus-final-state-v1` | settings 正确；窗口/注册/清理均为 2；running 为 `[false,false]` | 426.92 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-key-binding-helper-build-v1` | 成功，退出码 0 | 1862.35 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-key-binding-helper-tests-v1` | 9/9，退出码 0 | 3398.66 ms | 308,191,232 B（293.91 MiB） | 4.141 s | 2 |
| 2026-08-21 | `life-panel-deploy-reload-canvas-pan-1.0.7-key-binding-helper-v1` | 复制构建产物并 CLI 重载成功 | 396.20 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-key-binding-helper-state-v1` | 版本 1.0.7；settings 正确；窗口/注册/清理均为 2 | 401.40 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-key-binding-helper-runtime-both-windows-v2` | CLI 直接驱动两窗口同一运行链路，主窗 deltaTy `-8.3333`、副窗 deltaTy `-9.375`，随后恢复 | 383.72 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-key-binding-helper-runtime-console-v1` | 控制台出现两窗口 `pan-first-tick`，均 `viewportChanged=true`；同时发现既有 `advanced-canvas` 错误 | 491.65 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-key-binding-helper-errors-v1` | 仅返回既有 `advanced-canvas` 错误及一次早先探针恢复错误，未见 Pan 堆栈 | 491.88 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-key-binding-helper-runtime-console-filtered-v2` | 过滤日志核实 settings-loaded、双窗口注册和主/副窗 pan-first-tick | 415.22 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-cli-errors-help-v1` | CLI 帮助确认支持 `dev:errors clear` | 396.84 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-clear-cli-error-buffer-v1` | 清空 7 条历史错误记录 | 453.78 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-1.0.7-final-cli-errors-v1` | `No errors captured` | 357.51 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-request-frame-build-v1` | 成功，退出码 0 | 1687.90 ms | 19,947,520 B（19.02 MiB） | 0.141 s | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-request-frame-tests-v1` | 失败：测试期望值错误，9/10 通过；产品构建成功 | 2701.55 ms | 290,856,960 B（277.38 MiB） | 3.359 s | 2 |
| 2026-08-21 | `canvas-pan-1.0.7-request-frame-tests-v2` | 10/10，退出码 0 | 2582.65 ms | 278,130,688 B（265.25 MiB） | 2.875 s | 2 |
| 2026-08-21 | `life-panel-deploy-reload-pan-request-frame-v1` | 复制构建产物并 CLI 重载成功 | 579.06 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-request-frame-runtime-both-windows-v1` | 主/副窗均产生位移，且 requestFrame 调用计数均大于 0；随后恢复视口 | 330.71 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-directional-fix-console-baseline-v1` | 未捕获新的 Pan 按键日志，等待真实键盘路径；退出码 1 为过滤命令无匹配 | 395.74 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-directional-fix-state-v1` | Pan 配置正确、窗口数 2、白板版本 0.1.0 | 377.79 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-directional-fix-physical-main-w-v1` | OS 注入失败：SetForegroundWindow=false、SendInput=0；不作为功能失败依据 | 1584.24 ms | 90,124,288 B（85.95 MiB） | 0.422 s | 2 |
| 2026-08-21 | `life-panel-pan-directional-fix-clear-errors-v1` | 清空 16 条历史错误记录 | 402.88 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `life-panel-pan-directional-fix-final-errors-v2` | `No errors captured` | 314.91 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-release-build-v1` | 成功，退出码 0；短进程可能漏采内存和 CPU | 1613.19 ms | 0 B（短 CLI 进程，可能漏采） | 0 s（短 CLI 进程，可能漏采） | 1 |
| 2026-08-21 | `canvas-pan-1.0.7-release-tests-v1` | 10/10，退出码 0 | 2254.81 ms | 307,195,904 B（292.96 MiB） | 3.703 s | 2 |

采样器复用原插件仓库的 [`measure-command.ps1`](../../obsidian-canvas-block-reference/scripts/measure-command.ps1)。工作集和 CPU 仅代表被测命令进程树，不等同于整台机器的总资源占用；短命令可能因采样间隔漏掉瞬时峰值。
