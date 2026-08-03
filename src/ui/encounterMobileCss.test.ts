import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

function readRule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

function readMobileRules(css: string) {
  const start = css.indexOf('@media (max-width: 760px)')
  const end = css.indexOf('@media (max-width: 680px)', start)
  return start >= 0 ? css.slice(start, end >= 0 ? end : undefined) : ''
}

describe('encounter mobile CSS', () => {
  it('uses a scrollable viewport-height battle surface instead of the desktop aspect ratio', () => {
    const mobileCss = readMobileRules(fs.readFileSync('src/styles/encounter.css', 'utf8'))
    const stageRule = readRule(mobileCss, '.encounter-stage')

    expect(stageRule).toContain('aspect-ratio: auto')
    expect(stageRule).toContain('height: calc(100vh - 16px)')
    expect(stageRule).toContain('overflow-y: auto')
    expect(readRule(mobileCss, '.encounter-top-row')).toContain('grid-template-columns: minmax(0, 1fr)')
  })

  it('keeps the fixed-format enemy board readable through internal scrolling', () => {
    const mobileCss = readMobileRules(fs.readFileSync('src/styles/encounter.css', 'utf8'))

    expect(readRule(mobileCss, '.enemy-panel')).toContain('overflow-x: auto')
    expect(readRule(mobileCss, '.enemy-list')).toContain('min-width: 760px')
    expect(readRule(mobileCss, '.enemy-list')).toContain('min-height: 360px')
  })

  it('keeps skill cards and artwork from overlapping on narrow screens', () => {
    const mobileCss = readMobileRules(fs.readFileSync('src/styles/encounter.css', 'utf8'))

    expect(readRule(mobileCss, '.skill-panel')).toContain('overflow-x: auto')
    expect(readRule(mobileCss, '.skill-grid')).toContain('width: max-content')
    expect(readRule(mobileCss, '.skill-card')).toContain('flex: 0 0 160px')
    expect(readRule(mobileCss, '.skill-card')).toContain('grid-template-columns: minmax(0, 1fr) 56px')
    expect(readRule(mobileCss, '.skill-icon-box')).toContain('width: 56px')
    expect(readRule(mobileCss, '.skill-icon-box')).toContain('height: 56px')
  })
})
