# Pre-Battle Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frozen pre-battle preparation phase for map and victory-continue entries while keeping failed retries immediate.

**Architecture:** `App.tsx` owns the entry source and passes it into `EncounterScreen`. `EncounterScreen` owns a UI-only `preparation | active` phase, freezes ticking and combat commands during preparation, applies build edits for live preview, and creates a clean initial state when battle starts. Existing encounter engine and automated evaluation APIs remain unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, React DOM test utilities, CSS.

---

## File Map

- Modify `src/app/App.tsx`: carry encounter entry source through map start, victory advance, and retry.
- Modify `src/app/saveGame.ts`: persist the one-time preparation tutorial completion flag with backward-compatible defaults.
- Modify `src/app/saveGame.test.ts`: cover old-save migration and tutorial reset persistence.
- Modify `src/ui/EncounterScreen.tsx`: phase state, preparation controls, frozen ticker, target preselection, build preview, clean start.
- Modify `src/ui/TutorialOverlay.tsx` or add a focused preparation script: reuse the in-encounter mask for preparation guidance.
- Modify `src/ui/encounterScreenKeyboard.ts`: block combat shortcuts while preparing but preserve panel closing.
- Modify `src/ui/EncounterScreen.test.ts`: component and keyboard regression coverage.
- Modify `src/styles/encounter.css`: compact filled preparation/navigation controls over the skill-bar region.
- Read-only `public/designer-data/player_build.xlsx`: no workbook generation or overwrite in this plan.

### Task 1: Entry Source Contract

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/ui/EncounterScreen.tsx`
- Test: `src/ui/EncounterScreen.test.ts`

- [ ] **Step 1: Write failing component tests for entry sources**

Render `EncounterScreen` with `entrySource="map"`, `entrySource="victory-continue"`, and `entrySource="retry"`. Assert map/victory show a preparation overlay and retry does not.

```tsx
expect(mapContainer.querySelector('.encounter-preparation-controls')).not.toBeNull()
expect(victoryContainer.querySelector('.encounter-preparation-controls')).not.toBeNull()
expect(retryContainer.querySelector('.encounter-preparation-controls')).toBeNull()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: FAIL because `entrySource` and preparation controls do not exist.

- [ ] **Step 3: Add the entry types and App routing**

Add in `EncounterScreen.tsx`:

```ts
export type EncounterEntrySource = 'map' | 'victory-continue' | 'retry'
```

Add `entrySource` to props and initialize:

```ts
const [phase, setPhase] = useState<'preparation' | 'active'>(
  entrySource === 'retry' ? 'active' : 'preparation',
)
```

In `App.tsx`, store the next source beside `encounterInstance`. Map `StageSelectScreen.onStartStage` to `map`, `handleAdvanceStage` to `victory-continue`, and `onRetryStage` to `retry`. Pass the stored source to `EncounterScreen`.

- [ ] **Step 4: Add the minimal preparation marker and verify GREEN**

Render `.encounter-preparation-controls` only for `phase === 'preparation'`, then rerun:

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: PASS for entry-source tests.

### Task 2: Freeze Preparation and Start Cleanly

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`
- Test: `src/ui/EncounterScreen.test.ts`

- [ ] **Step 1: Write failing timer and start tests**

Use fake timers. Assert time stays `0` during preparation, target preselection is allowed, and clicking `开战` starts time progression from a clean state.

```tsx
act(() => vi.advanceTimersByTime(500))
expect(readEncounterTime(container)).toBe('0.0s')

act(() => clickStartBattle(container))
act(() => vi.advanceTimersByTime(100))
expect(readEncounterTime(container)).toBe('0.1s')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: FAIL because preparation currently ticks and has no start transition.

- [ ] **Step 3: Gate ticker and active combat commands**

Mirror phase into a ref used by the interval callback. Return the current encounter unchanged unless phase is `active`. Block `tryActivateSkill` and pause opening while preparing. Keep enemy selection available.

```ts
if (phaseRef.current !== 'active' || tutorialVisibleRef.current) {
  return current
}
```

- [ ] **Step 4: Start from current persisted build**

On `开战`, call `createInitialEncounterState(stage, classId, currentBuildRef.current)`, preserving the currently preselected living target when it exists, then set phase to `active`. This discards preview-only runtime residue while keeping the player's chosen target.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: preparation stays frozen; start begins at `0.0s`; next tick advances normally.

### Task 3: One-Time Preparation Tutorial

**Files:**
- Modify: `src/app/saveGame.ts`
- Modify: `src/app/saveGame.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/tutorialGuide.ts`
- Test: `src/ui/EncounterScreen.test.ts`

- [ ] **Step 1: Write failing save migration tests**

Assert old saves without `seenPreparationTutorial` load it as `false`, saved completed tutorials persist `true`, and reset returns it to `false`.

- [ ] **Step 2: Run save tests and verify RED**

Run: `npm test -- src/app/saveGame.test.ts`

