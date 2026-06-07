# Player Build Manual Control Notes

## `initialRemainingCooldownMs`

- 该字段仍是通用数据接口，用于配置技能进入战斗时还剩多少冷却。
- 当前演示阶段，为了便于玩家手动测试技能栏，样例主动技能建议填写为 `0`。
- 如果未来某关需要开场预冷却，仍然可以由策划在 `player_build.xlsx` 中填写非零值。
