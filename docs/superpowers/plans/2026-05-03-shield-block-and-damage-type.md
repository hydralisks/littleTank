# Shield Block And Damage Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make warrior `shield_block` a playable rage-spending physical mitigation skill and add enemy skill `damageType`.

**Architecture:** Enemy skills expose `damageType` through the catalog and workbook loader. Player mitigation buffs carry generic damage reduction metadata on `StatusEffect`, and enemy cast resolution applies matching reductions before absorb shields.

**Tech Stack:** TypeScript, Vitest, Vite, XLSX designer workbooks.

---

### Task 1: Enemy Skill Damage Type Data

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/data/enemyCatalog.ts`
- Modify: `src/game/data/workbookLoader.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Modify: `public/designer-data/enemy_data.xlsx`

- [ ] **Step 1: Add type and catalog fields**

Add `EnemySkillDamageType = 'physical' | 'magic'`, add `damageType` to `EnemySkillDefinition`, and add optional `damageType` to `EnemySkillWorkbookOverride`.

- [ ] **Step 2: Set defaults**

Set physical defaults for weapon/melee skills and magic defaults for spell-like skills such as `flame-lance`, `ember-bolt`, `dark-mend`, `ember-rush`, and `ruin-volley`.

- [ ] **Step 3: Read workbook field**

In `parseEnemyWorkbook`, read `row.damageType` into `EnemySkillWorkbookOverride.damageType`.

- [ ] **Step 4: Sync workbook entry points**

Add `damageType` to the sample rows in `scripts/generateDesignerWorkbooks.mjs` and to `public/designer-data/enemy_data.xlsx`.

### Task 2: Shield Block Runtime

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write failing test**

Add a test that casts `warrior_t_shield_block`, verifies rage cost, verifies physical `bone-jab` is reduced 50%, and verifies magic `flame-lance` is not reduced.

- [ ] **Step 2: Run focused test**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected before implementation: FAIL because `shieldBlock` buff is not created or damage is not reduced by type.

- [ ] **Step 3: Implement buff parameters**

In `applyPlayerBuffFromPrimaryEffect`, when `status.id === 'shieldBlock'`, attach:

```ts
damageReductionRatio: Math.max(0, Math.min(1, effect?.valueB ?? 0.5)),
damageReductionTypes: ['physical' as const],
```

- [ ] **Step 4: Register runtime handler**

Add:

```ts
shield_block: (state, skillId) =>
  applyPlayerBuffFromPrimaryEffect(state, skillId, 'shieldBlock', 7_000),
```

- [ ] **Step 5: Apply typed player damage reduction**

Before `ignorePain` absorption, multiply incoming player damage by all active matching player buff reductions.

- [ ] **Step 6: Run focused test again**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected after implementation: PASS.

### Task 3: Documentation And Handoff

**Files:**
- Modify: `ENEMY_DATA_INTERFACE_SPEC.md`
- Modify: `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- Modify: `战士T技能天赋设计入口.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `开发更新日志.md`
- Create: `docs/superpowers/specs/2026-05-03-shield-block-and-damage-type-design.md`
- Create: `docs/superpowers/plans/2026-05-03-shield-block-and-damage-type.md`

- [ ] **Step 1: Update enemy data docs**

Document `damageType` in the `敌人技能` table with allowed values `physical / magic`.

- [ ] **Step 2: Update player build docs**

Document `shield_block` effect-row usage: `durationMs`, `statusId`, `valueB`.

- [ ] **Step 3: Update handoff and changelog**

Add the new runtime behavior, changed files, and verification commands so later agents can continue from this work.

### Task 4: Verification

**Files:**
- Test-only command execution.

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit 0 with no lint errors.
