import { describe, expect, it } from 'vitest'
import {
  classifyStrategyTipSignals,
  filterViolatedBuildCandidates,
  formatPassRateDrop,
  summarizeStrategyTipDependency,
} from './strategyTipsSensitivity'
import type { SkillLoadout } from '../encounter/encounterTypes'
import type { BalanceBuildVariant } from './balanceSimulator'

function createLoadout(overrides: Partial<SkillLoadout>): SkillLoadout {
  return {
    '1': null,
    '2': null,
    '3': null,
    '4': null,
    Q: null,
    E: null,
    R: null,
    F: null,
    ...overrides,
  }
}

describe('strategy tips sensitivity', () => {
  it('classifies passive-heavy, reflect, and priority-kill tips', () => {
    expect(classifyStrategyTipSignals('注意配合使用新解锁的tier 2强力天赋，不适合当前关卡的主动技能也可以放弃掉')).toContain('passive_heavy')
    expect(classifyStrategyTipSignals('卡好gcd时间反弹“鱼人闪电术”，怒气保持“无视苦痛”覆盖')).toEqual(expect.arrayContaining(['spell_reflect', 'resource_absorb_uptime']))
    expect(classifyStrategyTipSignals('优先击杀初始dps更高的敌人')).toContain('priority_kill')
  })

  it('filters tip-aligned builds in violated mode without returning an empty candidate list', () => {
    const candidates: BalanceBuildVariant[] = [
      { id: 'passive', build: { loadout: createLoadout({ '1': 'warrior_t_shield_block' }), passiveTalentIds: ['a', 'b', 'c', 'd'] } },
      { id: 'active', build: { loadout: createLoadout({ '1': 'warrior_t_shield_wall', '2': 'warrior_t_shield_reflection' }), passiveTalentIds: [] } },
      { id: 'plain', build: { loadout: createLoadout({ '1': 'warrior_t_revenge' }), passiveTalentIds: [] } },
    ]

    expect(filterViolatedBuildCandidates(candidates, ['passive_heavy', 'spell_reflect']).map((candidate) => candidate.id)).toEqual(['plain'])
    expect(filterViolatedBuildCandidates([candidates[0]], ['passive_heavy']).map((candidate) => candidate.id)).toEqual(['passive'])
  })

  it('labels dependency from ignored-mode pass-rate drop', () => {
    expect(summarizeStrategyTipDependency(0.7, 0.64).label).toBe('low')
    expect(summarizeStrategyTipDependency(0.7, 0.5).label).toBe('medium')
    expect(summarizeStrategyTipDependency(0.7, 0.3).label).toBe('high')
    expect(summarizeStrategyTipDependency(0.7, 0.02).label).toBe('critical')
    expect(formatPassRateDrop(0.59, 0.31)).toBe('28pp / 47%')
  })
})
