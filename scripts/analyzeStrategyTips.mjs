import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import {
  applyEncounterWorkbookOverrides,
  getStageBuildRuleId,
} from '../src/game/data/encounterTemplates.ts'
import {
  applyEnemyWorkbookOverrides,
} from '../src/game/data/enemyCatalog.ts'
import {
  applyStageWorkbookOverrides,
  getStageById,
} from '../src/game/data/stageTemplates.ts'
import {
  applyPlayerBuildWorkbookOverrides,
} from '../src/game/data/playerBuildCatalog.ts'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../src/game/data/workbookLoader.ts'
import {
  runTwoPhaseStageBalanceAnalysis,
  selectLearningBuildCandidatesFromFixedAnalysis,
} from '../src/game/balance/balanceSimulator.ts'
import {
  generateStrategyTipBuildCandidates,
  getBuildSignature,
} from '../src/game/balance/balanceBuildGenerator.ts'
import {
  runLearningStageBalanceAnalysis,
} from '../src/game/balance/learningBalanceEvaluator.ts'
import {
  classifyStrategyTipSignals,
  createStageWithoutStrategyTips,
  createStrategyTipsModeResult,
  filterViolatedBuildCandidates,
  filterViolatedCastStrategies,
  filterViolatedTacticalStrategies,
  renderStrategyTipsSensitivityMarkdown,
  summarizeStrategyTipDependency,
} from '../src/game/balance/strategyTipsSensitivity.ts'
import { getPlayerClassRuntimeDefinition } from '../src/game/playerClasses/playerClassRuntimeRegistry.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')
const outputDir = path.join(projectRoot, 'reports', 'strategy_tips', 'story')

const CHAPTERS = [
  {
    areaId: 'RingingDeeps',
    title: '第一章策略提示敏感性',
    markdown: '第一章策略提示敏感性.md',
    json: '第一章策略提示敏感性.json',
    stageIds: ['RingingDeeps-1', 'RingingDeeps-2', 'RingingDeeps-3', 'RingingDeeps-4', 'RingingDeeps-5', 'RingingDeeps-6'],
  },
  {
    areaId: 'WestFall',
    title: '第二章策略提示敏感性',
    markdown: '第二章策略提示敏感性.md',
    json: '第二章策略提示敏感性.json',
    stageIds: ['WestFall-1', 'WestFall-2', 'WestFall-3', 'WestFall-4', 'WestFall-5', 'WestFall-6'],
  },
  {
    areaId: "Zul'Aman",
    title: '第三章策略提示敏感性',
    markdown: '第三章策略提示敏感性.md',
    json: '第三章策略提示敏感性.json',
    stageIds: ["Zul'Aman-1", "Zul'Aman-2", "Zul'Aman-3", "Zul'Aman-4", "Zul'Aman-5", "Zul'Aman-6"],
  },
]

const SAMPLE_CONFIGS = {
  quick: {
    fixedPhaseOneAttempts: 2,
    fixedPhaseOneMaxActiveBuilds: 8,
    fixedPhaseOneMaxPassiveVariants: 2,
    fixedFinalBuildCount: 2,
    fixedAttempts: 8,
    learningPhaseOneAttempts: 1,
    learningFinalBuildCount: 2,
    learningFinalStrategyCount: 1,
    learningAttempts: 8,
  },
  normal: {
    fixedPhaseOneAttempts: 4,
    fixedPhaseOneMaxActiveBuilds: 12,
    fixedPhaseOneMaxPassiveVariants: 3,
    fixedFinalBuildCount: 3,
    fixedAttempts: 24,
    learningPhaseOneAttempts: 3,
    learningFinalBuildCount: 3,
    learningFinalStrategyCount: 2,
    learningAttempts: 24,
  },
  full: {
    fixedPhaseOneAttempts: 12,
    fixedPhaseOneMaxActiveBuilds: 18,
    fixedPhaseOneMaxPassiveVariants: 3,
    fixedFinalBuildCount: 5,
    fixedAttempts: 80,
    learningPhaseOneAttempts: 6,
    learningFinalBuildCount: 4,
    learningFinalStrategyCount: 2,
    learningAttempts: 80,
  },
}

const COMMON_TACTIC_PROFILE = {
  endCastStopWindowMs: 800,
  preserveKeyStopSkills: true,
  evaluateEnemySkillImpact: true,
  preferControlForChanneling: true,
}

