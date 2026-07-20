import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('analyze balance fast mode template', () => {
  it('supports fast iteration options and writes report diffs', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain("arg === '--quick'")
    expect(script).toContain("arg.startsWith('--budget=')")
    expect(script).toContain("arg.startsWith('--stage=')")
    expect(script).toContain('renderBalanceReportDiffMarkdown')
    expect(script).toContain('-变更对比.md')
  })
})
