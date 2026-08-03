# Bear Icon And Enemy Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repaint all Bear T icons in the Warrior T block-shape style, remove source emblems and icon-slot backgrounds from UI, and double enemy hover/selection frame weight inward.

**Architecture:** Keep the existing workbook mappings and icon resolver unchanged. Update the Bear-only asset script to read and validate the 53 mappings before overwriting only their SVG files, then simplify React presentation by removing `StatusSourceEmblem` consumers while preserving status semantic frames. Implement enemy emphasis with an inset hover layer and an inward 6px SVG selection ring so layout geometry remains stable.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, JSDOM, SVG, Vite, SheetJS read-only workbook validation.

---

### Task 1: Repaint The 53 Bear T SVG Assets

**Files:**
- Modify: `src/ui/iconAssetCoverage.test.ts`
- Modify: `scripts/applyBearTIconPresentation.mjs`
- Regenerate: `public/skill-icons/bear-skill-*.svg`
- Regenerate: `public/status-icons/bear-talent-*.svg`
- Regenerate: `public/status-icons/bear-status-*.svg`

- [ ] **Step 1: Write the failing asset-style assertions**

Extend the Bear asset loop in `src/ui/iconAssetCoverage.test.ts`:

```ts
const svg = fs.readFileSync(filePath, 'utf8')
expect(svg).toContain('data-icon-style="warrior-block"')
expect(svg).toContain('data-icon-layer="core"')
expect(svg).not.toContain('data-icon-layer="frame"')
expect(svg).not.toContain('data-icon-layer="platform"')
expect(svg).not.toContain('M5 15V5h10')
expect(svg).not.toContain('M8 57h48')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/ui/iconAssetCoverage.test.ts`

Expected: FAIL because current SVG files have no `warrior-block` or `core` markers and still contain corner/platform paths.

- [ ] **Step 3: Convert the generator to read-only mapping validation**

In `scripts/applyBearTIconPresentation.mjs`, remove workbook cell writes and `writeDesignerWorkbookCompact`. Keep the existing 53-row validation and additionally assert each row already has the expected unique asset key:

```js
for (const target of targetRows) {
  const currentAssetKey = String(readCell(target.row, 'assetKey'))
  if (currentAssetKey !== target.assetKey) {
    throw new Error(`Unexpected assetKey for ${target.iconId}: ${currentAssetKey}`)
  }
}
```

- [ ] **Step 4: Generate the Warrior-style block composition**

Make `makeSvg()` emit:

```xml
<svg ... data-icon-canvas="full" data-icon-style="warrior-block">
  <rect x="3" y="3" width="58" height="58" rx="12" fill="url(#bg)"/>
  <g data-icon-layer="core" fill="..." stroke="#091116" stroke-width="4">
    <!-- solid semantic plate plus the icon-specific filled silhouette -->
  </g>
  <g data-icon-layer="highlight" fill="..." stroke="none">
    <!-- at most one highlight shape -->
  </g>
</svg>
```

Do not emit an outer stroke rectangle, internal frame, corner brackets, or bottom platform. Use a small set of filled semantic plates selected by slug so open-path glyphs sit on a strong solid core rather than reading as pure line art.

- [ ] **Step 5: Run the authorized Bear-only generator**

Run: `node scripts/applyBearTIconPresentation.mjs`

Expected: `Generated 53 Bear T warrior-block SVG assets without modifying workbook mappings.`

- [ ] **Step 6: Verify GREEN and commit**

Run: `npm test -- src/ui/iconAssetCoverage.test.ts`

Expected: PASS.

Commit:

```powershell
git add scripts/applyBearTIconPresentation.mjs src/ui/iconAssetCoverage.test.ts public/skill-icons public/status-icons
git commit -m "feat: repaint bear tank icons in block style"
```

### Task 2: Remove Source Emblems And Icon Slot Backgrounds

