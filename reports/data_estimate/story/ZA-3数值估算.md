# 自定义关卡基础数值统计

生成时间：2026-07-16T15:39:13.030Z

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
| `Zul'Aman-3` | 残破神庙 | `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_12_2` | 34% | 40.30 | 6.30 | 8.47 | 14.16 | 49.30 | 1.13 |

## Zul'Aman-3 残破神庙

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `generated_12_2` | 100 | 8% | 38.77 | 6.33 | 8.77 | 14.26 | 49.28 | 1.24 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_13_2` | 100 | 1% | 33.76 | 6.63 | 9.45 | 6.60 | 49.07 | 1.24 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_18_2` | 100 | 1% | 27.48 | 5.23 | 10.43 | 6.62 | 50.68 | 1.35 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 18.69 | 6.52 | 10.38 | 6.49 | 39.45 | 1.60 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_10_2` | 100 | 0% | 25.54 | 4.33 | 10.88 | 6.62 | 48.83 | 1.46 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_4_2` | 100 | 0% | 25.38 | 4.35 | 10.92 | 6.58 | 48.65 | 1.44 |
| `fixed` | `average/average2-800ms-10pct` | `generated_12_2` | 100 | 9% | 38.41 | 6.35 | 8.84 | 14.29 | 49.25 | 1.29 |
| `fixed` | `average/average2-800ms-10pct` | `generated_13_2` | 100 | 4% | 33.62 | 6.64 | 9.45 | 6.59 | 49.33 | 1.24 |
| `fixed` | `average/average2-800ms-10pct` | `generated_10_2` | 100 | 2% | 26.98 | 4.14 | 10.54 | 6.66 | 48.59 | 1.48 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 18.72 | 6.61 | 10.39 | 6.50 | 39.56 | 1.58 |
| `fixed` | `average/average2-800ms-10pct` | `generated_18_2` | 100 | 0% | 27.49 | 5.25 | 10.46 | 6.63 | 50.75 | 1.41 |
| `fixed` | `average/average2-800ms-10pct` | `generated_4_2` | 100 | 0% | 27.08 | 4.13 | 10.54 | 6.61 | 48.76 | 1.43 |
| `fixed` | `average/average3-500ms-15pct` | `generated_12_2` | 100 | 8% | 38.22 | 6.36 | 8.86 | 14.20 | 48.98 | 1.25 |
| `fixed` | `average/average3-500ms-15pct` | `generated_13_2` | 100 | 6% | 33.70 | 6.65 | 9.42 | 6.66 | 48.96 | 1.27 |
| `fixed` | `average/average3-500ms-15pct` | `generated_10_2` | 100 | 1% | 27.78 | 4.05 | 10.39 | 6.64 | 48.68 | 1.45 |
| `fixed` | `average/average3-500ms-15pct` | `generated_4_2` | 100 | 1% | 28.12 | 4.01 | 10.31 | 6.62 | 49.10 | 1.40 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 18.84 | 6.77 | 10.42 | 6.52 | 39.62 | 1.60 |
| `fixed` | `average/average3-500ms-15pct` | `generated_18_2` | 100 | 0% | 26.82 | 5.33 | 10.60 | 6.63 | 50.64 | 1.38 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_12_2` | 100 | 20% | 40.02 | 6.29 | 8.59 | 14.23 | 49.52 | 1.20 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_13_2` | 100 | 18% | 36.21 | 6.51 | 9.06 | 6.56 | 49.60 | 1.18 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_18_2` | 100 | 3% | 28.17 | 5.16 | 10.28 | 6.60 | 50.28 | 1.32 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_10_2` | 100 | 1% | 28.56 | 3.95 | 10.22 | 6.60 | 48.80 | 1.39 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 18.99 | 6.80 | 10.44 | 6.49 | 40.07 | 1.59 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_4_2` | 100 | 0% | 27.87 | 4.03 | 10.39 | 6.62 | 49.09 | 1.38 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_12_2` | 100 | 24% | 40.61 | 6.28 | 8.46 | 14.16 | 48.83 | 1.13 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_13_2` | 100 | 7% | 35.10 | 6.55 | 9.25 | 6.63 | 49.74 | 1.22 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 18.98 | 6.82 | 10.45 | 6.50 | 40.12 | 1.58 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_10_2` | 100 | 0% | 27.71 | 4.05 | 10.42 | 6.63 | 48.66 | 1.39 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_18_2` | 100 | 0% | 27.92 | 5.19 | 10.38 | 6.59 | 50.55 | 1.35 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_4_2` | 100 | 0% | 28.08 | 4.01 | 10.34 | 6.61 | 48.53 | 1.39 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_12_2` | 100 | 26% | 40.18 | 6.31 | 8.48 | 14.18 | 49.35 | 1.18 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_13_2` | 100 | 17% | 35.60 | 6.54 | 9.16 | 6.55 | 49.65 | 1.19 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_10_2` | 100 | 2% | 27.37 | 4.09 | 10.43 | 6.65 | 48.74 | 1.42 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 100 | 2% | 27.26 | 5.26 | 10.43 | 6.59 | 50.51 | 1.35 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_4_2` | 100 | 1% | 26.77 | 4.17 | 10.58 | 6.64 | 48.81 | 1.44 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 18.90 | 6.84 | 10.46 | 6.49 | 40.15 | 1.59 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_12_2` | 100 | 4% | 38.24 | 6.34 | 8.87 | 14.23 | 49.63 | 1.19 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_13_2` | 100 | 4% | 33.56 | 6.60 | 9.46 | 6.60 | 49.46 | 1.24 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_10_2` | 100 | 2% | 28.49 | 3.96 | 10.22 | 6.64 | 49.07 | 1.38 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 18.95 | 6.74 | 10.41 | 6.52 | 39.94 | 1.60 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_18_2` | 100 | 0% | 27.87 | 5.20 | 10.38 | 6.59 | 50.70 | 1.33 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_4_2` | 100 | 0% | 27.50 | 4.08 | 10.46 | 6.64 | 48.63 | 1.41 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_12_2` | 100 | 20% | 39.66 | 6.31 | 8.61 | 14.18 | 49.06 | 1.18 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_13_2` | 100 | 12% | 35.21 | 6.56 | 9.19 | 6.59 | 49.31 | 1.20 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_10_2` | 100 | 2% | 27.92 | 4.03 | 10.35 | 6.60 | 48.74 | 1.40 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 18.93 | 6.79 | 10.46 | 6.49 | 39.92 | 1.59 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_18_2` | 100 | 0% | 27.64 | 5.21 | 10.43 | 6.61 | 50.39 | 1.36 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_4_2` | 100 | 0% | 27.60 | 4.07 | 10.44 | 6.61 | 48.35 | 1.40 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_12_2` | 100 | 28% | 40.58 | 6.30 | 8.40 | 14.18 | 48.85 | 1.21 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_13_2` | 100 | 15% | 35.28 | 6.56 | 9.20 | 6.60 | 49.63 | 1.24 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_4_2` | 100 | 2% | 28.46 | 3.97 | 10.22 | 6.57 | 48.68 | 1.36 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 18.94 | 6.82 | 10.44 | 6.50 | 40.13 | 1.60 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_10_2` | 100 | 0% | 27.59 | 4.07 | 10.44 | 6.62 | 48.62 | 1.42 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_18_2` | 100 | 0% | 27.40 | 5.25 | 10.48 | 6.62 | 50.59 | 1.35 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-tank-chain` | `generated_12_2` | 100 | 11% | 38.65 | 6.30 | 8.75 | 14.32 | 47.15 | 1.47 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_12_2` | 100 | 34% | 40.30 | 6.30 | 8.47 | 14.16 | 49.30 | 1.13 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_mechanic-wax-tank-chain` | `generated_12_2` | 100 | 11% | 39.92 | 6.21 | 8.61 | 14.29 | 47.26 | 1.44 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `generated_12_2` | 100 | 29% | 40.51 | 6.28 | 8.39 | 14.14 | 49.13 | 1.17 |
