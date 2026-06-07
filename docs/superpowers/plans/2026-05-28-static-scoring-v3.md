# Static Scoring V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade read-only static balance scoring to V3 components and calibrate static labels for RingingDeeps plus WestFall-1 through WestFall-3.

**Architecture:** Keep the existing `scoreStageStaticDifficulty(stage, template?)` entry point and report pipeline. Add V3 component metrics inside `staticStageScoring.ts`, compose the final static score from unavoidable pressure, mitigated answerable pressure, effective support, and execution complexity, then update report wording to explain V3. Do not modify designer workbooks or simulation AI strategy.

**Tech Stack:** TypeScript, Vitest, Node balance analysis script, XLSX workbook loaders.

---

### File Structure

- Modify: `src/game/balance/staticStageScoring.ts`
  - Owns V3 static metric calculation, final static label, and static reason strings.
- Modify: `src/game/balance/staticStageScoring.test.ts`
  - Already contains V3 expectations; extend only if a red test is missing for final calibration.
- Modify: `src/game/balance/balanceRecommendation.ts`
  - Keep compatibility with `StaticStageDifficultyMetrics`; optionally prefer V3 execution/support fields for recommendation signals.
- Modify: `src/game/balance/balanceRecommendation.test.ts`
  - Update fixture metrics if the type requires V3 fields.
- Modify: `scripts/analyzeBalance.mjs`
  - Change static scoring layer name and explanation from V2 to V3.
- Modify: `docs/balance/difficulty-scoring-system.md`
  - Document the V3 components and interpretation.
- Generate: `reports/balance/chapter-one-auto-scoring.md`
- Generate: `reports/balance/chapter-one-auto-scoring.json`
- Generate: `reports/balance/westfall-auto-scoring.md`
- Generate: `reports/balance/westfall-auto-scoring.json`

Do not modify or generate files under `public/`.

---

### Task 1: Confirm Existing V3 Static Tests Fail

**Files:**
- Read: `src/game/balance/staticStageScoring.test.ts`
- Read: `src/game/balance/staticStageScoring.ts`

- [ ] **Step 1: Run the focused static scoring tests**

Run:

```powershell
npm test -- src/game/balance/staticStageScoring.test.ts
```

Expected before implementation: FAIL because `result.metrics.unavoidablePressureScore`,
`answerablePressureScore`, `toolMitigationScore`, `effectiveSupportRisk`, or
`executionComplexityScore` are missing or undefined, and WestFall static labels
do not match the V3 calibration.

- [ ] **Step 2: Record the exact failing assertions**

Use the failure output to confirm the failing behavior is the missing V3
implementation, not a test setup or workbook load error. If the command fails
before assertions because of a TypeScript syntax issue, fix only the test typo
and rerun this same command before touching production scoring logic.

---

### Task 2: Add V3 Metric Fields And Score Composition

**Files:**
- Modify: `src/game/balance/staticStageScoring.ts`
- Test: `src/game/balance/staticStageScoring.test.ts`

- [ ] **Step 1: Extend the metrics interface**

Add these fields to `StaticStageDifficultyMetrics`:

```ts
unavoidablePressureScore: number
answerablePressureScore: number
toolMitigationScore: number
effectiveSupportRisk: number
executionComplexityScore: number
```

- [ ] **Step 2: Add support helpers that expose raw and effective support**

Replace the single support-risk return path with a raw/effective shape:

