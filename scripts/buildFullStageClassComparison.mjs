import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildFullStageClassComparison,
  renderFullStageClassComparisonMarkdown,
} from '../src/game/balance/fullStageClassComparison.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportRoot = path.join(projectRoot, 'reports', 'balance')
const expectedStageIds = [
  ...Array.from({ length: 9 }, (_, index) => `Challenge-${index + 1}`),
  ...Array.from({ length: 6 }, (_, index) => `WestFall-${index + 1}`),
  ...Array.from({ length: 6 }, (_, index) => `Zul'Aman-${index + 1}`),
]
const expectedClassIds = ['warrior_t', 'druid_bear_t']

function readReport(relativePath) {
  const absolutePath = path.join(reportRoot, relativePath)
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
}

const challenge = readReport(path.join('challenge', 'latest.json'))
const westfall = readReport(path.join('story', '第二章自动评分.json'))
const zulAman = readReport(path.join('story', '第三章自动评分.json'))
const allStages = [
  ...(challenge.stages ?? []),
  ...(westfall.stages ?? []),
  ...(zulAman.stages ?? []),
]
const expectedStageSet = new Set(expectedStageIds)
const stages = allStages.filter((stage) => expectedStageSet.has(stage.stageId))

const resultKeys = new Map()
for (const stage of stages) {
  const key = `${stage.stageId}|${stage.classId}`
  resultKeys.set(key, (resultKeys.get(key) ?? 0) + 1)
}

const errors = []
for (const stageId of expectedStageIds) {
  for (const classId of expectedClassIds) {
    const key = `${stageId}|${classId}`
    const count = resultKeys.get(key) ?? 0
    if (count !== 1) errors.push(`${key}: expected 1 result, found ${count}`)
  }
}
if (stages.length !== expectedStageIds.length * expectedClassIds.length) {
  errors.push(`expected 42 filtered results, found ${stages.length}`)
}
if (errors.length > 0) {
  throw new Error(`Full-stage comparison input is incomplete:\n${errors.join('\n')}`)
}

const report = buildFullStageClassComparison({
  generatedAt: new Date().toISOString(),
  stages,
})
const reportMarkdown = renderFullStageClassComparisonMarkdown(report)
const outputBase = path.join(reportRoot, '熊T与战士T全关卡完整预算对比-2026-07-30')
const trackedReportRoot = path.join(projectRoot, 'docs', 'reports')
const trackedReportPath = path.join(
  trackedReportRoot,
  '熊T与战士T全关卡完整预算对比报告-2026-07-30.md',
)
fs.writeFileSync(`${outputBase}.json`, `${JSON.stringify({
  ...report,
  sources: {
    challengeGeneratedAt: challenge.generatedAt,
    westfallGeneratedAt: westfall.generatedAt,
    zulAmanGeneratedAt: zulAman.generatedAt,
  },
}, null, 2)}\n`)
fs.writeFileSync(`${outputBase}.md`, reportMarkdown)
fs.mkdirSync(trackedReportRoot, { recursive: true })
fs.writeFileSync(trackedReportPath, reportMarkdown)

console.log(`Full-stage comparison written: ${path.relative(projectRoot, outputBase)}.{md,json}`)
console.log(`Tracked report written: ${path.relative(projectRoot, trackedReportPath)}`)
console.log(`- stages=${report.rows.length}`)
console.log(`- class results=${report.sourceResultCount}`)
