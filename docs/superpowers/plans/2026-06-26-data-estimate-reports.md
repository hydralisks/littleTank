# Data Estimate Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `/reports/data_estimate/` markdown and JSON reports alongside balance reports for the same requested stage range.

**Architecture:** Reuse balance simulation attempts to collect compact per-scenario numeric samples instead of retaining full combat logs. Aggregate those samples into stage-level and build/profile-level estimates, then write story reports by chapter and challenge reports by groups of three stages.

**Tech Stack:** TypeScript, Vitest, Node report script, existing combat stats and balance simulator.

---

### Task 1: Scenario Estimate Samples

**Files:**
- Modify: `src/game/balance/balanceSimulator.ts`
- Test: `src/game/balance/balanceSimulator.test.ts`

- [ ] Add a compact `dataEstimate` field to traceable scenario results.
- [ ] Collect per-attempt duration, resource gain, tank damage taken, healing/absorb received, player-side damage dealt, and party pressure from `buildEncounterStats(state)` and resource delta.
- [ ] Average those values per second per scenario.

### Task 2: Data Estimate Renderer

**Files:**
- Create: `src/game/balance/dataEstimateReport.ts`
- Test: `src/game/balance/dataEstimateReport.test.ts`

- [ ] Render markdown with a summary table per stage.
- [ ] Include build/profile rows for fixed AI and learning AI final scenarios.
- [ ] Include JSON payload with generatedAt, stages, and scenario rows.

### Task 3: Analyze Script Integration

**Files:**
- Modify: `scripts/analyzeBalance.mjs`
- Test: `src/game/balance/analyzeDataEstimateTemplate.test.ts`

- [ ] Create `reports/data_estimate/story` and `reports/data_estimate/challenge`.
- [ ] Write story reports using the same slug names as balance reports.
- [ ] Write challenge reports in groups of three stages.
- [ ] Keep balance report output unchanged.

### Task 4: Verification

**Commands:**
- `npm run test -- src/game/balance/dataEstimateReport.test.ts src/game/balance/analyzeDataEstimateTemplate.test.ts src/game/balance/balanceSimulator.test.ts`
- `npm run build`
- `npm run analyze:balance -- --quick --stage=RingingDeeps-1`
- `npm run analyze:balance -- --challenge --quick --stages=Challenge-1`
