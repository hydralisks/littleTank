# 挑战模式第1~3关基础数值统计

生成时间：2026-07-25T07:32:24.906Z

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
| `Challenge-1 / warrior_t / standard_5slot` | 鱼人登陆队 | `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 100% | 36.93 | 3.32 | 3.34 | 3.00 | 19.35 | 0.01 |
| `Challenge-1 / druid_bear_t / standard_5slot` | 鱼人登陆队 | `fixed` | `expert/expert1-200ms-1pct` | `default` | 100% | 41.88 | 6.09 | 2.64 | 3.00 | 19.43 | 0.05 |
| `Challenge-2 / warrior_t / standard_5slot` | 烛火与潮汐 | `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 100% | 38.23 | 3.64 | 3.09 | 3.08 | 17.99 | 0.32 |
| `Challenge-2 / druid_bear_t / standard_5slot` | 烛火与潮汐 | `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 100% | 47.89 | 5.17 | 4.23 | 4.21 | 16.90 | 0.25 |
| `Challenge-3 / warrior_t / standard_5slot` | 老瞎眼演练 | `fixed` | `expert/expert3-100ms-3pct` | `generated_7_1` | 100% | 48.42 | 2.89 | 4.52 | 4.09 | 30.19 | 0.23 |
| `Challenge-3 / druid_bear_t / standard_5slot` | 老瞎眼演练 | `fixed` | `expert/expert2-150ms-2pct` | `default` | 100% | 56.75 | 5.79 | 3.85 | 3.94 | 25.72 | 0.40 |

## `Challenge-1 / warrior_t / standard_5slot` 鱼人登陆队

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_1` | 12 | 92% | 39.15 | 3.14 | 3.57 | 3.00 | 18.55 | 0.07 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_1` | 12 | 83% | 37.65 | 3.26 | 3.57 | 3.00 | 19.24 | 0.15 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 17% | 38.04 | 3.30 | 4.18 | 3.00 | 14.25 | 0.12 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_1` | 12 | 83% | 38.19 | 3.35 | 3.71 | 3.00 | 19.14 | 0.26 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_1` | 12 | 83% | 37.24 | 3.31 | 3.63 | 3.00 | 18.69 | 0.14 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 0% | 37.38 | 3.33 | 4.38 | 3.00 | 13.99 | 0.28 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 12 | 83% | 37.73 | 3.37 | 3.52 | 3.00 | 19.00 | 0.17 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_1` | 12 | 75% | 37.32 | 3.22 | 3.76 | 3.00 | 18.91 | 0.27 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 17% | 37.98 | 3.29 | 4.18 | 3.00 | 14.13 | 0.27 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_1` | 12 | 100% | 38.17 | 3.23 | 3.42 | 3.00 | 19.05 | 0.35 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_1` | 12 | 100% | 38.83 | 3.31 | 3.48 | 3.00 | 18.68 | 0.49 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 17% | 37.75 | 3.32 | 4.21 | 3.00 | 14.06 | 0.25 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_1` | 12 | 100% | 38.10 | 3.30 | 3.54 | 3.00 | 19.13 | 0.15 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_1` | 12 | 92% | 36.92 | 3.32 | 3.40 | 3.00 | 19.34 | 0.18 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 17% | 37.59 | 3.32 | 4.24 | 3.00 | 13.84 | 0.03 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_1` | 12 | 83% | 37.65 | 3.31 | 3.57 | 3.00 | 18.91 | 0.25 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_1` | 12 | 58% | 36.43 | 3.39 | 3.83 | 3.00 | 18.95 | 0.17 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 25% | 40.09 | 3.16 | 4.10 | 3.00 | 13.96 | 0.02 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 12 | 100% | 36.93 | 3.32 | 3.34 | 3.00 | 19.35 | 0.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_1` | 12 | 83% | 37.39 | 3.35 | 3.61 | 3.00 | 19.03 | 0.38 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 42% | 42.39 | 3.04 | 3.86 | 3.00 | 14.18 | 0.37 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_1` | 12 | 92% | 38.25 | 3.24 | 3.53 | 3.00 | 18.72 | 0.24 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 12 | 92% | 36.58 | 3.38 | 3.50 | 3.00 | 19.00 | 0.24 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 42% | 41.18 | 3.13 | 3.87 | 3.00 | 14.22 | 0.43 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_1` | 12 | 92% | 38.03 | 3.29 | 3.44 | 3.00 | 18.85 | 0.53 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 12 | 92% | 37.85 | 3.32 | 3.53 | 3.00 | 18.80 | 0.24 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 33% | 41.33 | 3.11 | 3.95 | 3.00 | 13.90 | 0.23 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_1_1` | 12 | 75% | 36.33 | 3.37 | 3.46 | 3.00 | 19.08 | 0.29 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `default` | 12 | 25% | 39.27 | 3.24 | 4.01 | 3.00 | 14.04 | 0.05 |

