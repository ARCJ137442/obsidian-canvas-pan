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

采样器复用原插件仓库的 [`measure-command.ps1`](../../obsidian-canvas-block-reference/scripts/measure-command.ps1)。工作集和 CPU 仅代表被测命令进程树，不等同于整台机器的总资源占用；短命令可能因采样间隔漏掉瞬时峰值。
