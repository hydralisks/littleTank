# Bear T Resource and Trial Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Bear T early rage loop and linked talents exactly as approved, then rebalance Challenge 1-3 so fixed-AI profiles produce differentiated 40%-90% outcomes while only expert learning profiles may exceed 95%.

**Architecture:** Keep scalar tuning in `player_build.xlsx`, route all Bear rage gains through `applyBearRageGain`, and add narrow runtime hooks for target-count rage, Barkskin's conditional effective cost/absorb, and Last Stand's rage lock. Tune only challenge-local workbook data after behavior tests pass and trace evidence identifies the pressure source.

**Tech Stack:** TypeScript, Vitest, XLSX workbooks, SVG assets, existing balance simulator and designer-data validator.

---

### Task 1: Workbook Contract and Targeted Sync

**Files:**
- Modify: `src/game/playerClasses/bearTDesign.test.ts`
- Modify: `src/game/playerClasses/bearTChallengeIntegration.test.ts`
- Create: `scripts/rebalanceBearTResourceLoop.mjs`
- Modify in place: `public/designer-data/player_build.xlsx`

- [ ] **Step 1: Write failing workbook assertions**

Assert 16 active skills and 21 talents with tier counts `{ 0: 6, 1: 5, 2: 5, 3: 5 }`. Assert Skull Bash costs 0, Ironfur and Frenzied Regeneration cost 20, Mangle effect `valueB=15`, Thrash effect `valueB=5`, Spring Returns `valueA=60`, Guardian `valueA=0.25`, Ironfur Reserve `valueA=0.10/valueB=5`, Last Stand `valueA=0.15/valueB=10`, and the new talent:

```ts
expect(painRage).toMatchObject({
  id: 'druid_bear_t_pain_rage',
  pointCost: 4,
  tier: 0,
  talentLogicId: 'bear_pain_rage',
})
expect(painRageEffect).toMatchObject({ valueA: 2, valueB: 10 })
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/game/playerClasses/bearTDesign.test.ts src/game/playerClasses/bearTChallengeIntegration.test.ts`

Expected: failures for the old costs, 20-talent count, old tuning values, and missing `druid_bear_t_pain_rage`.

- [ ] **Step 3: Implement an idempotent targeted workbook sync**

Create a script that reads the current workbook with `cellStyles: true`, updates rows by stable ID, appends the new talent/effect/status/icon rows only when absent, and writes back with compression. It must not recreate any sheet or reorder existing rows. Relevant new rows:

```js
const painRageTalent = {
  talentId: 'druid_bear_t_pain_rage',
  classId: 'druid_bear_t',
  talentName: '痛苦之怒',
  category: 'skill',
  cost: 4,
  description: '痛击每命中一个敌人额外获得2怒，单次最多额外获得10怒。',
  iconId: 'druid_bear_t_pain_rage_pic',
  talentLogicId: 'bear_pain_rage',
  tier: 0,
  talentTagsCsv: 'rage,aoe',
  uiOrder: 21,
  enabled: true,
}
```

Add `druid_bear_t_rage_exhaustion` as a dispellable player debuff with 10,000ms duration and `bear_rage_exhaustion` effect logic. Register icon mappings to `bear-pain-rage` and `bear-rage-lock`.

- [ ] **Step 4: Run the sync and verify GREEN**

Run:

```powershell
node scripts/rebalanceBearTResourceLoop.mjs
npm test -- --run src/game/playerClasses/bearTDesign.test.ts src/game/playerClasses/bearTChallengeIntegration.test.ts
npm run validate:designer-data
```

Expected: focused tests pass and designer-data reports zero warnings.

### Task 2: Rage Generation and Rage Lock

**Files:**
- Modify: `src/game/playerClasses/bearTSkillRuntime.test.ts`
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Modify: `src/game/data/playerTalentLogicRegistry.ts`

- [ ] **Step 1: Write failing behavior tests**

Cover these exact outcomes:

```ts
expect(rageAfterMangleWithSavageFocus).toBe(20) // 15 base + 5 talent
expect(rageAfterSingleTargetThrashWithPainRage).toBe(7) // 5 + 2
expect(rageAfterFiveTargetThrashWithPainRage).toBe(15) // 5 + capped 10
expect(rageAfterThrashWithSavageFocusOnly).toBe(5)
expect(rageWhileExhausted).toBe(rageBeforeGain)
```

