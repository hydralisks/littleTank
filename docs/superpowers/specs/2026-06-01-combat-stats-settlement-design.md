# Combat Stats Settlement Design

Date: 2026-06-01

## Purpose

Add a concise post-combat statistics UI and an extensible combat event statistics layer.

The first version is not a full combat replay or a Details!-style analysis tool. It should help players understand where the key numbers came from in the finished fight, and it should give future systems a stable way to record events from enemy skills, player skills, passive talents, statuses, affixes, and stage rules.

## Scope

Included in V1:

- A battle result statistics panel shown after victory or defeat.
- Five selectable statistics pages:
  - Tank damage taken.
  - Party pressure gained.
  - Cast handling.
  - Damage dealt.
  - Healing and absorb generated.
- A normalized combat log event layer stored on the encounter runtime.
- Aggregation utilities that convert raw combat log events into UI-ready rows.
- Focused tests for event recording and aggregation.

Excluded from V1:

- Last-seconds combat replay.
- Full chronological timeline UI.
- Sorting/filtering beyond fixed page grouping.
- Actual absorb consumption analysis.
- Per-frame logs or high-frequency debug traces.

## Product Behavior

When combat ends, the existing result overlay is replaced or expanded into a result statistics panel.

The panel header shows:

- Outcome: victory or defeat.
- Stage title.
- Fight duration.
- Existing result reason.

The panel body has five tabs. Each tab shows one compact table and a small summary line naming the largest contributor on that page.

The panel footer keeps the existing result actions:

- Victory: return to map.
- Defeat: retry.

If a page has no data, it shows a short empty state such as "本场没有产生该类事件。"

## UI Copy

The first implementation should use concise Chinese labels:

- Tabs: `坦克承伤`, `压力来源`, `打断情况`, `造成伤害`, `治疗/吸收`.
- Shared table labels: `来源`, `项目`, `分类`, `总量`, `次数`, `平均`, `占比`.
- Cast table labels: `敌人`, `技能`, `危险度`, `结果`, `处理方式`.
- Cast results: `已打断`, `已控制`, `完成施放`, `不可处理`.
- Empty state: `本场没有产生该类事件。`

## Settlement UI Pages

### Tank Damage Taken

Purpose: explain which enemy skill, status, affix, or stage rule threatened the tank most.

Rows aggregate damage events where the target is the tank.

Columns:

- Source: enemy, status, affix, or stage rule display name.
- Effect: skill or effect display name.
- Total: total damage dealt to the tank.
- Count: number of hits.
- Share: percentage of all tank damage taken.

### Party Pressure Gained

Purpose: explain which mechanics pushed the party pressure bar.

Rows aggregate pressure events where the target is the party.

Columns:

- Source: enemy, status, affix, or stage rule display name.
- Effect: skill or effect display name.
- Total: total pressure gained.
- Count: number of pressure applications.
- Share: percentage of all pressure gained.

### Cast Handling

Purpose: show whether dangerous enemy casts were handled.

Rows aggregate cast lifecycle events by cast instance or by enemy skill when instance information is unavailable.

Columns:

- Enemy: enemy display name.
- Skill: enemy skill display name.
- Danger: low, medium, or high.
- Result: interrupted, controlled, completed, or unhandleable.
- Handling: player skill used, or "-".

Rules:

- A cast interrupted by a player interrupt is counted as interrupted.
- A cast stopped by control is counted as controlled.
- A cast that resolves successfully is counted as completed.
- A cast with an unstoppable break rule is counted as unhandleable if it completes.

### Damage Dealt

Purpose: show the player's offensive contribution by source category.

Rows aggregate damage events where the target is an enemy and the source is player-side.

Source categories:

- Player skill damage.
- Player auto attack damage.
- Passive talent damage.
- Party auto attack damage.

Columns:

- Source: skill, auto attack, talent, or party auto attack display name.
- Category: one of the source categories above.
- Total: total damage dealt.
- Count: number of damage events.
- Average: total divided by count.
- Share: percentage of all player-side damage dealt.

### Healing And Absorb

Purpose: show player-side sustain and mitigation generated during the fight.

Rows aggregate healing and absorb-created events.

Source categories:

- Party auto healing.
- Player skill healing.
- Player skill absorb.
- Passive talent healing.
- Passive talent absorb.

Columns:

- Source: skill, talent, or party auto heal display name.
- Type: healing or absorb.
- Total: total healing done or absorb amount created.
- Count: number of events.
- Share: percentage of all healing plus absorb generated.

V1 records absorb creation, not actual absorbed damage. Actual absorb consumption requires a more detailed damage settlement chain and is intentionally left for a later version.

## Combat Log Architecture

The existing `EncounterEvent` queue remains a state-mutation event system. It should not become the main statistics source because it is incomplete for analytics and is tied to gameplay state transitions.

Add a parallel append-only combat log to `EncounterRuntime`:

```ts
combatLog: CombatLogEvent[]
```

The combat log records analytical facts. Recording an event must not directly change combat state.

### Event Shape

All combat log events share these base fields:

```ts
interface CombatLogEventBase {
  id: string
  occurredAtMs: number
  type: CombatLogEventType
  source: CombatLogActor
  target: CombatLogActor
  ability?: CombatLogAbility
  tags?: string[]
}
```

Actor shape:

