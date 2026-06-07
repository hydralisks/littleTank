# Monster Codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a map-entry monster codex that shows already encountered enemies with HP, skills, skill cycles, threat behavior, and appearing stages.

**Architecture:** Persist encountered enemy definition IDs in the save file, unlock them when a stage starts, and render a read-only codex panel from a pure data view-model. Keep data aggregation in `src/game/data/monsterCodex.ts` so UI components do not manually join enemy, skill, stage, and encounter-template data.

**Tech Stack:** React 19, TypeScript, Vitest, JSDOM, existing Little Tank encounter and workbook-derived runtime data.

---

## File Structure

- Modify `src/app/saveGame.ts`: add `seenEnemyDefinitionIds` to `SaveGameState` and normalize old saves.
- Modify `src/app/saveGame.test.ts`: cover save round-trip and old-save normalization for the new field.
- Create `src/game/data/monsterCodex.ts`: pure codex data helpers and display view-models.
- Create `src/game/data/monsterCodex.test.ts`: cover unlock ID extraction, de-duplication, and entry building.
- Modify `src/app/App.tsx`: keep `seenEnemyDefinitionIds` state, persist it, and append stage enemies in `startStage`.
- Modify `src/ui/StageSelectScreen.tsx`: add button state and render `MonsterCodexPanel`.
- Create `src/ui/MonsterCodexPanel.tsx`: modal panel presentation.
- Modify `src/ui/StageSelectScreen.test.ts`: cover opening the codex panel from the map.
- Modify `src/index.css`: add panel/button styles using existing map/panel visual language.

The project is currently not a Git repository in this workspace. Skip commit steps unless a repository is initialized before implementation.

---

### Task 1: Save Encountered Enemy IDs

**Files:**
- Modify: `src/app/saveGame.ts`
- Modify: `src/app/saveGame.test.ts`

- [ ] **Step 1: Write the failing save tests**

Add `seenEnemyDefinitionIds` to the round-trip expectation and old-save normalization test in `src/app/saveGame.test.ts`.

Use these exact changes:

```ts
saveSaveGame({
  highestClearedStageIndex: 1,
  stageId: 'RingingDeeps-2',
  build,
  seenEnemyDefinitionIds: ['kobold_miner', 'kobold_apprentice'],
  tutorial: {
    seenStageSelectStageIds: ['RingingDeeps-2'],
    seenEncounterStageIds: ['RingingDeeps-1'],
    autoEquippedStageIds: ['RingingDeeps-2'],
    manualBuildConfiguredStageIds: ['RingingDeeps-3'],
  },
}, storage, 'package-a')
```

Expected loaded value:

```ts
expect(loadSaveGame(storage, 'package-a')).toEqual({
  highestClearedStageIndex: 1,
  stageId: 'RingingDeeps-2',
  build,
  seenEnemyDefinitionIds: ['kobold_miner', 'kobold_apprentice'],
  tutorial: {
    seenStageSelectStageIds: ['RingingDeeps-2'],
    seenEncounterStageIds: ['RingingDeeps-1'],
    autoEquippedStageIds: ['RingingDeeps-2'],
    manualBuildConfiguredStageIds: ['RingingDeeps-3'],
  },
})
```

In the old-save normalization expectation add:

```ts
seenEnemyDefinitionIds: [],
```

Also add the empty field to the `uses separate keys` save payload:

```ts
seenEnemyDefinitionIds: [],
```

- [ ] **Step 2: Run the focused save test and verify failure**

Run:

```bash
npm test -- src/app/saveGame.test.ts
```

Expected: fails because `seenEnemyDefinitionIds` is missing from loaded save state.

- [ ] **Step 3: Implement save normalization**

In `src/app/saveGame.ts`, update the save interface:

```ts
export interface SaveGameState {
  highestClearedStageIndex: number
  stageId: StageId
  build: PersistedBuildState
  seenEnemyDefinitionIds: string[]
  tutorial: TutorialSaveState
}
```

Add this helper near `normalizeStageIdList`:

```ts
function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))]
    : []
}
```

Keep `normalizeStageIdList` stage-specific:

```ts
function normalizeStageIdList(value: unknown): StageId[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is StageId => typeof entry === 'string')
    : []
}
```

In `loadSaveGame`, return the normalized field:

