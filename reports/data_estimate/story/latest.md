# 第三章基础数值统计

生成时间：2026-07-17T12:26:46.221Z

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
| `Zul'Aman-1` | 日冕村 | `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 37% | 24.98 | 9.38 | 10.47 | 8.04 | 52.96 | 0.06 |
| `Zul'Aman-2` | 阿曼尼小径 | `fixed` | `average/average1-1000ms-5pct` | `manual_playtest_recommended` | 87% | 44.46 | 9.50 | 6.78 | 12.28 | 53.04 | 1.75 |
| `Zul'Aman-3` | 残破神庙 | `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `generated_12_2` | 33% | 41.20 | 6.26 | 8.32 | 14.16 | 49.07 | 0.01 |
| `Zul'Aman-4` | 枯木山崖 | `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-party-chain` | `manual_playtest_recommended` | 27% | 35.97 | 7.73 | 8.85 | 8.43 | 51.91 | 0.35 |
| `Zul'Aman-5` | 迈萨拉深渊 | `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 66% | 43.83 | 9.11 | 5.73 | 12.85 | 45.52 | 0.47 |
| `Zul'Aman-6` | 阿塔阿曼 | `fixed` | `skilled/skilled2-300ms-5pct` | `manual_playtest_recommended` | 100% | 88.01 | 9.71 | 5.14 | 10.94 | 37.71 | 1.00 |

## Zul'Aman-1 日冕村

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `manual_playtest_recommended` | 100 | 30% | 24.20 | 9.45 | 10.69 | 9.48 | 53.49 | 0.31 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_9_2` | 100 | 28% | 20.80 | 9.58 | 11.78 | 5.02 | 61.51 | 0.02 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_16_2` | 100 | 9% | 20.47 | 6.57 | 12.22 | 5.65 | 52.58 | 0.75 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_6_2` | 100 | 6% | 19.36 | 6.68 | 12.71 | 5.76 | 52.74 | 0.86 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 5% | 19.39 | 6.70 | 12.71 | 5.71 | 53.05 | 0.81 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 6.46 | 13.45 | 20.85 | 5.97 | 36.40 | 2.47 |
| `fixed` | `average/average2-800ms-10pct` | `manual_playtest_recommended` | 100 | 34% | 24.77 | 9.39 | 10.57 | 9.21 | 53.06 | 0.25 |
| `fixed` | `average/average2-800ms-10pct` | `generated_9_2` | 100 | 32% | 21.37 | 9.77 | 11.60 | 5.00 | 61.02 | 0.00 |
| `fixed` | `average/average2-800ms-10pct` | `generated_16_2` | 100 | 16% | 21.48 | 6.29 | 11.79 | 5.85 | 51.98 | 1.07 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 4% | 19.57 | 6.68 | 12.61 | 6.02 | 52.74 | 1.34 |
| `fixed` | `average/average2-800ms-10pct` | `generated_6_2` | 100 | 3% | 19.18 | 6.80 | 12.77 | 6.15 | 53.41 | 1.48 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 6.46 | 13.76 | 20.70 | 5.85 | 36.78 | 2.32 |
| `fixed` | `average/average3-500ms-15pct` | `generated_9_2` | 100 | 32% | 21.25 | 9.97 | 11.63 | 5.02 | 61.23 | 0.02 |
| `fixed` | `average/average3-500ms-15pct` | `manual_playtest_recommended` | 100 | 27% | 23.97 | 9.51 | 10.81 | 9.03 | 54.08 | 0.27 |
| `fixed` | `average/average3-500ms-15pct` | `generated_16_2` | 100 | 13% | 20.62 | 6.52 | 12.17 | 5.99 | 52.62 | 1.20 |
| `fixed` | `average/average3-500ms-15pct` | `generated_6_2` | 100 | 5% | 19.45 | 6.75 | 12.67 | 5.90 | 52.69 | 1.08 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 2% | 19.02 | 6.84 | 12.88 | 6.02 | 53.38 | 1.31 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 6.47 | 13.53 | 20.69 | 5.87 | 36.54 | 2.39 |
| `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 100 | 37% | 24.98 | 9.38 | 10.47 | 8.04 | 52.96 | 0.06 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_9_2` | 100 | 24% | 20.80 | 9.72 | 11.77 | 5.00 | 61.61 | 0.00 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_16_2` | 100 | 15% | 21.40 | 6.30 | 11.90 | 5.59 | 52.17 | 0.65 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 10% | 19.93 | 6.51 | 12.42 | 5.69 | 52.40 | 0.74 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_6_2` | 100 | 5% | 19.85 | 6.56 | 12.49 | 5.82 | 52.60 | 0.99 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 6.53 | 13.32 | 20.52 | 5.81 | 36.79 | 2.11 |
| `fixed` | `expert/expert2-150ms-2pct` | `manual_playtest_recommended` | 100 | 30% | 24.05 | 9.54 | 10.76 | 8.18 | 53.79 | 0.09 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_9_2` | 100 | 27% | 21.02 | 9.57 | 11.81 | 5.00 | 61.20 | 0.00 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_16_2` | 100 | 8% | 20.37 | 6.53 | 12.26 | 5.67 | 52.85 | 0.81 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 3% | 19.21 | 6.70 | 12.78 | 5.59 | 53.12 | 0.74 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_6_2` | 100 | 2% | 18.71 | 6.84 | 13.01 | 5.64 | 53.02 | 0.76 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 6.47 | 13.47 | 20.68 | 5.86 | 36.72 | 2.19 |
| `fixed` | `expert/expert3-100ms-3pct` | `manual_playtest_recommended` | 100 | 31% | 24.30 | 9.50 | 10.62 | 8.37 | 53.45 | 0.13 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_9_2` | 100 | 28% | 21.17 | 9.65 | 11.69 | 5.01 | 61.39 | 0.01 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_16_2` | 100 | 13% | 21.01 | 6.36 | 11.96 | 5.87 | 52.56 | 1.04 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_6_2` | 100 | 4% | 19.21 | 6.70 | 12.75 | 6.00 | 52.77 | 1.19 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 2% | 20.02 | 6.52 | 12.47 | 6.02 | 52.61 | 1.19 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 6.37 | 13.62 | 20.91 | 5.75 | 36.57 | 1.71 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_9_2` | 100 | 32% | 21.24 | 9.62 | 11.69 | 5.01 | 61.20 | 0.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `manual_playtest_recommended` | 100 | 32% | 24.42 | 9.42 | 10.59 | 9.31 | 53.24 | 0.23 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_16_2` | 100 | 12% | 21.40 | 6.29 | 11.86 | 5.78 | 52.16 | 0.92 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_6_2` | 100 | 9% | 20.13 | 6.52 | 12.39 | 5.74 | 52.60 | 0.87 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 4% | 19.20 | 6.75 | 12.77 | 5.83 | 52.72 | 0.96 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 6.40 | 13.60 | 20.80 | 5.74 | 36.84 | 2.02 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `manual_playtest_recommended` | 100 | 36% | 24.60 | 9.43 | 10.53 | 8.12 | 53.07 | 0.07 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_9_2` | 100 | 20% | 20.57 | 9.78 | 12.05 | 5.01 | 61.70 | 0.01 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_16_2` | 100 | 8% | 20.13 | 6.61 | 12.37 | 5.67 | 53.01 | 0.79 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 5% | 19.46 | 6.64 | 12.63 | 5.77 | 52.97 | 0.88 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_6_2` | 100 | 3% | 19.17 | 6.70 | 12.75 | 5.66 | 53.42 | 0.81 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 6.55 | 13.29 | 20.50 | 5.88 | 36.79 | 2.53 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_9_2` | 100 | 31% | 21.30 | 9.56 | 11.68 | 5.03 | 60.74 | 0.03 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `manual_playtest_recommended` | 100 | 31% | 24.14 | 9.55 | 10.68 | 8.17 | 53.53 | 0.12 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_16_2` | 100 | 10% | 20.64 | 6.49 | 12.16 | 5.73 | 52.62 | 0.86 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 2% | 19.21 | 6.74 | 12.76 | 5.81 | 52.98 | 0.94 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_6_2` | 100 | 1% | 18.74 | 6.84 | 12.99 | 5.60 | 53.28 | 0.76 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 6.51 | 13.34 | 20.56 | 5.85 | 36.74 | 2.41 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `generated_9_2` | 100 | 34% | 21.82 | 9.37 | 11.36 | 5.00 | 60.47 | 0.00 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 27% | 24.27 | 9.04 | 10.76 | 7.95 | 54.15 | 0.04 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 37% | 24.73 | 9.41 | 10.48 | 8.16 | 53.21 | 0.07 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `generated_9_2` | 100 | 25% | 20.74 | 9.76 | 11.89 | 5.00 | 61.93 | 0.00 |

