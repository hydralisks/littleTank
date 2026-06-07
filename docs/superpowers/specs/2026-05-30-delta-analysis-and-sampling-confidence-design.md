# Delta Analysis And Sampling Confidence Design

## Purpose

The balance system already answers "what difficulty label does this stage get?" with static scoring, fixed-strategy AI, and learning AI. The next gap is causal diagnosis: when a stage depends on a narrow build or passive combination, designers need to know which component caused the pass-rate jump and how much confidence the sample supports.

This feature adds a read-only `analyze:delta` workflow and a reusable sampling confidence layer. It must not modify `public/designer-data/` or generate planner-owned workbooks.

## Goals

- Compare specific build variants against a baseline in the existing combat simulator.
- Support passive talent delta analysis first, with room for active skill and full build comparisons.
- Report absolute pass-rate delta, relative pass-rate delta, sample size, seed count, and confidence.
- Make quick samples safe to read by labeling low-confidence results as screening signals.
- Reuse existing stage loading, build generation, profiles, and report conventions.

## Non-Goals

- No AI strategy rewrite in the first version.
- No automatic designer workbook edits.
- No final balance changes based only on quick delta samples.
- No full combinatorial passive sweep in v1; targeted comparisons are the point.

## User Workflows

### Passive Delta

```bash
npm run analyze:delta -- --stages=WestFall-2,WestFall-3 --type=passive --sample=quick
```

The report should include baseline, single passive variants, important pair variants, pass-rate deltas, and confidence. For the current WestFall questions it should show `warrior_t_raise_banner`, `warrior_t_barbaric_training`, `warrior_t_raise_banner + warrior_t_barbaric_training`, and `warrior_t_focused_vigor`.

### Build Delta

```bash
npm run analyze:delta -- --stages=RingingDeeps-5 --type=build --baseBuild=default --sample=standard
```

The report compares default against candidate builds selected from current balance reports or generated legal builds.

### Focused Validation

```bash
npm run analyze:delta -- --stages=WestFall-3 --type=passive --baseBuild=generated_8_0 --attempts=60 --seeds=3
```

This validates a quick signal with more attempts and multiple deterministic seed offsets once deterministic seed support exists.

## CLI

Add `scripts/analyzeDelta.mjs` and package script `analyze:delta`.

Supported v1 options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--stages=a,b` | Explicit stage IDs. | Required unless `--area` is supplied. |
| `--area=WestFall` | Analyze all ordered stages in an area. | Empty |
| `--type=passive|build` | Delta mode. | `passive` |
| `--baseBuild=best|default|<id>` | Baseline active/passive source. | `best` |
| `--talents=a,b` | Passive IDs to test. | Auto-select unlocked high-priority passives |
| `--attempts=n` | Attempts per scenario per seed. | From sample config |
| `--seeds=n` | Number of seed buckets. | `1` in v1 if simulator seed injection is not available |
| `--sample=quick|standard|full` | Preset attempts. | `quick` |
| `--profile=learning|average|skilled|expert` | Profile set. | `learning` |

If both `--attempts` and `--sample` are present, `--attempts` wins.

## Sample Presets

| Sample | Attempts | Seeds | Use |
| --- | ---: | ---: | --- |
| `quick` | 12 | 1 | Screening during design |
| `standard` | 30 | 1 | Better single-run evidence |
| `full` | 100 | 1 | Stronger evidence without seed support |

Seed count is included in the model now. The existing simulator currently creates deterministic random streams internally per scenario attempt; if direct seed injection is not exposed yet, v1 reports `seedCount=1` and leaves multi-seed execution for the next small extension.

## Core Types

Create `src/game/balance/deltaAnalysis.ts`.

```ts
export type DeltaAnalysisType = 'passive' | 'build'
export type DeltaConfidence = 'low' | 'medium' | 'high'
export type DeltaVerdict = 'strong_gain' | 'minor_gain' | 'neutral' | 'regression' | 'inconclusive'

export interface DeltaVariant {
  id: string
  label: string
  kind: 'baseline' | 'add_passive' | 'passive_combo' | 'custom_build'
  build: PersistedBuildState
}

export interface DeltaScenarioResult {
  stageId: string
  baselineVariantId: string
  variantId: string
  variantLabel: string
  variantKind: DeltaVariant['kind']
  attempts: number
  victories: number
  passRate: number
  seedCount: number
  passiveTalentIds: PassiveTalentId[]
  loadout: SkillLoadout
}

export interface DeltaComparison {
  stageId: string
  baselineVariantId: string
  comparedVariantId: string
  comparedVariantLabel: string
  baselinePassRate: number
  comparedPassRate: number
  passRateDelta: number
  relativeDelta: number
  confidence: DeltaConfidence
  verdict: DeltaVerdict
  reasons: string[]
}

