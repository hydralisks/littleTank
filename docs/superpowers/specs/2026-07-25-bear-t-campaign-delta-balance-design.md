# Bear T Campaign Delta Balance Design

## Goal

Establish the first reusable Bear T numerical baseline across Challenge 1-3 and campaign chapters two and three, then produce separate active-skill and passive-talent delta reports suitable for planner review and manual playtesting.

## Scope

- Add Bear T campaign skill unlock snapshots to every chapter-two and chapter-three stage.
- Analyze all twelve campaign stages for Warrior T/Bear T parity.
- Run focused active-skill delta analysis at Bear skill unlock milestones.
- Run focused passive-talent delta analysis at chapter entry/end milestones.
- Retest Challenge 1-3 after every accepted Bear numerical change.
- Generate persistent JSON and Markdown reports for challenges, chapter two, and chapter three.
- Start the current web demo after verification for manual playtesting.

The work may modify Bear rows in `player_build.xlsx` when evidence crosses the thresholds below. It must not rebalance campaign enemies or overwrite unrelated planner rows.

## Campaign Unlock Contract

The first five Bear skills remain available together at `RingingDeeps-6`. Later skills follow the Warrior unlock cadence:

| Stage | Newly unlocked Bear skills | Cumulative Bear skills |
| --- | --- | ---: |
| `WestFall-1` | Frenzied Regeneration, Swipe | 7 |
| `WestFall-3` | Moonfire, Barkskin | 9 |
| `WestFall-5` | Survival Instincts | 10 |
| `WestFall-6` | none | 10 |
| `Zul'Aman-1` | Lunar Beam | 11 |
| `Zul'Aman-2` | Incarnation of Ursoc | 12 |
| `Zul'Aman-3` | Rage of the Sleeper | 13 |
| `Zul'Aman-5` | Regrowth, Berserk, Roar | 16 |
| `Zul'Aman-6` | none | 16 |

The workbook stores only newly unlocked skills on each campaign stage. `getUnlockedActiveSkillIdsForStage` continues to provide the cumulative list.

## Analysis Architecture

### Baseline layer

Run quick fixed/learning analysis for Warrior T and Bear T on all chapter-two and chapter-three stages. Compare the classes by `(stageId, classId, buildRuleId)` and retain the existing difficulty labels and class-comparison rules.

### Active-skill delta layer

Add an `active` delta mode. At each unlock milestone, generate a common legal build pool and evaluate each unlocked Bear skill using:

- the best legal analyzed build containing the skill;
- the best legal analyzed build excluding the skill;
- presence delta = containing pass rate minus excluding pass rate.

This avoids assigning an arbitrary replacement slot. The report must retain both compared loadouts so planners can detect correlated build differences.

Milestones: `Challenge-1`, `WestFall-1`, `WestFall-3`, `WestFall-5`, `WestFall-6`, `Zul'Aman-1`, `Zul'Aman-2`, `Zul'Aman-3`, `Zul'Aman-5`, `Zul'Aman-6`.

### Passive-talent delta layer

Keep the existing no-passive baseline and single/pair variants, but select legal Bear talents instead of the Warrior fallback list. Run at `Challenge-1`, `WestFall-1`, `WestFall-6`, `Zul'Aman-1`, and `Zul'Aman-6` so every unlocked tier is represented.

### Challenge data loading

The delta CLI must load both campaign and challenge stage/encounter workbooks. Challenge IDs must resolve to challenge-local build rules, placements, affixes, and Bear skill snapshots.

## Sampling Budget

The entire batch may run for up to roughly eight hours, but should stop earlier when conclusions are stable.

1. Quick baseline: all 12 campaign stages, both classes.
2. Standard delta: all defined active and passive milestones.
3. Full rerun: only medium/high-impact comparisons that remain low-confidence, or findings that would trigger a numerical change.
4. After a change: quick Challenge 1-3 regression plus affected campaign chapter; standard rerun for the changed skill/talent.

No single command may silently overwrite a report from another scope or delta type.

## Tuning Thresholds

- Campaign class parity: chapter average best pass-rate difference within 15 percentage points; no stage differs by more than one difficulty tier without a documented mechanics reason.
- Active over-centralization candidate: presence delta at least +20 percentage points with medium/high confidence at two or more relevant stages.
- Active weakness candidate: presence delta at most -15 percentage points with medium/high confidence at two or more relevant stages.
- Passive over-centralization candidate: single talent or legal pair gains at least +20 points at two or more milestones.
- Passive weakness candidate: no measurable benefit in at least three non-saturated milestones, supported by healing, mitigation, threat, rage, or party-pressure telemetry.
- Saturated 0%/100% results are diagnostic only; they do not alone authorize tuning.

Adjust the smallest Bear-owned scalar or AI priority that explains the result. Do not modify campaign encounter data to force parity. Every accepted change must keep Challenge 1-3 free of `tool_gap` and `strength_overflow` flags.

## Report Outputs

Write JSON and Markdown pairs under `reports/balance/`:

- `delta-druid_bear_t-challenge-1-3-active.*`
- `delta-druid_bear_t-challenge-1-3-passive.*`
- `delta-druid_bear_t-westfall-active.*`
- `delta-druid_bear_t-westfall-passive.*`
- `delta-druid_bear_t-zulaman-active.*`
- `delta-druid_bear_t-zulaman-passive.*`
- chapter baseline reports through the existing balance report paths.

Each delta report includes sampling mode, compared builds, pass-rate delta, confidence, verdict, and planner-readable strong/weak/inconclusive summaries.

## Verification And Handoff

- Contract tests cover the campaign unlock cadence and delta report output isolation.
- Delta unit tests cover active presence comparisons and Bear talent discovery.
- Designer-data validation must report zero warnings.
- Full tests, lint, production build, and `git diff --check` must pass.
- Update the class expansion handoff and changelog with measured results and residual risks.
- Start a local demo URL from the verified working tree. Manual playtest remains the release gate.

