import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import XLSX from 'xlsx'
import { writeChallengeWorkbooks } from './generateChallengeWorkbook.mjs'

describe('generate challenge workbook template', () => {
  it('exports the challenge workbook generator with encounter-style sheets', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'generateChallengeWorkbook.mjs'), 'utf8')

    expect(script).toContain('challenge_stage_content.xlsx')
    expect(script).toContain('challenge_encounter_balance.xlsx')
    expect(script).not.toContain('const outputPath')
    expect(script).toContain('area:')
    expect(script).toContain('stage:')
    expect(script).toContain('legend:')
    expect(script).toContain('opening:')
    expect(script).toContain('placements:')
    expect(script).toContain('openingStatuses:')
    expect(script).toContain('affixBindings:')
    expect(script).toContain('specialRuleBindings:')
  })

  it('writes split stage-content and encounter-balance workbooks', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'little-tank-challenge-workbooks-'))
    const stagePath = path.join(tempRoot, 'challenge_stage_content.xlsx')
    const encounterPath = path.join(tempRoot, 'challenge_encounter_balance.xlsx')

    writeChallengeWorkbooks({ stagePath, encounterPath })

    const stageWorkbook = XLSX.readFile(stagePath)
    const encounterWorkbook = XLSX.readFile(encounterPath)

    expect(stageWorkbook.SheetNames).toEqual(['区域', '关卡', '图例'])
    expect(encounterWorkbook.SheetNames).toEqual([
      '关卡开场',
      '敌人布置',
      '开场状态',
      '关卡词缀绑定',
      '词缀定义',
      '伤害来源定义',
      '关卡伤害来源绑定',
      '特殊规则绑定',
      '特殊规则定义',
    ])
  })
})
