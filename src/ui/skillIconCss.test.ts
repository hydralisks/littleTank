import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

function readRule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('icon slot presentation CSS', () => {
  it.each([
    '.skill-icon-box',
    '.passive-talent-card__icon',
  ])('keeps %s transparent and unframed', (selector) => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')
    const rule = readRule(css, selector)

    expect(rule).toContain('border: 0')
    expect(rule).toContain('border-radius: 0')
    expect(rule).toContain('background: transparent')
    expect(rule).toContain('box-shadow: none')
    expect(rule).toContain('overflow: visible')
  })

  it('removes the status icon background while retaining semantic frames', () => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')

    expect(readRule(css, '.status-square')).toContain('border-radius: 0')
    expect(readRule(css, '.status-square__icon')).toContain('border-radius: 0')
    expect(readRule(css, '.status-square__icon')).toContain('background: transparent')
    expect(readRule(css, '.status-square__frame--beneficial')).toContain('border-color: #59e1a1')
    expect(readRule(css, '.status-square__frame--harmful')).toContain('border-color: #ff6d7f')
    expect(readRule(css, '.status-square__frame--party-beneficial')).toContain('border-color: #f4c95e')
  })

  it.each(['.skill-icon-cooldown', '.skill-icon-gcd'])('clips %s to the icon artwork', (selector) => {
    const css = fs.readFileSync('src/styles/encounter.css', 'utf8')

    expect(readRule(css, selector)).toContain('clip-path: inset(3px round 12px)')
  })
})
