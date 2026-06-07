import { describe, expect, it } from 'vitest'
import {
  RINGING_DEEPS_MANUAL_BASELINES,
  WESTFALL_MANUAL_BASELINES,
  getManualDifficultyBaseline,
  renderBalanceReportMarkdown,
  type BalanceReport,
} from './balanceReport'

describe('balance report rendering', () => {
  it('uses the current RingingDeeps manual difficulty baselines', () => {
    expect(RINGING_DEEPS_MANUAL_BASELINES['RingingDeeps-1']).toBe('easy')
    expect(RINGING_DEEPS_MANUAL_BASELINES['RingingDeeps-2']).toBe('easy')
    expect(RINGING_DEEPS_MANUAL_BASELINES['RingingDeeps-3']).toBe('hard')
    expect(RINGING_DEEPS_MANUAL_BASELINES['RingingDeeps-4']).toBe('hard')
    expect(RINGING_DEEPS_MANUAL_BASELINES['RingingDeeps-5']).toBe('balanced')
    expect(RINGING_DEEPS_MANUAL_BASELINES['RingingDeeps-6']).toBe('expert')
  })

  it('uses the current WestFall manual difficulty baselines', () => {
    expect(WESTFALL_MANUAL_BASELINES['WestFall-1']).toBe('easy')
    expect(WESTFALL_MANUAL_BASELINES['WestFall-2']).toBe('balanced')
    expect(WESTFALL_MANUAL_BASELINES['WestFall-3']).toBe('balanced')
    expect(WESTFALL_MANUAL_BASELINES['WestFall-4']).toBe('hard')
    expect(WESTFALL_MANUAL_BASELINES['WestFall-5']).toBe('balanced')
    expect(WESTFALL_MANUAL_BASELINES['WestFall-6']).toBe('hard')
    expect(getManualDifficultyBaseline('WestFall-1')).toBe('easy')
    expect(getManualDifficultyBaseline('WestFall-4')).toBe('hard')
    expect(getManualDifficultyBaseline('WestFall-5')).toBe('balanced')
    expect(getManualDifficultyBaseline('WestFall-6')).toBe('hard')
  })

  it('renders best-build summaries without weak-build wording', () => {
    const report: BalanceReport = {
      generatedAt: '2026-05-21T00:00:00.000Z',
      stages: [
        {
          stageId: 'RingingDeeps-1',
          title: 'RD1',
          manualLabel: 'hard',
          automatedLabel: 'balanced',
          scoringMode: 'best_build_per_profile',
          testedBuildCount: 3,
          bestBuildsByProfile: [
            {
              profileId: 'average-250ms-10pct',
              profileTier: 'average',
              buildId: 'default',
              attempts: 10,
              victories: 6,
              passRate: 0.6,
              loadout: {
                '1': 'warrior_t_taunt',
                '2': 'warrior_t_shield_slam',
                '3': null,
                '4': null,
                Q: null,
                E: null,
                R: null,
                F: null,
              },
              passiveTalentIds: ['talent_a', 'talent_b'],
            },
            {
              profileId: 'expert-80ms-1pct',
              profileTier: 'expert',
              buildId: 'defensive',
              attempts: 10,
              victories: 9,
              passRate: 0.9,
              loadout: {
                '1': null,
                '2': null,
                '3': null,
                '4': null,
                Q: null,
                E: null,
                R: null,
                F: null,
              },
              passiveTalentIds: [],
            },
          ],
          ratingReasons: [
            'average best pass rate: 60%',
            'skilled best pass rate: 80%',
            'expert best pass rate: 90%',
          ],
          scenarios: [
            {
              stageId: 'RingingDeeps-1',
              profileId: 'average-250ms-10pct',
              profileTier: 'average',
              buildId: 'default',
              attempts: 10,
              victories: 6,
              passRate: 0.6,
            },
          ],
          recommendation: 'Manual baseline is harder than automated smoke sample; inspect operation profile coverage.',
        },
      ],
    }

    const markdown = renderBalanceReportMarkdown(report)

    expect(markdown).toContain('人工基线：`hard`')
    expect(markdown).toContain('自动标签：`balanced`')
    expect(markdown).toContain('评分模式：`best_build_per_profile`')
    expect(markdown).toContain('测试 build 数：3')
    expect(markdown).toContain('| Profile | 档位 | Build | 通关 | 通过率 | 主动配置 | 被动天赋 |')
    expect(markdown).toContain(
      '| `average-250ms-10pct` | `average` | `default` | 6/10 | 60% | 1=warrior_t_taunt, 2=warrior_t_shield_slam | talent_a, talent_b |',
    )
    expect(markdown).toContain('| `expert-80ms-1pct` | `expert` | `defensive` | 9/10 | 90% | 空 | 无 |')
    expect(markdown).toContain('average 最佳通过率：60%')
    expect(markdown).not.toMatch(/weak build|average build/i)
    expect(markdown).not.toMatch(/hp ratio|pressure ratio/i)
  })

  it('renders half-best build counts in the stage summary', () => {
    const report: BalanceReport = {
      generatedAt: '2026-05-21T00:00:00.000Z',
      stages: [
        {
          stageId: 'RingingDeeps-1',
          title: 'RD1',
          manualLabel: 'easy',
          automatedLabel: 'easy',
          scoringMode: 'best_build_per_profile',
          testedBuildCount: 2,
          bestBuildsByProfile: [],
          ratingReasons: ['half-best build count: 3 at threshold 50%'],
          scenarios: [],
          recommendation: 'ok',
        },
      ],
    }

    const markdown = renderBalanceReportMarkdown(report)

    expect(markdown).toContain('半最优 build 数量：3')
  })
})