const BALANCE_PROFILES = [
  {
    id: 'average2-800ms-10pct',
    tier: 'average',
    reactionDelayMs: 800,
    reactionDelayJitterMs: 220,
    reactionDelayFastChance: 0.1,
    reactionDelayFastMs: 220,
    mistakeRate: 0.1,
    forgetSkillRate: 0.04,
    wrongTargetRate: 0.04,
    prioritySlipRate: 0.02,
    decisionIntervalMs: 300,
  },
  {
    id: 'skilled2-300ms-5pct',
    tier: 'skilled',
    reactionDelayMs: 300,
    reactionDelayJitterMs: 120,
    reactionDelayFastChance: 0.12,
    reactionDelayFastMs: 130,
    mistakeRate: 0.05,
    forgetSkillRate: 0.02,
    wrongTargetRate: 0.02,
    prioritySlipRate: 0.01,
    decisionIntervalMs: 180,
  },
  {
    id: 'expert2-150ms-2pct',
    tier: 'expert',
    reactionDelayMs: 150,
    reactionDelayJitterMs: 60,
    reactionDelayFastChance: 0.15,
    reactionDelayFastMs: 80,
    mistakeRate: 0.02,
    forgetSkillRate: 0.006,
    wrongTargetRate: 0.008,
    prioritySlipRate: 0.006,
    decisionIntervalMs: 110,
  },
].map((profile) => ({
  ...profile,
  ...COMMON_TACTIC_PROFILE,
}))

const LEARNING_BALANCE_PROFILES = [
  {
    id: 'learning-220ms-low-error',
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
    endCastStopWindowMs: 800,
    preserveKeyStopSkills: true,
    evaluateEnemySkillImpact: true,
    preferControlForChanneling: true,
  },
]

const LEARNING_CAST_STRATEGIES = [
  {
    id: 'broad-window',
    profileOverrides: {
      endCastStopWindowMs: 1400,
      preserveKeyStopSkills: true,
      evaluateEnemySkillImpact: true,
      preferControlForChanneling: true,
    },
  },
  {
    id: 'balanced-window',
    profileOverrides: {
      endCastStopWindowMs: 850,
      preserveKeyStopSkills: true,
      evaluateEnemySkillImpact: true,
      preferControlForChanneling: true,
    },
  },
  {
    id: 'late-window',
    profileOverrides: {
      endCastStopWindowMs: 450,
      preserveKeyStopSkills: true,
      evaluateEnemySkillImpact: true,
      preferControlForChanneling: true,
    },
  },
  {
    id: 'broad-low-mid-casts',
    profileOverrides: {
      endCastStopWindowMs: 1200,
      preserveKeyStopSkills: false,
      evaluateEnemySkillImpact: true,
      preferControlForChanneling: true,
    },
  },
]

const LEARNING_TACTICAL_STRATEGIES = [
  {
    id: 'strict-threat',
    profileOverrides: {
      targetPriorityMode: 'threat_first',
      irregularThreatPolicy: 'strict',
      minimumTargetStickMs: 900,
      preemptiveDefenseHorizonMs: 2500,
    },
  },
  {
    id: 'kill-high-impact',
    profileOverrides: {
      targetPriorityMode: 'kill_high_impact',
      irregularThreatPolicy: 'periodic',
      minimumTargetStickMs: 1000,
      preemptiveDefenseHorizonMs: 3000,
    },
  },
  {
    id: 'allow-irregular-leak',
    profileOverrides: {
      targetPriorityMode: 'kill_high_impact',
      irregularThreatPolicy: 'allow_leak_when_tank_pressure_high',
      minimumTargetStickMs: 1200,
      preemptiveDefenseHorizonMs: 3500,
    },
  },
  {
    id: 'mechanic-focus',
    profileOverrides: {
      targetPriorityMode: 'mechanic_focus',
      irregularThreatPolicy: 'periodic',
      minimumTargetStickMs: 1200,
      preemptiveDefenseHorizonMs: 3200,
    },
  },
  {
    id: 'mechanic-wax-party-chain',
    profileOverrides: {
      targetPriorityMode: 'mechanic_focus',
      irregularThreatPolicy: 'allow_leak_when_tank_pressure_high',
      mechanicChainPlan: 'wax_party_then_hoe_party',
      minimumTargetStickMs: 1200,
      preemptiveDefenseHorizonMs: 3500,
    },
  },
  {
    id: 'mechanic-wax-tank-chain',
    profileOverrides: {
      targetPriorityMode: 'mechanic_focus',
      irregularThreatPolicy: 'periodic',
      mechanicChainPlan: 'wax_tank_then_hoe_tank',
      minimumTargetStickMs: 1200,
      preemptiveDefenseHorizonMs: 3500,
    },
  },
]

