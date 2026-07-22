# Stage Select Visibility And Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide challenge UI until challenges are open, render only open challenges, and keep the desktop/tablet three-row class grid inside the campaign map.

**Architecture:** `StageSelectScreen` will derive its displayed challenge entries by filtering the existing challenge catalog through `isChallengeStageOpen`, so progression policy remains the single source of truth. The existing `StageClassEntryControl` and responsive mapping remain unchanged; only the desktop/tablet campaign positioning moves from below the map edge to a 12px inset.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, JSDOM, CSS, Vite.

---

### Task 1: Gate Challenge Mode And Filter Locked Challenges

**Files:**
- Modify: `src/ui/StageSelectScreen.test.ts`
- Modify: `src/ui/StageSelectScreen.tsx`

- [ ] **Step 1: Add failing visibility tests**

Add a test that renders with `highestClearedStageIndex: 4` and `defaultMode: 'challenge'`, then asserts only one mode button exists, its text is `主线战役`, `.stage-map` exists, and `.challenge-board` does not exist.

Extend the existing challenge-mode test fixture to register `Challenge-1` through `Challenge-4` while keeping `highestClearedStageIndex: 5`. After clicking the challenge button, assert exactly three cards render and no card contains the fourth challenge title.

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```powershell
npm test -- src/ui/StageSelectScreen.test.ts
```

Expected: FAIL because the challenge button is always rendered and `buildChallengeModeEntries()` currently includes locked challenges.

- [ ] **Step 3: Filter challenges through the progression policy**

In `StageSelectScreen`, derive entries before initializing mode state:

```ts
const challengeModeEntries = buildChallengeModeEntries().filter((entry) =>
  isChallengeStageOpen(entry.stageId, highestClearedStageIndex)
)
const hasUnlockedChallenges = challengeModeEntries.length > 0
const [stageSelectMode, setStageSelectMode] = useState<StageSelectMode>(
  defaultMode === 'challenge' && hasUnlockedChallenges ? 'challenge' : 'campaign',
)
```

Render the challenge mode button only when `hasUnlockedChallenges` is true. Keep the campaign button visible. Because every rendered challenge is now open, remove the locked card class, disabled flag, and click guard; keep the entry control guard as defense in depth.

- [ ] **Step 4: Run the focused tests and verify green**

Run:

```powershell
npm test -- src/ui/StageSelectScreen.test.ts
```

Expected: PASS; pre-unlock renders campaign only and the first milestone renders only Challenge-1 through Challenge-3.

### Task 2: Move Desktop And Tablet Campaign Entry Inside The Map

**Files:**
- Modify: `src/ui/stageSelectResponsiveCss.test.ts`
- Modify: `src/styles/encounter.css`

- [ ] **Step 1: Change the CSS contract test to the approved inset**

Replace the base campaign-entry assertion with:

```ts
expect(css).toMatch(
  /\.stage-map-column\s*>\s*\.stage-class-entry\s*{[^}]*bottom:\s*12px;/,
)
```

Retain the existing `@media (max-width: 680px)` assertion for `bottom: -266px`, so this increment does not redefine mobile behavior.

- [ ] **Step 2: Run the CSS test and verify red**

Run:

```powershell
npm test -- src/ui/stageSelectResponsiveCss.test.ts
```

Expected: FAIL because the desktop/tablet rule still uses `bottom: -36px`.

- [ ] **Step 3: Apply the 12px desktop/tablet inset**

Change only the base rule:

```css
.stage-map-column > .stage-class-entry {
  bottom: 12px;
}
```

Keep the mobile override at `bottom: -266px` and preserve all CTA, grid, slot, icon, and flow dimensions.

- [ ] **Step 4: Run UI tests and build**

Run:

```powershell
npm test -- src/ui/stageSelectResponsiveCss.test.ts src/ui/StageSelectScreen.test.ts src/ui/StageClassEntryControl.test.tsx
npm run build
```

Expected: PASS.

### Task 3: Verify, Document, Commit, And Reopen The Demo

**Files:**
- Modify: `开发更新日志.md`
- Verify only: `public/designer-data/`

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run validate:designer-data
npm run lint
npm run build
```

Expected: all commands exit 0; designer validation reports 0 errors and 0 warnings.

- [ ] **Step 2: Perform desktop geometry inspection**

At a 1440×900 viewport, confirm the challenge button is absent before `RingingDeeps-6`, the class entry grid bottom is at least 12px above the map bottom, and the CTA/grid fixed dimensions remain unchanged. After using a save with the first milestone cleared, confirm the challenge button appears and only Challenge-1 through Challenge-3 render.

- [ ] **Step 3: Update the development changelog**

Record the challenge visibility rule, desktop/tablet 12px map inset, mobile non-goal, tests, and explicit statement that no designer workbook or public generator was touched.

- [ ] **Step 4: Review boundaries and commit**

Run:

```powershell
git diff --check
git diff --stat -- public
git status --short
```

Expected: no whitespace errors and no `public/` changes.

Commit:

```powershell
git add src/ui/StageSelectScreen.tsx src/ui/StageSelectScreen.test.ts src/ui/stageSelectResponsiveCss.test.ts src/styles/encounter.css 开发更新日志.md
git commit -m "fix: gate challenge selection by campaign progress"
```

- [ ] **Step 5: Reopen the current branch demo**

Keep or restart Vite on an unused localhost port and open the URL in the system browser for user inspection. Do not merge or push before explicit approval.
