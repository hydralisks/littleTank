# Monster Codex Design

## Goal

Add a map-entry monster codex that lets players review enemies they have already fought, including maximum HP, threat behavior, skill list, and configured skill cycle.

## Scope

The first version is a read-only reference panel. It unlocks enemy entries when the player enters a stage containing those enemy definitions. It does not record combat replays, actual cast history, kill counts, or per-run statistics.

## User Experience

The map screen gets a small top-left `怪物图鉴` button near the existing map header controls. Clicking it opens a large modal panel over the map. The panel shows:

- A left list of unlocked enemy entries.
- A right detail area for the selected enemy.
- An empty state when no enemy has been encountered yet.

Each unlocked detail page shows:

- Enemy name and ID.
- Maximum HP from enemy definition.
- Threat logic as readable Chinese text.
- Boss marker when `isSkull` is true.
- Appearing stages collected from encounter templates.
- Skill list with cast time, channel time, recovery time, damage or pressure values, break rule, and danger level.
- Skill cycle as an ordered chain using skill names.

Unknown enemies are not shown in the first version. Locked silhouettes and completion counters can be added later.

## Unlock Rule

An enemy unlocks when the player starts a stage containing that enemy definition. Unlocking does not require victory or killing the enemy.

Unlock identity is `EnemyState.definitionId`, not the stage-local spawn ID. Multiple instances of the same enemy only unlock one codex entry.

The save file stores unlocked enemies in `seenEnemyDefinitionIds: string[]`. Old saves normalize this field to an empty array.

## Data Flow

1. `App.startStage(stageId)` creates or inspects the stage encounter template.
2. It extracts unique enemy `definitionId` values from the template.
3. It merges those IDs into `seenEnemyDefinitionIds` in React state and persisted save data.
4. `StageSelectScreen` receives `seenEnemyDefinitionIds`.
5. `MonsterCodexPanel` receives prepared codex entries from a view-model helper.

The UI must not reach into raw workbook data directly. A focused view-model module owns the conversion from enemy catalog and encounter templates into display entries.

## Proposed Modules

### `src/game/data/monsterCodex.ts`

Pure data/view-model helpers:

- `getEnemyDefinitionIdsForStage(stageId)`
- `appendSeenEnemyDefinitionIds(current, next)`
- `buildMonsterCodexEntries(seenEnemyDefinitionIds)`

The module reads existing enemy definitions, skill definitions, stage order, and encounter templates. It returns cloned, display-friendly data.

### `src/ui/MonsterCodexPanel.tsx`

Presentation component:

- Receives `isOpen`, `entries`, `onClose`.
- Maintains only selected enemy ID as local UI state.
- Renders empty, list, and detail states.

### `src/app/saveGame.ts`

Persist and normalize `seenEnemyDefinitionIds`.

### `src/app/App.tsx`

Owns the unlocked enemy state and updates it when a stage starts.

### `src/ui/StageSelectScreen.tsx`

Adds the map button and modal state. It passes codex entries into `MonsterCodexPanel`.

## Non-Goals

- No new designer workbook columns.
- No changes to AI simulation strategy.
- No public asset generation.
- No combat event history or per-run analytics.
- No locked enemy silhouettes in MVP.
- No search/filter in MVP.

## Testing Strategy

Use TDD:

- Save tests prove new field round-trips and old saves normalize.
- Monster codex data tests prove stage enemy IDs unlock by definition ID and entries include skill details and stage appearances.
- App or focused helper tests prove starting a stage merges unlocked enemies without duplicates.
- Stage select UI tests prove the button opens the panel and displays an unlocked enemy entry.

## Open Decisions

The first version should use Chinese labels for common enum values in the UI:

- `normal`: 普通仇恨
- `irregular`: 乱仇恨
- `bloodlust`: 嗜血目标
- `interruptOrControl`: 可打断或控制
- `controlOnly`: 只能控制
- `unstoppable`: 不可阻止
- `low`: 低
- `medium`: 中
- `high`: 高

These labels should live in the codex view-model or a small UI helper, not be duplicated inline across components.