**Files:**
- Modify: `src/ui/SkillBar.test.ts`
- Modify: `src/ui/PassiveTalentPanel.test.tsx`
- Modify: `src/ui/StatusBadge.test.tsx`
- Modify: `src/ui/skillIconCss.test.ts`
- Modify: `src/ui/tutorialGuide.test.ts`
- Modify: `src/ui/TutorialOverlay.test.tsx`
- Modify: `src/ui/EncounterScreen.test.ts`
- Modify: `src/ui/SkillBar.tsx`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/PassiveTalentPanel.tsx`
- Modify: `src/ui/StatusBadge.tsx`
- Modify: `src/ui/IconGrammarLegend.tsx`
- Modify: `src/ui/tutorialGuide.ts`
- Modify: `src/styles/encounter.css`

- [ ] **Step 1: Write failing component assertions**

Change component tests to require no rendered source emblem while keeping semantic frames and metadata-compatible statuses:

```ts
expect(container.querySelector('[data-status-source]')).toBeNull()
expect(container.querySelector('[data-source-shape]')).toBeNull()
expect(container.querySelector('[data-class-motif]')).toBeNull()
expect(container.querySelector('[data-status-semantic="harmful"]')).not.toBeNull()
```

Update `SkillBar` tests to omit `classId`. Update passive talent tests to keep the image URL assertion but expect no oval shield or bear-claw element.

- [ ] **Step 2: Write failing CSS assertions**

Replace the old rounded-clipping test with rules that require transparent, unframed slots:

```ts
expect(readRule(css, '.skill-icon-box')).toContain('border: 0')
expect(readRule(css, '.skill-icon-box')).toContain('background: transparent')
expect(readRule(css, '.skill-icon-box')).toContain('box-shadow: none')
expect(readRule(css, '.passive-talent-card__icon')).toContain('border: 0')
expect(readRule(css, '.status-square__icon')).toContain('background: transparent')
```

Also assert `.status-square__frame--beneficial`, `--harmful`, and `--party-beneficial` still define their semantic border colors.

- [ ] **Step 3: Write failing tutorial assertions**

Change `getIconGrammarTutorialScript()` expectations to one `status-layers` step. Remove the source-shape fixture from `TutorialOverlay.test.tsx` and update `EncounterScreen.test.ts` to advance one icon-grammar step rather than three.

- [ ] **Step 4: Run focused tests and verify RED**

Run:

```powershell
npm test -- src/ui/SkillBar.test.ts src/ui/PassiveTalentPanel.test.tsx src/ui/StatusBadge.test.tsx src/ui/skillIconCss.test.ts src/ui/tutorialGuide.test.ts src/ui/TutorialOverlay.test.tsx src/ui/EncounterScreen.test.ts
```

Expected: FAIL on existing source emblems, rounded slot backgrounds, and the three-step tutorial.

- [ ] **Step 5: Remove emblem rendering and obsolete props**

- Remove `StatusSourceEmblem` from `SkillBar`, `PassiveTalentPanel`, and `StatusBadge`.
- Remove `classId` from `SkillBarProps` and its `EncounterScreen` call.
- Keep `sourceKind` and `sourceClassId` on status data; do not alter encounter logic.
- Remove `class-emblems` and `source-shapes` payloads and branches from the icon tutorial, leaving the `status-layers` legend.

- [ ] **Step 6: Remove immediate icon-slot decoration**

Set fixed-size wrappers to transparent/unframed while retaining positioning:

```css
.skill-icon-box,
.passive-talent-card__icon {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.status-square__icon {
  border-radius: 0;
  background: transparent;
}
```

Use `clip-path: inset(3px round 12px)` on cooldown/GCD overlays so they follow the SVG background instead of filling transparent corners. Retain `StatusSemanticFrame`, countdown overlays, cooldown timers, and stack badges.

- [ ] **Step 7: Verify GREEN and commit**

Run the focused command from Step 4.

Expected: PASS.

Commit:

```powershell
git add src/ui src/styles/encounter.css
git commit -m "refactor: simplify icon presentation layers"
```

### Task 3: Double Enemy Hover And Selection Frames Inward

**Files:**
- Modify: `src/ui/EnemyRaidFrameItem.test.ts`
- Create: `src/ui/enemyFrameCss.test.ts`
- Modify: `src/ui/EnemyRaidFrameItem.tsx`
- Modify: `src/styles/encounter.css`

- [ ] **Step 1: Write failing SVG geometry assertions**

For a selected enemy, assert both selection rectangles use the 6px-safe inner geometry:

```ts
expect(base?.getAttribute('x')).toBe('3')
expect(base?.getAttribute('y')).toBe('3')
expect(base?.getAttribute('width')).toBe('94')
expect(base?.getAttribute('height')).toBe('94')
expect(dash?.getAttribute('x')).toBe('3')
```

- [ ] **Step 2: Write failing CSS assertions**

Create `src/ui/enemyFrameCss.test.ts` and assert:

```ts
expect(readRule(css, '.enemy-frame')).toContain('--enemy-hover-frame-width: 0px')
expect(readRule(css, '.enemy-frame:hover')).toContain('--enemy-hover-frame-width: 6px')
expect(readRule(css, '.enemy-selection-ring__base,\n.enemy-selection-ring__dash')).toContain('stroke-width: 6')
expect(readRule(css, '.enemy-selection-ring__dash')).toContain('stroke: rgba(255, 255, 255, 0.98)')
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/ui/EnemyRaidFrameItem.test.ts src/ui/enemyFrameCss.test.ts`

Expected: FAIL because the current SVG uses `1.5/97` geometry and 3px strokes.

- [ ] **Step 4: Implement inward hover and selection frames**

- Add an `::before` inset hover layer driven by `--enemy-hover-frame-width` so the 6px orange frame does not change layout.
- Set selection SVG to `inset: 0; width: 100%; height: 100%`.
- Change both selection strokes to 6px.
- Use threat accent on the base and white on the animated dash.
- Update rect geometry to `x="3" y="3" width="94" height="94"`.
- Increase enemy title horizontal padding and cast-track padding to 12px so text clears the new inner frame without changing font size.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- src/ui/EnemyRaidFrameItem.test.ts src/ui/enemyFrameCss.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/ui/EnemyRaidFrameItem.tsx src/ui/EnemyRaidFrameItem.test.ts src/ui/enemyFrameCss.test.ts src/styles/encounter.css
git commit -m "style: strengthen enemy target frames"
```

### Task 4: Full Verification And Visual Review

**Files:**
- No production file changes expected unless visual review exposes a concrete defect.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
npm test
npm run lint
npm run build
npm run validate:designer-data
git diff --check
```

Expected: all commands exit 0; designer data reports zero warnings.

- [ ] **Step 2: Verify every Bear SVG decodes**

Use Edge automation to load all 53 mapped SVG URLs from the local Vite server and assert every image has non-zero `naturalWidth` and `naturalHeight`.

- [ ] **Step 3: Review desktop presentation**

At `http://localhost:54099/`, seed the local demo save with all current stages and classes unlocked, enter a Bear T encounter, and capture:

- combat skill bar;
- passive talent panel;
- player/enemy status icons;
- enemy frame normal, hovered, selected, and casting states.

Verify no source emblems or slot backgrounds remain, semantic frames remain readable, and 6px enemy frames do not cover text.

- [ ] **Step 4: Review narrow viewport**

Repeat at 390x844 and verify no new horizontal overflow, clipped labels, or incoherent overlap caused by these changes.

- [ ] **Step 5: Request code review and complete**

Run an independent read-only review against the design specification, fix any Critical or Important findings, then rerun the full verification commands before reporting completion.