```ts
function estimateSkillSupportRisk(skillId: string) {
  const skill = getEnemySkillDefinition(skillId)
  if (!skill) {
    return { raw: 0, effective: 0 }
  }

  const targetStatusSupport = skill.appliedTargetStatusIds.reduce(
    (sum, statusId) => sum + estimateStatusSupportValue(statusId),
    0,
  )
  const selfStatusSupport = skill.appliedSelfStatusIds.reduce(
    (sum, statusId) => sum + estimateStatusSupportValue(statusId),
    0,
  )
  const targetRuleSupport =
    skill.targetRuleId === 'mostInjured'
      ? 5
      : skill.targetRuleId === 'self' || skill.targetRuleId === 'otherEnemy'
        ? 4
        : 0
  const raw = targetStatusSupport + selfStatusSupport + targetRuleSupport
  if (raw <= 0) {
    return { raw: 0, effective: 0 }
  }

  const castWindowFactor = skill.castTimeMs + skill.channelingMs >= 2500 ? 0.82 : 1
  const overhealFactor = skill.targetRuleId === 'mostInjured' ? 0.55 : 1
  const effective =
    raw *
    breakRuleRealizationMultiplier(skill.castBreakRule) *
    castWindowFactor *
    overhealFactor

  return { raw, effective }
}
```

- [ ] **Step 3: Add encounter-level support aggregation**

Use this shape in `estimateEnemySupportRisk`:

```ts
function estimateEnemySupportRisk(enemies: readonly EncounterEnemy[]) {
  return enemies.reduce(
    (sum, enemy) => {
      const cycle = getEnemySkillIds(enemy)
      if (cycle.length === 0) {
        return sum
      }

      const cycleMs = cycle.reduce((innerSum, skillId) => innerSum + skillCastIntervalMs(skillId), 0)
      if (cycleMs <= 0) {
        return sum
      }

      const supportPerCycle = cycle.reduce(
        (innerSum, skillId) => {
          const support = estimateSkillSupportRisk(skillId)
          return {
            raw: innerSum.raw + support.raw,
            effective: innerSum.effective + support.effective,
          }
        },
        { raw: 0, effective: 0 },
      )
      const castsPerMinuteFactor = Math.min(2.4, 60_000 / cycleMs)
      return {
        raw: sum.raw + supportPerCycle.raw * castsPerMinuteFactor,
        effective: sum.effective + supportPerCycle.effective * castsPerMinuteFactor,
      }
    },
    { raw: 0, effective: 0 },
  )
}
```

- [ ] **Step 4: Add pressure split helpers**

In `scoreStageStaticDifficulty`, derive the V3 pressure components from existing
subscores:

```ts
const unavoidablePressureScore =
  durationPressureRisk * 0.35 +
  estimatedPartyPressureRisk * 0.35 +
  template.enemies.reduce((sum, enemy) => {
    return sum + getEnemySkillIds(enemy).reduce((innerSum, skillId) => {
      const skill = getEnemySkillDefinition(skillId)
      if (!skill || skill.castBreakRule !== 'unstoppable') {
        return innerSum
      }
      const risk = estimateSkillRisk(skillId)
      return innerSum + risk.castRisk * 0.08
    }, 0)
  }, 0)

const answerablePressureScore =
  enemyBodyScore * 0.12 +
  castScore * 0.72 +
  pressureScore * 0.45 +
  mechanicRisk * 0.22

const toolMitigationScore = Math.max(0, toolCoverageScore * 0.82)
const executionComplexityScore =
  targetComplexityRisk * 0.16 +
  operationLoadRisk * 0.18 +
  castDensityRisk * 0.12
```

- [ ] **Step 5: Compose the final V3 score**

Replace the V2 score formula with the V3 composition:

```ts
const supportRisk = estimateEnemySupportRisk(template.enemies)
const enemySupportRisk = supportRisk.raw
const effectiveSupportRisk = supportRisk.effective
const answerableAfterMitigation = Math.max(0, answerablePressureScore - toolMitigationScore)
const score = clampScore(
  unavoidablePressureScore +
  answerableAfterMitigation +
  effectiveSupportRisk * 0.35 +
  executionComplexityScore +
  limitedBuildRisk +
  highHpMultiTargetRisk +
  lateMechanicRisk -
  earlyTutorialRelief -
  crowdedFightRelief,
)
```

Tune only the numeric weights in this local formula until the accepted
calibration labels pass. Do not add stage-id-specific branches.

- [ ] **Step 6: Populate V3 metrics and reason strings**

Add V3 fields to the metrics object and update the static summary reason:

