# Challenge Affixes 4-6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Challenge-4 through Challenge-6 with simpler, readable challenge-specific affixes and tune them with challenge auto scoring.

**Architecture:** Challenge affixes remain data-driven through `challenge_stage_content.xlsx` and `challenge_encounter_balance.xlsx`. New mechanics are implemented as reusable status effect logic in encounter runtime, while display text and bindings live only in challenge workbooks.

**Tech Stack:** TypeScript, Vitest, XLSX designer data, existing encounter/status runtime.

---

### Task 1: Add Runtime Coverage Tests

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`

- [ ] Add tests proving new affixes can:
  - increase magic damage without haste,
  - apply initial party threat to selected enemies,
  - grant periodic absorbs to selected enemies,
  - periodically reinforce elite enemies,
  - stack a damage-taken debuff on player or party after back-row/fish damage.

- [ ] Run: `npm run test -- src/game/encounter/encounterFactory.test.ts`

### Task 2: Implement Minimal Runtime Mechanics

**Files:**
- Modify: `src/game/data/enemyCatalog.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/stageRuleLogicRegistry.ts` if periodic behavior is better as rule logic
- Modify: `src/ui/iconMaps.ts`

- [ ] Add status definitions and effect logic IDs for the five simplified effects.
- [ ] Route damage, threat, absorb, periodic elite reinforcement, and stacking vulnerability through existing event/status systems.
- [ ] Re-run focused encounter tests.

### Task 3: Update Challenge Workbooks

**Files:**
- Modify binary: `public/designer-data/challenge_stage_content.xlsx`
- Modify binary: `public/designer-data/challenge_encounter_balance.xlsx`

- [ ] Add two affix definitions for each of Challenge-4, Challenge-5, and Challenge-6.
- [ ] Replace old Challenge-4/5/6 affix bindings.
- [ ] Fill `affix1*` and `affix2*` display columns in `challenge_stage_content.xlsx`.
- [ ] Keep non-challenge workbooks unchanged.

### Task 4: Verify and Tune

**Commands:**
- `npm run test -- src/game/encounter/encounterFactory.test.ts`
- `npm run build`
- `npm run analyze:balance -- --challenge --quick --stages=Challenge-4,Challenge-5,Challenge-6`

- [ ] Tune values in challenge workbooks only until Challenge-4/5 trend hard and Challenge-6 trends expert or near expert.