Update Spring Returns coverage so 59 accumulated rage does not heal and crossing 60 heals the party for 5.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/game/playerClasses/bearTSkillRuntime.test.ts`

Expected: old hard-coded 20/15 generator values, Savage Focus affecting Thrash, missing Pain Rage, old 30-rage threshold, and no rage-lock guard.

- [ ] **Step 3: Implement the minimal rage logic**

Read generator bases from the primary skill effect instead of literals:

```ts
const baseRage = Math.max(0, effect?.valueB ?? 15)
```

In `bear_thrash`, calculate `affected.length`, then add:

```ts
const painRage = state.passiveTalentIds.includes('druid_bear_t_pain_rage')
  ? Math.min(
      getBearTalentValue('druid_bear_t_pain_rage', 'valueB', 10),
      affected.length * getBearTalentValue('druid_bear_t_pain_rage', 'valueA', 2),
    )
  : 0
```

At the top of `applyBearRageGain`, return the unchanged state when an active player debuff has ID `druid_bear_t_rage_exhaustion`. Register `bear_pain_rage` as a runtime-only talent logic.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run src/game/playerClasses/bearTSkillRuntime.test.ts src/game/playerClasses/bearTDesign.test.ts`

Expected: both files pass.

### Task 3: Conditional Barkskin Cost and Exclusive Shield Reward

**Files:**
- Modify: `src/game/playerClasses/bearTSkillRuntime.test.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`

- [ ] **Step 1: Write failing Barkskin tests**

Prove that Barkskin costs 0 without Broken Bark; with the talent it is blocked below 10 rage, spends exactly 10 rage, creates `druid_bear_t_broken_bark_shield` with `absorbRemaining=20` and 5,000ms duration, returns 20 rage only when that exact shield is fully consumed before expiry, and does not reward `ignorePain` or natural expiration.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- --run src/game/playerClasses/bearTSkillRuntime.test.ts`

Expected: Barkskin ignores the conditional cost, the shield is absent, and the existing Broken Bark trigger incorrectly accepts any fully consumed absorb.

- [ ] **Step 3: Add one effective-cost helper**

Use the same helper in both activation checks and resource deduction:

```ts
function getEffectiveSkillResourceCost(state: EncounterState, skill: SkillState) {
  if (
    skill.id === 'druid_bear_t_barkskin' &&
    state.passiveTalentIds.includes('druid_bear_t_broken_bark')
  ) {
    return Math.max(0, getBearTalentValue('druid_bear_t_broken_bark', 'valueB', 10))
  }
  return skill.resourceCost
}
```

Update absorb consumption to accept any buff with positive `absorbRemaining` and `absorbRatio`, retaining `statusId` in the existing combat event.

- [ ] **Step 4: Create the Barkskin shield and narrow the reward**

When Broken Bark is selected, `bear_barkskin` appends a status created from `druid_bear_t_broken_bark_shield`, with `absorbRemaining=20` and `absorbRatio=1`. Change the event predicate to:

```ts
event.type === 'absorb-consumed' &&
event.statusId === 'druid_bear_t_broken_bark_shield' &&
event.fullyConsumed
```

Reward `valueA=20` rage through `applyBearRageGain`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- --run src/game/playerClasses/bearTSkillRuntime.test.ts src/game/encounter/encounterFactory.test.ts -t "absorb|broken bark|Barkskin"`

Expected: all selected tests pass.

### Task 4: Ironfur Reserve, Guardian, and Last Stand

**Files:**
- Modify: `src/game/playerClasses/bearTSkillRuntime.test.ts`
- Modify: `src/game/encounter/encounterFactory.ts`

- [ ] **Step 1: Write failing survival tests**

Assert Ironfur Reserve is 10% for 5 seconds and reduces a physical hit together with a newly active Ironfur. Assert Last Stand preserves `maxHp * 0.15`, applies the 10-second dispellable rage-exhaustion debuff, triggers once, and allows the existing dispel path to remove the debuff. Assert Guardian applies `damageTakenMultiplierBonus=-0.25` above 80% HP.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/game/playerClasses/bearTSkillRuntime.test.ts`

Expected: old 8%/3-second reserve, one-HP Last Stand, missing debuff, and old 6% Guardian value.

- [ ] **Step 3: Implement data-driven behavior**

Keep Reserve and Ironfur as separate statuses so the existing player-buff and active-mitigation pipelines both apply. In Last Stand:

```ts
hp: Math.max(1, state.player.maxHp * getBearTalentValue('druid_bear_t_last_bear_stand', 'valueA', 0.15))
```

Append `druid_bear_t_rage_exhaustion` using its workbook definition and `valueB * 1000` duration. Keep the once-per-encounter runtime flag.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run src/game/playerClasses/bearTSkillRuntime.test.ts`

