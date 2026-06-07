# WestFall Latest Data And Static Scoring V2 Design

## Goal

Publish a build that matches the latest designer workbook values, including the
75-point `murlocHealing_status` heal, and produce first- and second-chapter
balance samples using a static score that can represent support mechanics more
honestly than the first-chapter calibration alone.

## Scope

- Keep `public/designer-data/*.xlsx` read-only throughout implementation.
- Correct the runtime healing value for `murlocHealing_status` to the currently
  approved value of 75 and protect it with a regression test.
- Extend static scoring to show separate hostile pressure, enemy support value,
  player tool coverage, and the resulting adjusted static score.
- Account for support overvaluation: repeated `mostInjured` healing casts are
  not treated as guaranteed full effective healing, because cast-start target
  locking permits overheal.
- Build the desktop package and run fresh automated samples for RingingDeeps
  and WestFall after implementation.

## Runtime Data Compatibility

The current enemy status workbook schema exposes `effectLogicId` and a
description but does not expose a structured numeric heal parameter. Runtime
logic therefore cannot obtain the new healing amount directly from a workbook
cell without a separate schema revision.

For this release, `murlocHealing_status` uses the approved current value of 75
in its runtime handler, with a regression test tied to the loaded WestFall data.
The follow-up data-model improvement is to add structured status parameters
such as `valueA` and have the handler read that field.

## Static Scoring V2

Static scoring remains a diagnostic estimate, not the final difficulty verdict.
The V2 output is decomposed into:

- `rawThreatScore`: enemy bodies, hostile damage/pressure casts, long-fight
  pressure, and mechanical/target-operation burden before player mitigation.
- `enemySupportRisk`: healing and beneficial enemy effects, estimated using
  their status effect behavior, cast frequency, interruptibility, and reduced
  realization for `mostInjured` heals that can overlap or overheal.
- `toolCoverageScore`: current player damage, recovery, multi-target,
  defensive, taunt, interrupt, and control coverage.
- `adjustedThreatScore`: the final static score after tool coverage and
  narrowly scoped tutorial/crowded-fight adjustments.

The existing difficulty label thresholds remain unchanged in this version, so
fresh first-chapter samples can be compared against previous manual labels
before further calibration.

## Reporting

Static report reasons will identify the V2 components instead of presenting a
single unexplained score. The chapter reports remain generated through the
existing balance-analysis command and continue to include simulation and
learning-AI results.

## Verification

- Targeted regression test demonstrates that the old 100-point murloc heal
  behavior fails and the corrected behavior passes.
- Static scoring tests demonstrate that interruptible/overhealable healing adds
  support risk without being valued as guaranteed full healing.
- The full Vitest suite, web build, desktop-data smoke test, and Tauri build
  must pass before publishing release artifacts.
- Fresh quick samples are generated for both `RingingDeeps` and `WestFall`.