```ts
return {
  ...parsed,
  seenEnemyDefinitionIds: normalizeStringList(parsed.seenEnemyDefinitionIds),
  tutorial: normalizeTutorialSaveState(parsed.tutorial),
}
```

- [ ] **Step 4: Run focused save tests and verify pass**

Run:

```bash
npm test -- src/app/saveGame.test.ts
```

Expected: all `saveGame` tests pass.

- [ ] **Step 5: Skip commit unless git is available**

If `git rev-parse --is-inside-work-tree` succeeds:

```bash
git add src/app/saveGame.ts src/app/saveGame.test.ts
git commit -m "feat: persist monster codex unlocks"
```

If it fails, continue without committing.

---

### Task 2: Add Monster Codex Data Helpers

**Files:**
- Create: `src/game/data/monsterCodex.ts`
- Create: `src/game/data/monsterCodex.test.ts`

- [ ] **Step 1: Write failing data tests**

Create `src/game/data/monsterCodex.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  appendSeenEnemyDefinitionIds,
  buildMonsterCodexEntries,
  getEnemyDefinitionIdsForStage,
} from './monsterCodex'

describe('monster codex data helpers', () => {
  it('extracts unique enemy definition ids from a stage encounter template', () => {
    const ids = getEnemyDefinitionIdsForStage('RingingDeeps-4')

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('appends newly seen enemy ids without duplicates while preserving order', () => {
    expect(appendSeenEnemyDefinitionIds(['a', 'b'], ['b', 'c', 'a', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('builds display entries with skills, cycles, and appearing stages for seen enemies', () => {
    const seenIds = getEnemyDefinitionIdsForStage('RingingDeeps-4')
    const entries = buildMonsterCodexEntries(seenIds)
    const first = entries[0]

    expect(first).toBeDefined()
    expect(first.enemyId).toBe(seenIds[0])
    expect(first.name.length).toBeGreaterThan(0)
    expect(first.baseMaxHp).toBeGreaterThan(0)
    expect(first.appearsInStages.length).toBeGreaterThan(0)
    expect(first.skills.length).toBeGreaterThan(0)
    expect(first.skillCycle.length).toBeGreaterThan(0)
    expect(first.skills[0].breakRuleLabel.length).toBeGreaterThan(0)
    expect(first.skills[0].dangerLabel.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```bash
npm test -- src/game/data/monsterCodex.test.ts
```

Expected: fails because `monsterCodex.ts` does not exist.

- [ ] **Step 3: Implement the data helper module**

Create `src/game/data/monsterCodex.ts`:

```ts
import {
  getEnemyDefinition,
  getEnemySkillDefinition,
  type EnemySkillDefinition,
  type EnemyThreatLogic,
} from './enemyCatalog'
import { createEncounterTemplate } from './encounterTemplates'
import { getStageById, stageOrder, type StageId } from './stageTemplates'
import type { DangerLevel, EnemyCastBreakRule, EnemySkillDamageType } from '../encounter/encounterTypes'

export interface MonsterCodexSkillEntry {
  skillId: string
  name: string
  targetLabel: string
  castTimeMs: number
  channelingMs: number
  recoveryMs: number
  damageType: EnemySkillDamageType
  playerDamage: number
  partyDamageOnHit: number
  partyDamageOnMiss: number
  pressureOnHit: number
  pressureOnMiss: number
  breakRule: EnemyCastBreakRule
  breakRuleLabel: string
  dangerLevel: DangerLevel
  dangerLabel: string
  appliedStatusIds: string[]
}

export interface MonsterCodexStageEntry {
  stageId: StageId
  title: string
  areaTitle: string
  stageNumber: number
}

export interface MonsterCodexEntry {
  enemyId: string
  name: string
  baseMaxHp: number
  threatLogic: EnemyThreatLogic
  threatLogicLabel: string
  isSkull: boolean
  skillCycle: MonsterCodexSkillEntry[]
  skills: MonsterCodexSkillEntry[]
  appearsInStages: MonsterCodexStageEntry[]
}

const THREAT_LOGIC_LABELS: Record<EnemyThreatLogic, string> = {
  normal: '普通仇恨',
  irregular: '乱仇恨',
  bloodlust: '嗜血目标',
}

