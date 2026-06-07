# Manual Skill Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove automatic demo casting and make the sample player skills manually playable in the encounter UI.

**Architecture:** Keep the current instant-cast combat model, but route all keyboard and mouse skill activation through a single validation path that returns human-readable failure reasons. Preserve the existing eight sample skill behaviors, make them available at combat start, and surface interaction feedback in the live encounter UI instead of auto-playing skills for the user.

**Tech Stack:** TypeScript, React, Vite

---

### Task 1: Manual activation path

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/SkillBar.tsx`

- [x] Add a shared skill activation validation helper that reports why a skill cannot be used yet.
- [x] Route both hotkey presses and skill bar clicks through that helper.
- [x] Remove the current automatic demo skill release queue and timeout logic.

### Task 2: Improve sample skill usability

**Files:**
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`

- [x] Make the current sample active skills available from combat start instead of spawning on long initial cooldowns.
- [x] Keep cooldowns, costs, and logic ids intact after the initial-use adjustment.

### Task 3: Feedback and verification

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`

- [x] Surface the most recent failed activation reason in the encounter warning area.
- [x] Keep target switching and manual activation controls readable in the header or live warning text.
- [x] Verify with `npm run build` and `npm run lint`.
