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

采样器复用原插件仓库的 [`measure-command.ps1`](../../obsidian-canvas-block-reference/scripts/measure-command.ps1)。工作集和 CPU 仅代表被测命令进程树，不等同于整台机器的总资源占用；短命令可能因采样间隔漏掉瞬时峰值。