const BREAK_RULE_LABELS: Record<EnemyCastBreakRule, string> = {
  interruptOrControl: '可打断或控制',
  controlOnly: '只能控制',
  unstoppable: '不可阻止',
}

const DANGER_LABELS: Record<DangerLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

function targetLabel(skill: EnemySkillDefinition) {
  switch (skill.targetRuleId) {
    case 'threatTarget':
      return '当前仇恨目标'
    case 'tankAndParty':
      return '坦克与队伍'
    case 'party':
      return '队伍'
    case 'otherEnemy':
      return '其他敌人'
    case 'self':
      return '自身'
    case 'mostInjured':
      return '最低生命敌人'
    default:
      return skill.targetRuleId
  }
}

function toSkillEntry(skillId: string): MonsterCodexSkillEntry | null {
  const skill = getEnemySkillDefinition(skillId)

  if (!skill) {
    return null
  }

  return {
    skillId: skill.skillId,
    name: skill.skillName,
    targetLabel: targetLabel(skill),
    castTimeMs: skill.castTimeMs,
    channelingMs: skill.channelingMs,
    recoveryMs: skill.recoveryMs,
    damageType: skill.damageType,
    playerDamage: skill.playerDamage,
    partyDamageOnHit: skill.partyDamageOnHit,
    partyDamageOnMiss: skill.partyDamageOnMiss,
    pressureOnHit: skill.pressureOnHit,
    pressureOnMiss: skill.pressureOnMiss,
    breakRule: skill.castBreakRule,
    breakRuleLabel: BREAK_RULE_LABELS[skill.castBreakRule],
    dangerLevel: skill.dangerLevel,
    dangerLabel: DANGER_LABELS[skill.dangerLevel],
    appliedStatusIds: [...skill.appliedTargetStatusIds, ...skill.appliedSelfStatusIds],
  }
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

export function appendSeenEnemyDefinitionIds(
  currentIds: readonly string[],
  nextIds: readonly string[],
) {
  return uniqueStrings([...currentIds, ...nextIds])
}

export function getEnemyDefinitionIdsForStage(stageId: StageId) {
  const stage = getStageById(stageId)
  const template = createEncounterTemplate(stage)
  return uniqueStrings(template.enemies.map((enemy) => enemy.definitionId))
}

function getAppearingStages(enemyId: string): MonsterCodexStageEntry[] {
  return stageOrder.flatMap((stageId) => {
    const stage = getStageById(stageId)
    const template = createEncounterTemplate(stage)
    const appears = template.enemies.some((enemy) => enemy.definitionId === enemyId)

    return appears
      ? [{
          stageId,
          title: stage.title,
          areaTitle: stage.areaTitle,
          stageNumber: stage.stageNumber,
        }]
      : []
  })
}

export function buildMonsterCodexEntries(seenEnemyDefinitionIds: readonly string[]): MonsterCodexEntry[] {
  return uniqueStrings(seenEnemyDefinitionIds)
    .flatMap((enemyId) => {
      const enemy = getEnemyDefinition(enemyId)

      if (!enemy) {
        return []
      }

      const skills = enemy.skillIds.flatMap((skillId) => {
        const entry = toSkillEntry(skillId)
        return entry ? [entry] : []
      })
      const skillById = new Map(skills.map((skill) => [skill.skillId, skill]))
      const cycleIds = enemy.skillCycle.length > 0 ? enemy.skillCycle : enemy.skillIds
      const skillCycle = cycleIds.flatMap((skillId) => {
        const entry = skillById.get(skillId) ?? toSkillEntry(skillId)
        return entry ? [entry] : []
      })

      return [{
        enemyId: enemy.enemyId,
        name: enemy.name,
        baseMaxHp: enemy.baseMaxHp,
        threatLogic: enemy.threatLogic,
        threatLogicLabel: THREAT_LOGIC_LABELS[enemy.threatLogic],
        isSkull: enemy.isSkull,
        skills,
        skillCycle,
        appearsInStages: getAppearingStages(enemy.enemyId),
      }]
    })
}
```

- [ ] **Step 4: Run focused codex data tests and verify pass**

Run:

```bash
npm test -- src/game/data/monsterCodex.test.ts
```

Expected: all `monsterCodex` tests pass.

- [ ] **Step 5: Skip commit unless git is available**

If `git rev-parse --is-inside-work-tree` succeeds:

```bash
git add src/game/data/monsterCodex.ts src/game/data/monsterCodex.test.ts
git commit -m "feat: add monster codex data model"
```

If it fails, continue without committing.

---

### Task 3: Unlock Enemies When Starting a Stage

**Files:**
- Modify: `src/app/App.tsx`
- Test: use `src/app/saveGame.test.ts` and `src/game/data/monsterCodex.test.ts`; add App integration only if existing app harness is available.

- [ ] **Step 1: Write a focused helper test if App wiring is hard to test directly**

If there is no existing `App.test.tsx`, rely on the already tested `appendSeenEnemyDefinitionIds` and `getEnemyDefinitionIdsForStage` helpers from Task 2. Add this test to `src/game/data/monsterCodex.test.ts`:

```ts
it('supports the App stage-start unlock flow', () => {
  const stageIds = getEnemyDefinitionIdsForStage('RingingDeeps-4')
  const next = appendSeenEnemyDefinitionIds(['existing_enemy'], stageIds)

  expect(next).toContain('existing_enemy')
  for (const enemyId of stageIds) {
    expect(next).toContain(enemyId)
  }
})
```

- [ ] **Step 2: Run focused tests and verify pass or expected failure**

Run:

```bash
npm test -- src/game/data/monsterCodex.test.ts src/app/saveGame.test.ts
```

Expected: pass if Task 2 helpers already exist. If it fails, fix Task 2 before wiring App.

- [ ] **Step 3: Wire unlock state in App**

In `src/app/App.tsx`, import helpers:

```ts
import {
  appendSeenEnemyDefinitionIds,
  getEnemyDefinitionIdsForStage,
} from '../game/data/monsterCodex'
```

Add state after tutorial state:

```ts
const [seenEnemyDefinitionIds, setSeenEnemyDefinitionIds] = useState<string[]>(
  () => loadedSave?.seenEnemyDefinitionIds ?? [],
)
```

Include it in the auto-save effect:

```ts
saveSaveGame({
  highestClearedStageIndex,
  stageId,
  build: persistedBuild,
  seenEnemyDefinitionIds,
  tutorial: tutorialState,
})
```

Update the effect dependency list:

```ts
}, [highestClearedStageIndex, persistedBuild, seenEnemyDefinitionIds, stageId, tutorialState])
```

In `startStage(nextStageId)`, after validating the stage index and before `setScreen('encounter')`, append enemies:

```ts
const nextSeenEnemyDefinitionIds = appendSeenEnemyDefinitionIds(
  seenEnemyDefinitionIds,
  getEnemyDefinitionIdsForStage(nextStageId),
)
setSeenEnemyDefinitionIds(nextSeenEnemyDefinitionIds)
```

Pass the field when manually saving after build changes:

```ts
saveSaveGame({
  highestClearedStageIndex,
  stageId,
  build,
  seenEnemyDefinitionIds,
  tutorial: nextTutorialState,
})
```

Pass the field when saving from encounter build changes:

```ts
saveSaveGame({
  highestClearedStageIndex,
  stageId,
  build,
  seenEnemyDefinitionIds,
  tutorial: tutorialState,
})
```

Pass the IDs into `StageSelectScreen`:

```tsx
seenEnemyDefinitionIds={seenEnemyDefinitionIds}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/app/saveGame.test.ts src/game/data/monsterCodex.test.ts
```

Expected: pass.

- [ ] **Step 5: Skip commit unless git is available**

If `git rev-parse --is-inside-work-tree` succeeds:

```bash
git add src/app/App.tsx src/game/data/monsterCodex.test.ts
git commit -m "feat: unlock codex enemies on stage start"
```

If it fails, continue without committing.

---

### Task 4: Add Monster Codex Panel UI

**Files:**
- Create: `src/ui/MonsterCodexPanel.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write a UI test through StageSelectScreen first**

