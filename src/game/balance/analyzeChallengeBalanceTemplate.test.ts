import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('analyze challenge balance template', () => {
  it('loads challenge workbook data and writes grouped challenge reports under the challenge balance folder', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain("arg === '--challenge'")
    expect(script).toContain("readWorkbook('challenge_stage_content.xlsx')")
    expect(script).toContain("readWorkbook('challenge_encounter_balance.xlsx')")
    expect(script).not.toContain("readWorkbook('challenge.xlsx')")
    expect(script).toContain("const storyOutputDir = path.join(outputDir, 'story')")
    expect(script).toContain("const challengeOutputDir = path.join(outputDir, 'challenge')")
    expect(script).toContain('CHALLENGE_REPORT_GROUP_SIZE = 3')
    expect(script).toContain('第${firstStageNumber}~${lastStageNumber}关自动评分.md')
    expect(script).toContain('writeChallengeReportArtifacts')
    expect(script).not.toContain('getChallengeUnlockedActiveSkillIds(row)')
    expect(script).not.toContain('getChallengePassiveTalentUnlockTier(row)')
    expect(script).toContain('sourceStageIdsCsv')
    expect(script).toContain('recommendedActiveSkillNamesCsv')
    expect(script).toContain('recommendedPassiveTalentNamesCsv')
    expect(script).toContain('challenge_recommended')
    expect(script).toContain('filterRequestedChallengeEntries')
    expect(script).not.toContain('unlockedActiveSkillIds: [],')
    expect(script).not.toContain('挑战模式自动评测1.md')
    expect(script).not.toContain('挑战模式自动评测2.md')
    expect(script).not.toContain('挑战模式自动评测3.md')
  })
})
