import { describe, expect, it } from 'vitest'
import type { StageInfo } from '../game/data/stageTemplates'
import {
  getEncounterTutorialScript,
  getMonsterCodexTutorialScript,
  getStageSelectTutorialScript,
  isRingingDeepsTutorialStage,
} from './tutorialGuide'

function makeStage(id: string, areaId: string, stageNumber: StageInfo['stageNumber']): StageInfo {
  return {
    id,
    areaId,
    areaTitle: areaId,
    stageNumber,
    title: id,
    subtitle: '',
    affixes: [],
    rules: [],
    legend: [],
    unlockedActiveSkillIds: [],
  }
}

describe('tutorialGuide', () => {
  it('recognizes only RingingDeeps stages 1-4 as tutorial stages', () => {
    expect(isRingingDeepsTutorialStage(makeStage('RingingDeeps-1', 'RingingDeeps', 1))).toBe(true)
    expect(isRingingDeepsTutorialStage(makeStage('RingingDeeps-4', 'RingingDeeps', 4))).toBe(true)
    expect(isRingingDeepsTutorialStage(makeStage('RingingDeeps-5', 'RingingDeeps', 5))).toBe(false)
    expect(isRingingDeepsTutorialStage(makeStage('harbor-1', 'harbor', 1))).toBe(false)
  })

  it('returns combat tutorial steps for RingingDeeps 1 with concrete UI targets', () => {
    const script = getEncounterTutorialScript(makeStage('RingingDeeps-1', 'RingingDeeps', 1))

    expect(script?.map((step) => step.target)).toEqual([
      '[data-tutorial-id="enemy-frames"]',
      '[data-tutorial-id="skill-bar"]',
      '[data-tutorial-id="enemy-cast-and-threat"]',
      '[data-tutorial-id="team-status"]',
    ])
    expect(script?.[0]?.id).toBe('rd1-target-selection')
    expect(script?.[1]?.body).toContain('自动攻击')
    expect(script?.[3]?.body).toContain('击败全部敌人')
  })

  it('explains threat as the tank priority in RingingDeeps 1 skill tutorial', () => {
    const script = getEncounterTutorialScript(makeStage('RingingDeeps-1', 'RingingDeeps', 1))

    expect(script?.[1]?.body).toContain('拉好仇恨')
    expect(script?.[1]?.body).toContain('仇恨值')
    expect(script?.[1]?.body).not.toContain('压力')
  })

  it('covers RingingDeeps 1, WestFall 1, and ZulAman 1 healing tutorials', () => {
    expect(getEncounterTutorialScript(makeStage('RingingDeeps-1', 'RingingDeeps', 1))?.[1]?.body).toContain('自动攻击')
    expect(getEncounterTutorialScript(makeStage('WestFall-1', 'WestFall', 1))?.[0]?.body).toContain('每秒自动受到治疗')
    expect(getEncounterTutorialScript(makeStage('Zul\'Aman-1', "Zul'Aman", 1))?.[0]?.body).toContain('队伍每秒受到治疗')
  })

  it('explains that party healing reduces pressure by the same amount in ZulAman 1', () => {
    const script = getEncounterTutorialScript(makeStage('Zul\'Aman-1', "Zul'Aman", 1))

    expect(script?.[0]?.body).toContain('压力')
    expect(script?.[0]?.body).toContain('等量下降')
  })

  it('splits build and combat tutorials across RingingDeeps 2-4', () => {
    const stage2 = makeStage('RingingDeeps-2', 'RingingDeeps', 2)
    const stage3 = makeStage('RingingDeeps-3', 'RingingDeeps', 3)
    const stage4 = makeStage('RingingDeeps-4', 'RingingDeeps', 4)

    expect(getStageSelectTutorialScript(stage2)?.map((step) => step.target)).toEqual([
      '[data-tutorial-id="stage-build-menu"]',
      '[data-tutorial-id="stage-skill-config-button"]',
      '[data-tutorial-id="skill-config-slots"]',
      '[data-tutorial-id="skill-library"]',
    ])
    expect(getEncounterTutorialScript(stage2)?.map((step) => step.target)).toEqual([
      '[data-tutorial-id="enemy-cast-and-threat"]',
      '[data-tutorial-id="skill-bar"]',
    ])

    expect(getEncounterTutorialScript(stage3)?.map((step) => step.target)).toEqual([
      '[data-tutorial-id="enemy-cast-and-threat"]',
      '[data-tutorial-id="skill-bar"]',
      '[data-tutorial-id="enemy-cast-and-threat"]',
    ])
    expect(getEncounterTutorialScript(stage3)?.[2]?.body).toContain('引导施法')

    expect(getStageSelectTutorialScript(stage4)?.map((step) => step.target)).toEqual([
      '[data-tutorial-id="stage-build-menu"]',
      '[data-tutorial-id="stage-passive-config-button"]',
      '[data-tutorial-id="build-points-summary"]',
      '[data-tutorial-id="passive-talent-list"]',
    ])
    expect(getStageSelectTutorialScript(stage4)?.[2]?.body).toContain('共用同一池技能点')
  })

  it('marks build panel steps that should be opened before focusing nested controls', () => {
    const stage2Script = getStageSelectTutorialScript(makeStage('RingingDeeps-2', 'RingingDeeps', 2))
    const stage4Script = getStageSelectTutorialScript(makeStage('RingingDeeps-4', 'RingingDeeps', 4))

    expect(stage2Script?.[2]?.openPanel).toBe('skills')
    expect(stage2Script?.[3]?.openPanel).toBe('skills')
    expect(stage4Script?.[2]?.openPanel).toBe('passives')
    expect(stage4Script?.[3]?.openPanel).toBe('passives')
  })

  it('introduces the monster codex after RingingDeeps 2 is cleared', () => {
    const script = getMonsterCodexTutorialScript()

    expect(script.map((step) => step.target)).toEqual([
      '[data-tutorial-id="monster-codex-button"]',
    ])
    expect(script[0].body).toContain('仇恨逻辑')
    expect(script[0].body).toContain('输出循环')
    expect(script[0].body).toContain('技能伤害')
  })

  it('returns null for unsupported stages and contexts', () => {
    expect(getStageSelectTutorialScript(makeStage('RingingDeeps-1', 'RingingDeeps', 1))).toBeNull()
    expect(getEncounterTutorialScript(makeStage('RingingDeeps-4', 'RingingDeeps', 4))).toBeNull()
    expect(getStageSelectTutorialScript(makeStage('harbor-2', 'harbor', 2))).toBeNull()
    expect(getEncounterTutorialScript(makeStage('harbor-1', 'harbor', 1))).toBeNull()
  })
})