Append the UI test described in Task 5 before implementing this component. The component can remain untested directly unless the StageSelect integration becomes too broad.

- [ ] **Step 2: Create the panel component**

Create `src/ui/MonsterCodexPanel.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type { MonsterCodexEntry, MonsterCodexSkillEntry } from '../game/data/monsterCodex'

interface MonsterCodexPanelProps {
  isOpen: boolean
  entries: readonly MonsterCodexEntry[]
  onClose: () => void
}

function formatSeconds(ms: number) {
  if (ms <= 0) {
    return '无'
  }
  return `${(ms / 1000).toFixed(1)}秒`
}

function formatSkillImpact(skill: MonsterCodexSkillEntry) {
  const values = [
    skill.playerDamage > 0 ? `坦克伤害 ${skill.playerDamage}` : null,
    skill.partyDamageOnHit > 0 ? `命中队伍 ${skill.partyDamageOnHit}` : null,
    skill.partyDamageOnMiss > 0 ? `漏处理队伍 ${skill.partyDamageOnMiss}` : null,
    skill.pressureOnHit > 0 ? `命中压力 ${skill.pressureOnHit}` : null,
    skill.pressureOnMiss > 0 ? `漏处理压力 ${skill.pressureOnMiss}` : null,
  ].filter(Boolean)

  return values.length > 0 ? values.join(' / ') : '无直接伤害或压力'
}

export function MonsterCodexPanel({ isOpen, entries, onClose }: MonsterCodexPanelProps) {
  const sortedEntries = useMemo(
    () => [...entries].sort((left, right) => left.name.localeCompare(right.name) || left.enemyId.localeCompare(right.enemyId)),
    [entries],
  )
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null)
  const selectedEntry = sortedEntries.find((entry) => entry.enemyId === selectedEnemyId) ?? sortedEntries[0] ?? null

  if (!isOpen) {
    return null
  }

  return (
    <div className="monster-codex__backdrop" role="presentation" onClick={onClose}>
      <section
        className="monster-codex"
        role="dialog"
        aria-modal="true"
        aria-label="怪物图鉴"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="monster-codex__header">
          <div>
            <p className="monster-codex__eyebrow">ENEMY RECORDS</p>
            <h2>怪物图鉴</h2>
          </div>
          <button type="button" className="monster-codex__close" aria-label="关闭怪物图鉴" onClick={onClose}>
            X
          </button>
        </header>

        {sortedEntries.length === 0 ? (
          <div className="monster-codex__empty">
            <strong>还没有记录</strong>
            <span>进入一场战斗后，本关出现过的敌人会加入图鉴。</span>
          </div>
        ) : (
          <div className="monster-codex__layout">
            <nav className="monster-codex__list" aria-label="已解锁怪物">
              {sortedEntries.map((entry) => (
                <button
                  key={entry.enemyId}
                  type="button"
                  className={[
                    'monster-codex__list-item',
                    selectedEntry?.enemyId === entry.enemyId ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedEnemyId(entry.enemyId)}
                >
                  <strong>{entry.name}</strong>
                  <span>{entry.isSkull ? '首领' : entry.threatLogicLabel}</span>
                </button>
              ))}
            </nav>

            {selectedEntry ? (
              <article className="monster-codex__detail">
                <div className="monster-codex__title-row">
                  <div>
                    <p className="monster-codex__enemy-id">{selectedEntry.enemyId}</p>
                    <h3>{selectedEntry.name}</h3>
                  </div>
                  {selectedEntry.isSkull ? <span className="monster-codex__boss-tag">首领</span> : null}
                </div>

                <div className="monster-codex__stats">
                  <span><strong>{selectedEntry.baseMaxHp}</strong>最大生命值</span>
                  <span><strong>{selectedEntry.threatLogicLabel}</strong>仇恨逻辑</span>
                  <span><strong>{selectedEntry.appearsInStages.length}</strong>出现关卡</span>
                </div>

                <section className="monster-codex__section">
                  <h4>出现位置</h4>
                  <div className="monster-codex__chips">
                    {selectedEntry.appearsInStages.map((stage) => (
                      <span key={stage.stageId}>{stage.areaTitle} {stage.stageNumber}</span>
                    ))}
                  </div>
                </section>

                <section className="monster-codex__section">
                  <h4>输出循环</h4>
                  <p className="monster-codex__cycle">
                    {selectedEntry.skillCycle.map((skill) => skill.name).join(' -> ') || '无固定循环'}
                  </p>
                </section>

                <section className="monster-codex__section">
                  <h4>技能列表</h4>
                  <div className="monster-codex__skills">
                    {selectedEntry.skills.map((skill) => (
                      <div key={skill.skillId} className="monster-codex__skill">
                        <div className="monster-codex__skill-head">
                          <strong>{skill.name}</strong>
                          <span>{skill.dangerLabel}危 / {skill.breakRuleLabel}</span>
                        </div>
                        <p>{formatSkillImpact(skill)}</p>
                        <dl>
                          <div><dt>目标</dt><dd>{skill.targetLabel}</dd></div>
                          <div><dt>施法</dt><dd>{formatSeconds(skill.castTimeMs)}</dd></div>
                          <div><dt>引导</dt><dd>{formatSeconds(skill.channelingMs)}</dd></div>
                          <div><dt>恢复</dt><dd>{formatSeconds(skill.recoveryMs)}</dd></div>
                        </dl>
                      </div>
                    ))}
                  </div>
                </section>
              </article>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add styles**

Append styles to `src/index.css`:

```css
.stage-select__codex-button {
  position: absolute;
  left: 24px;
  top: 24px;
  z-index: 5;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(12, 18, 26, 0.78);
  color: #f6f1e8;
  padding: 10px 14px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.stage-select__codex-button:hover {
  background: rgba(28, 39, 52, 0.92);
}

.monster-codex__backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(3, 7, 12, 0.68);
}

