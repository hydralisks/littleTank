# 第三章祖阿曼开发记录

最后更新：2026-07-16

## 数据同步边界

- 主线战役第三章仍只从正式主线策划表读取：
  - `public/designer-data/stage_content.xlsx`
  - `public/designer-data/encounter_balance.xlsx`
  - `public/designer-data/enemy_data.xlsx`
  - `public/designer-data/player_build.xlsx`
- 演示 Web 版通过 Vite 静态服务运行时读取 `/designer-data/*.xlsx`。策划表被覆盖后，刷新浏览器页面即可重新拉取当前数据；如浏览器缓存异常，重启 dev server 后再刷新。
- 本轮没有运行 `npm run generate:designer-data`，没有生成或覆盖策划维护的 `public/designer-data/*.xlsx`。

## 第三章已接入机制

- 巨魔敌人的技能、状态和章节关卡布置来自当前工作簿。
- 已接入的第三章状态逻辑包括：
  - `soulSensitive_status` / `soulSensitive_p_status`：只提高玩家或队伍承受的魔法伤害，可叠加到 5 层。
  - `shadowWaved_status`：按当前状态参数产生暗影波相关效果。
  - `trollRuptured_status` / `trollRuptured_p_status`：产生持续伤害，并按目标侧处理治疗限制。
  - `trollTaunted_status` / `trollTaunted_p_status`：强制玩家或队伍当前目标指向来源敌人。
  - `berserker!_status` / `wind_strike!_status`：引导期间按锁定目标造成周期伤害。
  - `shellUp_status`、`spiritShelled_status`、药剂类状态：按策划表结构化字段驱动数值。
- 敌方技能对队伍造成实际血量伤害时会写入 `combatLog` 的 `damage` 事件，战后统计“队伍承伤”从该事件聚合。

## 灵魂敏感叠加规则

`灵魂敏感` 使用通用可叠加状态路径：

- 首次施加时创建 1 层，持续时间读取策划表定义，当前为 7000ms。
- 再次施加同一状态时，层数 +1，最多 5 层。
- 再次施加会把整组状态的 `remainingMs` 和 `totalMs` 刷新到新状态的完整持续时间。
- 层数不会逐层独立过期；从最近一次施加后经过完整持续时间，所有层数一起消失。

当前回归测试覆盖了 2 层叠加后立刻为 7000ms、经过 6999ms 仍保留 2 层、经过 7000ms 后一起消失。

## 验证命令

- `npm run validate:designer-data`
- `npx vitest run src/game/encounter/encounterFactory.test.ts -t "ZulAman player and party debuffs"`
- `npx vitest run src/game/encounter/encounterFactory.test.ts`
- `npm run build`