## Zul'Aman-2 阿曼尼小径

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `manual_playtest_recommended` | 100 | 87% | 44.46 | 9.50 | 6.78 | 12.28 | 53.04 | 1.75 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 8.04 | 12.33 | 16.79 | 6.38 | 33.33 | 11.27 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_13_2` | 100 | 0% | 9.58 | 10.43 | 8.29 | 6.48 | 47.19 | 12.99 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_14_2` | 100 | 0% | 7.06 | 14.13 | 9.01 | 6.29 | 45.51 | 17.12 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_15_2` | 100 | 0% | 18.76 | 5.33 | 13.16 | 5.36 | 48.15 | 1.62 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_16_2` | 100 | 0% | 27.77 | 3.60 | 10.42 | 5.73 | 48.39 | 1.41 |
| `fixed` | `average/average2-800ms-10pct` | `manual_playtest_recommended` | 100 | 63% | 41.84 | 9.67 | 7.15 | 12.62 | 53.36 | 1.83 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 7.48 | 13.20 | 17.94 | 6.33 | 33.30 | 10.79 |
| `fixed` | `average/average2-800ms-10pct` | `generated_13_2` | 100 | 0% | 11.62 | 8.60 | 7.49 | 6.57 | 47.29 | 10.98 |
| `fixed` | `average/average2-800ms-10pct` | `generated_14_2` | 100 | 0% | 7.86 | 12.70 | 8.67 | 6.36 | 46.28 | 15.53 |
| `fixed` | `average/average2-800ms-10pct` | `generated_15_2` | 100 | 0% | 18.70 | 5.35 | 13.18 | 5.34 | 47.86 | 1.64 |
| `fixed` | `average/average2-800ms-10pct` | `generated_16_2` | 100 | 0% | 27.75 | 3.60 | 10.36 | 5.83 | 48.34 | 2.14 |
| `fixed` | `average/average3-500ms-15pct` | `manual_playtest_recommended` | 100 | 58% | 40.97 | 9.75 | 7.43 | 12.07 | 53.64 | 1.71 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 7.74 | 12.75 | 17.20 | 6.35 | 33.75 | 10.98 |
| `fixed` | `average/average3-500ms-15pct` | `generated_13_2` | 100 | 0% | 11.38 | 8.78 | 7.68 | 6.56 | 47.62 | 11.18 |
| `fixed` | `average/average3-500ms-15pct` | `generated_14_2` | 100 | 0% | 7.86 | 12.71 | 8.59 | 6.36 | 46.37 | 15.53 |
| `fixed` | `average/average3-500ms-15pct` | `generated_15_2` | 100 | 0% | 18.83 | 5.31 | 13.13 | 5.37 | 48.11 | 1.90 |
| `fixed` | `average/average3-500ms-15pct` | `generated_16_2` | 100 | 0% | 27.48 | 3.64 | 10.32 | 5.80 | 48.43 | 2.18 |
| `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 100 | 64% | 45.26 | 9.53 | 7.95 | 12.39 | 52.87 | 1.35 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 7.52 | 13.13 | 18.05 | 6.34 | 33.28 | 10.65 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_13_2` | 100 | 0% | 10.20 | 9.80 | 8.03 | 6.51 | 47.06 | 12.29 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_14_2` | 100 | 0% | 7.06 | 14.10 | 8.86 | 6.29 | 45.98 | 17.12 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_15_2` | 100 | 0% | 18.67 | 5.36 | 13.21 | 5.34 | 47.57 | 1.29 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_16_2` | 100 | 0% | 27.76 | 3.60 | 10.44 | 5.71 | 48.41 | 1.31 |
| `fixed` | `expert/expert2-150ms-2pct` | `manual_playtest_recommended` | 100 | 64% | 45.46 | 9.50 | 7.92 | 12.49 | 52.74 | 1.40 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 7.24 | 13.54 | 18.25 | 6.30 | 33.11 | 10.87 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_13_2` | 100 | 0% | 10.06 | 9.94 | 8.06 | 6.50 | 46.95 | 12.45 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_14_2` | 100 | 0% | 6.74 | 14.78 | 9.22 | 6.26 | 46.20 | 17.86 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_15_2` | 100 | 0% | 18.65 | 5.36 | 13.23 | 5.42 | 48.00 | 1.30 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_16_2` | 100 | 0% | 27.59 | 3.62 | 10.38 | 5.82 | 48.31 | 1.64 |
| `fixed` | `expert/expert3-100ms-3pct` | `manual_playtest_recommended` | 100 | 67% | 43.49 | 9.59 | 7.87 | 12.57 | 53.12 | 1.56 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 7.14 | 13.79 | 18.87 | 6.30 | 32.97 | 10.63 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_13_2` | 100 | 0% | 11.04 | 9.06 | 7.89 | 6.55 | 46.89 | 11.47 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_14_2` | 100 | 0% | 7.54 | 13.25 | 8.84 | 6.34 | 46.26 | 16.12 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_15_2` | 100 | 0% | 18.72 | 5.34 | 13.19 | 5.29 | 47.73 | 1.63 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_16_2` | 100 | 0% | 27.80 | 3.60 | 10.38 | 5.84 | 48.42 | 1.82 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `manual_playtest_recommended` | 100 | 65% | 42.34 | 9.69 | 7.23 | 12.93 | 53.06 | 1.71 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 7.40 | 13.31 | 18.15 | 6.31 | 33.44 | 10.28 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_13_2` | 100 | 0% | 10.92 | 9.16 | 8.05 | 6.54 | 46.60 | 11.57 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_14_2` | 100 | 0% | 7.70 | 12.97 | 8.97 | 6.35 | 46.23 | 15.82 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_15_2` | 100 | 0% | 18.58 | 5.38 | 13.27 | 5.21 | 47.92 | 1.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_16_2` | 100 | 0% | 27.71 | 3.61 | 10.41 | 5.70 | 48.36 | 1.40 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `manual_playtest_recommended` | 100 | 66% | 43.93 | 9.57 | 7.76 | 12.40 | 53.20 | 1.53 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 7.62 | 13.01 | 17.75 | 6.34 | 33.06 | 10.87 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_13_2` | 100 | 0% | 10.50 | 9.52 | 8.18 | 6.52 | 46.87 | 11.98 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_14_2` | 100 | 0% | 7.62 | 13.07 | 8.40 | 6.34 | 46.16 | 15.97 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_15_2` | 100 | 0% | 18.74 | 5.34 | 13.16 | 5.48 | 47.70 | 1.75 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_16_2` | 100 | 0% | 27.93 | 3.58 | 10.40 | 5.86 | 48.13 | 1.84 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `manual_playtest_recommended` | 100 | 65% | 42.76 | 9.64 | 7.67 | 12.31 | 53.41 | 1.66 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 8.46 | 11.70 | 16.42 | 6.41 | 33.34 | 9.91 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_13_2` | 100 | 0% | 10.14 | 9.86 | 8.00 | 6.51 | 47.15 | 12.37 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_14_2` | 100 | 0% | 6.98 | 14.27 | 8.92 | 6.28 | 46.12 | 17.30 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_15_2` | 100 | 0% | 18.79 | 5.32 | 13.12 | 5.52 | 47.76 | 1.88 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_16_2` | 100 | 0% | 27.77 | 3.60 | 10.32 | 5.91 | 48.49 | 2.20 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 71% | 45.46 | 9.52 | 7.76 | 12.40 | 52.99 | 1.26 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 66% | 44.72 | 9.57 | 7.77 | 12.46 | 53.14 | 1.41 |

## Zul'Aman-3 残破神庙

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `manual_playtest_recommended` | 100 | 23% | 36.00 | 8.28 | 8.94 | 9.38 | 54.43 | 0.02 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_12_2` | 100 | 6% | 38.10 | 6.36 | 8.88 | 14.24 | 49.41 | 0.01 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_13_2` | 100 | 4% | 33.77 | 6.63 | 9.43 | 6.64 | 49.56 | 0.03 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 1% | 26.86 | 4.12 | 10.55 | 6.62 | 48.58 | 0.00 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 18.68 | 6.53 | 10.38 | 6.49 | 39.51 | 0.00 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_15_2` | 100 | 0% | 26.32 | 5.70 | 10.71 | 6.71 | 50.79 | 0.10 |
| `fixed` | `average/average2-800ms-10pct` | `manual_playtest_recommended` | 100 | 15% | 34.62 | 8.43 | 9.17 | 9.71 | 54.96 | 0.00 |
| `fixed` | `average/average2-800ms-10pct` | `generated_12_2` | 100 | 10% | 38.66 | 6.34 | 8.75 | 14.20 | 48.79 | 0.08 |
| `fixed` | `average/average2-800ms-10pct` | `generated_13_2` | 100 | 4% | 33.59 | 6.63 | 9.45 | 6.61 | 49.36 | 0.03 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 18.71 | 6.62 | 10.40 | 6.52 | 39.62 | 0.01 |
| `fixed` | `average/average2-800ms-10pct` | `generated_15_2` | 100 | 0% | 26.47 | 5.63 | 10.67 | 6.71 | 50.72 | 0.14 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 0% | 27.53 | 4.04 | 10.45 | 6.59 | 48.18 | 0.02 |
| `fixed` | `average/average3-500ms-15pct` | `manual_playtest_recommended` | 100 | 20% | 35.42 | 8.37 | 9.01 | 9.61 | 54.75 | 0.00 |
| `fixed` | `average/average3-500ms-15pct` | `generated_12_2` | 100 | 8% | 38.64 | 6.33 | 8.80 | 14.21 | 49.22 | 0.05 |
| `fixed` | `average/average3-500ms-15pct` | `generated_13_2` | 100 | 7% | 34.12 | 6.60 | 9.38 | 6.61 | 49.28 | 0.05 |
| `fixed` | `average/average3-500ms-15pct` | `generated_15_2` | 100 | 1% | 26.61 | 5.64 | 10.64 | 6.73 | 51.27 | 0.15 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 1% | 27.80 | 4.00 | 10.37 | 6.61 | 48.05 | 0.03 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 18.87 | 6.76 | 10.42 | 6.53 | 39.51 | 0.02 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_12_2` | 100 | 22% | 40.08 | 6.29 | 8.52 | 14.19 | 49.09 | 0.00 |
| `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 100 | 20% | 35.80 | 8.29 | 8.95 | 9.25 | 54.43 | 0.00 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_13_2` | 100 | 17% | 36.36 | 6.49 | 9.02 | 6.58 | 49.68 | 0.01 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_15_2` | 100 | 5% | 27.28 | 5.56 | 10.43 | 6.72 | 53.84 | 0.07 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 1% | 28.55 | 3.92 | 10.24 | 6.63 | 48.46 | 0.01 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 19.00 | 6.80 | 10.44 | 6.51 | 40.28 | 0.01 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_12_2` | 100 | 24% | 39.91 | 6.31 | 8.49 | 14.28 | 49.41 | 0.01 |
| `fixed` | `expert/expert2-150ms-2pct` | `manual_playtest_recommended` | 100 | 19% | 35.39 | 8.32 | 9.04 | 9.11 | 54.68 | 0.00 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_13_2` | 100 | 8% | 34.55 | 6.59 | 9.32 | 6.60 | 49.69 | 0.01 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_15_2` | 100 | 1% | 26.35 | 5.70 | 10.67 | 6.70 | 53.39 | 0.07 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 18.98 | 6.82 | 10.45 | 6.50 | 40.10 | 0.00 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 0% | 28.32 | 3.94 | 10.30 | 6.60 | 48.02 | 0.01 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_12_2` | 100 | 25% | 39.93 | 6.32 | 8.51 | 14.26 | 49.57 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `manual_playtest_recommended` | 100 | 24% | 36.02 | 8.32 | 8.92 | 9.81 | 54.63 | 0.00 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_13_2` | 100 | 13% | 35.88 | 6.51 | 9.12 | 6.64 | 49.72 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 1% | 29.24 | 3.84 | 10.11 | 6.57 | 48.78 | 0.01 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 18.92 | 6.84 | 10.46 | 6.49 | 40.15 | 0.00 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_15_2` | 100 | 0% | 26.02 | 5.74 | 10.78 | 6.72 | 52.84 | 0.10 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `manual_playtest_recommended` | 100 | 22% | 35.78 | 8.31 | 9.01 | 9.72 | 54.44 | 0.00 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_12_2` | 100 | 8% | 38.37 | 6.35 | 8.85 | 14.21 | 49.54 | 0.00 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_13_2` | 100 | 2% | 33.80 | 6.62 | 9.44 | 6.60 | 49.81 | 0.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 1% | 28.85 | 3.89 | 10.18 | 6.60 | 48.07 | 0.00 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 18.94 | 6.73 | 10.42 | 6.51 | 40.27 | 0.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_15_2` | 100 | 0% | 26.69 | 5.61 | 10.63 | 6.71 | 52.40 | 0.08 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_12_2` | 100 | 21% | 39.84 | 6.31 | 8.56 | 14.24 | 49.53 | 0.02 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_13_2` | 100 | 18% | 35.98 | 6.51 | 9.09 | 6.58 | 49.23 | 0.02 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `manual_playtest_recommended` | 100 | 13% | 35.16 | 8.39 | 9.15 | 9.52 | 55.01 | 0.00 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 2% | 27.77 | 4.01 | 10.37 | 6.62 | 48.31 | 0.01 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_15_2` | 100 | 1% | 26.77 | 5.62 | 10.60 | 6.72 | 54.77 | 0.11 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 18.95 | 6.79 | 10.45 | 6.48 | 40.07 | 0.02 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_12_2` | 100 | 21% | 39.57 | 6.33 | 8.57 | 14.24 | 49.32 | 0.03 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `manual_playtest_recommended` | 100 | 19% | 35.42 | 8.33 | 9.02 | 9.13 | 54.35 | 0.00 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_13_2` | 100 | 17% | 36.39 | 6.49 | 8.99 | 6.61 | 49.51 | 0.04 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_15_2` | 100 | 1% | 26.29 | 5.70 | 10.70 | 6.73 | 53.84 | 0.12 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 18.91 | 6.83 | 10.45 | 6.52 | 40.11 | 0.00 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 0% | 27.86 | 4.00 | 10.39 | 6.59 | 48.23 | 0.01 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_mechanic-wax-tank-chain` | `generated_13_2` | 100 | 16% | 37.69 | 6.32 | 8.83 | 6.86 | 47.40 | 0.59 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_mechanic-wax-tank-chain` | `manual_playtest_recommended` | 100 | 14% | 35.74 | 8.57 | 9.08 | 8.41 | 52.66 | 0.01 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_mechanic-wax-tank-chain` | `generated_12_2` | 100 | 4% | 39.39 | 6.24 | 8.77 | 14.33 | 47.01 | 0.45 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `generated_12_2` | 100 | 33% | 41.20 | 6.26 | 8.32 | 14.16 | 49.07 | 0.01 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `generated_13_2` | 100 | 15% | 36.08 | 6.51 | 9.09 | 6.69 | 49.48 | 0.01 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 12% | 35.20 | 8.36 | 9.13 | 9.47 | 54.74 | 0.00 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_mechanic-wax-tank-chain` | `generated_12_2` | 100 | 15% | 40.77 | 6.19 | 8.49 | 14.20 | 46.77 | 0.47 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_mechanic-wax-tank-chain` | `manual_playtest_recommended` | 100 | 7% | 34.22 | 8.68 | 9.34 | 8.39 | 52.91 | 0.01 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_mechanic-wax-tank-chain` | `generated_13_2` | 100 | 6% | 36.24 | 6.41 | 9.08 | 6.86 | 47.58 | 0.55 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `generated_12_2` | 100 | 28% | 40.65 | 6.27 | 8.45 | 14.11 | 48.94 | 0.00 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 16% | 35.11 | 8.36 | 9.08 | 9.48 | 55.20 | 0.00 |
| `learning` | `average/learning-220ms-low-error__cast_late-window__tactic_strict-threat` | `generated_13_2` | 100 | 9% | 35.20 | 6.56 | 9.22 | 6.61 | 49.45 | 0.02 |

## Zul'Aman-4 枯木山崖

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `manual_playtest_recommended` | 100 | 11% | 29.87 | 9.05 | 9.89 | 6.80 | 54.30 | 0.07 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 15.11 | 7.00 | 11.84 | 5.98 | 34.10 | 1.37 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_10_2` | 100 | 0% | 20.53 | 5.37 | 12.29 | 5.96 | 48.68 | 1.04 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_14_2` | 100 | 0% | 21.34 | 4.69 | 12.00 | 5.88 | 47.56 | 0.88 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_15_2` | 100 | 0% | 23.82 | 5.74 | 9.64 | 6.52 | 47.34 | 3.35 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_16_2` | 100 | 0% | 18.72 | 6.79 | 13.15 | 5.06 | 47.39 | 0.06 |
| `fixed` | `average/average2-800ms-10pct` | `manual_playtest_recommended` | 100 | 11% | 29.26 | 9.14 | 9.91 | 6.74 | 55.83 | 0.09 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 14.72 | 7.10 | 12.04 | 5.97 | 34.39 | 1.28 |
| `fixed` | `average/average2-800ms-10pct` | `generated_10_2` | 100 | 0% | 20.31 | 5.42 | 12.17 | 5.96 | 48.30 | 1.17 |
| `fixed` | `average/average2-800ms-10pct` | `generated_14_2` | 100 | 0% | 21.73 | 4.60 | 11.87 | 5.94 | 47.31 | 1.14 |
| `fixed` | `average/average2-800ms-10pct` | `generated_15_2` | 100 | 0% | 23.51 | 5.82 | 9.74 | 6.52 | 47.91 | 3.06 |
| `fixed` | `average/average2-800ms-10pct` | `generated_16_2` | 100 | 0% | 18.43 | 6.92 | 13.36 | 5.04 | 47.52 | 0.05 |
| `fixed` | `average/average3-500ms-15pct` | `manual_playtest_recommended` | 100 | 10% | 28.97 | 9.18 | 10.04 | 6.77 | 55.34 | 0.12 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 14.97 | 7.01 | 11.96 | 5.98 | 34.42 | 1.43 |
| `fixed` | `average/average3-500ms-15pct` | `generated_10_2` | 100 | 0% | 20.82 | 5.29 | 12.13 | 6.13 | 48.29 | 1.31 |
| `fixed` | `average/average3-500ms-15pct` | `generated_14_2` | 100 | 0% | 21.45 | 4.66 | 11.99 | 5.91 | 47.28 | 0.94 |
| `fixed` | `average/average3-500ms-15pct` | `generated_15_2` | 100 | 0% | 23.78 | 5.80 | 9.77 | 6.52 | 47.52 | 3.23 |
| `fixed` | `average/average3-500ms-15pct` | `generated_16_2` | 100 | 0% | 18.27 | 7.08 | 13.46 | 5.04 | 47.99 | 0.04 |
| `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 100 | 13% | 27.36 | 9.39 | 10.39 | 6.42 | 52.82 | 0.07 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 15.30 | 6.95 | 11.69 | 6.00 | 35.11 | 1.38 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_10_2` | 100 | 0% | 19.87 | 5.54 | 12.55 | 5.78 | 49.11 | 0.70 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_14_2` | 100 | 0% | 21.44 | 4.67 | 12.04 | 5.89 | 47.13 | 0.83 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_15_2` | 100 | 0% | 23.42 | 5.87 | 9.69 | 6.51 | 47.80 | 3.35 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_16_2` | 100 | 0% | 18.02 | 7.29 | 13.33 | 5.01 | 48.61 | 0.01 |
| `fixed` | `expert/expert2-150ms-2pct` | `manual_playtest_recommended` | 100 | 13% | 27.26 | 9.42 | 10.42 | 6.31 | 53.03 | 0.08 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 14.95 | 7.07 | 11.87 | 5.91 | 35.01 | 1.14 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_10_2` | 100 | 0% | 20.46 | 5.40 | 12.40 | 5.86 | 48.27 | 0.77 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_14_2` | 100 | 0% | 21.27 | 4.70 | 11.96 | 5.93 | 47.75 | 1.03 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_15_2` | 100 | 0% | 23.69 | 5.77 | 9.91 | 6.52 | 47.74 | 3.08 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_16_2` | 100 | 0% | 18.03 | 7.30 | 13.35 | 5.02 | 49.25 | 0.02 |
| `fixed` | `expert/expert3-100ms-3pct` | `manual_playtest_recommended` | 100 | 9% | 27.00 | 9.46 | 10.49 | 6.73 | 53.06 | 0.08 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 15.13 | 7.02 | 11.79 | 5.96 | 34.68 | 1.21 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_10_2` | 100 | 0% | 19.93 | 5.52 | 12.52 | 5.97 | 48.49 | 0.99 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_14_2` | 100 | 0% | 21.40 | 4.67 | 11.99 | 5.86 | 47.59 | 0.91 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_15_2` | 100 | 0% | 23.51 | 5.81 | 9.89 | 6.53 | 47.75 | 2.97 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_16_2` | 100 | 0% | 18.08 | 7.31 | 13.33 | 5.04 | 48.96 | 0.03 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `manual_playtest_recommended` | 100 | 15% | 29.98 | 9.06 | 9.78 | 6.65 | 56.14 | 0.06 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 14.38 | 7.17 | 12.20 | 5.97 | 34.62 | 1.32 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_10_2` | 100 | 0% | 20.35 | 5.42 | 12.40 | 5.95 | 48.75 | 0.90 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_14_2` | 100 | 0% | 21.59 | 4.63 | 11.95 | 5.92 | 47.43 | 0.89 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_15_2` | 100 | 0% | 24.41 | 5.69 | 10.07 | 6.53 | 47.55 | 2.96 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_16_2` | 100 | 0% | 18.35 | 7.08 | 13.42 | 5.03 | 48.19 | 0.02 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `manual_playtest_recommended` | 100 | 13% | 27.68 | 9.34 | 10.31 | 6.61 | 53.64 | 0.09 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 14.80 | 7.07 | 11.97 | 5.93 | 34.79 | 1.32 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_10_2` | 100 | 0% | 19.80 | 5.56 | 12.56 | 5.86 | 48.61 | 0.93 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_14_2` | 100 | 0% | 21.41 | 4.67 | 12.00 | 5.86 | 47.09 | 0.85 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_15_2` | 100 | 0% | 23.61 | 5.81 | 9.91 | 6.52 | 47.87 | 3.08 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_16_2` | 100 | 0% | 18.07 | 7.25 | 13.33 | 5.03 | 48.48 | 0.02 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `manual_playtest_recommended` | 100 | 14% | 27.00 | 9.50 | 10.43 | 6.43 | 53.78 | 0.10 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 14.91 | 7.06 | 11.87 | 5.90 | 34.60 | 1.23 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_10_2` | 100 | 0% | 19.79 | 5.56 | 12.55 | 5.81 | 48.71 | 0.85 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_14_2` | 100 | 0% | 21.50 | 4.65 | 11.91 | 5.94 | 47.58 | 1.01 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_15_2` | 100 | 0% | 23.71 | 5.80 | 10.03 | 6.52 | 48.03 | 2.86 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_16_2` | 100 | 0% | 18.11 | 7.28 | 13.31 | 5.03 | 48.32 | 0.03 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_mechanic-wax-party-chain` | `manual_playtest_recommended` | 100 | 10% | 31.71 | 8.66 | 9.64 | 6.97 | 52.50 | 0.32 |
| `learning` | `average/learning-220ms-low-error__cast_balanced-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 11% | 27.15 | 9.44 | 10.45 | 6.54 | 53.41 | 0.06 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-party-chain` | `manual_playtest_recommended` | 100 | 27% | 35.97 | 7.73 | 8.85 | 8.43 | 51.91 | 0.35 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 24% | 32.77 | 8.24 | 9.27 | 8.24 | 52.45 | 0.07 |

## Zul'Aman-5 迈萨拉深渊

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `manual_playtest_recommended` | 100 | 50% | 39.22 | 9.22 | 5.61 | 13.01 | 46.30 | 0.99 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 14.34 | 8.41 | 13.64 | 7.83 | 34.30 | 1.35 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_2` | 100 | 0% | 21.10 | 5.95 | 11.32 | 9.57 | 48.64 | 2.41 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_10_2` | 100 | 0% | 20.88 | 6.42 | 10.79 | 9.63 | 49.49 | 2.64 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 0% | 21.19 | 5.92 | 11.37 | 9.48 | 50.17 | 2.47 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_18_2` | 100 | 0% | 19.27 | 7.55 | 10.09 | 9.67 | 50.31 | 3.64 |
| `fixed` | `average/average2-800ms-10pct` | `manual_playtest_recommended` | 100 | 56% | 40.41 | 9.21 | 5.71 | 13.06 | 45.96 | 0.93 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 14.13 | 8.45 | 13.62 | 7.90 | 34.43 | 1.09 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_2` | 100 | 0% | 20.43 | 6.07 | 11.07 | 9.46 | 48.45 | 2.36 |
| `fixed` | `average/average2-800ms-10pct` | `generated_10_2` | 100 | 0% | 20.53 | 6.45 | 10.72 | 9.46 | 49.82 | 2.55 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 0% | 21.34 | 5.89 | 11.29 | 9.54 | 50.52 | 2.33 |
| `fixed` | `average/average2-800ms-10pct` | `generated_18_2` | 100 | 0% | 19.31 | 7.50 | 10.10 | 9.60 | 49.99 | 3.33 |
| `fixed` | `average/average3-500ms-15pct` | `manual_playtest_recommended` | 100 | 53% | 39.68 | 9.29 | 5.73 | 13.09 | 46.48 | 0.86 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 14.28 | 8.42 | 13.57 | 7.86 | 34.55 | 0.79 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_2` | 100 | 0% | 20.21 | 6.05 | 11.03 | 9.53 | 48.50 | 2.79 |
| `fixed` | `average/average3-500ms-15pct` | `generated_10_2` | 100 | 0% | 21.04 | 6.34 | 10.71 | 9.41 | 49.53 | 2.88 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 0% | 21.31 | 5.89 | 11.40 | 9.51 | 50.60 | 1.74 |
| `fixed` | `average/average3-500ms-15pct` | `generated_18_2` | 100 | 0% | 20.28 | 7.38 | 10.53 | 9.67 | 50.11 | 2.71 |
| `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 100 | 66% | 43.83 | 9.11 | 5.73 | 12.85 | 45.52 | 0.47 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 14.52 | 8.38 | 13.48 | 7.81 | 34.53 | 0.86 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_2` | 100 | 0% | 20.53 | 6.07 | 11.15 | 9.54 | 48.36 | 2.47 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_10_2` | 100 | 0% | 21.27 | 6.34 | 11.08 | 9.56 | 49.40 | 2.23 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 0% | 21.66 | 5.82 | 11.58 | 9.46 | 50.24 | 1.44 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_18_2` | 100 | 0% | 21.57 | 7.21 | 10.97 | 9.57 | 50.65 | 2.30 |
| `fixed` | `expert/expert2-150ms-2pct` | `manual_playtest_recommended` | 100 | 65% | 42.79 | 9.16 | 5.84 | 12.89 | 45.57 | 0.46 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 14.36 | 8.45 | 13.64 | 7.81 | 33.92 | 0.86 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_2` | 100 | 0% | 21.36 | 5.87 | 11.47 | 9.55 | 48.50 | 2.13 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_10_2` | 100 | 0% | 21.31 | 6.30 | 11.02 | 9.40 | 50.01 | 2.33 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 0% | 21.78 | 5.79 | 11.51 | 9.56 | 50.13 | 1.71 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_18_2` | 100 | 0% | 20.66 | 7.44 | 10.65 | 9.70 | 49.98 | 2.60 |
| `fixed` | `expert/expert3-100ms-3pct` | `manual_playtest_recommended` | 100 | 66% | 43.23 | 9.15 | 5.87 | 13.02 | 45.57 | 0.46 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 14.37 | 8.44 | 13.52 | 7.81 | 34.00 | 0.89 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_2` | 100 | 0% | 20.18 | 6.15 | 10.53 | 9.40 | 48.78 | 2.57 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_10_2` | 100 | 0% | 20.20 | 6.53 | 10.33 | 9.74 | 49.81 | 2.87 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 0% | 20.04 | 6.14 | 10.90 | 9.60 | 50.29 | 2.18 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 100 | 0% | 18.12 | 7.82 | 9.31 | 9.88 | 49.93 | 3.59 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `manual_playtest_recommended` | 100 | 56% | 40.96 | 9.21 | 5.67 | 12.97 | 45.98 | 0.84 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 14.64 | 8.35 | 13.54 | 7.72 | 34.81 | 0.63 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_2` | 100 | 0% | 20.40 | 6.07 | 11.16 | 9.56 | 48.59 | 2.66 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_10_2` | 100 | 0% | 21.05 | 6.35 | 10.73 | 9.58 | 49.76 | 2.62 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 0% | 21.63 | 5.81 | 11.29 | 9.52 | 50.26 | 1.87 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_18_2` | 100 | 0% | 20.96 | 7.31 | 10.40 | 9.62 | 49.92 | 2.72 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `manual_playtest_recommended` | 100 | 59% | 40.76 | 9.20 | 5.82 | 13.05 | 46.08 | 0.61 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 14.40 | 8.40 | 13.41 | 7.81 | 34.76 | 1.06 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_2` | 100 | 0% | 20.35 | 6.13 | 11.31 | 9.64 | 48.42 | 2.39 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_10_2` | 100 | 0% | 20.57 | 6.47 | 10.83 | 9.51 | 49.54 | 2.46 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 0% | 22.74 | 5.59 | 11.84 | 9.58 | 50.64 | 1.52 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_18_2` | 100 | 0% | 20.88 | 7.37 | 10.95 | 9.66 | 50.44 | 2.42 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `manual_playtest_recommended` | 100 | 63% | 41.55 | 9.20 | 5.81 | 12.98 | 45.82 | 0.50 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 14.24 | 8.48 | 13.69 | 7.85 | 34.55 | 0.76 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_2` | 100 | 0% | 20.77 | 6.00 | 11.26 | 9.44 | 48.41 | 2.47 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_10_2` | 100 | 0% | 20.89 | 6.42 | 10.90 | 9.53 | 49.72 | 2.54 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 0% | 21.46 | 5.84 | 11.46 | 9.57 | 50.64 | 1.75 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_18_2` | 100 | 0% | 20.92 | 7.36 | 10.73 | 9.59 | 49.84 | 2.44 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_mechanic-wax-tank-chain` | `manual_playtest_recommended` | 100 | 45% | 37.54 | 9.08 | 7.07 | 11.16 | 46.73 | 1.12 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 44% | 38.05 | 9.05 | 7.85 | 11.75 | 47.32 | 0.62 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_mechanic-wax-tank-chain` | `manual_playtest_recommended` | 100 | 30% | 34.18 | 9.42 | 5.85 | 13.19 | 47.83 | 1.07 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 42% | 36.27 | 9.41 | 6.88 | 12.72 | 47.47 | 0.63 |

