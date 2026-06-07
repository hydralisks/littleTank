# WestFall Latest Data And Static Scoring V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a latest-data build with the corrected WestFall healing value and a more general static balance score, then produce fresh first- and second-chapter samples.

**Architecture:** Keep designer workbooks read-only and repair the missing runtime mapping for the approved heal value in the existing enemy status handler. Refine `staticStageScoring` by separating raw hostile pressure, enemy support risk, and player tool mitigation while retaining the existing report pipeline and label thresholds for comparable samples.

**Tech Stack:** TypeScript, Vitest, XLSX workbook loaders, Node balance scripts, Vite, Tauri.

---

### Task 1: Correct WestFall Murloc Healing Runtime Value

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`
- Modify: `src/game/encounter/enemyStatusEffectRegistry.ts`

- [ ] **Step 1: Write a failing test**

Add a focused WestFall encounter assertion that loads the current designer
workbooks, resolves `murloc_healing`, and verifies an injured enemy receives
exactly 75 HP from that status rather than 100 HP.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected before implementation: the new assertion fails because the runtime
handler restores 100 HP.

- [ ] **Step 3: Implement the minimal runtime correction**

Change only the `murlocHealing_status` on-apply healing amount from `100` to
`75`; do not modify or regenerate the designer workbooks.

- [ ] **Step 4: Run the targeted test and encounter suite**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS.

### Task 2: Add Static Scoring V2 Support Accounting

**Files:**
- Modify: `src/game/balance/staticStageScoring.test.ts`
- Modify: `src/game/balance/staticStageScoring.ts`

- [ ] **Step 1: Write failing tests**

Add assertions that the score exposes V2 component metrics and that an
encounter containing interruptible `mostInjured` healing increases enemy
support risk while its realized contribution is discounted below guaranteed
full-value healing.

- [ ] **Step 2: Run the static score tests to verify failure**

Run: `npm test -- src/game/balance/staticStageScoring.test.ts`

Expected before implementation: FAIL because V2 component metrics and enemy
support accounting are absent.

- [ ] **Step 3: Implement V2 metrics**

Add `rawThreatScore`, `enemySupportRisk`, and `adjustedThreatScore` to the
static metrics. Identify enemy-support casts through healing or beneficial
target/self status effect definitions, apply cast-cycle and break-rule factors,
and discount `mostInjured` heal realization to represent cast overlap/overheal.
Include support risk in the adjusted score and render component explanations.

- [ ] **Step 4: Verify focused and full test suites**

Run: `npm test -- src/game/balance/staticStageScoring.test.ts`

Run: `npm test`

Expected: PASS with zero failed tests.

### Task 3: Update Documentation And Generated Reports

**Files:**
- Modify: `docs/balance/difficulty-scoring-system.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `开发更新日志.md`
- Generate: `reports/balance/chapter-one-auto-scoring.md`
- Generate: `reports/balance/westfall-auto-scoring.md`
- Modify: `第一章自动评分.md`
- Modify: `第二章自动评分.md`

- [ ] **Step 1: Document V2 score interpretation and the temporary healing-value mapping**

Record the metric split, the reason for discounted support healing, the
read-only workbook constraint, and the recommended future structured status
parameter field.

- [ ] **Step 2: Generate fresh samples**

Run: `npm run analyze:balance -- --sample=quick`

Run: `npm run analyze:balance -- --area=WestFall --sample=quick`

Expected: fresh chapter-one and WestFall report files under `reports/balance/`.
Copy their Markdown results into `第一章自动评分.md` and `第二章自动评分.md`
using UTF-8 encoding.

### Task 4: Build And Archive The Latest Installable Release

**Files:**
- Generate: `dist/`
- Generate: `src-tauri/resources/desktop-data/`
- Generate: `src-tauri/src/generated_data_pack.rs`
- Generate: `src-tauri/target/release/bundle/nsis/Little Tank_0.0.0_x64-setup.exe`
- Generate: `release/littleTank-demo-<timestamp>-x64-setup.exe`

- [ ] **Step 1: Verify and build**

Run: `npm test`

Run: `npm run build`

Run: `npm run test:desktop-data`

Run: `npm run desktop:build`

Expected: all commands exit successfully and Tauri produces the NSIS installer.

- [ ] **Step 2: Archive release outputs**

Copy the new installer to a timestamped `release/` filename. If the existing
standalone HTML release process is still supported by the current scripts,
create the matching timestamped web release folder and ZIP without writing
under `public/designer-data/`.

### Task 5: Final Verification

**Files:**
- Review: all files and generated artifacts above

- [ ] **Step 1: Re-run evidence commands**

Run: `npm test`

Run: `npm run build`

Run: `npm run test:desktop-data`

Confirm both fresh report files and the new timestamped installer exist.

- [ ] **Step 2: Report outputs for manual playtesting**

Provide the new installer path, chapter report paths, test/build evidence, and
explain that manual second-chapter testing should compare against the V2 static
score components and simulation results.