Expected: all Bear runtime tests pass.

### Task 5: Icon Assets and Workbook Validation

**Files:**
- Create: `public/status-icons/bear-pain-rage.svg`
- Create: `public/status-icons/bear-rage-lock.svg`
- Modify: `src/game/playerClasses/bearTDesign.test.ts`

- [ ] **Step 1: Add failing icon coverage**

Assert both new icon mapping asset keys resolve to existing SVG files through the same validation path as other Bear icons.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/game/playerClasses/bearTDesign.test.ts`

Expected: missing asset files.

- [ ] **Step 3: Add the two SVG assets**

Use the existing compact Bear palette and `viewBox="0 0 64 64"`; Pain Rage should read as a claw over a red-gold impact ring, and Rage Lock as a muted rage flame crossed by a locking bar. Avoid text and preserve transparent backgrounds.

- [ ] **Step 4: Verify assets and designer data**

Run: `npm test -- --run src/game/playerClasses/bearTDesign.test.ts && npm run validate:designer-data`

Expected: pass with zero warnings.

### Task 6: Challenge 1-3 Profile Distribution

**Files:**
- Modify in place: `public/designer-data/challenge_encounter_balance.xlsx`
- Modify in place: `public/designer-data/challenge_stage_content.xlsx` only when guidance text changes
- Modify: `scripts/tuneBearTTrialEncounters.mjs`
- Generated: existing `reports/balance/challenge/` and `reports/data_estimate/challenge/` snapshots

- [ ] **Step 1: Run the unchanged-challenge baseline**

Run: `npm run analyze:balance -- --challenge --stages=Challenge-1,Challenge-2,Challenge-3 --quick`

Record per-profile fixed pass rates, learning pass rates, class comparison flags, tank damage, party pressure, interrupt completion, and Bear rage throughput.

- [ ] **Step 2: Trace any out-of-range stage**

For profiles below40%, above90%, or ordinary learning profiles above95%, run one-attempt traces and classify the failure/success driver as tank death, party pressure, threat loss, interrupted casts, enemy healing, or operation-budget saturation.

- [ ] **Step 3: Apply one challenge-local hypothesis at a time**

Update only stable workbook IDs in `tuneBearTTrialEncounters.mjs`. Prefer opening HP/pressure, per-stage HP overrides, placements, or challenge-only affix values. Do not alter `stage_content.xlsx`, `encounter_balance.xlsx`, or `enemy_data.xlsx`.

- [ ] **Step 4: Repeat validation and quick analysis**

Run after each accepted hypothesis:

```powershell
node scripts/tuneBearTTrialEncounters.mjs
npm run validate:designer-data
npm run analyze:balance -- --challenge --stages=Challenge-1,Challenge-2,Challenge-3 --quick
```

Stop when fixed profiles mainly occupy40%-90%, only expert learning behavior exceeds95%, and all cross-class flags are clear. If discrete mechanics prevent all constraints, retain the nearest no-tool-gap configuration and document exact residuals.

### Task 7: Regression, Documentation, and Handoff

**Files:**
- Modify: `docs/player-tank-class-expansion-handoff.md`
- Modify: `开发更新日志.md`
- Modify: this plan checklist

- [ ] **Step 1: Smoke Challenge 4-9 builds**

Instantiate Bear defaults for Challenge4-6 (`8slot_0`) and Challenge7-9 (`8slot_2`) and run one short scenario per stage. Confirm all six builds are legal after adding the Tier0 talent.

- [ ] **Step 2: Run the full gate**

Run:

```powershell
npm test
npm run validate:designer-data
npm run lint
npm run build
git diff --check
```

Expected: zero failures and zero designer-data warnings.

- [ ] **Step 3: Document measured results**

Record final per-stage class pass rates, profile spread, retained exceptions, rage-loop values, and manual playtest risks in the handoff and changelog.

- [ ] **Step 4: Preserve the user's workbook changes**

Compare the final workbook against the current pre-implementation baseline by stable IDs. Confirm unrelated rows remain untouched. Do not commit or push the implementation batch unless the user requests it.
