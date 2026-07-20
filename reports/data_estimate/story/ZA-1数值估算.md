# 自定义关卡基础数值统计

生成时间：2026-07-16T14:28:25.995Z

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
| `Zul'Aman-1` | 日冕村 | `fixed` | `expert/expert1-200ms-1pct` | `generated_9_2` | 51% | 23.58 | 8.63 | 10.46 | 5.00 | 55.21 | 0.00 |

## Zul'Aman-1 日冕村

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `generated_9_2` | 100 | 50% | 23.32 | 8.73 | 10.31 | 5.01 | 55.53 | 0.01 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_10_2` | 100 | 41% | 27.03 | 6.30 | 10.41 | 13.44 | 46.73 | 1.04 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_11_2` | 100 | 36% | 26.59 | 6.25 | 10.54 | 5.97 | 47.07 | 1.00 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 29% | 22.62 | 6.00 | 11.12 | 5.32 | 50.72 | 0.35 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_6_2` | 100 | 21% | 21.56 | 6.23 | 11.63 | 5.24 | 51.84 | 0.26 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 7.64 | 11.39 | 18.10 | 5.89 | 37.73 | 1.30 |
| `fixed` | `average/average2-800ms-10pct` | `generated_9_2` | 100 | 50% | 23.24 | 8.80 | 10.37 | 5.01 | 55.79 | 0.01 |
| `fixed` | `average/average2-800ms-10pct` | `generated_10_2` | 100 | 39% | 26.55 | 6.40 | 10.52 | 13.53 | 47.29 | 1.08 |
| `fixed` | `average/average2-800ms-10pct` | `generated_11_2` | 100 | 37% | 26.70 | 6.29 | 10.50 | 6.01 | 46.98 | 1.03 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 28% | 22.47 | 6.02 | 11.24 | 5.39 | 50.96 | 0.43 |
| `fixed` | `average/average2-800ms-10pct` | `generated_6_2` | 100 | 20% | 21.70 | 6.20 | 11.58 | 5.40 | 52.02 | 0.47 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 8.14 | 11.12 | 17.29 | 5.83 | 37.64 | 1.21 |
| `fixed` | `average/average3-500ms-15pct` | `generated_9_2` | 100 | 42% | 22.35 | 9.13 | 10.77 | 5.06 | 56.90 | 0.06 |
| `fixed` | `average/average3-500ms-15pct` | `generated_11_2` | 100 | 37% | 26.45 | 6.44 | 10.54 | 6.02 | 47.18 | 1.04 |
| `fixed` | `average/average3-500ms-15pct` | `generated_10_2` | 100 | 34% | 26.58 | 6.33 | 10.53 | 13.42 | 47.15 | 1.00 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 23% | 21.91 | 6.18 | 11.46 | 5.38 | 51.63 | 0.42 |
| `fixed` | `average/average3-500ms-15pct` | `generated_6_2` | 100 | 15% | 21.30 | 6.33 | 11.77 | 5.38 | 51.82 | 0.42 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 7.72 | 11.45 | 17.96 | 5.61 | 37.76 | 0.86 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_9_2` | 100 | 51% | 23.58 | 8.63 | 10.46 | 5.00 | 55.21 | 0.00 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_10_2` | 100 | 43% | 26.95 | 6.27 | 10.42 | 13.15 | 46.75 | 0.82 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_11_2` | 100 | 41% | 27.12 | 6.26 | 10.38 | 5.86 | 46.87 | 0.87 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_6_2` | 100 | 28% | 22.30 | 6.04 | 11.25 | 5.24 | 51.13 | 0.25 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 20% | 21.67 | 6.16 | 11.61 | 5.23 | 51.83 | 0.24 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 7.36 | 11.79 | 18.60 | 5.61 | 37.73 | 0.86 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_9_2` | 100 | 50% | 23.32 | 8.64 | 10.33 | 5.00 | 55.83 | 0.00 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_10_2` | 100 | 41% | 26.90 | 6.24 | 10.43 | 13.31 | 46.92 | 0.99 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_11_2` | 100 | 37% | 26.47 | 6.30 | 10.53 | 5.86 | 47.09 | 0.88 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 26% | 21.94 | 6.11 | 11.37 | 5.28 | 51.59 | 0.29 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_6_2` | 100 | 26% | 22.03 | 6.08 | 11.36 | 5.29 | 51.40 | 0.31 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 7.32 | 11.88 | 18.66 | 5.62 | 37.57 | 0.85 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_9_2` | 100 | 47% | 23.02 | 8.87 | 10.51 | 5.02 | 56.08 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_11_2` | 100 | 44% | 27.25 | 6.22 | 10.32 | 5.98 | 46.64 | 1.01 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_10_2` | 100 | 43% | 26.85 | 6.25 | 10.46 | 13.39 | 47.22 | 1.10 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_6_2` | 100 | 27% | 22.04 | 6.09 | 11.39 | 5.30 | 51.53 | 0.32 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 24% | 22.14 | 6.05 | 11.31 | 5.32 | 51.48 | 0.35 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 7.44 | 11.64 | 18.44 | 5.82 | 37.80 | 1.16 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_9_2` | 100 | 50% | 23.15 | 8.85 | 10.53 | 5.01 | 56.01 | 0.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_11_2` | 100 | 44% | 27.25 | 6.20 | 10.35 | 5.96 | 46.64 | 0.99 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_10_2` | 100 | 43% | 27.03 | 6.23 | 10.42 | 13.29 | 46.68 | 0.99 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_6_2` | 100 | 27% | 22.14 | 6.08 | 11.28 | 5.26 | 51.09 | 0.28 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 22% | 21.98 | 6.12 | 11.39 | 5.37 | 51.13 | 0.40 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 7.68 | 11.48 | 18.03 | 5.57 | 37.78 | 0.72 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_9_2` | 100 | 47% | 22.97 | 9.00 | 10.61 | 5.01 | 56.29 | 0.01 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_10_2` | 100 | 41% | 26.75 | 6.27 | 10.49 | 13.26 | 47.05 | 0.93 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_11_2` | 100 | 33% | 26.31 | 6.29 | 10.57 | 6.05 | 47.06 | 1.07 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 25% | 22.08 | 6.07 | 11.35 | 5.31 | 51.51 | 0.33 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_6_2` | 100 | 16% | 21.41 | 6.23 | 11.73 | 5.42 | 52.01 | 0.44 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 7.52 | 11.60 | 18.30 | 5.56 | 37.83 | 0.86 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_9_2` | 100 | 49% | 22.96 | 8.81 | 10.65 | 5.02 | 56.51 | 0.03 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_11_2` | 100 | 41% | 26.92 | 6.27 | 10.43 | 6.01 | 47.15 | 1.05 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_10_2` | 100 | 38% | 26.76 | 6.39 | 10.44 | 13.50 | 47.06 | 0.99 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 24% | 22.08 | 6.07 | 11.42 | 5.38 | 51.45 | 0.42 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_6_2` | 100 | 22% | 21.72 | 6.18 | 11.55 | 5.29 | 51.78 | 0.30 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 7.43 | 11.68 | 18.46 | 5.67 | 37.76 | 1.00 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_9_2` | 100 | 49% | 23.46 | 8.66 | 10.52 | 5.00 | 55.34 | 0.00 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `generated_9_2` | 100 | 45% | 22.98 | 8.84 | 10.59 | 5.01 | 56.01 | 0.01 |
