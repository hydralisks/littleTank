# Player Build Step 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a workbook-driven player build system covering active skills, passive talents, player-caused statuses, per-stage build rules, and build inheritance between stages.

**Architecture:** Add a dedicated player build catalog that mirrors the existing enemy and stage workbook override pattern. Keep current combat logic ids and runtime behavior for the existing eight skills, but move planner-editable values, build rules, defaults, and player status metadata into `player_build.xlsx`, then normalize persisted builds against each stage's `buildRuleId` before entering combat.

**Tech Stack:** TypeScript, React, Vite, XLSX

---

### Task 1: Add player build data model

**Files:**
- Create: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/encounter/encounterTypes.ts`

- [ ] Define workbook-facing types for build rules, active skills, passive talents, player status definitions, icon mappings, build presets, normalized build warnings, and persisted build state.
- [ ] Replace hard-coded skill/talent unions with string-backed ids so workbook data can drive the catalogs without editing type unions.
- [ ] Port the current eight active skills, current passive talents, default presets, and passive modifier logic into the new catalog as built-in defaults.
- [ ] Add normalization helpers that trim an inherited build to a target rule, preserve active skills first, insert forced picks, refund blocked picks, and emit human-readable conflict warnings.

### Task 2: Load and generate `player_build.xlsx`

**Files:**
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Modify: `src/game/data/workbookLoader.ts`

- [ ] Generate `public/designer-data/player_build.xlsx` with eight planner-facing sheets and at least three valid sample rows per editable sheet.
- [ ] Add parser support for the new workbook and hook it into `loadDesignerWorkbooks()`.
- [ ] Apply workbook overrides into `playerBuildCatalog.ts` using the same tolerant parsing approach as the other workbooks.
- [ ] Extend `encounter_balance.xlsx -> 关卡开场` parsing and runtime storage with `buildRuleId`.

### Task 3: Wire stage build rules and inheritance

**Files:**
- Modify: `src/game/data/encounterTemplates.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/ui/StageSelectScreen.tsx`

- [ ] Expose a stage-to-build-rule lookup from encounter data.
- [ ] Store the player's current persisted build in `App.tsx` instead of resetting it inside `EncounterScreen`.
- [ ] Normalize the persisted build whenever the player picks a stage or advances to a new stage, and surface any automatic adjustments as warning messages.
- [ ] Show the selected stage's build rule summary and inheritance/conflict warnings in the stage selection panel.

### Task 4: Use workbook-driven build data in combat UI

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/SkillConfigPanel.tsx`
- Modify: `src/ui/PassiveTalentPanel.tsx`
- Modify: `src/ui/SkillBar.tsx`
- Modify: `src/ui/iconMaps.ts`
- Modify: `src/ui/StatusBadge.tsx`

- [ ] Replace imports from the old hard-coded skill data with the new player build catalog.
- [ ] Keep the current combat behavior for the existing eight skills, but source cooldown/resource/description/icon/status metadata from workbook data.
- [ ] Show player-caused status icons and descriptions inside the skill config and passive talent panels.
- [ ] Switch skill/status icon lookup to a shared icon registry keyed by `iconId`, with a safe fallback.

### Task 5: Update stage status panel data sources

**Files:**
- Modify: `src/ui/StageStatusPanel.tsx`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/game/data/encounterTemplates.ts`
- Modify: `src/game/data/enemyCatalog.ts` (if helper exports are needed)

- [ ] Build the “本场状态” legend from actual non-player sources in the current stage: enemy-caused statuses, affix statuses, and special-rule-linked statuses.
- [ ] Keep player-caused statuses out of “本场状态”.
- [ ] Reuse the current section layout for 关卡词缀 / 特殊规则 / 图例, but back the legend with runtime data instead of static area copy.

### Task 6: Refresh docs and handoff

**Files:**
- Create or modify: `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- Modify: `DATA_CONFIG_SPEC.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `README.md`
- Modify: `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`

- [ ] Document all `player_build.xlsx` sheets, field names, and Chinese meanings.
- [ ] Document the `buildRuleId` field in `encounter_balance.xlsx`.
- [ ] Document the build inheritance and conflict normalization rules for future agents and planners.
- [ ] Update project-level handoff notes so another agent can continue from the new data-driven model.

### Task 7: Verification

**Files:**
- Run only

- [ ] Run `npm run generate:designer-data` and confirm the four workbooks are generated without errors.
- [ ] Run `npm run build` and confirm TypeScript and Vite build pass.
- [ ] Run `npm run lint` and confirm no lint errors remain.
- [ ] Re-open the preview if needed and confirm the stage select and encounter screens load with the new data source.
