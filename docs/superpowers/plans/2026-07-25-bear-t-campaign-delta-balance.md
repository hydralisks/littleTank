# Bear T Campaign Delta Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Bear T campaign unlock snapshots, extend delta analysis to active skills and challenge data, generate chapter-wide reports, tune evidence-backed Bear outliers, and open a verified demo.

**Architecture:** Keep campaign unlock data in `stage_content.xlsx`, load campaign and challenge workbooks into a unified analysis catalog, and add active-skill presence comparisons beside existing passive variants. Use scope-specific report names so long analyses never overwrite one another.

**Tech Stack:** TypeScript, Vitest, Node.js, XLSX, existing balance simulator/reporting pipeline, Vite.

---

### Task 1: Campaign Bear Unlock Contract

**Files:**
- Modify: `src/game/playerClasses/bearTChallengeIntegration.test.ts`
- Create: `scripts/syncBearTCampaignSnapshots.mjs`
- Modify in place: `public/designer-data/stage_content.xlsx`

- [ ] Add failing real-workbook assertions for Bear unlock counts `7/9/10` in WestFall and `11/12/13/16` in Zul'Aman.
- [ ] Run the focused test and confirm it fails because campaign rows contain only Warrior IDs.
- [ ] Add an idempotent stable-ID sync that appends Bear IDs to the approved stage rows without rebuilding sheets or reordering rows.
- [ ] Run the sync, reread the workbook, and confirm the focused contract passes.

### Task 2: Delta CLI Data And Output Isolation

**Files:**
- Modify: `scripts/analyzeDelta.mjs`
- Modify: `src/game/balance/analyzeDeltaTemplate.test.ts`

- [ ] Add failing tests requiring challenge workbook loading, `--type=active`, `--output=<slug>`, and expert classification for the low-error learning profile.
- [ ] Run the template test and verify the missing CLI/data-loading behavior fails.
- [ ] Load `challenge_stage_content.xlsx` and `challenge_encounter_balance.xlsx` after campaign workbooks, add the CLI options, and reject unsafe output slugs.
- [ ] Write reports to `delta-<class>-<slug>-<type>.md/json` and rerun the template test.

### Task 3: Active Skill Presence Delta

**Files:**
- Modify: `src/game/balance/deltaAnalysis.ts`
- Modify: `src/game/balance/deltaAnalysis.test.ts`
- Modify: `src/game/balance/deltaReport.ts`
- Modify: `src/game/balance/deltaReport.test.ts`

- [ ] Add failing tests for active presence variants using the best legal containing and excluding builds while retaining both loadouts.
- [ ] Run the focused tests and verify `active` is currently unsupported.
- [ ] Add `active` to `DeltaAnalysisType`, generate a bounded common candidate pool, run it once, and create per-skill presence comparisons.
- [ ] Extend JSON/Markdown models with compared baseline/variant loadouts and active-skill labels.
- [ ] Rerun focused delta tests and keep passive report behavior unchanged.

### Task 4: Bear Passive Discovery

**Files:**
- Modify: `src/game/balance/deltaAnalysis.ts`
- Modify: `src/game/balance/deltaAnalysis.test.ts`

- [ ] Add a failing Bear-stage test showing default passive analysis discovers legal `druid_bear_t` talents instead of Warrior fallback IDs.
- [ ] Replace the fixed Warrior fallback with ordered enabled talents filtered by requested class, rule, and tier.
- [ ] Rerun the focused test and verify single/pair variants respect point limits and tier unlocks.

### Task 5: Baseline And Standard Reports

**Files:**
- Generated: `reports/balance/` scope-specific Markdown/JSON files

- [ ] Run quick Warrior/Bear baselines for all WestFall stages and record class comparison flags.
- [ ] Run quick Warrior/Bear baselines for all Zul'Aman stages and record class comparison flags.
- [ ] Run standard active delta at the approved unlock milestones for Challenge 1-3, WestFall, and Zul'Aman.
- [ ] Run standard passive delta at `Challenge-1`, `WestFall-1/6`, and `Zul'Aman-1/6`.
- [ ] Promote only tuning-trigger findings to full samples and record saturation exceptions without tuning from them.

### Task 6: Evidence-Backed Tuning Loop

**Files:**
- Modify in place: `public/designer-data/player_build.xlsx` only for approved Bear rows
- Create or modify: a focused stable-ID Bear tuning script only if changes are required
- Modify: Bear runtime tests only when a behavior scalar changes

- [ ] Classify findings against the design thresholds and trace any candidate before changing data.
- [ ] Write a failing contract/behavior test for each accepted numerical change.
- [ ] Apply the smallest Bear-owned scalar change and verify the focused test passes.
- [ ] Rerun affected standard delta, affected chapter quick baseline, and Challenge 1-3 quick regression.
- [ ] Stop when remaining findings are low-confidence, saturated, or documented mechanics tradeoffs.

### Task 7: Verification, Documentation, And Demo

**Files:**
- Modify: `docs/player-tank-class-expansion-handoff.md`
- Modify: `开发更新日志.md`
- Modify: this plan

- [ ] Run `npm test`, `npm run validate:designer-data`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Compare workbook rows by stable ID and confirm no unrelated planner content changed.
- [ ] Record chapter parity, skill/talent findings, accepted tuning, and remaining manual risks.
- [ ] Start Vite on an available localhost port and provide the URL for manual playtesting.
- [ ] Do not commit the implementation or push unless the user explicitly requests it.

