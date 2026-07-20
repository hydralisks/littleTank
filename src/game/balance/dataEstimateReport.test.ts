import { describe, expect, it } from 'vitest'
import {
  buildDataEstimateReport,
  renderDataEstimateMarkdown,
} from './dataEstimateReport'

describe('data estimate report', () => {
  it('renders stage summary and build/profile estimate rows', () => {
    const report = buildDataEstimateReport({
      generatedAt: '2026-06-26T00:00:00.000Z',
      title: '第一章基础数值统计',
      stages: [
        {
          stageId: 'RingingDeeps-1',
          title: '测试关',
          fixedAnalysis: {
            scenarios: [
              {
                stageId: 'RingingDeeps-1',
                profileId: 'average',
                profileTier: 'average',
                buildId: 'default',
                attempts: 2,
                victories: 1,
                passRate: 0.5,
                dataEstimate: {
                  attempts: 2,
                  averageDurationSec: 30,
                  playerResourcePerSec: 4,
                  tankDamageTakenPerSec: 8,
                  healingAndAbsorbPerSec: 3,
                  playerSideDamagePerSec: 12,
                  partyPressurePerSec: 1,
                },
              },
            ],
          },
          learningAnalysis: {
            finalAnalysis: {
              scenarios: [
                {
                  stageId: 'RingingDeeps-1',
                  profileId: 'learning',
                  profileTier: 'average',
                  buildId: 'learned',
                  attempts: 2,
                  victories: 2,
                  passRate: 1,
                  dataEstimate: {
                    attempts: 2,
                    averageDurationSec: 20,
                    playerResourcePerSec: 5,
                    tankDamageTakenPerSec: 6,
                    healingAndAbsorbPerSec: 4,
                    playerSideDamagePerSec: 16,
                    partyPressurePerSec: 0.5,
                  },
                },
              ],
            },
          },
        },
      ],
    })

    expect(report.stages[0].summary).toMatchObject({
      stageId: 'RingingDeeps-1',
      playerResourcePerSec: 5,
      tankDamageTakenPerSec: 6,
      healingAndAbsorbPerSec: 4,
      playerSideDamagePerSec: 16,
    })

    const markdown = renderDataEstimateMarkdown(report)
    expect(markdown).toContain('# 第一章基础数值统计')
    expect(markdown).toContain('资源/秒')
    expect(markdown).toContain('承伤/秒')
    expect(markdown).toContain('治疗吸收/秒')
    expect(markdown).toContain('造成伤害/秒')
    expect(markdown).toContain('`fixed`')
    expect(markdown).toContain('`learning`')
  })
})