function parseCliOptions(args) {
  let sample = 'normal'
  let area = null
  let stages = []
  let classId = 'warrior_t'
  for (const arg of args) {
    if (arg === '--quick') {
      sample = 'quick'
    } else if (arg.startsWith('--area=')) {
      area = arg.slice('--area='.length).trim() || null
    } else if (arg.startsWith('--stage=')) {
      stages = [arg.slice('--stage='.length).trim()].filter(Boolean)
    } else if (arg.startsWith('--stages=')) {
      stages = arg.slice('--stages='.length).split(',').map((stageId) => stageId.trim()).filter(Boolean)
    } else if (arg.startsWith('--sample=')) {
      const value = arg.slice('--sample='.length).trim()
      if (value === 'quick' || value === 'normal' || value === 'full') {
        sample = value
      }
    } else if (arg.startsWith('--class=')) {
      classId = arg.slice('--class='.length).trim() || 'warrior_t'
    } else if (arg.startsWith('--budget=')) {
      const value = arg.slice('--budget='.length).trim()
      if (value === 'quick' || value === 'normal' || value === 'full') {
        sample = value
      }
    }
  }

  return { sample, area, stages, classId }
}

function getRequestedChapters() {
  const requestedStageIds = new Set(cliOptions.stages)
  const areaFilteredChapters = !cliOptions.area
    ? CHAPTERS
    : CHAPTERS.filter((chapter) => chapter.areaId.toLowerCase() === cliOptions.area.toLowerCase())

  if (cliOptions.area && areaFilteredChapters.length === 0) {
    throw new Error(`Unknown strategy tips area: ${cliOptions.area}`)
  }

  if (requestedStageIds.size === 0) {
    return areaFilteredChapters
  }

  const chapters = areaFilteredChapters
    .map((chapter) => ({
      ...chapter,
      stageIds: chapter.stageIds.filter((stageId) => requestedStageIds.has(stageId)),
    }))
    .filter((chapter) => chapter.stageIds.length > 0)

  if (chapters.length === 0) {
    throw new Error(`Unknown strategy tips stage(s): ${cliOptions.stages.join(',')}`)
  }

  return chapters
}

function readWorkbook(fileName) {
  return XLSX.readFile(path.join(designerDataDir, fileName))
}

function loadStoryDesignerData() {
  applyStageWorkbookOverrides(parseStageWorkbook(readWorkbook('stage_content.xlsx')))
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(readWorkbook('encounter_balance.xlsx')))
  applyEnemyWorkbookOverrides(parseEnemyWorkbook(readWorkbook('enemy_data.xlsx')))
  applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(readWorkbook('player_build.xlsx')))
}

function prependUniqueBuildCandidates(...candidateGroups) {
  const results = []
  const seen = new Set()

  for (const group of candidateGroups) {
    for (const candidate of group) {
      const signature = getBuildSignature(candidate.build)
      if (seen.has(signature)) {
        continue
      }
      seen.add(signature)
      results.push(candidate)
    }
  }

  return results
}

function fixedLearningCandidatesFromAnalysis(analysis, classId) {
  const generated = selectLearningBuildCandidatesFromFixedAnalysis(
    analysis.scenarios,
    analysis.analyzedBuilds ?? [],
    {
      minBuildCount: 5,
      maxBuildCount: 10,
      gapThreshold: 0.07,
    },
  )

  if (generated.length > 0) {
    return generated
  }

  return analysis.bestBuildsByProfile.map((summary) => ({
    id: summary.buildId,
    classId,
    build: {
      loadout: summary.loadout,
      passiveTalentIds: summary.passiveTalentIds,
    },
  }))
}

function createLearningCandidates(stage, classId, mode, fixedCandidates, signals) {
  const tipCandidates = mode === 'baseline'
    ? generateStrategyTipBuildCandidates(stage, classId, { maxCandidates: 4 })
    : []
  const candidates = prependUniqueBuildCandidates(tipCandidates, fixedCandidates)

  if (mode === 'violated') {
    return filterViolatedBuildCandidates(candidates, signals)
  }

  return candidates
}

function createModeNotes(mode, signals, candidateCount) {
  if (mode === 'baseline') {
    return [`保留 strategyTips 与提示优先构筑候选；候选构筑 ${candidateCount} 个。`]
  }
  if (mode === 'low_attention') {
    return [`不插入 strategyTips 优先构筑候选，但保留提示文本参与战术过滤；候选构筑 ${candidateCount} 个。`]
  }
  if (mode === 'ignored') {
    return [`清空 strategyTips，并且不插入提示优先构筑候选；候选构筑 ${candidateCount} 个。`]
  }
  if (signals.length === 0) {
    return [`未识别到可稳定反向验证的提示项，本模式等价于完全忽视；候选构筑 ${candidateCount} 个。`]
  }

  return [`清空 strategyTips，并排除可识别的提示对齐构筑/战术；候选构筑 ${candidateCount} 个。`]
}

