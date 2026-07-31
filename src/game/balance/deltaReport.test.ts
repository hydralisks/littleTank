import { describe, expect, it } from 'vitest'
import type { StageDeltaAnalysis } from './deltaAnalysis'
import { renderDeltaReportMarkdown } from './deltaReport'

describe('delta report renderer', () => {
  it('renders confidence, verdict, and follow-up guidance', () => {
    const report = renderDeltaReportMarkdown({
      generatedAt: '2026-05-30T00:00:00.000Z',
      stages: [
        {
          classId: 'warrior_t', stageId: 'WestFall-2',
          buildRuleId: 'standard_5slot',
          title: 'Sentinel Hill',
          analysisType: 'passive',
          baselineVariantId: 'baseline_no_passives',
          scenarios: [
            {
              classId: 'warrior_t', stageId: 'WestFall-2',
              baselineVariantId: 'baseline_no_passives',
              variantId: 'baseline_no_passives',
              variantLabel: 'No passives',
              variantKind: 'baseline',
              attempts: 12,
              victories: 6,
              passRate: 0.5,
              seedCount: 1,
              passiveTalentIds: [],
              loadout: {
                '1': 'warrior_t_interrupt',
                '2': null,
                '3': null,
                '4': null,
                Q: null,
                E: null,
                R: null,
                F: null,
              },
            },
          ],
          comparisons: [
            {
              classId: 'warrior_t', stageId: 'WestFall-2',
              baselineVariantId: 'baseline_no_passives',
              comparedVariantId: 'passive_warrior_t_barbaric_training',
              comparedVariantLabel: '野蛮训练',
              baselinePassRate: 0.5,
              comparedPassRate: 0.75,
              passRateDelta: 0.25,
              relativeDelta: 0.5,
              confidence: 'low',
              verdict: 'minor_gain',
              reasons: ['delta 25 percentage points'],
            },
          ],
        } satisfies StageDeltaAnalysis,
      ],
    })

    expect(report).toContain('# Delta Analysis')
    expect(report).toContain('WestFall-2')
    expect(report).toContain('`WestFall-2 / warrior_t / standard_5slot`')
    expect(report).toContain('野蛮训练')
    expect(report).toContain('low')
    expect(report).toContain('minor_gain')
    expect(report).toContain('Needs rerun')
  })

  it('renders an upfront Chinese designer summary and table field explanations', () => {
    const report = renderDeltaReportMarkdown({
      generatedAt: '2026-05-30T00:00:00.000Z',
      stages: [
        {
          classId: 'warrior_t', stageId: 'WestFall-2',
          buildRuleId: 'standard_5slot',
          title: 'Sentinel Hill',
          analysisType: 'passive',
          baselineVariantId: 'baseline_no_passives',
          scenarios: [],
          comparisons: [
            {
              classId: 'warrior_t', stageId: 'WestFall-2',
              baselineVariantId: 'baseline_no_passives',
              comparedVariantId: 'strong_combo',
              comparedVariantLabel: '战旗飘扬 + 野蛮训练',
              baselinePassRate: 0.25,
              comparedPassRate: 0.65,
              passRateDelta: 0.4,
              relativeDelta: 1.6,
              confidence: 'medium',
              verdict: 'strong_gain',
              reasons: ['delta 40 percentage points'],
            },
            {
              classId: 'warrior_t', stageId: 'WestFall-2',
              baselineVariantId: 'baseline_no_passives',
              comparedVariantId: 'weak_combo',
              comparedVariantLabel: '瞬断手感',
              baselinePassRate: 0.55,
              comparedPassRate: 0.35,
              passRateDelta: -0.2,
              relativeDelta: -0.36,
              confidence: 'medium',
              verdict: 'regression',
              reasons: ['delta -20 percentage points'],
            },
          ],
        } satisfies StageDeltaAnalysis,
      ],
    })

    expect(report).toContain('## 重点结论')
    expect(report).toContain('过强候选')
    expect(report).toContain('战旗飘扬 + 野蛮训练')
    expect(report).toContain('偏弱或负收益候选')
    expect(report).toContain('瞬断手感')
    expect(report).toContain('## 表格字段说明')
    expect(report).toContain('Pass rate')
    expect(report).toContain('Delta')
    expect(report).toContain('Confidence')
    expect(report).toContain('为什么重要')
  })

  it('renders active skill presence comparisons with both legal loadouts', () => {
    const report = renderDeltaReportMarkdown({
      generatedAt: '2026-07-25T00:00:00.000Z',
      stages: [{
        classId: 'druid_bear_t', stageId: 'WestFall-1', buildRuleId: 'standard_5slot',
        title: 'WestFall', analysisType: 'active', baselineVariantId: 'best_without_each_skill',
        scenarios: [],
        comparisons: [{
          classId: 'druid_bear_t', stageId: 'WestFall-1',
          baselineVariantId: 'without_druid_bear_t_frenzied_regeneration',
          comparedVariantId: 'with_druid_bear_t_frenzied_regeneration',
          comparedVariantLabel: '狂暴回复', activeSkillId: 'druid_bear_t_frenzied_regeneration',
          baselinePassRate: 0.45, comparedPassRate: 0.7, passRateDelta: 0.25,
          relativeDelta: 0.56, confidence: 'medium', verdict: 'strong_gain',
          reasons: ['delta 25 percentage points'],
          baselineLoadout: { '1': 'druid_bear_t_growl', '2': null, '3': null, '4': null, Q: null, E: null, R: null, F: null },
          comparedLoadout: { '1': 'druid_bear_t_frenzied_regeneration', '2': null, '3': null, '4': null, Q: null, E: null, R: null, F: null },
        }],
      } satisfies StageDeltaAnalysis],
    })

    expect(report).toContain('druid_bear_t_frenzied_regeneration')
    expect(report).toContain('不含技能构筑')
    expect(report).toContain('包含技能构筑')
    expect(report).toContain('1=druid_bear_t_growl')
    expect(report).toContain('1=druid_bear_t_frenzied_regeneration')
  })
})
