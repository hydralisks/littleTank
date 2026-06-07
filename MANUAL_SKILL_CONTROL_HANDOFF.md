# Manual Skill Control Handoff

## Scope

本轮把战斗演示从“自动放技能”改成了“玩家手动操作技能”。

## Code Changes

- [EncounterScreen.tsx](/C:/codexCode/littleTank/src/ui/EncounterScreen.tsx)
  - 删除自动演示施法队列与计时器。
  - 新增最近一次技能施放失败提示，并显示到队伍状态警示区。
  - 键盘热键与技能栏点击统一走手动施法检查。
- [SkillBar.tsx](/C:/codexCode/littleTank/src/ui/SkillBar.tsx)
  - 冷却、资源不足、GCD 仍保留视觉锁定态。
  - 鼠标点击不再因为按钮 `disabled` 被吞掉，失败原因由上层统一提示。
- [playerBuildCatalog.ts](/C:/codexCode/littleTank/src/game/data/playerBuildCatalog.ts)
  - 样例技能 `taunt / stun / massTaunt / shieldWall / burst / panic` 的 `initialRemainingCooldownMs` 调整为 `0`。
- [encounterTemplates.ts](/C:/codexCode/littleTank/src/game/data/encounterTemplates.ts)
  - 关卡开场 `playerGcdRemainingMs` 调整为 `0`，保证进战即可试按技能。
- [generateDesignerWorkbooks.mjs](/C:/codexCode/littleTank/scripts/generateDesignerWorkbooks.mjs)
  - 同步更新生成出的策划样例表，使 Excel 与代码默认值一致。

## Verification

- `npm test -- src/game/encounter/encounterFactory.test.ts`
- `npm run generate:designer-data`
- `npm run build`
- `npm run lint`

## Next Recommended Work

1. 扩写更多技能的真实手动逻辑，并继续先补单测再改实现。
2. 给技能释放成功后的反馈补音效、浮字或更明确的按钮状态变化。
3. 继续把更多战斗逻辑从硬编码迁移到 `logicId` 注册表。
