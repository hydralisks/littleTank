import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('analyze balance trace template', () => {
  it('supports opt-in compact combat timeline trace output', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain("arg === '--trace'")
    expect(script).toContain("path.join(cliOptions.challenge ? challengeOutputDir : storyOutputDir, 'traces')")
    expect(script).toContain('renderCombatTimelineMarkdown')
    expect(script).toContain('buildCombatTimeline')
    expect(script).toContain('-latest-timeline.md')
    expect(script).toContain('-latest-timeline.json')
    expect(script).toContain('stripCombatLogTraceFromBalanceReport')
    expect(script).toContain('JSON.stringify(serializableReport, null, 2)')
  })
})
