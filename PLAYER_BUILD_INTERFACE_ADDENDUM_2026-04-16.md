# Player Build Interface Addendum 2026-04-16

## 主动技能定义新增字段

- `castStopMode`
  - 中文：施法阻止类型
  - `none / interrupt / control`

- `canAffectSkull`
  - 中文：是否可影响首领
  - `true / false`

## 规则

- `interrupt` 类技能只会对允许打断的施法生效
- `control` 类技能可对允许控制阻止的施法生效
- 当 `canAffectSkull=false` 时，该技能不会影响首领敌人
