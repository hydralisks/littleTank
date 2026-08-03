import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

function readRule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
  return matches.at(-1)?.[1] ?? ''
}

describe('enemy target frame CSS', () => {
  it('draws the hover frame inward at double weight without changing layout', () => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')

    expect(readRule(css, '.enemy-frame')).toContain('--enemy-hover-frame-width: 0px')
    expect(readRule(css, '.enemy-frame::before')).toContain('inset: 0')
    expect(readRule(css, '.enemy-frame::before')).toContain('inset 0 0 0 var(--enemy-hover-frame-width)')
    expect(readRule(css, '.enemy-frame::before')).toContain('z-index: 3')
    expect(readRule(css, '.enemy-frame:hover')).toContain('--enemy-hover-frame-width: 6px')
    expect(readRule(css, '.enemy-frame:hover')).not.toContain('border-color')
    expect(readRule(css, '.enemy-frame.is-unselected::after')).toContain('z-index: 2')
  })

  it('uses pixel-sized 6px layers for selected targets on non-square frames', () => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')

    expect(readRule(css, '.enemy-selection-ring')).toContain('inset: 0')
    expect(readRule(css, '.enemy-selection-ring')).toContain('width: 100%')
    expect(readRule(css, '.enemy-selection-ring')).toContain('height: 100%')
    expect(readRule(css, '.enemy-selection-ring')).toContain('z-index: 4')
    expect(readRule(css, '.enemy-selection-ring__base,\n.enemy-selection-ring__dash')).toContain('inset: 0')
    expect(readRule(css, '.enemy-selection-ring__base,\n.enemy-selection-ring__dash')).toContain('box-sizing: border-box')
    expect(readRule(css, '.enemy-selection-ring__base')).toContain('border: 6px solid var(--frame-accent)')
    expect(readRule(css, '.enemy-selection-ring__dash')).toContain('background-size: 30px 6px, 6px 30px, 30px 6px, 6px 30px')
    expect(readRule(css, '.enemy-selection-ring__dash')).toContain('animation: target-dash-flow 1.1s linear infinite')
  })

  it('keeps enemy text clear of the thicker inner frames', () => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')

    expect(readRule(css, '.enemy-frame')).toContain('padding: 8px 12px 28px')
    expect(readRule(css, '.enemy-cast-track')).toContain('padding: 0 12px')
  })
})
