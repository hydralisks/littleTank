# Stage Select Fixed Layout And Build Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固定地图选关页的地图与右侧信息区尺寸，并把构筑规则与构筑冲突改为两个独立的大按钮弹窗。

**Architecture:** 在 `StageSelectScreen.tsx` 中新增本地弹窗状态，保留地图主结构不变，把构筑规则与冲突明细从默认卡片剥离。样式继续沿用 `encounter.css`，只在地图页相关类附近增量修改，并补一个纯函数测试文件覆盖关卡页派生 UI 逻辑。

**Tech Stack:** React 19, TypeScript, Vitest, existing CSS in `src/styles/encounter.css`

---

### Task 1: Add stage-select UI model tests

**Files:**
- Create: `src/ui/stageSelectViewModel.test.ts`
- Create: `src/ui/stageSelectViewModel.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildStageSelectBuildRuleModal,
  buildStageSelectConflictModal,
  shouldShowBuildConflictButton,
} from './stageSelectViewModel'

describe('stageSelectViewModel', () => {
  it('always shows build rule button content when a build rule exists', () => {
    expect(
      buildStageSelectBuildRuleModal({
        ruleName: '标准五键构筑',
        description: '开放 1/2/3/4/Q 五个键位。',
        totalBuildPoints: 28,
        maxActiveSlots: 5,
        enabledHotkeys: ['1', '2', '3', '4', 'Q'],
        forcedSkillNames: [],
        forcedTalentNames: [],
        lockedSkillNames: [],
        lockedTalentNames: [],
      }).sections.length,
    ).toBeGreaterThan(0)
  })

  it('shows conflict button only when warnings exist', () => {
    expect(shouldShowBuildConflictButton([])).toBe(false)
    expect(shouldShowBuildConflictButton(['技能冲突'])).toBe(true)
  })

  it('maps warning messages into conflict modal rows', () => {
    expect(buildStageSelectConflictModal(['A', 'B']).items).toEqual(['A', 'B'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/stageSelectViewModel.test.ts`
Expected: FAIL with module-not-found for `./stageSelectViewModel`

- [ ] **Step 3: Write minimal implementation**

```ts
export interface StageSelectBuildRuleModalInput {
  ruleName: string
  description: string
  totalBuildPoints: number
  maxActiveSlots: number
  enabledHotkeys: string[]
  forcedSkillNames: string[]
  forcedTalentNames: string[]
  lockedSkillNames: string[]
  lockedTalentNames: string[]
}

export function shouldShowBuildConflictButton(warnings: string[]) {
  return warnings.length > 0
}

export function buildStageSelectBuildRuleModal(input: StageSelectBuildRuleModalInput) {
  return {
    title: input.ruleName,
    sections: [
      { label: '规则说明', value: input.description },
      { label: '总技能点', value: String(input.totalBuildPoints) },
      { label: '最大主动槽位', value: String(input.maxActiveSlots) },
      { label: '开放键位', value: input.enabledHotkeys.join('/') || '无额外限制' },
      { label: '强制技能', value: input.forcedSkillNames.join('、') || '无额外限制' },
      { label: '强制天赋', value: input.forcedTalentNames.join('、') || '无额外限制' },
      { label: '锁定技能', value: input.lockedSkillNames.join('、') || '无额外限制' },
      { label: '锁定天赋', value: input.lockedTalentNames.join('、') || '无额外限制' },
    ],
  }
}

export function buildStageSelectConflictModal(warnings: string[]) {
  return {
    title: '当前构筑冲突',
    items: warnings,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/stageSelectViewModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/stageSelectViewModel.ts src/ui/stageSelectViewModel.test.ts
git commit -m "test: add stage select view model coverage"
```

### Task 2: Implement stage-select modal state and fixed-info layout

**Files:**
- Modify: `src/ui/StageSelectScreen.tsx`
- Modify: `src/ui/stageSelectViewModel.ts`

- [ ] **Step 1: Write the failing test**

Use the Task 1 test file to add one more failing assertion for empty fallback text:

```ts
it('uses fallback text for empty build rule buckets', () => {
  const modal = buildStageSelectBuildRuleModal({
    ruleName: '教程一',
    description: '说明',
    totalBuildPoints: 10,
    maxActiveSlots: 2,
    enabledHotkeys: ['1', '2'],
    forcedSkillNames: [],
    forcedTalentNames: [],
    lockedSkillNames: [],
    lockedTalentNames: [],
  })

  expect(modal.sections.some((section) => section.value === '无额外限制')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/stageSelectViewModel.test.ts`
Expected: FAIL if fallback handling is missing or not wired

- [ ] **Step 3: Write minimal implementation**

Implement in `src/ui/StageSelectScreen.tsx`:

```ts
const [buildInfoModal, setBuildInfoModal] = useState<'none' | 'rule' | 'conflict'>('none')
```

and replace the old expanded build block with:

