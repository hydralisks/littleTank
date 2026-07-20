import { describe, expect, it } from 'vitest'
import { buildMonsterCodexEstimateReport, renderMonsterCodexEstimateMarkdown } from './monsterCodexEstimateReport'

describe('monster codex estimate report', () => {
  it('aggregates enemy template metrics across stages', () => {
    const report = buildMonsterCodexEstimateReport({
      generatedAt: '2026-07-10T00:00:00.000Z',
      title: '\u602a\u7269\u56fe\u9274\u6570\u503c\u4f30\u7b97',
      templates: [
        {
          stageId: 'S-1',
          title: 'Stage One',
          enemies: [
            {
              enemyId: 'wolf',
              name: 'Wolf',
              maxHp: 100,
              threatLogic: 'normal',
              isSkull: false,
              skills: [
                {
                  skillId: 'bite',
                  skillName: 'Bite',
                  targetRuleId: 'threatTarget',
                  castTimeMs: 1000,
                  channelingMs: 0,
                  recoveryMs: 1000,
                  damageType: 'physical',
                  playerDamage: 10,
                  partyDamageOnHit: 0,
                  partyDamageOnMiss: 0,
                  pressureOnHit: 0,
                  pressureOnMiss: 0,
                  appliedTargetStatusIds: ['bleed'],
                  appliedSelfStatusIds: [],
                  castBreakRule: 'controlOnly',
                  dangerLevel: 'low',
                },
                {
                  skillId: 'howl',
                  skillName: 'Howl',
                  targetRuleId: 'party',
                  castTimeMs: 2000,
                  channelingMs: 0,
                  recoveryMs: 0,
                  damageType: 'physical',
                  playerDamage: 0,
                  partyDamageOnHit: 4,
                  partyDamageOnMiss: 1,
                  pressureOnHit: 3,
                  pressureOnMiss: 1,
                  appliedTargetStatusIds: [],
                  appliedSelfStatusIds: ['rage'],
                  castBreakRule: 'interruptOrControl',
                  dangerLevel: 'medium',
                },
              ],
              skillCycle: ['bite', 'howl'],
            },
          ],
        },
        {
          stageId: 'S-2',
          title: 'Stage Two',
          enemies: [
            {
              enemyId: 'wolf',
              name: 'Wolf',
              maxHp: 120,
              threatLogic: 'normal',
              isSkull: false,
              skills: [
                {
                  skillId: 'bite',
                  skillName: 'Bite',
                  targetRuleId: 'threatTarget',
                  castTimeMs: 1000,
                  channelingMs: 0,
                  recoveryMs: 1000,
                  damageType: 'physical',
                  playerDamage: 10,
                  partyDamageOnHit: 0,
                  partyDamageOnMiss: 0,
                  pressureOnHit: 0,
                  pressureOnMiss: 0,
                  appliedTargetStatusIds: ['bleed'],
                  appliedSelfStatusIds: [],
                  castBreakRule: 'controlOnly',
                  dangerLevel: 'low',
                },
              ],
              skillCycle: ['bite'],
            },
          ],
        },
      ],
      statusDefinitions: {
        bleed: {
          statusId: 'bleed',
          statusName: 'Bleed',
          durationMs: 6000,
          effectLogicId: 'bleed_dot',
          kind: 'playerDebuff',
        },
        rage: {
          statusId: 'rage',
          statusName: 'Rage',
          durationMs: 4000,
          effectLogicId: 'rage_status',
          kind: 'enemyBuff',
        },
      },
    })

    expect(report.monsters).toHaveLength(1)
    expect(report.monsters[0]).toMatchObject({
      enemyId: 'wolf',
      appearances: 2,
      expectedTankDamagePerSec: 3.75,
      expectedPartyDamagePerSec: 0.5,
      expectedPressurePerSec: 0.38,
      requiredThreatPerSec: 3.75,
    })
    expect(report.monsters[0].statusCoverages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: 'bleed', expectedCoverage: 1 }),
        expect.objectContaining({ statusId: 'rage', expectedCoverage: 0.5 }),
      ]),
    )

    const markdown = renderMonsterCodexEstimateMarkdown(report)
    expect(markdown).toContain('# \u602a\u7269\u56fe\u9274\u6570\u503c\u4f30\u7b97')
    expect(markdown).toContain('\u5b57\u6bb5\u8bf4\u660e')
    expect(markdown).toContain('\u602a\u7269\u6c47\u603b')
    expect(markdown).toContain('expectedTankDamagePerSec')
    expect(markdown).toContain('Bleed')
  })
})
