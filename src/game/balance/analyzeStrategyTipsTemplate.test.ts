import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('strategy tips analyzer template', () => {
  it('writes compact story reports without touching designer workbooks', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeStrategyTips.mjs'), 'utf8')

    expect(script).toContain("reports', 'strategy_tips', 'story'")
    expect(script).toContain('第一章策略提示敏感性.md')
    expect(script).toContain('第二章策略提示敏感性.md')
    expect(script).toContain("stageIds: [\"Zul'Aman-1\", \"Zul'Aman-2\", \"Zul'Aman-3\", \"Zul'Aman-4\", \"Zul'Aman-5\", \"Zul'Aman-6\"]")
    expect(script).toContain("arg.startsWith('--area=')")
    expect(script).toContain("arg.startsWith('--stage=')")
    expect(script).toContain("arg.startsWith('--stages=')")
    expect(script).toContain('getRequestedChapters')
    expect(script).not.toContain('writeFileSync(path.join(designerDataDir')
    expect(script).not.toContain('generateDesignerWorkbooks')
  })
})
