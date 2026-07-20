# 自定义关卡基础数值统计

生成时间：2026-07-16T15:50:25.349Z

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
| `Zul'Aman-5` | 迈萨拉深渊 | `fixed` | `expert/expert1-200ms-1pct` | `generated_15_2` | 2% | 21.32 | 8.11 | 6.73 | 17.23 | 48.04 | 6.04 |

## Zul'Aman-5 迈萨拉深渊

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 14.06 | 8.54 | 13.99 | 7.88 | 34.45 | 4.15 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_2` | 100 | 0% | 20.16 | 6.13 | 11.21 | 9.50 | 48.58 | 5.60 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_15_2` | 100 | 0% | 17.94 | 8.49 | 6.02 | 17.44 | 48.17 | 6.73 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_16_2` | 100 | 0% | 18.03 | 8.49 | 6.74 | 9.28 | 48.26 | 6.78 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 0% | 21.70 | 5.82 | 11.57 | 9.48 | 50.26 | 4.95 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_18_2` | 100 | 0% | 18.65 | 7.67 | 10.04 | 9.65 | 49.51 | 6.23 |
| `fixed` | `average/average2-800ms-10pct` | `generated_16_2` | 100 | 1% | 18.91 | 8.36 | 6.91 | 9.37 | 48.21 | 6.63 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 14.19 | 8.44 | 13.74 | 7.87 | 34.87 | 4.25 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_2` | 100 | 0% | 20.61 | 6.03 | 11.33 | 9.55 | 48.43 | 5.54 |
| `fixed` | `average/average2-800ms-10pct` | `generated_15_2` | 100 | 0% | 18.55 | 8.40 | 6.15 | 17.29 | 48.46 | 6.61 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 0% | 21.78 | 5.77 | 11.66 | 9.52 | 50.02 | 4.94 |
| `fixed` | `average/average2-800ms-10pct` | `generated_18_2` | 100 | 0% | 19.61 | 7.44 | 10.40 | 9.45 | 49.92 | 5.70 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 14.38 | 8.37 | 13.50 | 7.81 | 34.77 | 4.00 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_2` | 100 | 0% | 21.08 | 5.95 | 11.60 | 9.51 | 48.47 | 5.30 |
| `fixed` | `average/average3-500ms-15pct` | `generated_15_2` | 100 | 0% | 18.39 | 8.43 | 5.89 | 17.37 | 48.40 | 6.61 |
| `fixed` | `average/average3-500ms-15pct` | `generated_16_2` | 100 | 0% | 18.91 | 8.38 | 6.70 | 9.27 | 48.48 | 6.61 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 0% | 21.95 | 5.77 | 11.79 | 9.53 | 49.88 | 4.49 |
| `fixed` | `average/average3-500ms-15pct` | `generated_18_2` | 100 | 0% | 20.57 | 7.33 | 10.60 | 9.58 | 50.16 | 5.15 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_15_2` | 100 | 2% | 21.32 | 8.11 | 6.73 | 17.23 | 48.04 | 6.04 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_16_2` | 100 | 2% | 19.55 | 8.33 | 7.23 | 9.38 | 48.11 | 6.18 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 14.26 | 8.46 | 13.73 | 7.83 | 34.33 | 3.93 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_2` | 100 | 0% | 21.42 | 5.87 | 11.39 | 9.57 | 48.68 | 5.12 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 0% | 21.64 | 5.83 | 11.70 | 9.47 | 50.26 | 4.28 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_18_2` | 100 | 0% | 19.60 | 7.61 | 10.53 | 9.55 | 49.89 | 4.97 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_16_2` | 100 | 2% | 19.25 | 8.36 | 7.12 | 9.23 | 47.75 | 6.45 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 14.23 | 8.50 | 13.86 | 7.85 | 34.05 | 3.78 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_2` | 100 | 0% | 20.72 | 6.04 | 11.57 | 9.63 | 48.10 | 5.05 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_15_2` | 100 | 0% | 20.29 | 8.22 | 6.45 | 17.31 | 48.52 | 6.22 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 0% | 22.02 | 5.74 | 11.76 | 9.46 | 50.15 | 4.22 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_18_2` | 100 | 0% | 20.60 | 7.38 | 10.86 | 9.68 | 50.07 | 4.86 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 14.18 | 8.50 | 13.64 | 7.84 | 34.16 | 4.13 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_2` | 100 | 0% | 20.03 | 6.16 | 10.96 | 9.50 | 48.38 | 5.44 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_15_2` | 100 | 0% | 17.58 | 8.44 | 5.36 | 17.42 | 48.31 | 7.60 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_16_2` | 100 | 0% | 16.75 | 8.62 | 6.22 | 9.41 | 48.38 | 7.30 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 0% | 20.68 | 5.98 | 11.31 | 9.53 | 50.19 | 4.74 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 100 | 0% | 18.60 | 7.79 | 9.63 | 9.61 | 49.92 | 5.66 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 14.32 | 8.40 | 13.62 | 7.84 | 34.71 | 4.09 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_2` | 100 | 0% | 20.42 | 6.09 | 11.06 | 9.46 | 48.72 | 5.56 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_15_2` | 100 | 0% | 18.92 | 8.35 | 6.31 | 17.46 | 47.62 | 6.42 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_16_2` | 100 | 0% | 18.44 | 8.40 | 6.55 | 9.27 | 48.48 | 6.87 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 0% | 22.14 | 5.70 | 11.64 | 9.44 | 50.30 | 4.28 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_18_2` | 100 | 0% | 20.72 | 7.25 | 10.55 | 9.47 | 49.97 | 4.96 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_16_2` | 100 | 1% | 20.36 | 8.22 | 7.16 | 9.07 | 48.15 | 6.15 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 14.18 | 8.47 | 13.63 | 7.85 | 35.15 | 4.11 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_2` | 100 | 0% | 22.25 | 5.69 | 11.86 | 9.47 | 48.69 | 4.93 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_15_2` | 100 | 0% | 18.68 | 8.42 | 6.30 | 17.47 | 48.54 | 6.50 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 0% | 21.37 | 5.89 | 11.57 | 9.49 | 50.58 | 4.39 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_18_2` | 100 | 0% | 21.04 | 7.29 | 10.93 | 9.52 | 50.13 | 4.79 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_16_2` | 100 | 1% | 19.52 | 8.30 | 7.07 | 9.18 | 48.01 | 6.36 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 14.05 | 8.51 | 13.68 | 7.89 | 34.57 | 4.07 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_2` | 100 | 0% | 20.98 | 5.95 | 11.42 | 9.52 | 48.56 | 5.27 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_15_2` | 100 | 0% | 19.11 | 8.36 | 6.28 | 17.52 | 48.37 | 6.56 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 0% | 22.07 | 5.71 | 11.87 | 9.45 | 50.44 | 4.22 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_18_2` | 100 | 0% | 20.38 | 7.37 | 10.68 | 9.53 | 50.20 | 5.06 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_allow-irregular-leak` | `default` | 100 | 0% | 14.70 | 8.34 | 13.27 | 7.72 | 34.59 | 4.19 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_allow-irregular-leak` | `generated_15_2` | 100 | 0% | 18.34 | 8.38 | 5.32 | 17.44 | 48.71 | 7.45 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_allow-irregular-leak` | `generated_17_2` | 100 | 0% | 19.39 | 6.30 | 10.26 | 9.58 | 50.42 | 5.65 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_allow-irregular-leak` | `generated_18_2` | 100 | 0% | 19.13 | 7.65 | 9.65 | 9.73 | 50.06 | 5.98 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-focus` | `default` | 100 | 0% | 14.15 | 8.48 | 13.43 | 7.87 | 34.40 | 4.25 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-focus` | `generated_15_2` | 100 | 0% | 17.62 | 8.52 | 5.15 | 17.60 | 48.16 | 7.58 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-focus` | `generated_17_2` | 100 | 0% | 20.59 | 6.04 | 10.70 | 9.72 | 50.07 | 5.50 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-focus` | `generated_18_2` | 100 | 0% | 18.71 | 7.76 | 9.54 | 9.78 | 50.01 | 6.11 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_allow-irregular-leak` | `default` | 100 | 0% | 13.73 | 8.64 | 13.15 | 7.98 | 34.27 | 4.66 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_allow-irregular-leak` | `generated_15_2` | 100 | 0% | 18.94 | 8.32 | 7.07 | 15.05 | 48.38 | 7.57 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_allow-irregular-leak` | `generated_17_2` | 100 | 0% | 18.61 | 6.25 | 9.74 | 7.31 | 50.65 | 6.78 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_allow-irregular-leak` | `generated_18_2` | 100 | 0% | 17.13 | 8.01 | 8.65 | 7.22 | 50.88 | 7.61 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-focus` | `default` | 100 | 0% | 13.79 | 8.63 | 13.31 | 7.87 | 34.08 | 4.51 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-focus` | `generated_15_2` | 100 | 0% | 18.99 | 8.34 | 7.29 | 15.06 | 48.54 | 7.33 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-focus` | `generated_17_2` | 100 | 0% | 19.22 | 6.08 | 10.36 | 7.36 | 50.81 | 5.98 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-focus` | `generated_18_2` | 100 | 0% | 17.15 | 7.96 | 8.88 | 7.01 | 50.71 | 7.39 |