```ts
interface CombatLogActor {
  kind:
    | 'tank'
    | 'ally'
    | 'player'
    | 'playerAutoAttack'
    | 'party'
    | 'partyAutoAttack'
    | 'partyAutoHeal'
    | 'enemy'
    | 'status'
    | 'affix'
    | 'stageRule'
    | 'talent'
  id?: string
  name?: string
}
```

Ability shape:

```ts
interface CombatLogAbility {
  kind:
    | 'playerSkill'
    | 'enemySkill'
    | 'autoAttack'
    | 'autoHeal'
    | 'status'
    | 'affix'
    | 'stageRule'
    | 'talent'
  id: string
  name?: string
}
```

Initial event types:

```ts
type CombatLogEventType =
  | 'damage'
  | 'pressure'
  | 'cast-started'
  | 'cast-resolved'
  | 'cast-interrupted'
  | 'cast-controlled'
  | 'healing'
  | 'absorb-created'
```

Damage event:

```ts
interface CombatDamageEvent extends CombatLogEventBase {
  type: 'damage'
  amount: number
  damageType?: EnemySkillDamageType
}
```

Pressure event:

```ts
interface CombatPressureEvent extends CombatLogEventBase {
  type: 'pressure'
  amount: number
}
```

Cast events:

```ts
interface CombatCastEvent extends CombatLogEventBase {
  type: 'cast-started' | 'cast-resolved' | 'cast-interrupted' | 'cast-controlled'
  castId?: string
  enemyId: string
  enemySkillId: string
  dangerLevel: DangerLevel
  breakRule: EnemyCastBreakRule
  handlerSkillId?: SkillId
}
```

Healing and absorb events:

```ts
interface CombatHealingEvent extends CombatLogEventBase {
  type: 'healing'
  amount: number
}

interface CombatAbsorbCreatedEvent extends CombatLogEventBase {
  type: 'absorb-created'
  amount: number
}
```

### Recording API

Add a small helper module:

```ts
recordCombatLogEvent(state, event): EncounterState
recordCombatLogEvents(state, events): EncounterState
```

These helpers append to `state.runtime.combatLog` and preserve immutability.

Event IDs should be deterministic enough for tests. A practical first version can derive IDs from time, event type, source, target, ability, and current log length.

### Aggregation API

Add a statistics module:

```ts
buildEncounterStats(state): EncounterStats
```

The result shape should be UI-oriented:

```ts
interface EncounterStats {
  durationMs: number
  tankDamageTaken: StatAmountRow[]
  pressureGained: StatAmountRow[]
  castHandling: CastHandlingRow[]
  damageDealt: StatAmountRow[]
  healingAndAbsorb: HealingAbsorbRow[]
}
```

Shared amount row:

```ts
interface StatAmountRow {
  id: string
  sourceName: string
  effectName: string
  category: string
  total: number
  count: number
  average: number
  share: number
}
```

Cast handling row:

```ts
interface CastHandlingRow {
  id: string
  enemyName: string
  skillName: string
  dangerLevel: DangerLevel
  result: 'interrupted' | 'controlled' | 'completed' | 'unhandleable'
  handlerName: string | null
}
```

Healing and absorb row:

```ts
interface HealingAbsorbRow extends StatAmountRow {
  kind: 'healing' | 'absorb'
}
```

Rows are sorted by total descending, except cast handling which is sorted by occurred time or cast start time.

## Integration Points

The first implementation should record events at the points where combat numbers are already settled.

High-priority integration points:

- Enemy skill damage to tank.
- Enemy skill pressure to party.
- Enemy cast started, resolved, interrupted, and controlled.
- Player skill damage.
- Player auto attack damage.
- Party auto attack damage.
- Player skill healing and absorb creation.
- Passive talent damage, healing, and absorb creation where such effects exist.
- Party auto healing.

Lower-priority later integration points:

- Stage rule damage or pressure.
- Affix damage or pressure.
- Status periodic damage, pressure, healing, or absorb.
- Actual absorb consumption.
- Overhealing.

If an integration point cannot provide a display name, it should still record a stable ID and let the aggregator fall back to the ID.

## Extensibility Rules

Future affixes, statuses, and skills should not need to modify the settlement panel directly.

They should only:

- Apply their gameplay effect.
- Record one or more combat log events with source, target, ability, and amount.

The aggregation layer owns grouping and display preparation. The UI consumes aggregated rows and does not need to know whether a row came from a skill, talent, affix, status, or stage rule.

## Testing Strategy

Unit tests:

- `recordCombatLogEvent` appends events immutably.
- Damage events aggregate by source category and ability.
- Tank damage excludes enemy damage dealt to non-tank targets.
- Pressure events aggregate by source and effect.
- Cast handling produces interrupted, controlled, completed, and unhandleable rows.
- Healing and absorb rows stay separate even when they share the same source.
- Empty combat log produces empty tables without errors.

Encounter integration tests:

- A simple enemy hit records tank damage taken.
- A pressure skill records pressure gained.
- A player damage skill appears in damage dealt.
- Interrupting a cast appears in cast handling.

UI tests:

- Result panel shows five selectable pages.
- Each page renders its table headers.
- Empty pages render the empty state.
- Existing victory and defeat actions still work.

## Acceptance Criteria

- After combat ends, the player can switch between the five statistics pages.
- Tank damage, pressure, cast handling, damage dealt, and healing/absorb pages are populated from `combatLog` aggregation.
- The result UI remains concise and does not show chronological replay.
- Existing combat behavior is unchanged by event recording.
- Tests cover the recording helpers, aggregation logic, and result panel page switching.
