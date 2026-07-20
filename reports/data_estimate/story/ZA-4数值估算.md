# 自定义关卡基础数值统计

生成时间：2026-07-16T15:45:07.187Z

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
| `Zul'Aman-4` | 枯木山崖 | `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 2% | 24.26 | 5.16 | 11.09 | 6.07 | 48.30 | 1.03 |

## Zul'Aman-4 枯木山崖

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 14.82 | 7.08 | 11.96 | 5.91 | 34.24 | 1.31 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_14_2` | 100 | 0% | 21.71 | 4.61 | 11.81 | 5.98 | 47.26 | 1.20 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_15_2` | 100 | 0% | 23.43 | 5.81 | 9.57 | 6.50 | 47.76 | 3.39 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_16_2` | 100 | 0% | 18.69 | 6.79 | 13.16 | 5.04 | 46.78 | 0.04 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 0% | 20.06 | 4.99 | 12.48 | 5.07 | 45.99 | 0.08 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_18_2` | 100 | 0% | 23.28 | 5.27 | 11.45 | 5.93 | 48.19 | 0.88 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 14.50 | 7.16 | 12.18 | 5.86 | 34.49 | 1.23 |
| `fixed` | `average/average2-800ms-10pct` | `generated_14_2` | 100 | 0% | 21.30 | 4.69 | 11.87 | 5.83 | 47.78 | 1.02 |
| `fixed` | `average/average2-800ms-10pct` | `generated_15_2` | 100 | 0% | 23.81 | 5.78 | 9.68 | 6.53 | 47.77 | 3.27 |
| `fixed` | `average/average2-800ms-10pct` | `generated_16_2` | 100 | 0% | 18.52 | 6.91 | 13.34 | 5.05 | 47.00 | 0.05 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 0% | 19.91 | 5.02 | 12.54 | 5.06 | 46.19 | 0.06 |
| `fixed` | `average/average2-800ms-10pct` | `generated_18_2` | 100 | 0% | 23.65 | 5.26 | 11.28 | 6.09 | 48.02 | 1.04 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 14.55 | 7.13 | 12.14 | 5.92 | 34.35 | 1.31 |
| `fixed` | `average/average3-500ms-15pct` | `generated_14_2` | 100 | 0% | 21.45 | 4.66 | 11.98 | 5.91 | 47.71 | 0.90 |
| `fixed` | `average/average3-500ms-15pct` | `generated_15_2` | 100 | 0% | 23.91 | 5.78 | 9.94 | 6.53 | 47.44 | 2.99 |
| `fixed` | `average/average3-500ms-15pct` | `generated_16_2` | 100 | 0% | 18.31 | 7.08 | 13.47 | 5.05 | 47.62 | 0.05 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 0% | 19.80 | 5.05 | 12.58 | 5.05 | 45.86 | 0.06 |
| `fixed` | `average/average3-500ms-15pct` | `generated_18_2` | 100 | 0% | 23.89 | 5.22 | 11.13 | 6.20 | 48.34 | 1.29 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 15.09 | 7.02 | 11.80 | 5.98 | 34.85 | 1.29 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_14_2` | 100 | 0% | 21.47 | 4.66 | 12.03 | 5.90 | 47.31 | 0.87 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_15_2` | 100 | 0% | 24.05 | 5.73 | 10.12 | 6.53 | 47.79 | 2.89 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_16_2` | 100 | 0% | 18.16 | 7.27 | 13.29 | 5.02 | 49.05 | 0.01 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 0% | 19.91 | 5.02 | 12.54 | 5.05 | 46.01 | 0.05 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_18_2` | 100 | 0% | 23.27 | 5.30 | 11.42 | 5.89 | 47.85 | 0.81 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 15.10 | 7.02 | 11.79 | 5.96 | 34.75 | 1.21 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_14_2` | 100 | 0% | 21.46 | 4.66 | 11.88 | 5.95 | 47.58 | 1.10 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_15_2` | 100 | 0% | 23.91 | 5.77 | 9.88 | 6.54 | 47.88 | 3.14 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_16_2` | 100 | 0% | 17.91 | 7.33 | 13.41 | 5.02 | 49.11 | 0.01 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 0% | 19.87 | 5.03 | 12.55 | 5.04 | 45.56 | 0.04 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_18_2` | 100 | 0% | 23.64 | 5.23 | 11.35 | 5.91 | 48.29 | 0.84 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 100 | 2% | 24.26 | 5.16 | 11.09 | 6.07 | 48.30 | 1.03 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 15.48 | 6.92 | 11.64 | 6.01 | 35.01 | 1.32 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_14_2` | 100 | 0% | 20.99 | 4.77 | 12.18 | 5.70 | 47.58 | 0.65 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_15_2` | 100 | 0% | 23.35 | 5.89 | 9.43 | 6.53 | 48.26 | 3.50 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_16_2` | 100 | 0% | 18.04 | 7.31 | 13.35 | 5.03 | 49.07 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 0% | 19.79 | 5.05 | 12.58 | 5.03 | 45.88 | 0.03 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 13.93 | 7.29 | 12.45 | 5.88 | 34.42 | 1.25 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_14_2` | 100 | 0% | 21.23 | 4.71 | 12.01 | 5.76 | 47.37 | 0.89 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_15_2` | 100 | 0% | 24.10 | 5.72 | 10.12 | 6.53 | 47.24 | 2.85 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_16_2` | 100 | 0% | 18.32 | 7.08 | 13.49 | 5.02 | 48.02 | 0.02 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 0% | 19.72 | 5.07 | 12.61 | 5.03 | 46.05 | 0.03 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_18_2` | 100 | 0% | 23.27 | 5.30 | 11.40 | 5.97 | 48.35 | 0.95 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 14.67 | 7.11 | 12.03 | 5.95 | 34.77 | 1.28 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_14_2` | 100 | 0% | 21.56 | 4.64 | 12.00 | 5.94 | 47.41 | 0.91 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_15_2` | 100 | 0% | 23.45 | 5.87 | 9.67 | 6.52 | 48.10 | 3.27 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_16_2` | 100 | 0% | 18.09 | 7.25 | 13.33 | 5.04 | 48.59 | 0.03 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 0% | 20.10 | 4.98 | 12.47 | 5.07 | 45.86 | 0.07 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_18_2` | 100 | 0% | 23.91 | 5.20 | 11.22 | 6.08 | 47.86 | 1.03 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 15.17 | 6.99 | 11.81 | 5.97 | 34.70 | 1.30 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_14_2` | 100 | 0% | 21.72 | 4.60 | 11.80 | 6.05 | 47.26 | 1.18 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_15_2` | 100 | 0% | 24.09 | 5.74 | 10.13 | 6.53 | 47.47 | 2.80 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_16_2` | 100 | 0% | 18.03 | 7.29 | 13.35 | 5.04 | 48.65 | 0.02 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 0% | 19.89 | 5.03 | 12.54 | 5.05 | 45.84 | 0.05 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_18_2` | 100 | 0% | 23.33 | 5.29 | 11.39 | 6.03 | 48.24 | 1.04 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-party-chain` | `default` | 100 | 0% | 14.70 | 7.15 | 11.96 | 5.86 | 34.94 | 1.01 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-party-chain` | `generated_14_2` | 100 | 0% | 21.47 | 4.66 | 12.05 | 5.91 | 47.44 | 0.81 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-party-chain` | `generated_15_2` | 100 | 0% | 24.49 | 5.71 | 10.34 | 6.53 | 47.58 | 2.63 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-party-chain` | `generated_16_2` | 100 | 0% | 17.97 | 7.30 | 13.38 | 5.07 | 48.84 | 0.06 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-tank-chain` | `default` | 100 | 0% | 14.75 | 7.12 | 12.00 | 5.89 | 34.89 | 1.05 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-tank-chain` | `generated_14_2` | 100 | 0% | 21.37 | 4.68 | 12.02 | 5.89 | 47.34 | 0.85 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-tank-chain` | `generated_15_2` | 100 | 0% | 24.51 | 5.69 | 10.41 | 6.51 | 47.30 | 2.58 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-tank-chain` | `generated_16_2` | 100 | 0% | 18.26 | 7.24 | 13.27 | 5.09 | 48.85 | 0.07 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-party-chain` | `default` | 100 | 0% | 14.23 | 7.30 | 12.25 | 5.85 | 34.37 | 1.05 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-party-chain` | `generated_14_2` | 100 | 0% | 21.30 | 4.70 | 12.12 | 6.00 | 47.47 | 0.99 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-party-chain` | `generated_15_2` | 100 | 0% | 24.95 | 5.59 | 10.74 | 6.55 | 47.07 | 2.36 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-party-chain` | `generated_16_2` | 100 | 0% | 19.25 | 7.04 | 12.89 | 5.14 | 48.63 | 0.13 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-tank-chain` | `default` | 100 | 0% | 14.00 | 7.34 | 12.40 | 5.85 | 34.40 | 1.11 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-tank-chain` | `generated_14_2` | 100 | 0% | 21.40 | 4.67 | 12.03 | 6.04 | 47.10 | 1.09 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-tank-chain` | `generated_15_2` | 100 | 0% | 24.78 | 5.63 | 10.62 | 6.54 | 47.31 | 2.43 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-tank-chain` | `generated_16_2` | 100 | 0% | 19.04 | 7.08 | 12.96 | 5.15 | 48.37 | 0.14 |
