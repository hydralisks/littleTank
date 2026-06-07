import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('analyze balance report template', () => {
  it('keeps auto scoring markdown focused on difficulty verdicts and scoring references', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).not.toContain("import { renderDiagnosticScenarioSummariesMarkdown }")
    expect(script).not.toContain('内部诊断候选 action')
    expect(script).not.toContain('renderDiagnosticScenarioSummariesMarkdown(')
  })

  it('writes root chapter auto-scoring reports with stable Chinese filenames', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain('第一章自动评分.md')
    expect(script).toContain('第二章自动评分.md')
    expect(script).toContain("reportSlug === 'westfall'")
  })

  it('shows learning path scoring without exposing internal diagnostics', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain('学习路径评分标准')
    expect(script).toContain('formatLearningPathCell')
    expect(script).toContain('hidden_solution')
  })
})