function runLearningForMode({ stage, classId, fixedCandidates, signals, mode, sampleConfig }) {
  const learningStage = mode === 'ignored' || mode === 'violated'
    ? createStageWithoutStrategyTips(stage)
    : stage
  const buildCandidates = createLearningCandidates(stage, classId, mode, fixedCandidates, signals)
  const castStrategies = mode === 'violated'
    ? filterViolatedCastStrategies(LEARNING_CAST_STRATEGIES, signals)
    : LEARNING_CAST_STRATEGIES
  const tacticalStrategies = mode === 'violated'
    ? filterViolatedTacticalStrategies(LEARNING_TACTICAL_STRATEGIES, signals)
    : LEARNING_TACTICAL_STRATEGIES
  const analysis = runLearningStageBalanceAnalysis({
    stage: learningStage,
    classId,
    profiles: LEARNING_BALANCE_PROFILES,
    buildCandidates,
    castStrategies,
    tacticalStrategies,
    phaseOneAttemptsPerScenario: sampleConfig.learningPhaseOneAttempts,
    finalBuildCount: sampleConfig.learningFinalBuildCount,
    finalStrategyCount: sampleConfig.learningFinalStrategyCount,
    attemptsPerScenario: sampleConfig.learningAttempts,
    maxDurationMs: 120_000,
    collectDiagnostics: false,
  })

  return createStrategyTipsModeResult(mode, analysis, createModeNotes(mode, signals, buildCandidates.length))
}

function analyzeStage(stageId, classId, sampleConfig) {
  const stage = getStageById(stageId)
  if (!stage) {
    throw new Error(`Missing stage: ${stageId}`)
  }

  console.log(`[strategy-tips] ${stageId}: fixed candidates start`)
  const fixedAnalysis = runTwoPhaseStageBalanceAnalysis({
    stage,
    classId,
    profiles: BALANCE_PROFILES,
    phaseOneAttemptsPerScenario: sampleConfig.fixedPhaseOneAttempts,
    phaseOneMaxActiveBuilds: sampleConfig.fixedPhaseOneMaxActiveBuilds,
    phaseOneMaxPassiveVariants: sampleConfig.fixedPhaseOneMaxPassiveVariants,
    finalBuildCount: sampleConfig.fixedFinalBuildCount,
    attemptsPerScenario: sampleConfig.fixedAttempts,
    maxDurationMs: 120_000,
    collectDiagnostics: false,
  })
  const fixedCandidates = fixedLearningCandidatesFromAnalysis(fixedAnalysis, classId)
  const signals = classifyStrategyTipSignals(stage.strategyTips)

  console.log(`[strategy-tips] ${stageId}: learning modes start`)
  const baseline = runLearningForMode({ stage, classId, fixedCandidates, signals, mode: 'baseline', sampleConfig })
  const lowAttention = runLearningForMode({ stage, classId, fixedCandidates, signals, mode: 'low_attention', sampleConfig })
  const ignored = runLearningForMode({ stage, classId, fixedCandidates, signals, mode: 'ignored', sampleConfig })
  const violated = runLearningForMode({ stage, classId, fixedCandidates, signals, mode: 'violated', sampleConfig })

  console.log(
    `[strategy-tips] ${stageId}: done baseline=${Math.round(baseline.bestPassRate * 100)}%, ignored=${Math.round(ignored.bestPassRate * 100)}%`,
  )

  return {
    stageId,
    classId,
    buildRuleId: getStageBuildRuleId(stage),
    title: stage.title,
    strategyTips: stage.strategyTips ?? '',
    signals,
    baseline,
    lowAttention,
    ignored,
    violated,
    dependency: summarizeStrategyTipDependency(baseline.bestPassRate, ignored.bestPassRate),
  }
}

function writeChapterReport(chapter, stages, sampleLabel) {
  const report = {
    title: chapter.title,
    generatedAt: new Date().toISOString(),
    sampleLabel,
    stages,
  }
  const markdownPath = path.join(outputDir, chapter.markdown.replace(/\.md$/, `-${cliOptions.classId}.md`))
  const jsonPath = path.join(outputDir, chapter.json.replace(/\.json$/, `-${cliOptions.classId}.json`))

  fs.writeFileSync(markdownPath, renderStrategyTipsSensitivityMarkdown(report), 'utf8')
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  return { markdownPath, jsonPath }
}

function formatPath(filePath) {
  return path.relative(projectRoot, filePath)
}

const cliOptions = parseCliOptions(process.argv.slice(2))
getPlayerClassRuntimeDefinition(cliOptions.classId)
const sampleConfig = SAMPLE_CONFIGS[cliOptions.sample]

loadStoryDesignerData()
fs.mkdirSync(outputDir, { recursive: true })

for (const chapter of getRequestedChapters()) {
  const stages = chapter.stageIds.map((stageId) => analyzeStage(stageId, cliOptions.classId, sampleConfig))
  const paths = writeChapterReport(chapter, stages, cliOptions.sample)
  console.log(`[strategy-tips] report written: ${formatPath(paths.markdownPath)}`)
  console.log(`[strategy-tips] compact json written: ${formatPath(paths.jsonPath)}`)
}
