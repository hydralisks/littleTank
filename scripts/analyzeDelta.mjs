import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides } from '../src/game/data/encounterTemplates.ts'
import { applyEnemyWorkbookOverrides } from '../src/game/data/enemyCatalog.ts'
import { applyPlayerBuildWorkbookOverrides } from '../src/game/data/playerBuildCatalog.ts'
import { applyStageWorkbookOverrides, getStageById } from '../src/game/data/stageTemplates.ts'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../src/game/data/workbookLoader.ts'
import { runStageDeltaAnalysis } from '../src/game/balance/deltaAnalysis.ts'
import { renderDeltaReportMarkdown } from '../src/game/balance/deltaReport.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')
const outputDir = path.join(projectRoot, 'reports', 'balance')

const SAMPLE_CONFIG = {
  quick: { attempts: 12, seeds: 1 },
  standard: { attempts: 30, seeds: 1 },
  full: { attempts: 100, seeds: 1 },
}

const LEARNING_PROFILE = {
  id: 'delta-learning-220ms-low-error',
  tier: 'average',
  reactionDelayMs: 220,
  reactionDelayJitterMs: 70,
  reactionDelayFastChance: 0.12,
  reactionDelayFastMs: 120,
  mistakeRate: 0.015,
  forgetSkillRate: 0.004,
  wrongTargetRate: 0.006,
  prioritySlipRate: 0.005,
  decisionIntervalMs: 140,
  endCastStopWindowMs: 850,
  preserveKeyStopSkills: true,
  evaluateEnemySkillImpact: true,
  preferControlForChanneling: true,
  targetPriorityMode: 'kill_high_impact',
  irregularThreatPolicy: 'allow_leak_when_tank_pressure_high',
  minimumTargetStickMs: 1200,
  preemptiveDefenseHorizonMs: 3500,
}

function parseList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function parseCliOptions(args) {
  const options = {
    stages: [],
    type: 'passive',
    baseBuild: 'best',
    talents: [],
    sample: 'quick',
    attempts: null,
    seeds: null,
  }

  for (const arg of args) {
    if (arg.startsWith('--stages=')) {
      options.stages = parseList(arg.slice('--stages='.length))
    } else if (arg.startsWith('--type=')) {
      const type = arg.slice('--type='.length).trim()
      if (type === 'passive' || type === 'build') {
        options.type = type
      }
    } else if (arg.startsWith('--baseBuild=')) {
      options.baseBuild = arg.slice('--baseBuild='.length).trim()
    } else if (arg.startsWith('--talents=')) {
      options.talents = parseList(arg.slice('--talents='.length))
    } else if (arg.startsWith('--sample=')) {
      const sample = arg.slice('--sample='.length).trim()
      if (sample in SAMPLE_CONFIG) {
        options.sample = sample
      }
    } else if (arg.startsWith('--attempts=')) {
      options.attempts = Number(arg.slice('--attempts='.length))
    } else if (arg.startsWith('--seeds=')) {
      options.seeds = Number(arg.slice('--seeds='.length))
    }
  }

  return options
}

function readWorkbook(fileName) {
  return XLSX.readFile(path.join(designerDataDir, fileName))
}

function loadDesignerDataIntoCatalogs() {
  applyStageWorkbookOverrides(parseStageWorkbook(readWorkbook('stage_content.xlsx')))
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(readWorkbook('encounter_balance.xlsx')))
  applyEnemyWorkbookOverrides(parseEnemyWorkbook(readWorkbook('enemy_data.xlsx')))
  applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(readWorkbook('player_build.xlsx')))
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function findStageReport(stageId) {
  const candidates = [
    path.join(outputDir, 'latest.json'),
    path.join(outputDir, 'westfall-auto-scoring.json'),
    path.join(outputDir, 'chapter-one-auto-scoring.json'),
  ]

  for (const candidate of candidates) {
    const report = readJsonIfExists(candidate)
    const stage = report?.stages?.find((entry) => entry.stageId === stageId)
    if (stage) {
      return stage
    }
  }

  return null
}

function findBestReportedBuild(stageId, baseBuildId) {
  if (baseBuildId !== 'best') {
    return undefined
  }

  const stageReport = findStageReport(stageId)
  const selectedBuildId = stageReport?.learningAnalysis?.selectedBuildIds
    ?.find((buildId) => buildId !== 'default') ?? stageReport?.fixedAnalysis?.bestBuildsByProfile
      ?.find((summary) => summary.buildId !== 'default')?.buildId
  if (!selectedBuildId) {
    return undefined
  }

  const analyzedBuild = stageReport?.fixedAnalysis?.analyzedBuilds
    ?.find((variant) => variant.id === selectedBuildId)
  if (analyzedBuild?.build) {
    return analyzedBuild.build
  }

  const bestSummary = stageReport?.fixedAnalysis?.bestBuildsByProfile
    ?.find((summary) => summary.buildId === selectedBuildId)
  if (bestSummary) {
    return {
      loadout: bestSummary.loadout,
      passiveTalentIds: bestSummary.passiveTalentIds,
    }
  }

  return undefined
}

const options = parseCliOptions(process.argv.slice(2))
if (options.stages.length === 0) {
  throw new Error('Usage: npm run analyze:delta -- --stages=WestFall-2,WestFall-3 [--type=passive]')
}

loadDesignerDataIntoCatalogs()

const sample = SAMPLE_CONFIG[options.sample]
const attempts = Number.isFinite(options.attempts) && options.attempts > 0
  ? Math.floor(options.attempts)
  : sample.attempts
const seeds = Number.isFinite(options.seeds) && options.seeds > 0
  ? Math.floor(options.seeds)
  : sample.seeds

const stages = options.stages.map((stageId) => {
  const stage = getStageById(stageId)
  if (!stage) {
    throw new Error(`Missing stage: ${stageId}`)
  }

  console.log(`[delta] ${stageId}: start`)
  const analysis = runStageDeltaAnalysis({
    stage,
    type: options.type,
    baseBuildId: options.baseBuild,
    baseBuild: findBestReportedBuild(stageId, options.baseBuild),
    talentIds: options.talents,
    includePairs: true,
    profile: LEARNING_PROFILE,
    attemptsPerScenario: attempts,
    seedCount: seeds,
    maxDurationMs: 120_000,
  })
  console.log(`[delta] ${stageId}: done comparisons=${analysis.comparisons.length}`)
  return analysis
})

const report = {
  generatedAt: new Date().toISOString(),
  stages,
}

fs.mkdirSync(outputDir, { recursive: true })
const jsonPath = path.join(outputDir, 'delta-analysis.json')
const markdownPath = path.join(outputDir, 'delta-analysis.md')
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8')
fs.writeFileSync(markdownPath, renderDeltaReportMarkdown(report), 'utf8')
console.log(`[delta] wrote ${markdownPath}`)
console.log(`[delta] wrote ${jsonPath}`)
