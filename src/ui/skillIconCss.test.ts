import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

function readRule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('skill icon clipping CSS', () => {
  it.each([
    '.skill-icon-image',
    '.skill-icon-cooldown',
    '.skill-icon-gcd',
  ])('keeps %s inside the icon box rounded rectangle', (selector) => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')

    expect(readRule(css, selector)).toContain('border-radius: inherit')
  })
})
