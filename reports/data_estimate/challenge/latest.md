# 挑战模式第7~9关基础数值统计

生成时间：2026-07-09T14:45:43.639Z

本报告由自动评测战斗样本聚合生成，用于观察关卡基础数值规模。数值会受 build、AI 档位、通关/失败时长影响，因此优先看同一批报告内的横向对比。

## 字段说明

| 字段 | 含义 | 为什么重要 |
| --- | --- | --- |
| 资源/秒 | 玩家职业资源的正向获取量，目前战士T为怒气/秒 | 判断本关是否支持当前技能循环和防御技能覆盖 |
| 承伤/秒 | 坦克实际受到的伤害/秒 | 衡量坦克生存压力和治疗需求 |
| 治疗吸收/秒 | 玩家与队伍为玩家侧产生的治疗和吸收/秒 | 衡量本关防御与恢复供给是否跟得上承伤 |
| 造成伤害/秒 | 玩家、天赋与队伍对敌方造成的伤害/秒 | 判断击杀速度、软狂暴和敌方循环暴露时间 |
| 压力/秒 | 队伍压力条增长/秒 | 衡量非坦克承压、漏怪或全队技能风险 |

## 关卡参考值

| 关卡 | 名称 | 参考模式 | profile | build | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Challenge-7` | 猎头断线 | `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 100% | 69.38 | 5.66 | 3.43 | 5.61 | 19.09 | 0.72 |
| `Challenge-8` | 森林药线 | `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 92% | 77.24 | 2.91 | 4.28 | 4.23 | 26.67 | 0.72 |
| `Challenge-9` | 持盾督军 | `fixed` | `expert/expert1-200ms-1pct` | `default` | 83% | 48.13 | 8.13 | 5.78 | 6.26 | 29.85 | 0.97 |

## Challenge-7 猎头断线

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `generated_6_1` | 12 | 100% | 76.20 | 5.63 | 4.09 | 5.48 | 19.95 | 0.72 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_1` | 12 | 75% | 73.17 | 5.59 | 3.22 | 5.69 | 19.03 | 0.73 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 0% | 86.33 | 4.16 | 3.77 | 7.19 | 13.14 | 0.80 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_1` | 12 | 75% | 67.31 | 5.71 | 3.47 | 5.96 | 19.17 | 0.80 |
| `fixed` | `average/average2-800ms-10pct` | `generated_6_1` | 12 | 75% | 75.62 | 5.62 | 3.87 | 5.94 | 19.58 | 0.79 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 0% | 87.92 | 4.16 | 3.90 | 7.09 | 13.14 | 0.78 |
| `fixed` | `average/average3-500ms-15pct` | `generated_6_1` | 12 | 100% | 78.69 | 5.60 | 3.89 | 5.67 | 19.94 | 0.72 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 12 | 67% | 65.46 | 5.66 | 3.52 | 6.14 | 18.99 | 0.79 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 0% | 85.29 | 4.16 | 4.02 | 6.90 | 13.27 | 0.78 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_6_1` | 12 | 100% | 80.93 | 5.61 | 3.99 | 5.70 | 19.49 | 0.73 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_1` | 12 | 83% | 67.18 | 5.69 | 3.54 | 5.82 | 19.26 | 0.73 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 0% | 85.42 | 4.16 | 3.78 | 7.36 | 13.01 | 0.81 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_6_1` | 12 | 100% | 79.88 | 5.59 | 3.89 | 5.65 | 19.62 | 0.71 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_1` | 12 | 92% | 66.13 | 5.66 | 3.41 | 5.64 | 19.09 | 0.77 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 0% | 85.83 | 4.16 | 3.78 | 7.34 | 12.99 | 0.80 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_1` | 12 | 100% | 67.66 | 5.68 | 3.46 | 5.95 | 19.45 | 0.67 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_6_1` | 12 | 25% | 72.67 | 5.63 | 3.55 | 6.26 | 19.67 | 0.92 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 0% | 86.25 | 4.16 | 3.79 | 7.29 | 12.95 | 0.80 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_6_1` | 12 | 100% | 75.93 | 5.57 | 3.83 | 5.90 | 19.74 | 0.72 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_1` | 12 | 92% | 68.05 | 5.65 | 3.51 | 5.99 | 19.24 | 0.61 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 0% | 85.83 | 4.16 | 3.79 | 7.27 | 13.08 | 0.80 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 12 | 100% | 69.38 | 5.66 | 3.43 | 5.61 | 19.09 | 0.72 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_6_1` | 12 | 83% | 77.80 | 5.62 | 4.10 | 5.56 | 19.65 | 0.74 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 0% | 87.08 | 4.16 | 3.86 | 7.21 | 13.00 | 0.79 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 12 | 92% | 66.70 | 5.63 | 3.37 | 5.65 | 19.27 | 0.73 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_6_1` | 12 | 92% | 78.70 | 5.60 | 4.03 | 5.56 | 19.64 | 0.74 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 0% | 85.00 | 4.16 | 3.78 | 7.26 | 13.00 | 0.81 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_6_1` | 12 | 17% | 61.92 | 5.65 | 4.96 | 5.08 | 19.96 | 0.75 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `default` | 12 | 0% | 90.00 | 4.15 | 3.98 | 7.12 | 13.14 | 0.77 |

