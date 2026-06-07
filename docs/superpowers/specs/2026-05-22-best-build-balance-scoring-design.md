# Best-Build Balance Scoring Design

## Goal

Upgrade the current read-only balance tool so RingingDeeps difficulty is evaluated against the strongest legal build the player can reasonably discover for each stage, instead of treating a default or weak build as representative.

## Confirmed Principle

For RingingDeeps, build choice space is small enough that difficulty should approximate:

> "A tutorial-stage player eventually finds the best available build for the stage."

Therefore, pass-rate scoring should use the best-performing legal build per operation profile/tier. Weak legal builds remain useful for diagnostics, but they must not drag down the difficulty label.

The existing classifier already uses best pass rate per profile tier. The missing work is to generate meaningful legal build variants and expose the winning build in reports.

## Scope

### In Scope

- Generate legal active/passive build candidates for a stage from current catalog data.
- Keep `default` build as a named candidate.
- Add a small set of deterministic best-build search controls:
  - maximum generated active build count
  - maximum passive variants
  - stable build IDs
- Run balance scenarios across generated build candidates.
- Report which build won for each profile tier.
- Report tested build count and a concise loadout/talent summary for best builds.
- Add optional action/failure trace output for calibration.
- Keep all scoring read-only; do not write under `public/designer-data`.

### Out Of Scope

- Changing planner workbook values.
- Optimizing build search for large late-game build spaces.
- Using player remaining HP, party remaining HP, party pressure, or similar indirect state values for difficulty labels.
- UI screens for the balance tool.
- Machine-learning or stochastic optimizer approaches.

## Architecture

### 1. Build Candidate Generator

Create `src/game/balance/balanceBuildGenerator.ts`.

Responsibilities:

- Accept a `StageInfo` and optional previous/default build.
- Resolve:
  - `buildRuleId`
  - unlocked active skills for the stage
  - unlocked passive talent tier
  - total build points
  - enabled hotkeys
- Produce legal `BalanceBuildVariant[]`.
- Include `default` first.
- Generate stable IDs such as:
  - `default`
  - `active-taunt-interrupt-stun-shield_wall`
  - `passive-reinforced_plates`
- Deduplicate variants by normalized loadout/passive signature.

For RingingDeeps, the generator may use exhaustive combinations because active skill count and slot count are small. To avoid future blowups, it should accept caps and sort candidates by a deterministic heuristic before truncating.

### 2. Best-Build Analysis Summary

Extend balance analysis with a summary layer:

```ts
interface BestBuildProfileSummary {
  profileTier: BalanceProfileTier
  profileId: string
  bestBuildId: string
  passRate: number
  victories: number
  attempts: number
  loadout: SkillLoadout
  passiveTalentIds: string[]
}
```

`StageBalanceAnalysis` should still include all scenario rows for diagnostics, but reports should make the best builds prominent.

Difficulty label calculation continues to use pass rates only. The input rows should be the best scenario for each relevant profile/tier, or equivalently all rows if the classifier keeps its current "best per tier" behavior. The report must make that behavior explicit.

### 3. Report Changes

Update `src/game/balance/balanceReport.ts` and `scripts/analyzeBalance.mjs`.

Add to each stage report:

- `testedBuildCount`
- `bestBuildsByProfile`
- `bestBuildsByTier`
- `scoringMode: "best_build_per_profile"`

Markdown report should show:

- manual baseline
- automated label
- tested build count
- best build per profile/tier
- all scenarios table retained below the summary

### 4. Action Trace For Calibration

Extend simulator options with an optional trace flag.

Trace output should record only debugging events, for example:

- selected target
- activated skill
- interrupted or controlled cast
- skipped decision due to mistake roll
- final result reason

Trace must not feed difficulty scoring. It is a calibration aid to explain mismatches such as `RingingDeeps-5` manual `balanced` versus automated `impossible`.

The first implementation can store only one representative failed attempt trace per stage/profile/build to keep report size controlled.

## Data Flow

1. `scripts/analyzeBalance.mjs` reads designer workbooks from `public/designer-data`.
2. Catalog overrides are applied in memory.
3. For each RingingDeeps stage:
   - generate legal build candidates
   - run all profile/build scenarios
   - derive best-build summaries
   - classify by pass-rate bands
   - render report
4. Reports are written to:
   - `reports/balance/latest.json`
   - `reports/balance/latest.md`

No generated file is written under `public`.

## Testing Strategy

### Unit Tests

- `balanceBuildGenerator.test.ts`
  - includes default build
  - generates only legal skills for the stage
  - respects enabled hotkeys and max active slots
  - respects passive unlock tier
  - deduplicates stable signatures

- `balanceSimulator.test.ts`
  - exposes best-build summary from multi-build analysis
  - best-build summary picks highest pass rate for each profile
  - scenario results still exclude HP/pressure ratio fields

- `balanceReport.test.ts`
  - renders scoring mode as best-build based
  - renders tested build count
  - renders best build IDs/loadouts
  - does not imply weak builds reduce label

### Integration Check

- `npm run analyze:balance`
- Confirm report includes more than one tested build for RingingDeeps stages where multiple legal builds exist.
- Confirm `RingingDeeps-5` report is interpretable through best-build rows even if automated label still mismatches manual baseline.

## Risks

### Risk: Build Explosion Later

Mitigation: Cap generated active/passive variants and keep deterministic sorting. The current scope is RingingDeeps, where the search space is intentionally small.

### Risk: Best Build Becomes Unrealistically Optimized

Mitigation: Only use legal stage-unlocked skills, legal passive tiers, current build points, and real build rules. Do not allow future unlocks or illegal point totals.

### Risk: Trace Data Pollutes Scoring

Mitigation: Keep traces outside `BalanceScenarioResult`; classifier input remains attempts/victories/passRate only.

## Acceptance Criteria

- Running `npm run analyze:balance` tests multiple legal build candidates for RingingDeeps stages.
- Reports state the scoring mode as best-build based.
- Reports show which build was best for each profile/tier.
- Difficulty labels remain based only on pass rates.
- No files under `public/designer-data` are modified.
- `npm test` and `npm run build` pass.
