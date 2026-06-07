# Player Resource System Design

## Goal

Build the first player resource system around the current `warrior_t` class, where the resource is rage. The shared skill table keeps `resourceCost` as the only generic resource field. Skills that generate rage do so in their `skillLogicId` runtime code instead of a `resourceDelta` column.

## Scope

- Current supported class: `warrior_t`.
- Current resource name: rage / 怒气.
- Base maximum resource remains `100`.
- Current passive talent modifiers remain usable:
  - `playerMaxResourceBonus`
  - `playerResourceRegenMultiplier`
- Stage and encounter tuning must not directly change player resource gain.
- Enemy, affix, and special rule effects that need to change resource behavior later must apply a player status, and that status effect logic can change resource variables.

## Runtime Rules

1. Passive resource gain is class-defined.
   - `warrior_t` base passive rage gain: `8` per second.
   - Formula: `basePerSecond * buildMultiplier * statusMultiplier * deltaMs / 1000`.
   - This replaces the old `deltaMs * 0.008 * passiveMultiplier * stageMultiplier` expression.

2. Rage on taking player damage remains class-defined.
   - `warrior_t` keeps the current rule: `max(4, round(incomingPlayerDamage / 11))`.
   - The rule moves into the resource system module so later classes can define different behavior.

3. Skill resource costs stay table-driven through `resourceCost`.
   - Runtime may later apply build/status cost modifiers to create final cost.
   - This round keeps final cost equal to `resourceCost`.

4. Skill rage generation is not a generic table field.
   - Remove `resourceDelta` from workbook overrides, generated xlsx data, type definitions, and docs.
   - If a skill should generate rage, its `skillLogicId` implementation calls a resource helper or emits a player resource event.

## Extension Points

- Add a player resource event: `player/resource-changed`.
- Add a small resource helper module in encounter runtime.
- Status and skill logic can eventually share the helper, keeping resource mutations out of UI code and workbook scalar fields.

## Tests

- Ticking an encounter for one second gives warrior rage from class/build rules and ignores stage resource tuning.
- Incoming enemy player damage still grants rage by the warrior damage-taken rule.
- A skill logic path can generate rage through the runtime helper/event path.
- Workbook overrides ignore/remove `resourceDelta` as an active skill effect field.
