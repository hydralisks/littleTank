# Stage Encounter Step 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the stage-level encounter workbook interface so stage opening values, enemy placement, opening statuses, affixes, and special rules are driven by new multi-sheet `.xlsx` tables while keeping the demo playable.

**Architecture:** Replace the old `关卡编队 / 关卡规则 / 敌人覆盖` parsing model with a stage encounter model centered on `关卡开场 / 敌人布置 / 开场状态 / 关卡词缀绑定 / 词缀定义 / 特殊规则绑定 / 特殊规则定义`. Keep enemy definitions in `enemy_data.xlsx`, keep display copy in `stage_content.xlsx`, and let `encounter_balance.xlsx` own only stage-runtime data. Runtime support in this step is intentionally minimal: affixes create delayed status applications, special rules only preserve `ruleLogicId` metadata and do not expand complex mechanics yet.

**Tech Stack:** TypeScript, React, Vite, XLSX

---

### Task 1: Define Stage Encounter Workbook Types

**Files:**
- Modify: `src/game/data/encounterTemplates.ts`

- [ ] **Step 1: Add stage encounter workbook interfaces**

Define types for:

```ts
export interface EncounterEnemyPlacementWorkbookRow {
  stageId: StageId
  spawnId: string
  enemyId: string
  row: number
  col: number
}

export interface EncounterAffixDefinition {
  affixId: string
  affixName: string
  iconId: string
  description: string
  delayMs: number
  targetType: 'enemy' | 'player' | 'party'
  targetSelector: string
  statusId: string
  durationMsOverride?: number
  stacks?: number
  enabled?: boolean
}
```

- [ ] **Step 2: Introduce stage-runtime override structure**

Create a `StageEncounterConfig`-style structure that can hold:

```ts
opening?: Partial<EncounterOpeningConfig>
enemyPlacements?: EncounterEnemyPlacement[]
openingStatuses?: EncounterOpeningStatusEntry[]
affixIds?: string[]
specialRuleIds?: string[]
```

- [ ] **Step 3: Keep legacy tuning in place**

Do not remove `EncounterTuning` or stage tuning generation in this step. The new workbook model should layer on top of current tuning behavior so demo difficulty stays stable.

### Task 2: Rebuild Encounter Template Creation Around Placements

**Files:**
- Modify: `src/game/data/encounterTemplates.ts`

- [ ] **Step 1: Replace area-based composition lookup with per-stage placements**

Introduce a new base placement record keyed by `stageId`, for example:

```ts
const BASE_STAGE_ENEMY_PLACEMENTS: Record<StageId, EncounterEnemyPlacement[]> = {
  'harbor-1': [
    { spawnId: 'harbor-1-e01', enemyId: 'harbor_raider', row: 1, col: 1 },
  ],
}
```

- [ ] **Step 2: Build `EnemySeed` from placement rows**

Use placement rows to create enemy seeds instead of `ENEMY_IDS_BY_AREA`. Preserve:
- name suffixing
- opening target
- opening threat state
- default hp generation

- [ ] **Step 3: Apply opening statuses after seed creation**

Create a helper that maps `开场状态` rows to player, party, or specific enemy by `spawnId`. Use status definitions from `enemy_data.xlsx` to resolve missing duration values.

- [ ] **Step 4: Add affix runtime metadata to stage encounter state**

Store parsed affix definitions and special rule definitions on the stage config returned by the encounter template layer. For this step, special rules only need metadata preservation; affixes must be executable later in the encounter tick path.

### Task 3: Parse New Workbook Sheets

**Files:**
- Modify: `src/game/data/workbookLoader.ts`

- [ ] **Step 1: Remove parsing reliance on old stage encounter sheets**

Stop reading:
- `区域倍率`
- `关卡编队`
- `关卡规则`
- `敌人覆盖`

- [ ] **Step 2: Parse new sheets**

Read these sheets instead:

```ts
const openingRows = readSheetRows<SheetRow>(workbook, '关卡开场')
const placementRows = readSheetRows<SheetRow>(workbook, '敌人布置')
const openingStatusRows = readSheetRows<SheetRow>(workbook, '开场状态')
const affixBindingRows = readSheetRows<SheetRow>(workbook, '关卡词缀绑定')
const affixDefinitionRows = readSheetRows<SheetRow>(workbook, '词缀定义')
const ruleBindingRows = readSheetRows<SheetRow>(workbook, '特殊规则绑定')
const ruleDefinitionRows = readSheetRows<SheetRow>(workbook, '特殊规则定义')
```

- [ ] **Step 3: Convert parsed rows into encounter override structures**

Build `EncounterWorkbookOverrides` so that each `stageId` accumulates:
- one opening object
- many placements
- many opening status rows
- affix id list
- special rule id list

- [ ] **Step 4: Preserve tolerant parsing**

Blank rows should be ignored. Unknown values should not crash workbook loading.

### Task 4: Implement Minimal Affix Runtime

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/encounter/encounterFactory.ts`

- [ ] **Step 1: Add encounter runtime support for pending affix triggers**

Create runtime items that include:

```ts
id: string
remainingMs: number
statusId: string
targetType: 'enemy' | 'player' | 'party'
targetSelector: string
durationMsOverride?: number
```

- [ ] **Step 2: Tick affix timers in `tickEncounter`**

When an affix reaches `0`, apply the configured status to the selected target and remove the pending trigger.

- [ ] **Step 3: Support simple selectors only**

Implement:
- `enemy/all`
- `enemy/frontRow`
- `enemy/backRow`
- `enemy/skullOnly`
- `enemy/randomOne`
- `player/player`
- `party/party`

- [ ] **Step 4: Keep special rules metadata-only**

Do not implement `ruleLogicId` behavior in this step. Preserve definitions for UI and later logic binding.

### Task 5: Regenerate Designer Workbooks

**Files:**
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Output: `public/designer-data/encounter_balance.xlsx`

- [ ] **Step 1: Replace old encounter workbook sheets with the new seven-sheet structure**

Generate:
- `关卡开场`
- `敌人布置`
- `开场状态`
- `关卡词缀绑定`
- `词缀定义`
- `特殊规则绑定`
- `特殊规则定义`

- [ ] **Step 2: Write three sample rows for each planner-facing sheet**

Sample rows must be Chinese and valid according to the new field names.

- [ ] **Step 3: Keep sample data executable**

Make sure the sample placements line up with real `enemyId`, `statusId`, and current stage ids so the runtime can read them immediately.

### Task 6: Update Documentation

**Files:**
- Modify: `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `README.md`
- Create or Modify: `STAGE_DATA_INTERFACE_SPEC.md`

- [ ] **Step 1: Document the new workbook sheets and field names**

List English column names, Chinese meaning, type, and whether each field is required.

- [ ] **Step 2: Document the simplified affix model**

Explain that affixes are delayed status applications, not arbitrary logic.

- [ ] **Step 3: Document the `ruleLogicId` contract**

State clearly that Excel only writes a controlled string id, and runtime logic remains in code.

### Task 7: Verification

**Files:**
- Modify: none

- [ ] **Step 1: Regenerate workbook outputs**

Run:

```powershell
npm run generate:designer-data
```

Expected: workbook generation completes successfully.

- [ ] **Step 2: Build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build succeed.

- [ ] **Step 3: Lint**

Run:

```powershell
npm run lint
```

Expected: ESLint exits cleanly.

- [ ] **Step 4: Reopen preview**

Run preview and verify:

```powershell
npm run preview -- --host 127.0.0.1 --port 4173
```

Expected: demo loads with the new workbook interface in effect.