## Zul'Aman-6 阿塔阿曼

| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | `average/average1-1000ms-5pct` | `manual_playtest_recommended` | 100 | 94% | 84.95 | 9.68 | 4.99 | 11.54 | 38.14 | 1.22 |
| `fixed` | `average/average1-1000ms-5pct` | `default` | 100 | 0% | 11.29 | 10.05 | 11.52 | 6.56 | 28.55 | 8.24 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_1_2` | 100 | 0% | 13.27 | 7.54 | 7.74 | 6.62 | 39.93 | 9.52 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_10_2` | 100 | 0% | 12.86 | 7.80 | 7.43 | 6.60 | 48.69 | 9.98 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_17_2` | 100 | 0% | 13.03 | 7.68 | 7.43 | 6.62 | 39.43 | 9.77 |
| `fixed` | `average/average1-1000ms-5pct` | `generated_18_2` | 100 | 0% | 12.26 | 9.75 | 6.87 | 6.59 | 39.65 | 10.48 |
| `fixed` | `average/average2-800ms-10pct` | `manual_playtest_recommended` | 100 | 97% | 86.40 | 9.69 | 5.12 | 11.37 | 38.02 | 1.15 |
| `fixed` | `average/average2-800ms-10pct` | `default` | 100 | 0% | 11.22 | 10.10 | 11.47 | 6.55 | 28.41 | 8.33 |
| `fixed` | `average/average2-800ms-10pct` | `generated_1_2` | 100 | 0% | 13.19 | 7.58 | 7.56 | 6.62 | 39.72 | 9.63 |
| `fixed` | `average/average2-800ms-10pct` | `generated_10_2` | 100 | 0% | 13.36 | 7.52 | 7.63 | 6.62 | 47.68 | 9.56 |
| `fixed` | `average/average2-800ms-10pct` | `generated_17_2` | 100 | 0% | 12.63 | 7.92 | 7.15 | 6.60 | 39.19 | 10.02 |
| `fixed` | `average/average2-800ms-10pct` | `generated_18_2` | 100 | 0% | 12.23 | 9.78 | 6.83 | 6.59 | 39.52 | 10.46 |
| `fixed` | `average/average3-500ms-15pct` | `manual_playtest_recommended` | 100 | 98% | 86.84 | 9.67 | 5.22 | 11.08 | 37.98 | 1.12 |
| `fixed` | `average/average3-500ms-15pct` | `default` | 100 | 0% | 11.24 | 10.12 | 11.65 | 6.55 | 28.21 | 8.09 |
| `fixed` | `average/average3-500ms-15pct` | `generated_1_2` | 100 | 0% | 13.37 | 7.48 | 7.60 | 6.63 | 39.93 | 9.49 |
| `fixed` | `average/average3-500ms-15pct` | `generated_10_2` | 100 | 0% | 13.43 | 7.48 | 7.76 | 6.62 | 48.39 | 9.58 |
| `fixed` | `average/average3-500ms-15pct` | `generated_17_2` | 100 | 0% | 13.01 | 7.69 | 7.45 | 6.62 | 39.07 | 9.70 |
| `fixed` | `average/average3-500ms-15pct` | `generated_18_2` | 100 | 0% | 12.07 | 9.87 | 6.70 | 6.58 | 39.90 | 10.51 |
| `fixed` | `expert/expert1-200ms-1pct` | `manual_playtest_recommended` | 100 | 98% | 87.39 | 9.65 | 5.07 | 11.02 | 37.76 | 1.02 |
| `fixed` | `expert/expert1-200ms-1pct` | `default` | 100 | 0% | 11.44 | 10.01 | 11.71 | 6.56 | 28.55 | 8.17 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_1_2` | 100 | 0% | 12.94 | 7.73 | 7.32 | 6.61 | 40.08 | 9.79 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_10_2` | 100 | 0% | 12.82 | 7.80 | 7.35 | 6.61 | 48.20 | 10.03 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_17_2` | 100 | 0% | 12.97 | 7.71 | 7.34 | 6.61 | 39.11 | 9.80 |
| `fixed` | `expert/expert1-200ms-1pct` | `generated_18_2` | 100 | 0% | 12.07 | 9.87 | 6.59 | 6.59 | 39.76 | 10.46 |
| `fixed` | `expert/expert2-150ms-2pct` | `manual_playtest_recommended` | 100 | 99% | 87.54 | 9.72 | 5.08 | 11.01 | 37.66 | 1.02 |
| `fixed` | `expert/expert2-150ms-2pct` | `default` | 100 | 0% | 11.17 | 10.11 | 11.47 | 6.55 | 28.50 | 8.28 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_1_2` | 100 | 0% | 13.31 | 7.52 | 7.57 | 6.62 | 40.40 | 9.56 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_10_2` | 100 | 0% | 13.23 | 7.58 | 7.47 | 6.61 | 48.27 | 9.64 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_17_2` | 100 | 0% | 12.60 | 7.94 | 7.15 | 6.60 | 39.32 | 10.04 |
| `fixed` | `expert/expert2-150ms-2pct` | `generated_18_2` | 100 | 0% | 12.21 | 9.77 | 6.72 | 6.59 | 40.15 | 10.46 |
| `fixed` | `expert/expert3-100ms-3pct` | `manual_playtest_recommended` | 100 | 99% | 87.87 | 9.79 | 5.07 | 11.06 | 37.54 | 0.98 |
| `fixed` | `expert/expert3-100ms-3pct` | `default` | 100 | 0% | 11.16 | 10.12 | 11.52 | 6.55 | 28.27 | 8.24 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_1_2` | 100 | 0% | 13.30 | 7.52 | 7.65 | 6.62 | 39.93 | 9.56 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_10_2` | 100 | 0% | 13.14 | 7.62 | 7.52 | 6.62 | 48.12 | 9.82 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_17_2` | 100 | 0% | 13.06 | 7.66 | 7.38 | 6.62 | 39.15 | 9.76 |
| `fixed` | `expert/expert3-100ms-3pct` | `generated_18_2` | 100 | 0% | 12.09 | 9.87 | 6.75 | 6.59 | 40.11 | 10.50 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `manual_playtest_recommended` | 100 | 99% | 88.22 | 9.72 | 5.11 | 11.46 | 37.76 | 1.14 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `default` | 100 | 0% | 11.12 | 10.12 | 11.31 | 6.55 | 28.36 | 8.31 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_1_2` | 100 | 0% | 13.12 | 7.62 | 7.40 | 6.62 | 39.95 | 9.67 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_10_2` | 100 | 0% | 12.87 | 7.78 | 7.40 | 6.61 | 48.69 | 10.01 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_17_2` | 100 | 0% | 12.92 | 7.74 | 7.37 | 6.61 | 39.32 | 9.84 |
| `fixed` | `skilled/skilled1-450ms-3pct` | `generated_18_2` | 100 | 0% | 12.33 | 9.70 | 6.83 | 6.59 | 39.87 | 10.35 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `manual_playtest_recommended` | 100 | 100% | 88.01 | 9.71 | 5.14 | 10.94 | 37.71 | 1.00 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `default` | 100 | 0% | 11.02 | 10.19 | 11.26 | 6.55 | 28.77 | 8.28 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_1_2` | 100 | 0% | 13.13 | 7.61 | 7.58 | 6.62 | 40.53 | 9.69 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_10_2` | 100 | 0% | 13.14 | 7.63 | 7.42 | 6.62 | 48.34 | 9.75 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_17_2` | 100 | 0% | 13.05 | 7.66 | 7.39 | 6.62 | 39.29 | 9.73 |
| `fixed` | `skilled/skilled2-300ms-5pct` | `generated_18_2` | 100 | 0% | 12.17 | 9.80 | 6.74 | 6.59 | 39.46 | 10.45 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `manual_playtest_recommended` | 100 | 98% | 86.51 | 9.69 | 5.13 | 10.92 | 37.78 | 1.10 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `default` | 100 | 0% | 11.22 | 10.08 | 11.54 | 6.55 | 28.04 | 8.26 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_1_2` | 100 | 0% | 13.47 | 7.42 | 7.77 | 6.63 | 40.13 | 9.42 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_10_2` | 100 | 0% | 13.10 | 7.65 | 7.45 | 6.62 | 48.64 | 9.76 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_17_2` | 100 | 0% | 13.14 | 7.61 | 7.50 | 6.62 | 39.23 | 9.59 |
| `fixed` | `skilled/skilled3-200ms-8pct` | `generated_18_2` | 100 | 0% | 12.12 | 9.86 | 6.66 | 6.59 | 39.60 | 10.50 |
| `learning` | `average/learning-220ms-low-error__cast_broad-low-mid-casts__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 99% | 84.24 | 9.39 | 5.90 | 10.23 | 39.49 | 0.95 |
| `learning` | `average/learning-220ms-low-error__cast_broad-window__tactic_strict-threat` | `manual_playtest_recommended` | 100 | 95% | 85.65 | 9.85 | 5.11 | 11.36 | 38.14 | 1.22 |