.monster-codex {
  width: min(1040px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: #101923;
  color: #f6f1e8;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
}

.monster-codex__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.monster-codex__eyebrow,
.monster-codex__enemy-id {
  margin: 0 0 4px;
  color: #9eb0bf;
  font-size: 12px;
  letter-spacing: 0;
}

.monster-codex__header h2,
.monster-codex__detail h3 {
  margin: 0;
}

.monster-codex__close {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #f6f1e8;
  cursor: pointer;
}

.monster-codex__empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 40px;
  color: #c9d3dc;
}

.monster-codex__layout {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(190px, 260px) minmax(0, 1fr);
}

.monster-codex__list {
  min-height: 0;
  overflow: auto;
  padding: 12px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.monster-codex__list-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 8px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #f6f1e8;
  cursor: pointer;
  text-align: left;
}

.monster-codex__list-item span {
  color: #9eb0bf;
  font-size: 12px;
}

.monster-codex__list-item.is-selected {
  border-color: #d7b56d;
  background: rgba(215, 181, 109, 0.14);
}

.monster-codex__detail {
  min-height: 0;
  overflow: auto;
  padding: 18px 20px 24px;
}

.monster-codex__title-row,
.monster-codex__skill-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.monster-codex__boss-tag {
  padding: 5px 8px;
  border-radius: 6px;
  background: rgba(205, 74, 74, 0.22);
  color: #ffb7a8;
  font-size: 12px;
  font-weight: 700;
}

