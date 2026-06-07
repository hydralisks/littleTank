# RingingDeeps 自动评分报告说明

标准产物：

- `reports/balance/latest.md`
- `reports/balance/latest.json`
- `reports/balance/chapter-one-auto-scoring.md`
- `reports/balance/chapter-one-auto-scoring.json`
- `第一章自动评分.md`

策划表更新后可用 `npm run analyze:balance` 刷新这些产物。该脚本只读取 `public/designer-data/*.xlsx`，不应写回策划表。

## 方法

- 读取当前 `stage_content.xlsx`、`encounter_balance.xlsx`、`enemy_data.xlsx`、`player_build.xlsx`。
- 在内存中应用工作簿数据。
- 分析 `RingingDeeps-1` 到 `RingingDeeps-6`。
- 人工基线作为校准源头，自动评分用于发现差异和辅助定位原因。
- AI 标签只看通过率，不使用玩家剩余血量、队伍剩余血量或队伍剩余压力。

## 固定策略 AI

- 使用九个操作 profile：
  - `average1-1000ms-5pct`、`average2-800ms-10pct`、`average3-500ms-15pct`
  - `skilled1-450ms-3pct`、`skilled2-300ms-5pct`、`skilled3-200ms-8pct`
  - `expert1-200ms-1pct`、`expert2-150ms-2pct`、`expert3-100ms-3pct`
- 各 tier 使用同一套战术假设，只通过反应延迟和失误率区分。
- 使用两段式 build 搜索：第一阶段低成本探索，第二阶段对筛出的候选 build 跑正式样本。
- Build 搜索包含主动技能和被动天赋，候选 build 会保留 `passiveTalentIds` 并进入真实战斗模拟。
- 目标选择不再只按丢失仇恨排序；现在会综合敌方当前读条风险、技能循环风险、低血量击杀收益、irregular 周期维护和坦克承压分摊。
- 防御技能会避免在同类减伤仍生效时重复消耗，例如护卫神盾下盾墙不会连续吃掉两层。
- 针对 RingingDeeps-6，学习型 AI 额外加入了机制偏好：会尝试识别“蜡像”与“暗影之锄”的状态链，并在 `mechanic_focus` 下避免把后续的状态链目标简单视为普通丢仇恨目标。

## 学习型 AI

- 探索合法 build、多种读条处理策略和多种战术策略。
- 战术策略包括严格抢回仇恨、优先击杀高威胁目标、坦克高压时允许 irregular 短暂分摊、机制目标优先。
- 对“蜡像 -> 暗影之锄”这类机制链，学习型 AI 现在会尝试两种前置计划：让蜡像和后续暗影之锄都打队伍，或都打坦克。该策略作为候选参与搜索，不直接改动策划表。
- 收敛到共享胜率较高的 build、读条策略与战术策略。
- 用最终候选集合跑正式样本，模拟玩家多次尝试后学到较优打法的结果。

## 当前人工记录

| 关卡 | 人工标签 | 备注 |
| --- | --- | --- |
| `RingingDeeps-1` | `easy` | 开场教程关。 |
| `RingingDeeps-2` | `easy` | 调整后记录为 easy。 |
| `RingingDeeps-3` | `hard` | 需要正确使用打断/控制。 |
| `RingingDeeps-4` | `hard` | 被动构筑解锁后人工结论为 hard。 |
| `RingingDeeps-5` | `balanced` | 当前目标体验锚点。 |
| `RingingDeeps-6` | `expert` | 被动天赋调整后人工结论为 expert。 |

## 今日规则变更

- 移除旧规则：“多种 build 甚至缺少技能也能通关则下调难度”。
- 保留并收紧为新规则：“空余 4 个或更多技能点的 build 仍能达到最优 build 通过率一半以上时，下调难度一档”。
- 评测总表需要单独显示“达到最优 build 一半以上通过率的 build 数量”，并标出其中空余 4 点以上的数量。
- 后续反馈给策划的文档优先使用中文描述，尤其是 `第一章自动评分.md` 等中文命名文档。

## 当前状态

本轮已更新评分代码、报表模板、人工基线和文档。短样本诊断显示 RingingDeeps-4 因目标选择和 irregular 策略改善，自动评分方向更接近人工记录；RingingDeeps-6 仍需要继续补机制级理解，尤其是把“前置技能规划”和“后续技能目标”扩展成更通用的策略搜索。完整 `npm run analyze:balance` 曾在 600 秒内未完成，因此历史 `reports/balance/*.md/json` 与 `第一章自动评分.md` 的具体数值可能仍来自旧样本。后续若需要刷新数值，应给脚本更长运行时间，或新增一个快速采样模式用于开发验证。

## 2026-05-25 RD6 定向更新

- 已确认 RD6 失败的主要原因之一不是关卡绝对不可过，而是评测搜索层漏掉了关键被动组合。旧候选在 `phaseOneMaxPassiveVariants=3` 时容易只保留 UI 顺序靠前的组合，漏掉 `加固板甲 + 野蛮训练`。
- `generateStageBalanceBuilds` 现在会按被动天赋标签做搜索价值排序，使生存、队伍增伤/降仇恨、打断控制等高价值组合更早进入候选。
- 修正目标抖动：AI 选择高危读条/机制目标后，同一决策 tick 不会立刻被普通丢仇恨逻辑覆盖；没有可用停止技能时也不会为了读条计划频繁切目标。
- RD6 定向短样本已出现正通过率：`generated_2_2` 100 次中 21 次通过，`generated_6_2` 100 次中 18 次通过。两者都使用 `加固板甲 + 野蛮训练`，说明学习型 AI 已经有机会找到可通关策略。
- 完整 `npm run analyze:balance` 本轮在 1200 秒内超时，完整章节报表未刷新。下一步建议增加快速采样/单关分析参数，再生成新的 `第一章自动评分.md`。