```ts
const metrics: StaticStageDifficultyMetrics = {
  enemyCount,
  totalEnemyHp,
  rawThreatScore: clampScore(rawThreatScore),
  unavoidablePressureScore: clampScore(unavoidablePressureScore),
  answerablePressureScore: clampScore(answerablePressureScore),
  toolMitigationScore: clampScore(toolMitigationScore),
  enemySupportRisk: clampScore(enemySupportRisk),
  effectiveSupportRisk: clampScore(effectiveSupportRisk),
  executionComplexityScore: clampScore(executionComplexityScore),
  adjustedThreatScore: score,
  estimatedEnemyCastRisk: clampScore(estimatedEnemyCastRisk),
  estimatedPartyPressureRisk: clampScore(estimatedPartyPressureRisk),
  castDensityRisk: clampScore(castDensityRisk),
  targetComplexityRisk: clampScore(targetComplexityRisk),
  operationLoadRisk: clampScore(operationLoadRisk),
  mechanicRisk: clampScore(mechanicRisk),
  toolCoverageScore: clampScore(toolCoverageScore),
  durationPressureRisk: clampScore(durationPressureRisk),
  availableActiveSkillCount,
  playerAutoDamage,
  playerAutoHeal,
  partyAutoHeal,
}
```

Update the reason line to include the substring expected by the current test:

```ts
`静态V3：原始威胁 ${formatNumber(metrics.rawThreatScore)}，不可处理压力 ${formatNumber(metrics.unavoidablePressureScore)}，可处理压力 ${formatNumber(metrics.answerablePressureScore)}，工具抵消 ${formatNumber(metrics.toolMitigationScore)}，有效支援 ${formatNumber(metrics.effectiveSupportRisk)}，折算后 ${formatNumber(metrics.adjustedThreatScore)}`
```

- [ ] **Step 7: Run focused static scoring tests**

Run:

```powershell
npm test -- src/game/balance/staticStageScoring.test.ts
```

Expected after implementation: PASS.

---

### Task 3: Keep Recommendation Tests Compatible

**Files:**
- Modify: `src/game/balance/balanceRecommendation.test.ts`
- Modify if needed: `src/game/balance/balanceRecommendation.ts`

- [ ] **Step 1: Run recommendation tests**

Run:

```powershell
npm test -- src/game/balance/balanceRecommendation.test.ts
```

Expected before compatibility updates: it may fail at TypeScript compile time if
fixture `staticMetrics` objects lack required V3 fields.

- [ ] **Step 2: Update metric fixtures**

For every `staticMetrics` fixture in `balanceRecommendation.test.ts`, add:

```ts
unavoidablePressureScore: 28,
answerablePressureScore: 42,
toolMitigationScore: 24,
effectiveSupportRisk: 8,
executionComplexityScore: 18,
```

Choose values that preserve the existing test intent: high-pressure fixtures
should keep higher unavoidable/execution numbers; tutorial-gap fixtures should
keep moderate values.

- [ ] **Step 3: Optionally use V3 fields in recommendation logic**

If `balanceRecommendation.ts` still only uses `mechanicRisk`, leave it alone
unless a test or type failure requires a change. If a narrow improvement is
needed, change the execution-load condition to:

```ts
if (
  input.learningEffortScore >= 60 ||
  input.learningExecutionLoadScore >= 45 ||
  input.staticMetrics.mechanicRisk >= 45 ||
  input.staticMetrics.executionComplexityScore >= 35
) {
  issueTypes.push('mechanic_execution_load')
  suggestions.push('学习型 AI 显示技巧或执行负载偏高，数值建议优先放在机制链的容错上：延长关键读条/引导窗口 200-500ms，降低同轮叠加伤害，或减少必须同时监控的目标。')
}
```

- [ ] **Step 4: Run recommendation tests again**

Run:

```powershell
npm test -- src/game/balance/balanceRecommendation.test.ts
```

Expected: PASS.

---

### Task 4: Update Report Wording To V3

