import { describe, expect, it } from 'vitest'
import { stripCombatLogTraceFromBalanceReport } from './balanceReportSanitizer'

describe('stripCombatLogTraceFromBalanceReport', () => {
  it('removes raw combat log traces from nested report data without mutating the source report', () => {
    const report = {
      generatedAt: '2026-06-16T00:00:00.000Z',
      stages: [
        {
          stageId: 'WestFall-1',
          fixedAnalysis: {
            scenarios: [
              {
                buildName: 'fixed',
                trace: { success: true },
                combatLogTrace: [{ timeMs: 1000, type: 'damage', amount: 12 }],
              },
            ],
          },
          learningAnalysis: {
            finalAnalysis: {
              scenarios: [
                {
                  buildName: 'learning',
                  diagnosticSummary: { deaths: 0 },
                  combatLogTrace: [{ timeMs: 2000, type: 'heal', amount: 8 }],
                },
              ],
            },
          },
        },
      ],
    }

    const sanitized = stripCombatLogTraceFromBalanceReport(report)

    expect(JSON.stringify(sanitized)).not.toContain('combatLogTrace')
    expect(sanitized.stages[0].fixedAnalysis.scenarios[0].trace).toEqual({ success: true })
    expect(sanitized.stages[0].learningAnalysis.finalAnalysis.scenarios[0].diagnosticSummary).toEqual({
      deaths: 0,
    })
    expect(report.stages[0].fixedAnalysis.scenarios[0].combatLogTrace).toHaveLength(1)
    expect(report.stages[0].learningAnalysis.finalAnalysis.scenarios[0].combatLogTrace).toHaveLength(1)
  })
})
