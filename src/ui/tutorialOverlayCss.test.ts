import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('TutorialOverlay responsive CSS', () => {
  it('includes padding and border inside the mobile-safe card width', () => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')
    const cardRule = css.match(/\.tutorial-overlay__card\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(cardRule).toContain('box-sizing: border-box')
  })
})
