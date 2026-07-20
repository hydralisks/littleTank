# Strategy Tips Sensitivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal analyzer that measures how much chapter 1-2 learning AI pass rates depend on `strategyTips`.

**Architecture:** Add a focused balance module for tip classification, degraded-mode candidate shaping, result summarization, and Markdown rendering. Add a Node script that loads story designer data read-only, runs the existing simulator, and writes compact reports under `reports/strategy_tips/story/`.

**Tech Stack:** TypeScript game/balance modules, Node ESM scripts with the existing TypeScript loader, Vitest tests, existing balance simulator APIs.

---

### Task 1: Core Strategy-Tip Sensitivity Module

**Files:**
- Create: `src/game/balance/strategyTipsSensitivity.ts`
- Test: `src/game/balance/strategyTipsSensitivity.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  classifyStrategyTipSignals,
  filterViolatedBuildCandidates,
  formatPassRateDrop,
  summarizeStrategyTipDependency,
} from './strategyTipsSensitivity'

describe('strategy tips sensitivity', () => {
  it('classifies passive-heavy, reflect, and priority-kill tips', () => {
    expect(classifyStrategyTipSignals('注意配合使用新解锁的tier 2强力天赋，不适合当前关卡的主动技能也可以放弃掉')).toContain('passive_heavy')
    expect(classifyStrategyTipSignals('卡好gcd时间反弹“鱼人闪电术”，怒气保持“无视苦痛”覆盖')).toEqual(expect.arrayContaining(['spell_reflect', 'resource_absorb_uptime']))
    expect(classifyStrategyTipSignals('优先击杀初始dps更高的敌人')).toContain('priority_kill')
  })

  it('filters tip-aligned builds in violated mode without returning an empty candidate list', () => {
    const candidates = [
      { id: 'passive', build: { loadout: { Digit1: 'warrior_t_shield_block' }, passiveTalentIds: ['a', 'b', 'c', 'd'] } },
      { id: 'active', build: { loadout: { Digit1: 'warrior_t_shield_wall', Digit2: 'warrior_t_shield_reflection' }, passiveTalentIds: [] } },
      { id: 'plain', build: { loadout: { Digit1: 'warrior_t_revenge' }, passiveTalentIds: [] } },
    ] as any

    expect(filterViolatedBuildCandidates(candidates, ['passive_heavy', 'spell_reflect']).map((candidate) => candidate.id)).toEqual(['plain'])
    expect(filterViolatedBuildCandidates([candidates[0]], ['passive_heavy']).map((candidate) => candidate.id)).toEqual(['passive'])
  })

  it('labels dependency from ignored-mode pass-rate drop', () => {
    expect(summarizeStrategyTipDependency(0.7, 0.64).label).toBe('low')
    expect(summarizeStrategyTipDependency(0.7, 0.5).label).toBe('medium')
    expect(summarizeStrategyTipDependency(0.7, 0.3).label).toBe('high')
    expect(summarizeStrategyTipDependency(0.7, 0.02).label).toBe('critical')
    expect(formatPassRateDrop(0.59, 0.31)).toBe('28pp / 47%')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails because the module is missing**

Run: `npx vitest run src/game/balance/strategyTipsSensitivity.test.ts`

Expected: FAIL with an import/module-not-found error.

- [ ] **Step 3: Implement the module**

Create the exported helpers used by the tests, plus report types and Markdown rendering helpers used by the script.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx vitest run src/game/balance/strategyTipsSensitivity.test.ts`

Expected: PASS.

### Task 2: Analyzer Script

**Files:**
- Create: `scripts/analyzeStrategyTips.mjs`
- Modify: `package.json`
- Test: `src/game/balance/analyzeStrategyTipsTemplate.test.ts`

- [ ] **Step 1: Write failing template tests**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('strategy tips analyzer template', () => {
  it('writes compact story reports without touching designer workbooks', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeStrategyTips.mjs'), 'utf8')

    expect(script).toContain("reports', 'strategy_tips', 'story'")
    expect(script).toContain('第一章策略提示敏感性.md')
    expect(script).toContain('第二章策略提示敏感性.md')
    expect(script).not.toContain('writeFileSync(path.join(designerDataDir')
    expect(script).not.toContain('generateDesignerWorkbooks')
  })
})
```

- [ ] **Step 2: Run the template test and verify it fails because the script is missing**

Run: `npx vitest run src/game/balance/analyzeStrategyTipsTemplate.test.ts`

Expected: FAIL with ENOENT for `scripts/analyzeStrategyTips.mjs`.

- [ ] **Step 3: Implement the script**

The script loads `stage_content.xlsx`, `encounter_balance.xlsx`, `enemy_data.xlsx`, and `player_build.xlsx` read-only; analyzes RD1-6 and WF1-6; writes Markdown and compact JSON reports under `reports/strategy_tips/story/`; and supports `--quick`, `--sample=normal`, and `--sample=full`.

- [ ] **Step 4: Add package script**

Add `"analyze:strategy-tips": "node --experimental-strip-types --loader ./scripts/ts-extension-loader.mjs scripts/analyzeStrategyTips.mjs"` to `package.json`.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/game/balance/strategyTipsSensitivity.test.ts src/game/balance/analyzeStrategyTipsTemplate.test.ts`

Expected: PASS.

### Task 3: Smoke Run

**Files:**
- Generated: `reports/strategy_tips/story/第一章策略提示敏感性.md`
- Generated: `reports/strategy_tips/story/第二章策略提示敏感性.md`

- [ ] **Step 1: Run quick analyzer**

Run: `npm run analyze:strategy-tips -- --quick`

Expected: command exits 0 and prints both report paths.

- [ ] **Step 2: Inspect generated reports**

Confirm the Markdown files begin with `# 第一章策略提示敏感性` and `# 第二章策略提示敏感性`, include a summary, include all six stages for the chapter, and do not contain large combat traces.

- [ ] **Step 3: Run final focused verification**

Run: `npx vitest run src/game/balance/strategyTipsSensitivity.test.ts src/game/balance/analyzeStrategyTipsTemplate.test.ts`

Expected: PASS.
