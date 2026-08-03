import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')
const candidateRoot = path.join(projectRoot, '.superpowers', 'stage-balance-candidates')
const outputPath = path.join(projectRoot, 'reports', 'balance', '关卡候选扫描-2026-08-02.json')
const designerDirArg = '--designer-data-dir='

const candidates = [
  {
    id: 'c1-candle-king-for-seer',
    stageId: 'Challenge-1',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-1-e05', values: { enemyId: 'The_Candle_King', nameOverride: '蜡烛之王', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c2-candle-king-for-rummager',
    stageId: 'Challenge-2',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-2-e05', values: { enemyId: 'The_Candle_King', nameOverride: '蜡烛之王', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c3-candle-king-for-seer',
    stageId: 'Challenge-3',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-3-e04', values: { enemyId: 'The_Candle_King', nameOverride: '蜡烛之王', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c4-oracle-for-apprentice',
    stageId: 'Challenge-4',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-4-e01', values: { enemyId: 'coldlight_oracle', nameOverride: '寒光智者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c5-oracle-for-rummager',
    stageId: 'Challenge-5',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-5-e01', values: { enemyId: 'coldlight_oracle', nameOverride: '寒光智者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c6-murk-eye-for-seer',
    stageId: 'Challenge-6',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-6-e05', values: { enemyId: 'Old_Murk-Eye', nameOverride: '老瞎眼', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c7-shadow-priest-for-seer',
    stageId: 'Challenge-7',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-7-e03', values: { enemyId: 'troll_shadow_priest', nameOverride: '巨魔暗影牧师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c8-shadow-priest-for-seer',
    stageId: 'Challenge-8',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-8-e03', values: { enemyId: 'troll_shadow_priest', nameOverride: '巨魔暗影牧师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c9-shieldmasta-for-high-priest',
    stageId: 'Challenge-9',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-9-e04', values: { enemyId: 'troll_shieldmasta', nameOverride: '巨魔持盾卫士', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 3, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'wf1-tidehunter-for-scout',
    stageId: 'WestFall-1',
    fileName: 'encounter_balance.xlsx',
    updates: [{ spawnId: 'WestFall-1-e05', values: { enemyId: 'murloc_tidehunter', nameOverride: '鱼人猎潮者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'wf2-blowgiller-for-scout',
    stageId: 'WestFall-2',
    fileName: 'encounter_balance.xlsx',
    updates: [{ spawnId: 'WestFall-2-e04', values: { enemyId: 'murloc_blowgiller', nameOverride: '鱼人吹箭者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'wf3-warleader-for-blowgiller',
    stageId: 'WestFall-3',
    fileName: 'encounter_balance.xlsx',
    updates: [{ spawnId: 'WestFall-3-e02', values: { enemyId: 'murloc_warleader', nameOverride: '鱼人领军', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c1-candle-plus-geomancer',
    stageId: 'Challenge-1',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [
      { spawnId: 'Challenge-1-e05', values: { enemyId: 'The_Candle_King', nameOverride: '蜡烛之王', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } },
      { spawnId: 'Challenge-1-e04', values: { enemyId: 'kobold_geomancer', nameOverride: '狗头人地卜师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } },
    ],
  },
  {
    id: 'c1-wounded-candle-plus-geomancer',
    stageId: 'Challenge-1',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [
      { spawnId: 'Challenge-1-e05', values: { enemyId: 'The_Candle_King', nameOverride: '负伤的蜡烛之王', hpOverride: 200, maxHpOverride: 200, openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } },
      { spawnId: 'Challenge-1-e04', values: { enemyId: 'kobold_geomancer', nameOverride: '狗头人地卜师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } },
    ],
  },
  {
    id: 'c1-candle-plus-wounded-geomancer',
    stageId: 'Challenge-1',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [
      { spawnId: 'Challenge-1-e05', values: { enemyId: 'The_Candle_King', nameOverride: '蜡烛之王', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } },
      { spawnId: 'Challenge-1-e04', values: { enemyId: 'kobold_geomancer', nameOverride: '负伤的狗头人地卜师', hpOverride: 100, maxHpOverride: 100, openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } },
    ],
  },
  {
    id: 'c2-candle-plus-monk',
    stageId: 'Challenge-2',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [
      { spawnId: 'Challenge-2-e05', values: { enemyId: 'The_Candle_King', nameOverride: '蜡烛之王', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 1000 } },
      { spawnId: 'Challenge-2-e03', values: { enemyId: 'kobold_monk', nameOverride: '狗头人武僧', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 5, openingRecoveryRemainingMs: 2000 } },
    ],
  },
  {
    id: 'c3-monk-for-scout',
    stageId: 'Challenge-3',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-3-e02', values: { enemyId: 'kobold_monk', nameOverride: '狗头人武僧', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 5, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c4-warleader-for-apprentice',
    stageId: 'Challenge-4',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-4-e01', values: { enemyId: 'murloc_warleader', nameOverride: '鱼人领军', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 3, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c5-warleader-for-rummager',
    stageId: 'Challenge-5',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-5-e01', values: { enemyId: 'murloc_warleader', nameOverride: '鱼人领军', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 3, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c6-warleader-for-seer',
    stageId: 'Challenge-6',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-6-e05', values: { enemyId: 'murloc_warleader', nameOverride: '鱼人领军', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 3, openingRecoveryRemainingMs: 1000 } }],
  },
  {
    id: 'c7-delayed-shadow-priest',
    stageId: 'Challenge-7',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-7-e03', values: { enemyId: 'troll_shadow_priest', nameOverride: '巨魔暗影牧师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 4, openingRecoveryRemainingMs: 4000 } }],
  },
  {
    id: 'c8-delayed-shadow-priest',
    stageId: 'Challenge-8',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-8-e03', values: { enemyId: 'troll_shadow_priest', nameOverride: '巨魔暗影牧师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 4, openingRecoveryRemainingMs: 4000 } }],
  },
  {
    id: 'c9-delayed-shadow-priest',
    stageId: 'Challenge-9',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-9-e04', values: { enemyId: 'troll_shadow_priest', nameOverride: '巨魔暗影牧师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 4, openingRecoveryRemainingMs: 4000 } }],
  },
  {
    id: 'wf1-two-tidehunters',
    stageId: 'WestFall-1',
    fileName: 'encounter_balance.xlsx',
    updates: [
      { spawnId: 'WestFall-1-e04', values: { enemyId: 'murloc_tidehunter', nameOverride: '鱼人猎潮者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } },
      { spawnId: 'WestFall-1-e05', values: { enemyId: 'murloc_tidehunter', nameOverride: '鱼人猎潮者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } },
    ],
  },
  {
    id: 'wf2-blowgiller-plus-tidehunter',
    stageId: 'WestFall-2',
    fileName: 'encounter_balance.xlsx',
    updates: [
      { spawnId: 'WestFall-2-e03', values: { enemyId: 'murloc_tidehunter', nameOverride: '鱼人猎潮者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } },
      { spawnId: 'WestFall-2-e04', values: { enemyId: 'murloc_blowgiller', nameOverride: '鱼人吹箭者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 1000 } },
    ],
  },
  {
    id: 'wf3-open-with-upgrades',
    stageId: 'WestFall-3',
    fileName: 'encounter_balance.xlsx',
    updates: [
      { spawnId: 'WestFall-3-e02', values: { openingCastSkillNum: 3, openingRecoveryRemainingMs: 0 } },
      { spawnId: 'WestFall-3-e03', values: { openingCastSkillNum: 3, openingRecoveryRemainingMs: 1000 } },
    ],
  },
  {
    id: 'c3-geomancer-for-scout',
    stageId: 'Challenge-3',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-3-e02', values: { enemyId: 'kobold_geomancer', nameOverride: '狗头人地卜师', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } }],
  },
  {
    id: 'c5-rummager-control-channel',
    stageId: 'Challenge-5',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-5-e01', values: { openingCastSkillNum: 4, openingRecoveryRemainingMs: 0 } }],
  },
  {
    id: 'c6-candle-shadow-hoe',
    stageId: 'Challenge-6',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-6-e01', values: { openingCastSkillNum: 4, openingRecoveryRemainingMs: 0 } }],
  },
  {
    id: 'c7-soul-summoner-for-seer',
    stageId: 'Challenge-7',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-7-e03', values: { enemyId: 'troll_soul_summoner', nameOverride: '巨魔唤魂者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } }],
  },
  {
    id: 'c8-soul-summoner-for-seer',
    stageId: 'Challenge-8',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-8-e03', values: { enemyId: 'troll_soul_summoner', nameOverride: '巨魔唤魂者', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 1, openingRecoveryRemainingMs: 2000 } }],
  },
  {
    id: 'c9-high-priest-spirit-shell',
    stageId: 'Challenge-9',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-9-e04', values: { openingCastSkillNum: 6, openingRecoveryRemainingMs: 0 } }],
  },
  {
    id: 'wf1-open-with-mark',
    stageId: 'WestFall-1',
    fileName: 'encounter_balance.xlsx',
    updates: [{ spawnId: 'WestFall-1-e06', values: { openingCastSkillNum: 2, openingRecoveryRemainingMs: 0 } }],
  },
  {
    id: 'wf2-open-with-upgrades',
    stageId: 'WestFall-2',
    fileName: 'encounter_balance.xlsx',
    updates: [
      { spawnId: 'WestFall-2-e05', values: { openingCastSkillNum: 3, openingRecoveryRemainingMs: 0 } },
      { spawnId: 'WestFall-2-e06', values: { openingCastSkillNum: 3, openingRecoveryRemainingMs: 1000 } },
    ],
  },
  {
    id: 'c1-candle-king-immediate',
    stageId: 'Challenge-1',
    fileName: 'challenge_encounter_balance.xlsx',
    updates: [{ spawnId: 'Challenge-1-e05', values: { enemyId: 'The_Candle_King', nameOverride: '蜡烛之王', hpOverride: '', maxHpOverride: '', openingCastSkillNum: 2, openingRecoveryRemainingMs: 0 } }],
  },
]

function parseSelectedIds() {
  const arg = process.argv.find((entry) => entry.startsWith('--ids='))
  if (!arg) return new Set(candidates.map((candidate) => candidate.id))
  return new Set(arg.slice('--ids='.length).split(',').map((entry) => entry.trim()).filter(Boolean))
}

function parseBudget() {
  const arg = process.argv.find((arg) => arg.startsWith('--budget='))
  const budget = arg ? arg.slice('--budget='.length).trim() : 'quick'
  if (!new Set(['quick', 'normal', 'full']).has(budget)) {
    throw new Error(`Unsupported budget: ${budget}`)
  }
  return budget
}

function requireSafeCandidateDir(candidateDir) {
  const relativePath = path.relative(candidateRoot, candidateDir)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || relativePath === '') {
    throw new Error(`Unsafe candidate directory: ${candidateDir}`)
  }
}

function applyUpdates(workbookPath, stageId, updates) {
  const workbook = XLSX.readFile(workbookPath)
  const sheet = workbook.Sheets['敌人布置']
  if (!sheet) throw new Error(`Missing 敌人布置 in ${workbookPath}`)
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })

  for (const update of updates) {
    const matches = rows.filter((row) => String(row.stageId) === stageId && String(row.spawnId) === update.spawnId)
    if (matches.length !== 1) throw new Error(`Expected one ${stageId}/${update.spawnId}, found ${matches.length}`)
    Object.assign(matches[0], update.values)
  }

  workbook.Sheets['敌人布置'] = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) })
  XLSX.writeFile(workbook, workbookPath, { bookType: 'xlsx', compression: true })
}

function average(values) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function summarizeStage(stage) {
  const profiles = Object.fromEntries(stage.fixedAnalysis.bestBuildsByProfile.map((entry) => [entry.profileId, entry.passRate]))
  const tierRates = (tier) => stage.fixedAnalysis.bestBuildsByProfile
    .filter((entry) => entry.profileId.startsWith(tier))
    .map((entry) => entry.passRate)
  return {
    classId: stage.classId,
    averageBestPassRate: stage.fixedAnalysis.rating.averageBestPassRate,
    skilledBestPassRate: average(tierRates('skilled')),
    expertBestPassRate: average(tierRates('expert')),
    overallBestPassRate: stage.fixedAnalysis.rating.overallBestPassRate,
    difficulty: stage.fixedAnalysis.rating.label,
    average2PassRate: profiles['average2-800ms-10pct'] ?? null,
    skilled2PassRate: profiles['skilled2-300ms-5pct'] ?? null,
    learningBestPassRate: stage.learningAnalysis.learningDifficultyRating.bestPassRate,
  }
}

function runCandidate(candidate, budget) {
  const candidateDir = path.join(candidateRoot, candidate.id)
  requireSafeCandidateDir(candidateDir)
  fs.rmSync(candidateDir, { recursive: true, force: true })
  const isolatedDesignerDataDir = path.join(candidateDir, 'designer-data')
  fs.mkdirSync(candidateDir, { recursive: true })
  fs.cpSync(designerDataDir, isolatedDesignerDataDir, { recursive: true })

  try {
    applyUpdates(path.join(isolatedDesignerDataDir, candidate.fileName), candidate.stageId, candidate.updates)
    const args = [
      '--experimental-strip-types',
      '--loader',
      './scripts/ts-extension-loader.mjs',
      'scripts/analyzeBalance.mjs',
      `${designerDirArg}${path.relative(projectRoot, isolatedDesignerDataDir)}`,
      `--stage=${candidate.stageId}`,
      '--classes=warrior_t,druid_bear_t',
      `--budget=${budget}`,
    ]
    if (candidate.stageId.startsWith('Challenge-')) args.push('--challenge')
    const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`Analyzer failed for ${candidate.id} with exit code ${result.status}`)

    const reportPath = path.join(
      projectRoot,
      'reports',
      'balance',
      candidate.stageId.startsWith('Challenge-') ? 'challenge' : 'story',
      'latest.json',
    )
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    const stages = report.stages.filter((stage) => stage.stageId === candidate.stageId)
    if (stages.length !== 2) throw new Error(`Expected two class results for ${candidate.id}, found ${stages.length}`)
    return {
      id: candidate.id,
      budget,
      stageId: candidate.stageId,
      fileName: candidate.fileName,
      updates: candidate.updates,
      generatedAt: report.generatedAt,
      classes: stages.map(summarizeStage),
    }
  } finally {
    fs.rmSync(candidateDir, { recursive: true, force: true })
  }
}

const selectedIds = parseSelectedIds()
const budget = parseBudget()
const selectedCandidates = candidates.filter((candidate) => selectedIds.has(candidate.id))
if (selectedCandidates.length !== selectedIds.size) {
  const foundIds = new Set(selectedCandidates.map((candidate) => candidate.id))
  const missingIds = [...selectedIds].filter((id) => !foundIds.has(id))
  throw new Error(`Unknown candidate ids: ${missingIds.join(', ')}`)
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
const previous = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : { results: [] }
const resultById = new Map(previous.results.map((result) => [`${result.id}:${result.budget ?? 'quick'}`, result]))

for (const candidate of selectedCandidates) {
  console.log(`[candidate] ${candidate.id}: start`)
  const result = runCandidate(candidate, budget)
  resultById.set(`${candidate.id}:${budget}`, result)
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results: [...resultById.values()] }, null, 2)}\n`)
  console.log(`[candidate] ${candidate.id}: done`)
}

console.log(`Candidate scan written to ${path.relative(projectRoot, outputPath)}`)
