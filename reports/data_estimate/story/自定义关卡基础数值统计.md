# 自定义关卡基础数值统计

生成时间：2026-07-16T15:54:31.759Z

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
| `Zul'Aman-6` | 阿塔阿曼 | `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 0% | 13.04 | 9.10 | 5.59 | 6.62 | 43.06 | 9.86 |

## Zul'Aman-6 阿塔阿曼

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 12.54 | 9.24 | 10.31 | 6.60 | 29.04 | 7.87 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_2` | 100 | 0% | 14.34 | 6.97 | 6.81 | 6.65 | 39.03 | 8.88 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_10_2` | 100 | 0% | 14.01 | 7.17 | 6.51 | 6.64 | 47.47 | 9.12 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_11_2` | 100 | 0% | 13.58 | 8.11 | 6.07 | 11.11 | 39.44 | 9.50 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 0% | 14.36 | 6.96 | 6.55 | 6.65 | 42.54 | 9.09 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_18_2` | 100 | 0% | 13.46 | 8.88 | 5.82 | 6.63 | 42.03 | 9.51 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 12.91 | 9.07 | 10.49 | 6.61 | 29.88 | 7.71 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_2` | 100 | 0% | 15.17 | 6.59 | 7.36 | 6.67 | 39.32 | 8.48 |
| `fixed` | `average/average2-800ms-10pct` | `generated_10_2` | 100 | 0% | 15.66 | 6.50 | 7.57 | 6.66 | 47.35 | 8.17 |
| `fixed` | `average/average2-800ms-10pct` | `generated_11_2` | 100 | 0% | 13.29 | 8.28 | 5.86 | 11.14 | 40.37 | 9.69 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 0% | 14.41 | 6.94 | 6.51 | 6.65 | 41.80 | 9.03 |
| `fixed` | `average/average2-800ms-10pct` | `generated_18_2` | 100 | 0% | 13.74 | 8.71 | 5.92 | 6.64 | 42.48 | 9.40 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 12.79 | 9.10 | 10.50 | 6.61 | 29.48 | 7.65 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_2` | 100 | 0% | 14.47 | 6.91 | 6.89 | 6.65 | 39.79 | 8.86 |
| `fixed` | `average/average3-500ms-15pct` | `generated_10_2` | 100 | 0% | 16.29 | 6.30 | 7.80 | 6.67 | 47.27 | 7.77 |
| `fixed` | `average/average3-500ms-15pct` | `generated_11_2` | 100 | 0% | 13.36 | 8.24 | 6.12 | 11.18 | 40.20 | 9.73 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 0% | 14.34 | 6.98 | 6.34 | 6.65 | 42.26 | 9.09 |
| `fixed` | `average/average3-500ms-15pct` | `generated_18_2` | 100 | 0% | 13.43 | 8.89 | 5.85 | 6.63 | 42.47 | 9.64 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 12.93 | 9.09 | 10.57 | 6.61 | 29.36 | 7.65 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_2` | 100 | 0% | 14.22 | 7.03 | 6.71 | 6.65 | 39.46 | 8.98 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_10_2` | 100 | 0% | 14.11 | 7.12 | 6.65 | 6.65 | 47.44 | 9.07 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_11_2` | 100 | 0% | 13.07 | 8.42 | 5.98 | 11.27 | 39.81 | 9.90 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 0% | 14.16 | 7.06 | 6.32 | 6.65 | 42.31 | 9.14 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_18_2` | 100 | 0% | 13.28 | 9.02 | 5.82 | 6.62 | 42.81 | 9.71 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 12.88 | 9.05 | 10.45 | 6.61 | 29.72 | 7.69 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_2` | 100 | 0% | 14.62 | 6.84 | 7.05 | 6.66 | 39.05 | 8.82 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_10_2` | 100 | 0% | 14.53 | 6.95 | 6.79 | 6.65 | 47.16 | 8.73 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_11_2` | 100 | 0% | 13.22 | 8.32 | 6.05 | 11.16 | 39.75 | 9.80 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 0% | 14.22 | 7.03 | 6.33 | 6.65 | 42.38 | 9.14 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_18_2` | 100 | 0% | 13.69 | 8.78 | 5.96 | 6.63 | 42.18 | 9.39 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 13.26 | 8.86 | 11.01 | 6.58 | 30.68 | 7.01 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_2` | 100 | 0% | 15.94 | 6.27 | 7.76 | 6.67 | 40.16 | 8.07 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_10_2` | 100 | 0% | 18.43 | 5.66 | 9.15 | 6.72 | 46.39 | 6.45 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_11_2` | 100 | 0% | 13.39 | 8.21 | 5.97 | 11.28 | 41.40 | 9.74 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 0% | 15.26 | 6.55 | 6.87 | 6.67 | 42.91 | 8.62 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 100 | 0% | 13.04 | 9.10 | 5.59 | 6.62 | 43.06 | 9.86 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 12.96 | 9.04 | 10.48 | 6.61 | 30.21 | 7.65 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_2` | 100 | 0% | 14.39 | 6.95 | 6.96 | 6.65 | 39.53 | 8.88 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_10_2` | 100 | 0% | 15.79 | 6.45 | 7.59 | 6.68 | 47.25 | 8.32 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_11_2` | 100 | 0% | 13.05 | 8.43 | 5.89 | 11.21 | 39.79 | 9.89 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 0% | 14.46 | 6.91 | 6.56 | 6.65 | 42.67 | 9.02 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_18_2` | 100 | 0% | 13.64 | 8.80 | 5.96 | 6.63 | 42.90 | 9.54 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 12.71 | 9.15 | 10.41 | 6.61 | 29.54 | 7.75 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_2` | 100 | 0% | 14.48 | 6.91 | 6.88 | 6.65 | 39.40 | 8.86 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_10_2` | 100 | 0% | 14.25 | 7.04 | 6.66 | 6.64 | 47.15 | 8.89 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_11_2` | 100 | 0% | 13.23 | 8.32 | 5.92 | 11.16 | 39.73 | 9.67 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 0% | 14.32 | 6.98 | 6.58 | 6.65 | 41.75 | 9.10 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_18_2` | 100 | 0% | 13.51 | 8.85 | 5.80 | 6.63 | 42.55 | 9.51 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 12.82 | 9.06 | 10.41 | 6.61 | 29.28 | 7.68 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_2` | 100 | 0% | 14.70 | 6.81 | 7.09 | 6.66 | 39.02 | 8.69 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_10_2` | 100 | 0% | 14.37 | 7.01 | 6.67 | 6.64 | 47.03 | 8.89 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_11_2` | 100 | 0% | 13.50 | 8.16 | 6.05 | 11.13 | 39.70 | 9.54 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 0% | 14.68 | 6.81 | 6.62 | 6.66 | 41.83 | 8.84 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_18_2` | 100 | 0% | 13.59 | 8.83 | 5.97 | 6.63 | 42.78 | 9.54 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `default` | 100 | 0% | 12.55 | 9.21 | 10.25 | 6.60 | 29.36 | 7.77 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_1_2` | 100 | 0% | 14.18 | 7.05 | 6.71 | 6.65 | 39.06 | 9.01 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_17_2` | 100 | 0% | 14.25 | 7.02 | 6.40 | 6.65 | 41.93 | 9.10 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_18_2` | 100 | 0% | 13.74 | 8.75 | 5.96 | 6.64 | 42.66 | 9.40 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `default` | 100 | 0% | 12.58 | 9.15 | 10.25 | 6.60 | 29.73 | 7.86 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_1_2` | 100 | 0% | 13.68 | 7.31 | 6.39 | 6.63 | 39.36 | 9.32 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_17_2` | 100 | 0% | 14.64 | 6.83 | 6.76 | 6.66 | 41.98 | 8.88 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_18_2` | 100 | 0% | 13.74 | 8.74 | 6.10 | 6.64 | 42.21 | 9.31 |