## Challenge-8 森林药线

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_1` | 12 | 75% | 67.45 | 2.97 | 4.37 | 4.22 | 26.83 | 1.05 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_6_1` | 12 | 58% | 72.22 | 4.20 | 4.91 | 4.26 | 29.83 | 1.03 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 0% | 20.67 | 7.71 | 2.54 | 4.85 | 24.12 | 3.92 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_1` | 12 | 92% | 75.55 | 2.88 | 4.31 | 4.28 | 27.05 | 0.80 |
| `fixed` | `average/average2-800ms-10pct` | `generated_6_1` | 12 | 75% | 73.88 | 4.27 | 4.82 | 4.29 | 29.11 | 0.96 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 0% | 21.00 | 7.71 | 2.79 | 4.19 | 24.46 | 3.86 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 12 | 92% | 78.95 | 2.85 | 4.51 | 4.37 | 27.13 | 0.77 |
| `fixed` | `average/average3-500ms-15pct` | `generated_6_1` | 12 | 58% | 74.82 | 4.13 | 4.97 | 4.30 | 29.18 | 1.02 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 0% | 21.00 | 7.67 | 2.76 | 4.27 | 24.31 | 3.86 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_6_1` | 12 | 67% | 71.35 | 4.18 | 4.91 | 4.24 | 29.42 | 1.05 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_1` | 12 | 58% | 54.86 | 3.38 | 4.42 | 3.99 | 26.78 | 1.12 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 0% | 19.75 | 7.75 | 2.81 | 3.41 | 23.89 | 4.10 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_1` | 12 | 83% | 69.18 | 3.17 | 4.38 | 4.25 | 26.66 | 0.75 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_6_1` | 12 | 42% | 69.22 | 4.26 | 5.14 | 4.29 | 29.56 | 1.11 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 0% | 20.00 | 7.73 | 2.79 | 3.40 | 23.80 | 4.05 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_6_1` | 12 | 75% | 72.80 | 4.20 | 4.98 | 4.29 | 29.77 | 0.99 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_1` | 12 | 50% | 51.93 | 3.40 | 4.39 | 3.94 | 27.36 | 1.41 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 0% | 19.83 | 7.72 | 2.57 | 4.14 | 24.25 | 4.08 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_6_1` | 12 | 92% | 76.70 | 4.09 | 4.69 | 4.35 | 29.45 | 0.95 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_1` | 12 | 75% | 69.03 | 2.99 | 4.30 | 4.19 | 27.05 | 0.98 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 0% | 20.00 | 7.73 | 2.57 | 4.23 | 24.41 | 4.05 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_6_1` | 12 | 83% | 77.87 | 4.10 | 4.97 | 4.28 | 29.28 | 0.92 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 12 | 75% | 66.14 | 3.07 | 4.48 | 4.12 | 26.98 | 1.02 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 0% | 20.67 | 7.73 | 2.94 | 3.51 | 24.62 | 3.92 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 12 | 92% | 77.24 | 2.91 | 4.28 | 4.23 | 26.67 | 0.72 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_6_1` | 12 | 67% | 68.85 | 4.27 | 5.00 | 4.30 | 29.76 | 1.01 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 0% | 20.67 | 7.72 | 2.93 | 3.40 | 24.47 | 3.92 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_mechanic-focus` | `generated_2_1` | 12 | 67% | 63.41 | 3.10 | 3.90 | 3.96 | 26.18 | 0.99 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_mechanic-focus` | `default` | 12 | 0% | 20.67 | 7.69 | 2.71 | 3.55 | 24.06 | 3.92 |

## Challenge-9 持盾督军

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 25% | 44.71 | 8.14 | 6.22 | 6.75 | 30.18 | 1.38 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_1` | 12 | 0% | 15.50 | 6.53 | 14.13 | 2.34 | 45.57 | 0.00 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_1` | 12 | 0% | 16.13 | 6.79 | 14.58 | 2.39 | 51.55 | 0.17 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 25% | 40.88 | 8.23 | 5.97 | 7.11 | 30.34 | 1.59 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_1` | 12 | 0% | 15.50 | 7.10 | 14.15 | 2.34 | 45.84 | 0.00 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_1` | 12 | 0% | 15.96 | 6.92 | 14.66 | 2.38 | 51.23 | 0.06 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 42% | 46.56 | 8.17 | 6.03 | 6.71 | 29.97 | 0.84 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_1` | 12 | 0% | 15.63 | 7.05 | 14.38 | 2.37 | 44.53 | 0.06 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 12 | 0% | 15.75 | 6.94 | 14.43 | 2.38 | 50.69 | 0.13 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 83% | 48.13 | 8.13 | 5.78 | 6.26 | 29.85 | 0.97 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_1` | 12 | 0% | 15.50 | 7.14 | 14.21 | 2.34 | 44.92 | 0.00 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_1` | 12 | 0% | 15.79 | 7.00 | 14.53 | 2.37 | 51.84 | 0.06 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 58% | 44.92 | 8.26 | 5.94 | 6.26 | 30.49 | 1.55 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_1` | 12 | 0% | 15.50 | 7.14 | 14.21 | 2.34 | 46.00 | 0.00 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_1` | 12 | 0% | 15.96 | 6.93 | 14.70 | 2.38 | 53.19 | 0.09 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 50% | 45.18 | 8.30 | 6.10 | 6.25 | 31.41 | 0.55 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_1` | 12 | 0% | 15.50 | 7.12 | 14.21 | 2.34 | 45.45 | 0.00 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_1` | 12 | 0% | 16.00 | 6.89 | 14.75 | 2.39 | 52.22 | 0.09 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 50% | 46.00 | 8.17 | 5.80 | 7.37 | 29.65 | 1.16 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 12 | 0% | 15.50 | 7.05 | 14.13 | 2.34 | 45.15 | 0.00 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_1` | 12 | 0% | 15.67 | 7.08 | 14.38 | 2.35 | 49.96 | 0.06 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 58% | 45.54 | 8.11 | 5.82 | 6.35 | 30.07 | 1.51 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_1` | 12 | 0% | 15.50 | 7.09 | 14.20 | 2.34 | 44.88 | 0.00 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 12 | 0% | 15.71 | 7.04 | 14.50 | 2.36 | 50.02 | 0.06 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 42% | 46.26 | 8.29 | 6.09 | 6.30 | 30.01 | 1.07 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_1` | 12 | 0% | 15.50 | 7.14 | 14.20 | 2.34 | 45.65 | 0.00 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 12 | 0% | 15.88 | 6.97 | 14.65 | 2.37 | 50.22 | 0.13 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `default` | 12 | 42% | 44.31 | 8.19 | 5.78 | 6.32 | 30.00 | 2.07 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `generated_1_1` | 12 | 0% | 15.50 | 7.14 | 14.21 | 2.34 | 44.74 | 0.00 |