.monster-codex__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 16px 0;
}

.monster-codex__stats span {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #9eb0bf;
  font-size: 12px;
}

.monster-codex__stats strong {
  color: #f6f1e8;
  font-size: 18px;
}

.monster-codex__section {
  margin-top: 18px;
}

.monster-codex__section h4 {
  margin: 0 0 8px;
}

.monster-codex__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.monster-codex__chips span {
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.07);
}

.monster-codex__cycle {
  margin: 0;
  color: #d9e2ea;
}

.monster-codex__skills {
  display: grid;
  gap: 10px;
}

.monster-codex__skill {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}

.monster-codex__skill p {
  margin: 8px 0;
  color: #c9d3dc;
}

.monster-codex__skill dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.monster-codex__skill dl div {
  min-width: 0;
}

.monster-codex__skill dt {
  color: #9eb0bf;
  font-size: 12px;
}

.monster-codex__skill dd {
  margin: 2px 0 0;
}

@media (max-width: 760px) {
  .monster-codex__layout {
    grid-template-columns: 1fr;
  }

  .monster-codex__list {
    max-height: 180px;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .monster-codex__stats,
  .monster-codex__skill dl {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 4: Do not run tests yet**

This component is not wired. Continue to Task 5 before verification.

---

### Task 5: Wire the Codex Into the Map

**Files:**
- Modify: `src/ui/StageSelectScreen.tsx`
- Modify: `src/ui/StageSelectScreen.test.ts`

- [ ] **Step 1: Write the failing StageSelect UI test**

Add this test near other `StageSelectScreen` component tests:

```ts
it('opens the monster codex from the map header and shows encountered enemies', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
  setGlobalProperty('window', dom.window)
  setGlobalProperty('document', dom.window.document)
  setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
  let root: Root | null = null

  try {
    const container = dom.window.document.getElementById('root')
    if (!container) {
      throw new Error('Missing root container')
    }
    root = createRoot(container)
    await act(async () => {
      root!.render(createElement(StageSelectScreen, {
        defaultSelectedStageId: 'RingingDeeps-4',
        highestClearedStageIndex: 3,
        maxUnlockedStageIndex: 3,
        partyStageId: 'RingingDeeps-4',
        persistedBuild: getDefaultPersistedBuildForRule('tutorial_5slot'),
        seenEnemyDefinitionIds: ['kobold_miner'],
        onStartStage: () => undefined,
      }))
    })

    const codexButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('怪物图鉴')) as HTMLElement | undefined
    expect(codexButton).toBeDefined()

    await act(async () => {
      codexButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('怪物图鉴')
    expect(container.querySelector('.monster-codex')).not.toBeNull()
  } finally {
    if (root) {
      await act(async () => {
        root!.unmount()
      })
    }
    setGlobalProperty('window', previousWindow)
    setGlobalProperty('document', previousDocument)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
    dom.window.close()
  }
})
```

If `kobold_miner` is not present in current designer-loaded data, replace it with the first ID returned by `getEnemyDefinitionIdsForStage('RingingDeeps-4')[0]` and import that helper from `../game/data/monsterCodex`.

- [ ] **Step 2: Run the StageSelect test and verify failure**

Run:

```bash
npm test -- src/ui/StageSelectScreen.test.ts
```

Expected: fails because `seenEnemyDefinitionIds` prop and the codex button are missing.

- [ ] **Step 3: Wire props and panel**

In `src/ui/StageSelectScreen.tsx`, add imports:

```ts
import { buildMonsterCodexEntries } from '../game/data/monsterCodex'
import { MonsterCodexPanel } from './MonsterCodexPanel'
```

Add prop:

```ts
seenEnemyDefinitionIds?: readonly string[]
```

Destructure with default:

```ts
seenEnemyDefinitionIds = [],
```

Add local state:

```ts
const [isMonsterCodexOpen, setIsMonsterCodexOpen] = useState(false)
```

Build entries near other derived values:

```ts
const monsterCodexEntries = buildMonsterCodexEntries(seenEnemyDefinitionIds)
```

Inside `<section className="stage-select__hero">`, before the reset tutorial button, add:

```tsx
<button
  type="button"
  className="stage-select__codex-button"
  onClick={() => setIsMonsterCodexOpen(true)}
>
  怪物图鉴
</button>
```

Before `</main>`, render:

```tsx
<MonsterCodexPanel
  isOpen={isMonsterCodexOpen}
  entries={monsterCodexEntries}
  onClose={() => setIsMonsterCodexOpen(false)}
/>
```

- [ ] **Step 4: Run StageSelect tests and verify pass**

Run:

```bash
npm test -- src/ui/StageSelectScreen.test.ts
```

Expected: all StageSelect tests pass.

- [ ] **Step 5: Skip commit unless git is available**

If `git rev-parse --is-inside-work-tree` succeeds:

```bash
git add src/ui/StageSelectScreen.tsx src/ui/StageSelectScreen.test.ts src/ui/MonsterCodexPanel.tsx src/index.css
git commit -m "feat: add monster codex map panel"
```

If it fails, continue without committing.

---

### Task 6: Final Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/app/saveGame.test.ts src/game/data/monsterCodex.test.ts src/ui/StageSelectScreen.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete with exit code 0.

- [ ] **Step 4: Manual smoke check**

Start the dev server:

```bash
npm run dev
```

Expected: Vite prints a local URL.

Open the app, click `怪物图鉴` on the map, verify:

- Empty state appears on a fresh save.
- After entering a stage and returning to map, at least one enemy appears.
- Enemy detail shows max HP, threat logic, appearing stages, skill list, and skill cycle.
- Closing by `X` and backdrop both work.

- [ ] **Step 5: Report results**

In the final response, include:

- Files changed.
- Test commands and results.
- Any known limitations, especially that MVP uses configured skill cycles rather than actual combat cast logs.