## `Challenge-1 / druid_bear_t / standard_5slot` 鱼人登陆队

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 100% | 44.88 | 6.11 | 2.86 | 3.00 | 19.02 | 0.02 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_1` | 12 | 100% | 43.98 | 6.06 | 3.05 | 3.00 | 19.45 | 0.06 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_1` | 12 | 100% | 42.67 | 6.03 | 2.89 | 3.00 | 19.10 | 0.02 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 100% | 41.74 | 6.21 | 2.84 | 3.00 | 19.55 | 0.01 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_1` | 12 | 100% | 42.23 | 6.07 | 2.96 | 3.00 | 19.43 | 0.03 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_1` | 12 | 100% | 39.61 | 6.25 | 2.94 | 3.00 | 19.85 | 0.01 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 100% | 41.99 | 6.07 | 2.73 | 3.00 | 19.52 | 0.04 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_1` | 12 | 100% | 42.39 | 6.11 | 2.96 | 3.00 | 19.26 | 0.03 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 12 | 100% | 43.44 | 6.03 | 2.93 | 3.00 | 19.36 | 0.04 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 100% | 41.88 | 6.09 | 2.64 | 3.00 | 19.43 | 0.05 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_1` | 12 | 100% | 42.57 | 6.10 | 2.86 | 3.00 | 19.59 | 0.01 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_1` | 12 | 100% | 41.17 | 6.07 | 2.78 | 3.00 | 19.54 | 0.02 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 100% | 39.92 | 6.18 | 2.76 | 3.00 | 19.54 | 0.03 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_1` | 12 | 100% | 43.13 | 6.07 | 2.89 | 3.00 | 19.25 | 0.05 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_1` | 12 | 100% | 41.53 | 6.13 | 2.90 | 3.00 | 19.80 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 100% | 40.64 | 6.19 | 2.76 | 3.00 | 19.51 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_1` | 12 | 100% | 40.38 | 6.15 | 2.90 | 3.00 | 19.77 | 0.00 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_1` | 12 | 100% | 41.75 | 6.17 | 2.81 | 3.00 | 19.31 | 0.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 100% | 41.02 | 6.21 | 2.81 | 3.00 | 19.50 | 0.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 12 | 100% | 42.13 | 6.07 | 2.88 | 3.00 | 19.54 | 0.03 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_1` | 12 | 100% | 43.19 | 6.05 | 2.83 | 3.00 | 19.40 | 0.03 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 100% | 41.52 | 6.17 | 2.80 | 3.00 | 19.70 | 0.05 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_1` | 12 | 100% | 42.10 | 6.06 | 2.77 | 3.00 | 19.33 | 0.03 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 12 | 100% | 43.38 | 6.07 | 2.84 | 3.00 | 19.22 | 0.07 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 100% | 41.62 | 6.19 | 2.86 | 3.00 | 19.73 | 0.04 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_1` | 12 | 100% | 43.48 | 5.96 | 2.94 | 3.00 | 19.34 | 0.06 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 12 | 100% | 43.62 | 6.09 | 2.88 | 3.00 | 19.55 | 0.02 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `default` | 12 | 100% | 41.60 | 6.08 | 2.93 | 3.00 | 19.55 | 0.10 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `generated_1_1` | 12 | 100% | 40.85 | 6.10 | 2.97 | 3.00 | 19.67 | 0.10 |

