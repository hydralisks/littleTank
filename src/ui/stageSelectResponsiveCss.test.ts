import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('stage select responsive layout', () => {
  it('lets the stage selector grow and scroll below desktop width', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles', 'encounter.css'), 'utf8')

    expect(css).toMatch(
      /@media \(max-width: 1280px\)[\s\S]*?\.encounter-shell:has\(\.stage-select\)\s*{[^}]*align-items:\s*flex-start;/,
    )
    expect(css).toMatch(
      /@media \(max-width: 1280px\)[\s\S]*?\.stage-select\s*{[^}]*aspect-ratio:\s*auto;[^}]*grid-template-rows:\s*auto auto;/,
    )
    expect(css).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.stage-select__layout\s*{[^}]*row-gap:\s*296px;/,
    )
    expect(css).toMatch(
      /\.stage-map-column\s*>\s*\.stage-class-entry\s*{[^}]*bottom:\s*-36px;/,
    )
    expect(css).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.stage-map-column\s*>\s*\.stage-class-entry\s*{[^}]*bottom:\s*-266px;/,
    )
  })
})
