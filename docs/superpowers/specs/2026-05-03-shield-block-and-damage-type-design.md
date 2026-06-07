# Shield Block And Damage Type Design

## Goal

Implement `warrior_t_shield_block` as the next real warrior tank active skill. The skill should follow the planner text in `player_build.xlsx`: `description=耗怒物理减伤` and effect `notes=物理减伤50%`.

## Scope

- Add an enemy skill damage type field named `damageType`.
- Current valid values are `physical` and `magic`.
- Enemy player damage defaults to physical when no workbook value is present.
- Implement `shield_block` as a player buff created from the active skill effect row.
- Shield block reduces matching physical player damage by `valueB`, with `0.5` meaning 50% damage reduction.
- Shield block does not reduce magic player damage.

## Data Contract

`public/designer-data/enemy_data.xlsx -> 敌人技能` gains:

- `damageType`: `physical` or `magic`.

`public/designer-data/player_build.xlsx -> 主动技能定义` uses:

- `skillId=warrior_t_shield_block`
- `skillLogicId=shield_block`
- `resourceCost=20`
- `targetingType=self`
- `grantedStatusIdsCsv=shieldBlock`

`public/designer-data/player_build.xlsx -> 主动技能效果` uses:

- `skillEffectId=warrior_t_shield_block_main`
- `statusId=shieldBlock`
- `durationMs`: runtime duration in milliseconds. Current planner target is 7000 ms.
- `valueB=0.5`: physical damage reduction ratio.

## Runtime Design

`shield_block` reuses the player buff path instead of the older `player.mitigation` single slot. The generated `StatusEffect` carries:

- `damageReductionRatio`
- `damageReductionTypes`

When an enemy cast hits the player, the damage calculation reads `EnemySkillDefinition.damageType`, multiplies damage by all matching player buff reductions, then applies the existing `ignorePain` absorb shield logic.

## Testing

Add a combat test that:

- Creates `shieldBlock` from the player build override.
- Casts shield block and verifies rage goes from 100 to 80.
- Resolves `bone-jab` as physical player damage and verifies 18 damage becomes 9.
- Resolves `flame-lance` as magic player damage and verifies 32 damage is not reduced.

## Handoff Notes

- Do not model boss-specific rules here.
- Future mitigation skills should prefer the `StatusEffect` damage reduction fields over `player.mitigation`.
- If future skills need magic-only or all-damage reduction, extend `damageReductionTypes` rather than adding another hard-coded branch.
