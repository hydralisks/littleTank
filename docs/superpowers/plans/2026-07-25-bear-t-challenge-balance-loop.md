# Bear T Challenge Balance Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `druid_bear_t` playable and automatically evaluable across the cumulative Challenge 1-9 snapshots, then verify the Challenge 1-3 unlock loop and establish a balanced baseline.

**Architecture:** Add a class-specific decision handler behind the existing runtime `aiStrategyId`, while reusing generic target and cast-reaction systems. Maintain challenge snapshot data through a focused, idempotent workbook sync script that preserves workbook layout and existing warrior IDs. Use real-workbook contract tests and quick balance reports before changing any combat values.

**Tech Stack:** TypeScript, Vitest, XLSX, existing balance simulator and designer-data validator.

---

### Task 1: Bear Automated Strategy

**Files:**
- Modify: `src/game/balance/balanceSimulator.ts`
- Modify: `src/game/balance/balanceSimulator.test.ts`

- [x] Add a failing scenario test proving `druid_bear_t_default` is registered and activates bear-owned skills.
- [x] Add a failing low-health/high-rage trace test proving Ironfur is preferred before offensive spenders.
- [x] Implement bear targeting, lost-threat recovery, defensive spend, rage generation and filler priorities while retaining the generic cast-reaction pipeline.
- [x] Run the focused simulator tests and confirm green.

### Task 2: Cumulative Challenge Snapshots

**Files:**
- Create: `scripts/syncBearTChallengeSnapshots.mjs`
- Create: `src/game/playerClasses/bearTChallengeIntegration.test.ts`
- Modify: `public/designer-data/challenge_stage_content.xlsx`

- [x] Add failing real-workbook tests for Challenge 1-3 RD-6/5-skill snapshots, Challenge 4-6 WF-6/10-skill snapshots and Challenge 7-9 ZA-6/16-skill snapshots.
- [x] Assert all Challenge 1-9 rows allow `warrior_t,druid_bear_t` and contain no warrior-only recommendations.
- [x] Implement and run the idempotent workbook sync script without invoking public generators.
- [x] Read the workbook back and rerun contract tests.

### Task 3: Unlock and UI Flow

**Files:**
- Modify: `src/ui/StageSelectScreen.test.ts`
- Modify: `src/game/progression/classProgression.test.ts` only if a real-workbook boundary is missing

- [x] Add a real-workbook availability test: Bear is trial-available in Challenge 1-3 after RD-6, unavailable early, and becomes campaign-eligible only after Bear victories in all three stages.
- [x] Verify Bear remains cumulatively selectable in Challenge 4-9 after permanent unlock.
- [x] Run progression and stage-select tests.

### Task 4: Automated Evaluation and Balance Baseline

**Files:**
- Generated reports only under existing `reports/` paths
- Modify: `public/designer-data/player_build.xlsx` only if report evidence crosses approved class-comparison thresholds

- [x] Run quick Challenge 1-3 analysis for both classes.
- [x] Inspect pass-rate difference, difficulty gap, tank damage, party pressure, interrupt handling and Bear rage throughput.
- [x] If Bear is outside the approved comparison thresholds, change the smallest relevant Bear values in `player_build.xlsx`, rerun validation and repeat the quick report.
- [x] Adjust challenge encounter data only after trace evidence identifies an RD-6 toolkit mismatch, then rerun both classes on the same stage.

### Task 5: Cumulative Regression and Handoff

**Files:**
- Modify: `docs/player-tank-class-expansion-handoff.md`
- Modify: project development changelog if present

- [x] Run a quick smoke analysis for Challenge 4-9 to prove the 10/16-skill snapshots construct legal Bear builds.
- [x] Run `npm run validate:designer-data`, `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
- [x] Document the implemented Bear challenge boundary, measured baseline and any remaining manual playtest risks.
- [x] Commit the Bear challenge-loop batch separately; do not push without an explicit request.
