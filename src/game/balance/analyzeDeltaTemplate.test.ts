import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('analyze delta CLI template', () => {
  const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeDelta.mjs'), 'utf8')

  it('loads campaign and challenge workbooks into the same analysis catalogs', () => {
    expect(script).toContain("readWorkbook('challenge_stage_content.xlsx')")
    expect(script).toContain("readWorkbook('challenge_encounter_balance.xlsx')")
    expect(script).toContain('applyStageWorkbookOverrides(challengeStageWorkbook)')
    expect(script).toContain('appendEncounterWorkbookOverrides')
  })

  it('supports active analysis and isolated safe report slugs', () => {
    expect(script).toContain("type === 'passive' || type === 'active' || type === 'build'")
    expect(script).toContain("arg.startsWith('--output=')")
    expect(script).toContain('/^[a-z0-9][a-z0-9-]*$/')
    expect(script).toContain('delta-${options.classId}-${options.outputSlug}-${options.type}')
  })

  it('labels the low-error delta profile as expert simulation', () => {
    expect(script).toContain("id: 'delta-expert-220ms-low-error'")
    expect(script).toContain("tier: 'expert'")
  })
})
