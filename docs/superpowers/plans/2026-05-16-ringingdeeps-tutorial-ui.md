# RingingDeeps Tutorial UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-pass tutorial overlay for RingingDeeps stages 1-4 that pauses combat, highlights the exact UI control being taught, and walks the player through target selection, skill builds, interrupts, control, and passive builds.

**Architecture:** Keep the tutorial as a small, data-driven UI layer. A pure tutorial script module chooses stage-specific steps, the encounter screen owns pause/progression state, and a dedicated overlay component measures the highlighted element and draws the gray mask plus spotlight/arrow. Existing combat and build panels stay intact; only a few stable data attributes and selectors are added to expose the target UI surface.

**Tech Stack:** React 19, TypeScript, existing Vite/Vitest test setup, current encounter CSS.

---

### Task 1: Add tutorial script data and selector helpers

**Files:**
- Create: `src/ui/tutorialGuide.ts`
- Test: `src/ui/tutorialGuide.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { getEncounterTutorialScript } from './tutorialGuide'

it('returns no tutorial for non-RingingDeeps stages', () => {
  expect(
    getEncounterTutorialScript({
      id: 'harbor-1',
      areaId: 'harbor',
      areaTitle: 'Harbor',
      stageNumber: 1,
    } as never),
  ).toBeNull()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/ui/tutorialGuide.test.ts -v`
Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function getEncounterTutorialScript(stage) {
  if (stage.areaId !== 'RingingDeeps' || stage.stageNumber > 4) {
    return null
  }
  return []
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- src/ui/tutorialGuide.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/tutorialGuide.ts src/ui/tutorialGuide.test.ts docs/superpowers/plans/2026-05-16-ringingdeeps-tutorial-ui.md
git commit -m "feat: add ringingdeeps tutorial script"
```

### Task 2: Add the tutorial overlay component

**Files:**
- Create: `src/ui/TutorialOverlay.tsx`
- Test: `src/ui/TutorialOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders a spotlight, message, next button, and skip button for the current target', () => {
  // render a dummy target element in jsdom and verify the overlay shows a focus hole
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/ui/TutorialOverlay.test.tsx -v`
Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```tsx
export function TutorialOverlay(props) {
  if (!props.step) return null
  return <div className="tutorial-overlay" />
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- src/ui/TutorialOverlay.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/TutorialOverlay.tsx src/ui/TutorialOverlay.test.tsx
git commit -m "feat: add tutorial overlay"
```

### Task 3: Wire tutorial state into encounter flow

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/encounterScreenKeyboard.ts`
- Modify: `src/ui/EnemyRaidFrameItem.tsx`
- Modify: `src/ui/SkillBar.tsx`
- Modify: `src/ui/SkillConfigPanel.tsx`
- Modify: `src/ui/PassiveTalentPanel.tsx`
- Modify: `src/ui/StageStatusPanel.tsx`
- Modify: `src/styles/encounter.css`

- [ ] **Step 1: Write the failing test**

```ts
it('pauses encounter ticks and keyboard actions while a tutorial step is visible', () => {
  // mount EncounterScreen with a RingingDeeps stage and confirm time does not advance
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/ui/EncounterScreen.test.ts -v`
Expected: FAIL because tutorial state is not wired yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
const tutorialVisible = Boolean(tutorialStep)
if (tutorialVisible) {
  return current
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- src/ui/EncounterScreen.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/EncounterScreen.tsx src/ui/encounterScreenKeyboard.ts src/ui/EnemyRaidFrameItem.tsx src/ui/SkillBar.tsx src/ui/SkillConfigPanel.tsx src/ui/PassiveTalentPanel.tsx src/ui/StageStatusPanel.tsx src/styles/encounter.css
git commit -m "feat: wire tutorial into encounter ui"
```

### Task 4: Verify whole-project health

**Files:**
- None

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run designer data validation**

Run: `npm run validate:designer-data`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add ringingdeeps tutorial ui"
```