```tsx
<div className="stage-brief__build-actions">
  <button type="button" className="stage-brief__detail-button" onClick={() => setBuildInfoModal('rule')}>
    <span className="stage-brief__detail-icon stage-brief__detail-icon--rule">构</span>
    <span className="stage-brief__detail-copy">
      <strong>构筑规则</strong>
      <span>查看本关构筑限制与开放内容</span>
    </span>
  </button>

  {hasBuildConflict ? (
    <button type="button" className="stage-brief__detail-button is-warning" onClick={() => setBuildInfoModal('conflict')}>
      <span className="stage-brief__detail-icon stage-brief__detail-icon--warning">!</span>
      <span className="stage-brief__detail-copy">
        <strong>当前构筑冲突</strong>
        <span>{buildPreview.warnings.length} 项需要调整</span>
      </span>
    </button>
  ) : null}
</div>
```

Render one in-page modal tree below the card using `buildInfoModal`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/stageSelectViewModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/StageSelectScreen.tsx src/ui/stageSelectViewModel.ts src/ui/stageSelectViewModel.test.ts
git commit -m "feat: add stage select build detail modal flow"
```

### Task 3: Lock map and side panel sizing in CSS

**Files:**
- Modify: `src/styles/encounter.css`

- [ ] **Step 1: Write the failing test**

No CSS test harness exists, so use a manual verification checklist as the failing spec:

```text
1. 地图页在常见桌面宽度下不出现“进入这一关”按钮掉出屏幕
2. 右侧卡片高度固定，不因构筑说明变长而整体变高
3. 地图节点与标签均留在地图框体内
4. 两个详情弹窗为固定尺寸，内容区单独滚动
```

- [ ] **Step 2: Run verification to confirm current layout fails the checklist**

Run: `npm run preview -- --host 127.0.0.1 --port 4173`
Expected: current UI still shows expanded build content directly in the card

- [ ] **Step 3: Write minimal implementation**

Add or adjust CSS around:

```css
.stage-select__layout {
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: stretch;
}

.stage-map {
  aspect-ratio: 16 / 10;
  min-height: 0;
  height: 100%;
}

.stage-brief {
  min-height: 0;
  max-height: 100%;
  grid-template-rows: auto auto auto auto auto auto 1fr auto;
  overflow: hidden;
}

.stage-brief__build-actions {
  display: grid;
  gap: 10px;
}

.stage-brief__detail-button { ... }
.stage-brief__detail-button.is-warning { ... }
.stage-brief__modal-backdrop { ... }
.stage-brief__modal { ... }
.stage-brief__modal-body { overflow: auto; }
```

Also clamp summary text with line clamp classes where needed.

- [ ] **Step 4: Run verification to verify it passes**

Run:
- `npm run build`
- `npm run preview -- --host 127.0.0.1 --port 4173`

Expected:
- build passes
- map and right panel remain stable
- modal content scrolls internally

- [ ] **Step 5: Commit**

```bash
git add src/styles/encounter.css
git commit -m "style: fix stage select layout sizing"
```

### Task 4: Rename update log and refresh references

**Files:**
- Rename log file to `开发更新日志.md`
- Modify: `README.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `docs/superpowers/specs/2026-04-16-pause-party-auto-damage-and-death-flow-design.md`
- Modify: `docs/superpowers/plans/2026-04-17-damage-source-model.md`
- Modify: `docs/superpowers/plans/2026-04-16-warrior-t-build-registry.md`
- Modify: `docs/superpowers/plans/2026-04-16-pause-party-auto-damage-and-death-flow.md`

- [ ] **Step 1: Write the failing check**

```text
搜索仓库中旧日志文件名，结果应最终为 0。
```

- [ ] **Step 2: Run check to verify it currently fails**

Run: `rg -n "UPDATE_LOG\\.md|UPDATE_LOG" README.md DEVELOPMENT_HANDOFF.md docs`
Expected: finds existing references

- [ ] **Step 3: Write minimal implementation**

Rename the file and update links/text to:

```text
开发更新日志.md
```

- [ ] **Step 4: Run check to verify it passes**

Run: `rg -n "UPDATE_LOG\\.md|UPDATE_LOG" README.md DEVELOPMENT_HANDOFF.md docs`
Expected: no results

- [ ] **Step 5: Commit**

```bash
git add README.md DEVELOPMENT_HANDOFF.md docs 开发更新日志.md
git commit -m "docs: rename update log to chinese title"
```

### Task 5: Final verification

**Files:**
- Modify: none

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- src/ui/stageSelectViewModel.test.ts`
Expected: PASS

- [ ] **Step 2: Run full verification**

Run:
- `npm test`
- `npm run build`
- `npm run lint`

Expected:
- all pass cleanly

- [ ] **Step 3: Open preview for review**

Run:
- `npm run preview -- --host 127.0.0.1 --port 4173`
- open `http://127.0.0.1:4173`

Expected:
- map page is stable
- build rule and conflict buttons behave as designed
