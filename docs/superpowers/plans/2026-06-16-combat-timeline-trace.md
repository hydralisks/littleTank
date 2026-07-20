# Combat Timeline Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact internal combat event timeline report for balance review and bug localization.

**Architecture:** Build a pure timeline formatter over existing `CombatLogEvent[]`; keep player UI unchanged. `analyzeBalance.mjs` gains an opt-in `--trace` flag that writes concise Markdown and JSON trace files for the analyzed scenarios.

**Tech Stack:** TypeScript, Vitest, Node ESM scripts, existing combat log and balance analyzer.

**Combat log typing note:** `CombatLogActor.kind` identifies the acting subject, such as `player`, `enemy`, `partyAutoAttack`, or `partyAutoHeal`. Skill or effect categories belong on `CombatLogAbility.kind`, such as `playerSkill`, `enemySkill`, `autoAttack`, `autoHeal`, `status`, `affix`, `stageRule`, or `talent`. Do not use `playerSkill` as an actor kind; doing so breaks `tsc -b` and blurs attribution in combat statistics.

---

### Task 1: Timeline Pure Functions

**Files:**
- Create: `src/game/encounter/combatTimeline.ts`
- Create: `src/game/encounter/combatTimeline.test.ts`

- [ ] Write a failing test for transforming mixed `CombatLogEvent[]` into compact timeline entries sorted by `occurredAtMs`.
- [ ] Implement `buildCombatTimeline(events, options)` with a default limit and compact labels.
- [ ] Write a failing test for `renderCombatTimelineMarkdown`.
- [ ] Implement Markdown rendering with summary counts and a short event table.
- [ ] Run `npm run test -- src/game/encounter/combatTimeline.test.ts`.

### Task 2: Balance Analyzer Trace Output

**Files:**
- Modify: `scripts/analyzeBalance.mjs`
- Create: `src/game/balance/analyzeBalanceTraceTemplate.test.ts`

- [ ] Write a template test requiring `--trace`, `reports/balance/traces`, and `renderCombatTimelineMarkdown`.
- [ ] Add `trace` to CLI options.
- [ ] During `buildReport`, retain a compact trace sample from the first final fixed-AI scenario and first final learning-AI scenario that has combat logs.
- [ ] Write `<stageId>-latest-timeline.json` and `<stageId>-latest-timeline.md` when `--trace` is enabled.
- [ ] Run the template test and one quick trace command.

### Task 3: Verification

**Files:**
- No additional files.

- [ ] Run focused tests for timeline and analyzer trace template.
- [ ] Run `npm run analyze:balance -- --stage=WestFall-1 --quick --trace`.
- [ ] Confirm trace files exist under `reports/balance/traces`.
