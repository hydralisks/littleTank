import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('analyze data estimate template', () => {
  it('writes data estimate reports next to balance reports', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain("const dataEstimateOutputDir = path.join(projectRoot, 'reports', 'data_estimate')")
    expect(script).toContain("const dataEstimateStoryOutputDir = path.join(dataEstimateOutputDir, 'story')")
    expect(script).toContain("const dataEstimateChallengeOutputDir = path.join(dataEstimateOutputDir, 'challenge')")
    expect(script).toContain('writeDataEstimateArtifacts')
    expect(script).toContain('writeChallengeDataEstimateArtifacts')
    expect(script).toContain('writeMonsterCodexDataEstimateArtifact')
    expect(script).toContain('renderDataEstimateMarkdown')
    expect(script).toContain('buildDataEstimateReport')
    expect(script).toContain('怪物图鉴数值估算.md')
  })

  it('generates complete story and challenge data estimate groups', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'analyzeBalance.mjs'), 'utf8')

    expect(script).toContain('writeCompleteDataEstimateArtifacts')
    expect(script).toContain("fileName: '第一章数值估算'")
    expect(script).toContain("stageIds: ['RingingDeeps-1', 'RingingDeeps-2', 'RingingDeeps-3', 'RingingDeeps-4', 'RingingDeeps-5', 'RingingDeeps-6']")
    expect(script).toContain("fileName: '第二章数值估算'")
    expect(script).toContain("stageIds: ['WestFall-1', 'WestFall-2', 'WestFall-3', 'WestFall-4', 'WestFall-5', 'WestFall-6']")
    expect(script).toContain("fileName: '第三章数值估算'")
    expect(script).toContain("stageIds: [\"Zul'Aman-1\", \"Zul'Aman-2\", \"Zul'Aman-3\", \"Zul'Aman-4\", \"Zul'Aman-5\", \"Zul'Aman-6\"]")
    expect(script).toContain("fileName: '挑战模式1~3关数值估算'")
    expect(script).toContain("stageIds: ['Challenge-1', 'Challenge-2', 'Challenge-3']")
    expect(script).toContain("fileName: '挑战模式4~6关数值估算'")
    expect(script).toContain("stageIds: ['Challenge-4', 'Challenge-5', 'Challenge-6']")
  })
})
