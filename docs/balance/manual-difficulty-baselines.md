# 人工难度基准

本文档记录人工测试者给出的关卡难度标签，用来校准后续只读自动评分系统。

注意：这里不是策划表数据。关卡数值调整仍必须由策划在 `public/designer-data/` 源工作簿中完成后再覆盖项目数据。

## 2026-05-24 基准 V2：被动天赋调整后的 RingingDeeps

来源：当前手动测试反馈。范围：第一章 `RingingDeeps-1` 至 `RingingDeeps-6`。

| 关卡 | 人工标签 | 备注 |
| --- | --- | --- |
| `RingingDeeps-1` | `easy` | 开场教程关，当前反馈为简单。 |
| `RingingDeeps-2` | `easy` | 调整后同样作为简单教程关记录。 |
| `RingingDeeps-3` | `hard` | 仍需要正确使用打断/控制，保留为 hard 校准点。 |
| `RingingDeeps-4` | `hard` | 被动天赋解锁后不再按 expert 记录，当前人工结论为 hard。 |
| `RingingDeeps-5` | `balanced` | 当前第一章中较接近目标体验的 balanced 校准点。 |
| `RingingDeeps-6` | `expert` | 被动天赋调整后不再按 near_impossible / impossible 记录，当前人工结论为 expert。 |

## 评分输入约束

- 难度标签只由不同操作 profile、反应延迟、失误率、合法 build 方案下的通过率决定。
- 不使用玩家剩余血量比例、队伍剩余血量比例、队伍剩余压力比例等间接状态数值给关卡定级。
- 静态评分只能作为早期风险提示，不替代人工记录和 AI 通过率评分。
- 自动评分发现与人工记录冲突时，先检查 AI 行为、build 搜索和 profile 覆盖；不要直接要求策划改表。

## 当前校准用途

- `RingingDeeps-1`、`RingingDeeps-2`：easy 教程关锚点。
- `RingingDeeps-3`、`RingingDeeps-4`：hard 操作要求锚点。
- `RingingDeeps-5`：balanced 目标体验锚点。
- `RingingDeeps-6`：expert 第一章收束关锚点。

## 标签含义

- `easy`：普通玩家可以较高概率通过，机制提示和基础操作仍应可见。
- `balanced`：普通玩家有合理通过率，机制和 build 选择仍有意义。
- `hard`：普通玩家可以通过，但需要正确反应、技能顺序或 build 使用，容错有限。
- `expert`：熟练玩家有可实践通关路径，普通玩家预计会多次失败。
- `near_impossible`：理论上可能通关，但平均人类操作在平均运气下很难完成。
- `impossible`：当前可用工具和规则下没有实际可行通关路径。
