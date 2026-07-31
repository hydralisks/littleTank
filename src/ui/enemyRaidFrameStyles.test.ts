import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('enemy raid frame styles', () => {
  it('attaches the unselected inner threat border to the original border', () => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')
    const rule = css.match(/\.enemy-frame\.is-unselected::after\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(rule).toContain('inset: 0;')
    expect(rule).toContain('box-shadow: inset 0 0 0 3px var(--frame-accent);')
  })
})