**Files:**
- Modify: `scripts/analyzeBalance.mjs`
- Modify: `docs/balance/difficulty-scoring-system.md`

- [ ] **Step 1: Replace report layer text**

In `scripts/analyzeBalance.mjs`, replace the static-layer row with:

```js
'| 1 | 静态评分 V3 | 不跑战斗，拆分不可处理压力、可处理压力、敌方表面/有效支援、玩家工具抵消和执行复杂度；用于解释静态与模拟差异。 | `unavoidablePressureScore + answerablePressureScore + toolMitigationScore + effectiveSupportRisk + executionComplexityScore + adjustedThreatScore + label` |',
```

- [ ] **Step 2: Replace usage guidance V2 references**

Replace:

```js
'- 静态评分 V2 用于尽早发现明显表值或敌方支援结构风险，不替代战斗模拟。',
```

with:

```js
'- 静态评分 V3 用于尽早发现明显表值、敌方支援结构、工具覆盖缺口和执行复杂度风险，不替代战斗模拟。',
```

- [ ] **Step 3: Update scoring system docs**

In `docs/balance/difficulty-scoring-system.md`, update the static scoring
section so it names V3 and describes the new fields:

```md
## 静态评分 V3 口径

- `unavoidablePressureScore`：环境压力、长线压力和不可打断高影响读条。
- `answerablePressureScore`：可被打断、控制、嘲讽、防御或目标优先级处理的压力。
- `toolMitigationScore`：当前关卡已解锁工具对可处理压力的抵消。
- `enemySupportRisk`：敌方治疗、升级、自保和增益的表面风险。
- `effectiveSupportRisk`：考虑打断窗口、长读条、`mostInjured` 过量治疗和目标锁定后的有效支援。
- `executionComplexityScore`：多目标、多读条、站位分散和特殊仇恨带来的执行成本。
- `adjustedThreatScore`：最终静态分，等同于报告里的静态评分数值。
```

- [ ] **Step 4: Search for stale V2 report wording**

Run:

```powershell
rg "静态评分 V2|静态V2|Static Scoring V2|V2 口径" scripts docs src
```

Expected: any remaining matches are historical spec/plan files only, not active
report templates or current docs.

---

### Task 5: Generate Fresh Reports

**Files:**
- Generate: `reports/balance/chapter-one-auto-scoring.md`
- Generate: `reports/balance/chapter-one-auto-scoring.json`
- Generate: `reports/balance/westfall-auto-scoring.md`
- Generate: `reports/balance/westfall-auto-scoring.json`
- Generate: `reports/balance/latest.md`
- Generate: `reports/balance/latest.json`
- May update root Chinese report for chapter one through existing script behavior.

- [ ] **Step 1: Generate quick RingingDeeps report**

Run:

```powershell
npm run analyze:balance -- --sample=quick
```

Expected: command exits 0 and refreshes `reports/balance/chapter-one-auto-scoring.md`.

- [ ] **Step 2: Generate quick WestFall report**

Run:

```powershell
npm run analyze:balance -- --area=WestFall --sample=quick
```

Expected: command exits 0 and refreshes `reports/balance/westfall-auto-scoring.md`.

- [ ] **Step 3: Inspect generated static labels**

Open the generated Markdown or JSON and confirm these labels:

```text
RingingDeeps-1 easy
RingingDeeps-2 easy
RingingDeeps-3 hard
RingingDeeps-4 hard
RingingDeeps-5 balanced
RingingDeeps-6 expert
WestFall-1 easy
WestFall-2 balanced
WestFall-3 hard
```

WestFall-4 through WestFall-6 labels should be treated as diagnostics only.

---

### Task 6: Final Verification

**Files:**
- Review all modified files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- src/game/balance/staticStageScoring.test.ts src/game/balance/balanceRecommendation.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 4: Summarize outputs**

Report:

- Modified source/docs files.
- Refreshed report paths.
- Exact verification commands and outcomes.
- Explicitly state that no `public/designer-data/*.xlsx` file was modified and
  `npm run generate:designer-data` was not run.