## `Challenge-2 / warrior_t / standard_5slot` 烛火与潮汐

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 100% | 50.22 | 3.20 | 3.72 | 3.69 | 12.86 | 0.26 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_1` | 12 | 100% | 34.40 | 3.74 | 3.30 | 3.26 | 18.13 | 0.12 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_1` | 12 | 100% | 35.52 | 3.74 | 3.35 | 3.31 | 17.67 | 0.24 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 100% | 53.07 | 3.14 | 3.78 | 3.77 | 12.96 | 0.25 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_1` | 12 | 100% | 36.27 | 3.73 | 3.40 | 3.38 | 17.93 | 0.02 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_1` | 12 | 100% | 38.10 | 3.66 | 3.38 | 3.34 | 18.08 | 0.28 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 100% | 60.97 | 2.92 | 3.76 | 3.74 | 12.92 | 0.09 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_1` | 12 | 100% | 39.95 | 3.67 | 3.62 | 3.61 | 18.38 | 0.24 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 12 | 100% | 38.23 | 3.64 | 3.09 | 3.08 | 17.99 | 0.32 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 100% | 58.07 | 2.98 | 3.47 | 3.47 | 13.01 | 0.05 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_1` | 12 | 100% | 38.75 | 3.66 | 3.64 | 3.62 | 18.04 | 0.07 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_1` | 12 | 100% | 38.92 | 3.66 | 3.36 | 3.30 | 17.86 | 0.05 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 100% | 59.78 | 2.95 | 3.59 | 3.58 | 13.03 | 0.10 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_1` | 12 | 100% | 38.14 | 3.68 | 3.32 | 3.28 | 18.20 | 0.09 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_1` | 12 | 100% | 38.38 | 3.69 | 3.39 | 3.35 | 17.88 | 0.03 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 100% | 54.72 | 3.10 | 3.72 | 3.71 | 13.11 | 0.12 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_1` | 12 | 100% | 36.13 | 3.71 | 3.43 | 3.36 | 17.92 | 0.18 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_1` | 12 | 100% | 36.90 | 3.70 | 3.29 | 3.25 | 18.17 | 0.06 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 100% | 59.74 | 2.95 | 3.57 | 3.56 | 13.09 | 0.03 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 12 | 100% | 37.78 | 3.68 | 3.30 | 3.25 | 17.70 | 0.14 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_1` | 12 | 100% | 37.80 | 3.64 | 3.27 | 3.19 | 17.96 | 0.09 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 100% | 58.47 | 2.96 | 3.66 | 3.66 | 13.19 | 0.02 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_1` | 12 | 100% | 38.16 | 3.66 | 3.28 | 3.26 | 18.08 | 0.10 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 12 | 100% | 37.85 | 3.67 | 3.41 | 3.39 | 18.16 | 0.18 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 100% | 62.85 | 2.84 | 3.63 | 3.63 | 13.17 | 0.05 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_1` | 12 | 100% | 39.67 | 3.69 | 3.38 | 3.33 | 18.17 | 0.01 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 12 | 100% | 40.16 | 3.71 | 3.42 | 3.42 | 18.01 | 0.15 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `default` | 12 | 100% | 64.67 | 2.77 | 3.89 | 3.89 | 12.97 | 0.05 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `generated_1_1` | 12 | 100% | 40.75 | 3.58 | 3.52 | 3.51 | 17.78 | 0.30 |