Expected: FAIL because the new flag does not exist.

- [ ] **Step 3: Add the backward-compatible tutorial flag**

Add `seenPreparationTutorial: boolean` to the tutorial save state, default missing values to `false`, pass it into `EncounterScreen`, and clear it in `resetTutorials`.

- [ ] **Step 4: Write failing tutorial sequence tests**

Assert first preparation entry shows the mask, keeps `开战` disabled, and does not show the existing combat tutorial. Complete the mask, assert `onPreparationTutorialComplete` fires once and `开战` enables. Click `开战`, then assert the stage combat tutorial appears.

- [ ] **Step 5: Run UI tests and verify RED**

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: FAIL because preparation tutorial gating does not exist.

- [ ] **Step 6: Implement the preparation tutorial script and gate**

Reuse the existing encounter tutorial mask component with a dedicated script that highlights enemy frames, active configuration, passive configuration, and start control. Do not show this script on retry. Delay the existing stage tutorial until phase becomes `active`.

- [ ] **Step 7: Verify GREEN**

Run: `npm test -- src/app/saveGame.test.ts src/ui/EncounterScreen.test.ts`

Expected: PASS.

### Task 4: Build Editing and Keyboard Boundaries

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/encounterScreenKeyboard.ts`
- Test: `src/ui/EncounterScreen.test.ts`

- [ ] **Step 1: Write failing build-access tests**

Assert skill/passive buttons are enabled during preparation, disabled in active combat, and enabled after result as before. Submit a passive change and assert the player preview updates while time remains `0.0s`.

- [ ] **Step 2: Write failing keyboard tests**

Add a `combatLocked` input to keyboard action resolution. Assert skill hotkeys, Tab target cycling, and Escape pause do nothing while preparing; Escape still closes an open config panel.

```ts
expect(getEncounterScreenKeyboardAction({ combatLocked: true, key: '1', ...base })).toEqual({ type: 'none' })
expect(getEncounterScreenKeyboardAction({ combatLocked: true, key: 'Escape', openPanel: 'skills', ...base }))
  .toEqual({ type: 'close-panel' })
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: FAIL because preparation is not part of build/keyboard lock rules.

- [ ] **Step 4: Implement preparation build access and preview**

Set:

```ts
const buildLocked = phase === 'active' && encounter.result === null
const combatLocked = phase === 'preparation' || Boolean(encounter.result)
```

Keep `commitBuild` calling `onBuildChange` and `applyBuildConfiguration`; use a ref for the latest submitted build so `开战` uses it even before parent rerender.

- [ ] **Step 5: Implement keyboard lock and verify GREEN**

Pass `combatLocked: phase === 'preparation' || tutorialVisible` into the keyboard helper and reject combat-only actions before target cycling, pause, or skill activation.

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: PASS.

### Task 5: Three-Button Overlay and Result Navigation

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/EncounterResultStatsPanel.tsx` if navigation callbacks are not currently exposed separately
- Modify: `src/styles/encounter.css`
- Test: `src/ui/EncounterScreen.test.ts`

- [ ] **Step 1: Write failing button-matrix tests**

For preparation, pause, victory, and defeat states, assert the controls expose `返回 / 开战 / 继续` with the approved enabled matrix. Assert victory `继续` calls `onAdvanceStage`; preparation `返回` calls stage-select; pause `继续` closes pause.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: FAIL because current overlay labels and result actions differ.

- [ ] **Step 3: Render a shared navigation control group**

Create a small local renderer in `EncounterScreen.tsx` using three native buttons. Keep the existing result statistics visible, but route navigation through the shared controls. Failed result keeps its existing `重新挑战` action and disables shared `继续`.

- [ ] **Step 4: Add compact filled styling**

Position `.encounter-noncombat-controls` absolutely above the existing skill bar, centered within its bounds. Use fixed button dimensions, opaque filled materials, clear disabled state, and a higher stacking layer. Do not move header, enemy frames, team/player panels, or the skill bar itself.

- [ ] **Step 5: Verify GREEN and UI constraints**

Run: `npm test -- src/ui/EncounterScreen.test.ts`

Expected: PASS; no control matrix regression.

### Task 6: Regression Verification

**Files:**
- Test: `src/ui/EncounterScreen.test.ts`
- Test: `src/app/saveGame.test.ts`

- [ ] **Step 1: Run focused UI and save tests**

Run: `npm test -- src/ui/EncounterScreen.test.ts src/app/saveGame.test.ts`

Expected: PASS.

- [ ] **Step 2: Run encounter engine regression tests**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts src/game/encounter/combatLog.test.ts src/game/encounter/combatTelemetry.integration.test.ts`

Expected: PASS, confirming UI phase changes did not alter engine behavior.

- [ ] **Step 3: Run static checks**

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Inspect repository safety boundary**

Run: `git status --short`

Expected: the user's existing `public/designer-data/player_build.xlsx` modification remains untouched; only the approved docs, source, style, and test files are added or modified.
