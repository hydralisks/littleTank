# Static Scoring V3 Design

## Goal

Upgrade the read-only static balance score from the current V2 component split
to a V3 diagnostic model that better explains the first two chapters without
changing simulation AI strategy or designer-owned workbook data.

The immediate calibration scope is:

- `RingingDeeps-1` and `RingingDeeps-2`: `easy`
- `RingingDeeps-3` and `RingingDeeps-4`: `hard`
- `RingingDeeps-5`: `balanced`
- `RingingDeeps-6`: `expert`
- `WestFall-1`: `easy`
- `WestFall-2`: `balanced`
- `WestFall-3`: `hard`

`WestFall-4` through `WestFall-6` remain diagnostic only in this pass.

## Non-Goals

- Do not modify `public/designer-data/*.xlsx`.
- Do not run `npm run generate:designer-data` or any command that overwrites
  planner workbooks.
- Do not change combat runtime values.
- Do not change fixed-strategy AI or learning-AI behavior in this iteration.
- Do not tune WestFall-4 through WestFall-6 labels as hard acceptance criteria.

## Current Problem

V2 reports `rawThreatScore`, `enemySupportRisk`, `toolCoverageScore`, and
`adjustedThreatScore`. This is useful, but WestFall-1 through WestFall-3 still
show very high static labels while fixed and learning AI can clear them easily.

The problem is not necessarily that all enemy pressure is low. The problem is
that V2 over-compresses several different questions into one score:

- Which pressure is unavoidable?
- Which pressure is answerable by current player tools?
- How much enemy support is only theoretical because it is interruptible,
  delayed, or likely to overheal?
- How much of the remaining risk is real execution complexity rather than raw
  number pressure?

V3 makes these distinctions visible and uses them in the final static label.

## V3 Metrics

`StaticStageDifficultyMetrics` will retain existing fields for compatibility
and add these fields:

- `unavoidablePressureScore`: pressure that is hard to prevent through current
  tools, including ambient pressure, long-fight pressure, and meaningful
  unbreakable enemy casts.
- `answerablePressureScore`: hostile pressure that can be reduced by interrupts,
  control, taunt/threat control, defense, target priority, or multi-target tools.
- `toolMitigationScore`: current-stage player tool value against answerable
  pressure. This should include active skill availability, automatic damage and
  healing budgets, interrupt/control access, defensive tools, taunt coverage,
  and multi-target coverage.
- `enemySupportRisk`: surface enemy support risk from healing, upgrades,
  beneficial statuses, and self-preservation.
- `effectiveSupportRisk`: realized support value after discounts for
  interrupt/control windows, long cast/channel windows, `mostInjured`
  over-healing, and target-lock overlap.
- `executionComplexityScore`: operation cost from enemy count, target spread,
  skill density, high-risk casts, irregular/bloodlust threat behavior, and
  multi-target monitoring.

`rawThreatScore` remains the broad pre-mitigation diagnostic total, and
`adjustedThreatScore` remains equal to the final `score`.

## Score Composition

The final score should be built from the V3 components instead of applying one
large generic tool-coverage subtraction to V2 raw threat.

The intended shape is:

```text
answerableAfterMitigation = max(0, answerablePressureScore - toolMitigationScore)

score =
  unavoidablePressureScore
  + answerableAfterMitigation
  + effectiveSupportRisk
  + executionComplexityScore
  + narrowBuild / lateMechanic / tutorial modifiers
```

The exact constants can be tuned during implementation, but they must satisfy
the calibration scope above. Constants should remain simple and explainable in
the code.

## Support Accounting

V3 keeps V2's support detection approach and changes how support contributes to
the final score:

- Healing and beneficial statuses still contribute to `enemySupportRisk`.
- Support attached to `mostInjured` should be discounted in
  `effectiveSupportRisk`, because target locking and simultaneous heals can
  produce overheal.
- Interruptible or controllable support should contribute less than
  unanswerable support.
- Long cast or channel windows should reduce realized support unless the skill
  is unbreakable.
- Low realized support should still appear in reports, even if it barely moves
  the final label.

## Reporting

`scripts/analyzeBalance.mjs` should describe the static layer as V3 and render
the new components in the static-reason summary.

The report should make disagreement easier to diagnose:

- If static score is high but AI clears easily, the report should show whether
  the excess came from surface support, answerable pressure, or execution
  complexity.
- If static and AI both rate a stage difficult, the report should show whether
  the issue is unavoidable pressure, lack of mitigation tools, or high execution
  cost.

The report format remains Markdown and JSON under `reports/balance/`. Root
Chinese report synchronization can continue to use the existing script behavior.

## Compatibility

`balanceRecommendation.ts` currently consumes `StaticStageDifficultyMetrics`.
It can keep using existing fields, but should tolerate the V3 fields. If a
recommendation is improved by using `effectiveSupportRisk` or
`executionComplexityScore`, that change should be narrow and not alter AI
behavior.

Existing report consumers should still find:

- `stage.staticScore.score`
- `stage.staticScore.label`
- `stage.staticScore.metrics.rawThreatScore`
- `stage.staticScore.metrics.enemySupportRisk`
- `stage.staticScore.metrics.adjustedThreatScore`

## Verification

Implementation should verify:

- `npm test -- src/game/balance/staticStageScoring.test.ts`
- `npm test -- src/game/balance/balanceRecommendation.test.ts`
- `npm test`
- `npm run analyze:balance -- --sample=quick`
- `npm run analyze:balance -- --area=WestFall --sample=quick`

The scoring tests should assert the V3 metric fields and the calibration labels
for RingingDeeps full chapter plus WestFall-1 through WestFall-3.

The balance analysis commands are read-only for `public/designer-data/*.xlsx`
but will refresh generated reports under `reports/balance/`.