## `Challenge-2 / druid_bear_t / standard_5slot` 烛火与潮汐

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 100% | 47.22 | 5.29 | 4.39 | 4.37 | 17.15 | 0.43 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_1` | 12 | 100% | 45.76 | 5.32 | 4.66 | 4.57 | 17.10 | 0.13 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_1` | 12 | 100% | 45.58 | 5.37 | 4.44 | 4.42 | 16.97 | 0.52 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 100% | 47.06 | 5.23 | 4.48 | 4.42 | 16.98 | 0.20 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_1` | 12 | 100% | 44.82 | 5.30 | 4.38 | 4.37 | 17.21 | 0.25 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_1` | 12 | 92% | 42.54 | 5.39 | 4.53 | 4.47 | 17.05 | 0.63 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 100% | 45.82 | 5.29 | 4.43 | 4.39 | 17.13 | 0.48 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_1` | 12 | 100% | 47.00 | 5.25 | 4.50 | 4.42 | 17.04 | 0.32 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_1` | 12 | 100% | 46.83 | 5.23 | 4.51 | 4.42 | 16.94 | 0.23 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 100% | 47.75 | 5.28 | 4.65 | 4.54 | 16.99 | 0.36 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_1` | 12 | 100% | 46.17 | 5.30 | 4.55 | 4.49 | 17.12 | 0.38 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_1` | 12 | 100% | 46.77 | 5.35 | 4.66 | 4.54 | 16.95 | 0.50 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 100% | 46.82 | 5.16 | 4.47 | 4.43 | 17.07 | 0.32 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_1` | 12 | 100% | 45.83 | 5.33 | 4.44 | 4.36 | 16.98 | 0.64 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_1` | 12 | 100% | 46.22 | 5.25 | 4.41 | 4.35 | 17.03 | 0.48 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 100% | 44.69 | 5.32 | 4.63 | 4.53 | 17.30 | 0.28 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_1` | 12 | 100% | 44.18 | 5.29 | 4.45 | 4.39 | 17.23 | 0.38 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_1` | 12 | 100% | 45.88 | 5.32 | 4.60 | 4.50 | 17.12 | 0.22 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 100% | 46.71 | 5.19 | 4.35 | 4.29 | 16.97 | 0.32 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 12 | 100% | 47.89 | 5.17 | 4.23 | 4.21 | 16.90 | 0.25 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_1` | 12 | 100% | 48.21 | 5.22 | 4.50 | 4.44 | 16.93 | 0.41 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 100% | 48.61 | 5.16 | 4.47 | 4.38 | 16.81 | 0.25 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_1` | 12 | 100% | 46.33 | 5.25 | 4.54 | 4.47 | 16.83 | 0.44 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_1` | 12 | 100% | 46.73 | 5.25 | 4.54 | 4.46 | 17.02 | 0.24 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_1` | 12 | 100% | 44.69 | 5.30 | 4.57 | 4.51 | 17.37 | 0.19 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_1` | 12 | 100% | 48.13 | 5.33 | 4.73 | 4.55 | 17.11 | 0.24 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 83% | 42.35 | 5.24 | 4.60 | 4.49 | 17.03 | 0.65 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `generated_1_1` | 12 | 100% | 44.17 | 5.36 | 4.64 | 4.58 | 17.20 | 0.44 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `default` | 12 | 92% | 44.03 | 5.31 | 4.34 | 4.28 | 17.26 | 0.60 |

## `Challenge-3 / warrior_t / standard_5slot` 老瞎眼演练

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_1` | 12 | 75% | 41.00 | 3.29 | 4.76 | 3.80 | 31.64 | 0.73 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_7_1` | 12 | 75% | 40.50 | 3.25 | 4.80 | 3.93 | 30.92 | 0.75 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 0% | 21.18 | 5.66 | 7.09 | 2.61 | 27.77 | 1.58 |
| `fixed` | `average/average2-800ms-10pct` | `generated_7_1` | 12 | 92% | 45.39 | 3.01 | 4.67 | 3.99 | 30.94 | 0.48 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_1` | 12 | 67% | 38.32 | 3.48 | 5.04 | 3.79 | 32.57 | 0.18 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 0% | 19.97 | 6.01 | 7.29 | 2.61 | 27.86 | 1.16 |
| `fixed` | `average/average3-500ms-15pct` | `generated_7_1` | 12 | 92% | 45.21 | 3.06 | 4.79 | 3.96 | 31.12 | 0.23 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_1` | 12 | 67% | 39.05 | 3.41 | 5.05 | 3.80 | 32.08 | 0.38 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 0% | 21.18 | 5.67 | 7.34 | 2.80 | 26.95 | 1.18 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_1` | 12 | 83% | 43.33 | 3.15 | 4.75 | 3.92 | 31.30 | 0.80 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_7_1` | 12 | 83% | 42.85 | 3.19 | 4.88 | 4.00 | 32.11 | 0.56 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 8% | 24.42 | 5.05 | 6.77 | 3.20 | 25.97 | 0.80 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_7_1` | 12 | 75% | 40.83 | 3.22 | 4.73 | 3.88 | 30.84 | 0.71 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_1` | 12 | 67% | 39.68 | 3.36 | 4.96 | 3.83 | 31.79 | 0.24 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 0% | 20.33 | 5.90 | 7.37 | 2.86 | 27.67 | 1.23 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_7_1` | 12 | 100% | 48.42 | 2.89 | 4.52 | 4.09 | 30.19 | 0.23 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_1` | 12 | 83% | 42.93 | 3.18 | 4.85 | 3.87 | 31.30 | 0.33 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 0% | 20.17 | 5.95 | 7.45 | 2.71 | 28.63 | 0.12 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_1` | 12 | 67% | 39.28 | 3.39 | 5.18 | 3.93 | 31.68 | 0.59 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_7_1` | 12 | 50% | 34.07 | 3.82 | 5.40 | 3.49 | 33.85 | 0.40 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 0% | 20.37 | 5.89 | 7.42 | 2.64 | 27.24 | 0.71 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_1` | 12 | 92% | 45.96 | 3.01 | 4.67 | 4.01 | 30.86 | 0.25 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_7_1` | 12 | 58% | 36.28 | 3.63 | 5.17 | 3.83 | 32.24 | 0.50 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 0% | 20.28 | 5.92 | 7.30 | 2.79 | 27.62 | 1.67 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_7_1` | 12 | 83% | 41.54 | 3.21 | 4.69 | 3.94 | 31.42 | 0.83 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_1` | 12 | 67% | 38.89 | 3.43 | 4.97 | 3.88 | 32.50 | 0.60 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 0% | 19.78 | 5.89 | 7.19 | 2.94 | 28.15 | 2.11 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `generated_7_1` | 12 | 50% | 35.27 | 3.69 | 5.29 | 3.84 | 32.89 | 0.40 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `default` | 12 | 0% | 20.67 | 5.81 | 7.19 | 2.53 | 27.87 | 0.90 |

## `Challenge-3 / druid_bear_t / standard_5slot` 老瞎眼演练

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 12 | 92% | 54.48 | 5.81 | 4.10 | 3.95 | 25.65 | 0.37 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_8_1` | 12 | 33% | 32.35 | 6.54 | 5.28 | 3.39 | 28.62 | 0.33 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_2_0` | 12 | 8% | 23.35 | 7.21 | 6.31 | 2.87 | 30.49 | 0.94 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 12 | 67% | 44.47 | 6.07 | 4.58 | 3.66 | 27.14 | 0.03 |
| `fixed` | `average/average2-800ms-10pct` | `generated_2_0` | 12 | 33% | 32.37 | 6.54 | 5.40 | 3.43 | 28.60 | 0.18 |
| `fixed` | `average/average2-800ms-10pct` | `generated_8_1` | 12 | 0% | 20.37 | 7.61 | 7.15 | 2.51 | 32.95 | 0.08 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 12 | 100% | 56.47 | 5.78 | 4.01 | 3.97 | 25.92 | 0.08 |
| `fixed` | `average/average3-500ms-15pct` | `generated_8_1` | 12 | 25% | 29.04 | 6.71 | 5.73 | 3.23 | 29.16 | 0.18 |
| `fixed` | `average/average3-500ms-15pct` | `generated_2_0` | 12 | 8% | 23.10 | 7.22 | 6.54 | 2.78 | 31.13 | 0.09 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 12 | 83% | 51.62 | 5.80 | 4.10 | 3.86 | 25.76 | 0.05 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_8_1` | 12 | 42% | 35.13 | 6.36 | 5.15 | 3.49 | 28.29 | 0.69 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_2_0` | 12 | 8% | 23.62 | 7.13 | 6.36 | 2.77 | 31.31 | 0.41 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 12 | 100% | 56.75 | 5.79 | 3.85 | 3.94 | 25.72 | 0.40 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_8_1` | 12 | 25% | 28.91 | 6.76 | 5.59 | 3.17 | 28.87 | 0.82 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_2_0` | 12 | 8% | 23.73 | 7.17 | 6.31 | 2.77 | 30.92 | 0.61 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 12 | 75% | 47.21 | 5.93 | 4.36 | 3.74 | 27.00 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_8_1` | 12 | 25% | 28.68 | 6.91 | 5.73 | 3.21 | 29.83 | 0.01 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_2_0` | 12 | 8% | 23.48 | 7.24 | 6.45 | 2.78 | 30.69 | 0.22 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 12 | 75% | 49.45 | 5.89 | 4.33 | 3.75 | 26.30 | 0.03 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_2_0` | 12 | 8% | 23.52 | 7.16 | 6.40 | 2.76 | 30.91 | 0.05 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_8_1` | 12 | 8% | 23.23 | 7.25 | 6.53 | 2.80 | 31.22 | 0.04 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 12 | 92% | 54.47 | 5.84 | 3.96 | 3.89 | 25.68 | 0.27 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_2_0` | 12 | 17% | 26.23 | 6.99 | 6.03 | 3.07 | 29.61 | 0.31 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_8_1` | 12 | 17% | 26.54 | 6.97 | 6.12 | 3.16 | 29.48 | 0.18 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 12 | 100% | 56.73 | 5.76 | 3.93 | 3.95 | 25.72 | 0.26 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_8_1` | 12 | 17% | 26.94 | 6.87 | 5.80 | 2.97 | 29.43 | 0.79 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_2_0` | 12 | 8% | 23.23 | 7.32 | 6.64 | 2.93 | 30.56 | 0.71 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `default` | 12 | 58% | 40.32 | 6.00 | 4.15 | 4.41 | 25.74 | 1.65 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_kill-high-impact` | `generated_2_0` | 12 | 17% | 22.14 | 6.81 | 5.40 | 4.35 | 28.24 | 3.38 |
