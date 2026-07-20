# 自定义关卡基础数值统计

生成时间：2026-07-16T15:34:12.856Z

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
| `Zul'Aman-2` | 阿曼尼小径 | `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 0% | 10.88 | 10.39 | 4.67 | 6.54 | 50.13 | 11.67 |

## Zul'Aman-2 阿曼尼小径

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 13.88 | 7.14 | 10.31 | 6.64 | 34.27 | 8.38 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_13_2` | 100 | 0% | 11.16 | 8.92 | 6.16 | 6.55 | 47.24 | 11.35 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_14_2` | 100 | 0% | 7.06 | 13.85 | 7.00 | 6.29 | 45.65 | 17.12 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_15_2` | 100 | 0% | 21.07 | 4.75 | 12.13 | 5.58 | 48.14 | 2.81 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_16_2` | 100 | 0% | 29.56 | 3.38 | 9.73 | 5.95 | 48.25 | 3.43 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 0% | 10.34 | 10.87 | 4.74 | 6.52 | 49.90 | 12.16 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 13.14 | 7.57 | 11.08 | 6.62 | 33.97 | 8.13 |
| `fixed` | `average/average2-800ms-10pct` | `generated_13_2` | 100 | 0% | 12.00 | 8.30 | 6.07 | 6.58 | 47.01 | 10.66 |
| `fixed` | `average/average2-800ms-10pct` | `generated_14_2` | 100 | 0% | 8.90 | 11.11 | 6.31 | 6.44 | 46.61 | 13.89 |
| `fixed` | `average/average2-800ms-10pct` | `generated_15_2` | 100 | 0% | 21.29 | 4.70 | 12.06 | 5.55 | 48.01 | 2.89 |
| `fixed` | `average/average2-800ms-10pct` | `generated_16_2` | 100 | 0% | 29.67 | 3.37 | 9.73 | 5.93 | 48.39 | 3.57 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 0% | 10.26 | 10.89 | 4.71 | 6.51 | 49.72 | 12.28 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 12.82 | 7.75 | 11.41 | 6.61 | 34.19 | 8.22 |
| `fixed` | `average/average3-500ms-15pct` | `generated_13_2` | 100 | 0% | 12.22 | 8.16 | 5.79 | 6.59 | 47.49 | 10.51 |
| `fixed` | `average/average3-500ms-15pct` | `generated_14_2` | 100 | 0% | 9.06 | 10.90 | 6.14 | 6.45 | 46.94 | 13.67 |
| `fixed` | `average/average3-500ms-15pct` | `generated_15_2` | 100 | 0% | 21.31 | 4.69 | 11.91 | 5.62 | 48.03 | 3.24 |
| `fixed` | `average/average3-500ms-15pct` | `generated_16_2` | 100 | 0% | 28.96 | 3.45 | 9.56 | 5.96 | 48.14 | 3.87 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 0% | 10.64 | 10.56 | 4.87 | 6.53 | 49.56 | 11.93 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 12.86 | 7.72 | 11.40 | 6.60 | 34.08 | 8.10 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_13_2` | 100 | 0% | 11.42 | 8.69 | 5.93 | 6.56 | 47.36 | 11.14 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_14_2` | 100 | 0% | 7.46 | 13.14 | 6.81 | 6.33 | 46.21 | 16.28 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_15_2` | 100 | 0% | 21.10 | 4.74 | 12.24 | 5.54 | 47.79 | 2.38 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_16_2` | 100 | 0% | 29.55 | 3.38 | 9.74 | 5.93 | 48.42 | 3.39 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 0% | 10.72 | 10.48 | 4.87 | 6.53 | 50.00 | 11.84 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 12.98 | 7.64 | 11.06 | 6.61 | 34.25 | 8.16 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_13_2` | 100 | 0% | 11.32 | 8.78 | 6.02 | 6.56 | 47.57 | 11.22 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_14_2` | 100 | 0% | 7.62 | 12.87 | 6.75 | 6.34 | 46.11 | 15.97 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_15_2` | 100 | 0% | 21.16 | 4.73 | 12.12 | 5.61 | 48.01 | 2.82 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_16_2` | 100 | 0% | 29.83 | 3.35 | 9.80 | 5.97 | 48.32 | 3.37 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 0% | 10.30 | 10.86 | 4.94 | 6.51 | 49.76 | 12.29 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 13.42 | 7.42 | 11.13 | 6.62 | 34.14 | 7.95 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_13_2` | 100 | 0% | 12.36 | 8.08 | 6.09 | 6.60 | 47.13 | 10.38 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_14_2` | 100 | 0% | 8.60 | 11.47 | 6.40 | 6.42 | 46.78 | 14.32 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_15_2` | 100 | 0% | 20.85 | 4.80 | 12.24 | 5.47 | 48.01 | 2.46 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_16_2` | 100 | 0% | 29.88 | 3.35 | 9.80 | 5.92 | 48.23 | 3.31 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 0% | 10.14 | 11.00 | 4.93 | 6.51 | 50.18 | 12.43 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 13.28 | 7.48 | 11.40 | 6.62 | 34.05 | 8.05 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_13_2` | 100 | 0% | 12.16 | 8.21 | 5.98 | 6.59 | 47.14 | 10.54 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_14_2` | 100 | 0% | 8.26 | 11.92 | 6.53 | 6.39 | 46.66 | 14.85 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_15_2` | 100 | 0% | 21.00 | 4.76 | 12.21 | 5.49 | 47.90 | 2.51 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_16_2` | 100 | 0% | 29.93 | 3.34 | 9.77 | 5.89 | 48.24 | 3.37 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 0% | 9.68 | 11.43 | 4.82 | 6.48 | 49.83 | 12.90 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 13.32 | 7.45 | 10.92 | 6.62 | 34.05 | 8.14 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_13_2` | 100 | 0% | 10.96 | 9.09 | 6.17 | 6.54 | 47.31 | 11.54 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_14_2` | 100 | 0% | 7.70 | 12.73 | 6.68 | 6.35 | 46.32 | 15.82 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_15_2` | 100 | 0% | 21.08 | 4.74 | 11.99 | 5.66 | 47.86 | 3.10 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_16_2` | 100 | 0% | 29.73 | 3.36 | 9.78 | 5.98 | 48.18 | 3.35 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 0% | 10.88 | 10.39 | 4.67 | 6.54 | 50.13 | 11.67 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 12.42 | 7.99 | 11.40 | 6.59 | 34.05 | 8.12 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_13_2` | 100 | 0% | 11.80 | 8.44 | 6.09 | 6.58 | 47.30 | 10.82 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_14_2` | 100 | 0% | 7.46 | 13.09 | 6.67 | 6.33 | 46.21 | 16.28 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_15_2` | 100 | 0% | 21.41 | 4.67 | 11.89 | 5.69 | 48.36 | 3.39 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_16_2` | 100 | 0% | 29.02 | 3.45 | 9.61 | 6.11 | 48.39 | 3.92 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 0% | 10.06 | 11.11 | 4.96 | 6.50 | 49.94 | 12.51 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `default` | 100 | 0% | 13.56 | 7.35 | 10.93 | 6.63 | 34.06 | 7.98 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_13_2` | 100 | 0% | 11.22 | 8.88 | 6.14 | 6.55 | 46.93 | 11.30 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_14_2` | 100 | 0% | 7.30 | 13.38 | 6.78 | 6.32 | 46.57 | 16.60 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_15_2` | 100 | 0% | 20.96 | 4.77 | 12.15 | 5.58 | 48.01 | 2.68 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `default` | 100 | 0% | 13.58 | 7.31 | 10.75 | 6.63 | 34.09 | 8.10 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_13_2` | 100 | 0% | 11.40 | 8.74 | 6.24 | 6.56 | 47.28 | 11.15 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_14_2` | 100 | 0% | 7.38 | 13.27 | 6.86 | 6.32 | 46.15 | 16.44 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_15_2` | 100 | 0% | 21.15 | 4.73 | 12.07 | 5.60 | 48.13 | 2.88 |