export interface StageDeltaAnalysis {
  stageId: string
  title: string
  analysisType: DeltaAnalysisType
  baselineVariantId: string
  scenarios: DeltaScenarioResult[]
  comparisons: DeltaComparison[]
}
```

## Confidence Rules

Create `src/game/balance/samplingConfidence.ts`.

V1 uses clear rules instead of a complex statistical model:

- `low`: total attempts below 30, or absolute delta below 10 percentage points.
- `medium`: total attempts at least 30 and absolute delta at least 15 percentage points.
- `high`: total attempts at least 100 and absolute delta at least 15 percentage points.
- Any comparison with zero baseline and nonzero variant is capped at `medium` unless total attempts are at least 100.
- Any comparison where both baseline and variant are below 10% pass rate is `low` unless the absolute delta is at least 25 percentage points.

Verdict rules:

- `strong_gain`: delta >= 25 percentage points and confidence is not `low`.
- `minor_gain`: delta >= 10 percentage points.
- `neutral`: absolute delta < 10 percentage points.
- `regression`: delta <= -10 percentage points.
- `inconclusive`: confidence is `low` and absolute delta is below 15 percentage points.

Reports should expose confidence even when verdict is not conclusive.

## Variant Generation

Passive delta v1:

1. Resolve baseline build.
2. Preserve baseline active loadout.
3. Create baseline variant with no passive changes when possible.
4. Create single-passive variants for selected talents.
5. Create pair variants for selected talents that are known high-interest or legal affordable pairs.
6. Normalize every generated build through `normalizePersistedBuildForRule`.
7. Drop duplicate build signatures.

Default auto-selected talents:

- Unlocked talents with tags `party`, `survival`, `anti-cast`, `rage`, `damage`, or `focus`.
- Always include currently important warrior passives when legal: `warrior_t_raise_banner`, `warrior_t_barbaric_training`, `warrior_t_focused_vigor`, `warrior_t_bloodsurge`, `warrior_t_snap_interrupt`, `warrior_t_defenders_aegis`, `warrior_t_reinforced_plates`, `warrior_t_defensive_stance`.

Build delta v1:

- Baseline is default or requested build.
- Comparisons come from current generated balance builds and any best builds found in existing reports if available.
- Keep candidate count small in quick mode to avoid the previous full-sweep timeout.

## Baseline Resolution

`--baseBuild=default` uses the normalized default persisted build for the stage rule.

`--baseBuild=best` prefers:

1. Best learning AI selected build from existing `reports/balance/*.json` if it matches the stage.
2. Best fixed AI build from existing report.
3. Generated build with highest phase-one quick score if no report entry exists.
4. Default build as fallback.

`--baseBuild=<id>` resolves against generated legal build IDs first, then existing report analyzed builds.

## Report Output

Write:

- `reports/balance/delta-analysis.md`
- `reports/balance/delta-analysis.json`

Markdown sections:

1. Summary table: stage, baseline, top gains, regressions, low-confidence items.
2. Comparison table: baseline, variant, pass rate, delta, relative delta, confidence, verdict.
3. Variant details: active loadout and passive list.
4. Follow-up list: comparisons that need `standard` or `full` rerun.

## Integration

- `scripts/analyzeDelta.mjs` should reuse workbook loading conventions from `scripts/analyzeBalance.mjs`.
- `deltaAnalysis.ts` should call existing `runStageBalanceAnalysis`.
- `samplingConfidence.ts` should be pure and unit tested.
- Existing `analyze:balance` does not need to call delta analysis in v1.
- Future passive-talent audit reports can consume delta JSON instead of ad hoc scripts.

## Testing

Add tests for:

- Confidence classification thresholds.
- Verdict classification.
- Passive variant generation preserves active loadout and legalizes passives.
- Duplicate variants are removed.
- Markdown report includes confidence and follow-up recommendations.

Run:

```bash
npm test -- src/game/balance/samplingConfidence.test.ts src/game/balance/deltaAnalysis.test.ts
npm test
npm run analyze:delta -- --stages=WestFall-2,WestFall-3 --type=passive --sample=quick
```

## Risks

- Quick sample outputs may still be noisy. Mitigation: label low confidence and recommend reruns.
- Baseline selection may hide active-skill effects. Mitigation: report exact loadout and support explicit `--baseBuild`.
- Full combinatorial passive analysis can timeout. Mitigation: targeted variants only in v1.
- Existing report JSON may be stale. Mitigation: use generated legal builds as fallback and display report source when used.

## Acceptance Criteria

- `npm run analyze:delta -- --stages=WestFall-2,WestFall-3 --type=passive --sample=quick` writes markdown and JSON.
- Report includes `warrior_t_raise_banner`, `warrior_t_barbaric_training`, their pair, and `warrior_t_focused_vigor` when legal.
- Each comparison has pass-rate delta, relative delta, confidence, verdict, and reasons.
- No files under `public/` are modified.
- Existing test suite passes.
