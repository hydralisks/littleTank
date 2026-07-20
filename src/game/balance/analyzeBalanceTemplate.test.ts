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

  it('writes chapter auto-scoring reports under reports balance with stable Chinese filenames', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain('第一章自动评分.md')
    expect(script).toContain('第一章自动评分.json')
    expect(script).toContain('第二章自动评分.md')
    expect(script).toContain('第二章自动评分.json')
    expect(script).toContain('第三章自动评分.md')
    expect(script).toContain('第三章自动评分.json')
    expect(script).toContain("reportSlug === 'westfall'")
    expect(script).toContain("reportSlug === \"zul'aman\"")
    expect(script).not.toContain('getRootChapterReportFileName')
  })

  it('keeps report titles and leading summary in Chinese for planning review', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain("title: '第一章自动评分'")
    expect(script).toContain("title: '第二章自动评分'")
    expect(script).toContain("title: '第三章自动评分'")
    expect(script).toContain('## 总结')
    expect(script).toContain('formatStageSummaryConclusion')
  })

  it('shows learning path scoring without exposing internal diagnostics', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain('学习路径评分标准')
    expect(script).toContain('formatLearningPathCell')
    expect(script).toContain('hidden_solution')
  })
  it('prepends strategy-tip build candidates before fixed AI candidates for learning', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain('generateStrategyTipBuildCandidates')
    expect(script).toContain('const strategyTipBuildCandidates = generateStrategyTipBuildCandidates(stage')
    expect(script).toContain('strategyTipBuildCandidates,')
    expect(script.indexOf('strategyTipBuildCandidates,')).toBeLessThan(script.indexOf('fixedBuildCandidates,'))
  })

  it('includes per-stage enemy balance advice in chapter reports', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain('renderStageEnemyBalanceAdvice')
    expect(script).toContain('## 每关敌人数值建议')
    expect(script).toContain('| 关卡 | 敌人建议 |')
  })
})
