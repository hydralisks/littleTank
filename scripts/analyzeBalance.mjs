import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import {
  appendEncounterWorkbookOverrides,
  applyEncounterWorkbookOverrides,
  createEncounterTemplate,
} from '../src/game/data/encounterTemplates.ts'
import {
  applyEnemyWorkbookOverrides,
  getEnemySkillDefinition,
  getEnemyStatusDefinition,
} from '../src/game/data/enemyCatalog.ts'
import {
  applyStageWorkbookOverrides,
  getPassiveTalentUnlockTierForStage,
  getStageById,
  getUnlockedActiveSkillIdsForStage,
} from '../src/game/data/stageTemplates.ts'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../src/game/data/workbookLoader.ts'
import {
  SKILL_HOTKEYS,
  applyPlayerBuildWorkbookOverrides,
  getActiveSkillCatalog,
  getPassiveTalentCatalog,
  normalizePersistedBuildForRule,
} from '../src/game/data/playerBuildCatalog.ts'
import {
  getManualDifficultyBaseline,
  RINGING_DEEPS_MANUAL_BASELINES,
  renderBalanceReportMarkdown,
} from '../src/game/balance/balanceReport.ts'
import {
  runTwoPhaseStageBalanceAnalysis,
  selectLearningBuildCandidatesFromFixedAnalysis,
} from '../src/game/balance/balanceSimulator.ts'
import {
  buildDataEstimateReport,
  renderDataEstimateMarkdown,
} from '../src/game/balance/dataEstimateReport.ts'
import {
  buildMonsterCodexEstimateReport,
  renderMonsterCodexEstimateMarkdown,
} from '../src/game/balance/monsterCodexEstimateReport.ts'
import {
  generateStrategyTipBuildCandidates,
  getBuildSignature,
} from '../src/game/balance/balanceBuildGenerator.ts'
import {
  buildManualPlaytestCandidateForStage,
  getManualPlaytestEntryForStage,
  parseManualPlaytestWorkbook,
} from '../src/game/balance/manualPlaytestBuilds.ts'
import { scoreStageStaticDifficulty } from '../src/game/balance/staticStageScoring.ts'
import { runLearningStageBalanceAnalysis } from '../src/game/balance/learningBalanceEvaluator.ts'
import { createBalanceDesignRecommendation } from '../src/game/balance/balanceRecommendation.ts'
import {
  renderBalanceReportDiffMarkdown,
  summarizeBalanceReportDiff,
} from '../src/game/balance/balanceReportDiff.ts'
import { stripCombatLogTraceFromBalanceReport } from '../src/game/balance/balanceReportSanitizer.ts'
import {
  buildCombatTimeline,
  renderCombatTimelineMarkdown,
} from '../src/game/encounter/combatTimeline.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')
const manualPlaytestBuildsPath = path.join(designerDataDir, 'manual_playtest_builds.xlsx')
const outputDir = path.join(projectRoot, 'reports', 'balance')
const storyOutputDir = path.join(outputDir, 'story')
const challengeOutputDir = path.join(outputDir, 'challenge')
const dataEstimateOutputDir = path.join(projectRoot, 'reports', 'data_estimate')
const dataEstimateStoryOutputDir = path.join(dataEstimateOutputDir, 'story')
const dataEstimateChallengeOutputDir = path.join(dataEstimateOutputDir, 'challenge')
const cliOptions = parseCliOptions(process.argv.slice(2))
let manualPlaytestEntries = []
const CHINESE_REPORT_FILE_NAMES = {
  'chapter-one': {
    title: '第一章自动评分',
    markdown: '第一章自动评分.md',
    json: '第一章自动评分.json',
    diffMarkdown: '第一章自动评分-变更对比.md',
  },
  westfall: {
    title: '第二章自动评分',
    markdown: '第二章自动评分.md',
    json: '第二章自动评分.json',
    diffMarkdown: '第二章自动评分-变更对比.md',
  },
  "zul'aman": {
    title: '第三章自动评分',
    markdown: '第三章自动评分.md',
    json: '第三章自动评分.json',
    diffMarkdown: '第三章自动评分-变更对比.md',
  },
  challenge: {
    title: '挑战模式自动评分',
    markdown: '第1~3关自动评分.md',
    json: '第1~3关自动评分.json',
    diffMarkdown: '第1~3关自动评分-变更对比.md',
  },
  'custom-stages': {
    title: '自定义关卡自动评分',
    markdown: '自定义关卡自动评分.md',
    json: '自定义关卡自动评分.json',
    diffMarkdown: '自定义关卡自动评分-变更对比.md',
  },
}
const CHALLENGE_REPORT_GROUP_SIZE = 3
const DATA_ESTIMATE_STORY_GROUPS = [
  {
    fileName: '第一章数值估算',
    outputDir: dataEstimateStoryOutputDir,
    stageIds: ['RingingDeeps-1', 'RingingDeeps-2', 'RingingDeeps-3', 'RingingDeeps-4', 'RingingDeeps-5', 'RingingDeeps-6'],
  },
  {
    fileName: '第二章数值估算',
    outputDir: dataEstimateStoryOutputDir,
    stageIds: ['WestFall-1', 'WestFall-2', 'WestFall-3', 'WestFall-4', 'WestFall-5', 'WestFall-6'],
  },
  {
    fileName: '第三章数值估算',
    outputDir: dataEstimateStoryOutputDir,
    stageIds: ["Zul'Aman-1", "Zul'Aman-2", "Zul'Aman-3", "Zul'Aman-4", "Zul'Aman-5", "Zul'Aman-6"],
  },
]
const DATA_ESTIMATE_CHALLENGE_GROUPS = [
  {
    fileName: '挑战模式1~3关数值估算',
    outputDir: dataEstimateChallengeOutputDir,
    stageIds: ['Challenge-1', 'Challenge-2', 'Challenge-3'],
  },
  {
    fileName: '挑战模式4~6关数值估算',
    outputDir: dataEstimateChallengeOutputDir,
    stageIds: ['Challenge-4', 'Challenge-5', 'Challenge-6'],
  },
]
const FULL_SAMPLE_CONFIG = {
  fixedPhaseOneAttempts: 20,
  fixedPhaseOneMaxActiveBuilds: 18,
  fixedPhaseOneMaxPassiveVariants: 3,
  fixedFinalBuildCount: 6,
  fixedAttempts: 100,
  learningPhaseOneAttempts: 8,
  learningFinalBuildCount: 4,
  learningFinalStrategyCount: 2,
  learningAttempts: 100,
}
const QUICK_SAMPLE_CONFIG = {
  fixedPhaseOneAttempts: 3,
  fixedPhaseOneMaxActiveBuilds: 8,
  fixedPhaseOneMaxPassiveVariants: 2,
  fixedFinalBuildCount: 3,
  fixedAttempts: 12,
  learningPhaseOneAttempts: 2,
  learningFinalBuildCount: 2,
  learningFinalStrategyCount: 1,
  learningAttempts: 12,
}
const NORMAL_SAMPLE_CONFIG = {
  fixedPhaseOneAttempts: 8,
  fixedPhaseOneMaxActiveBuilds: 12,
  fixedPhaseOneMaxPassiveVariants: 3,
  fixedFinalBuildCount: 4,
  fixedAttempts: 40,
  learningPhaseOneAttempts: 4,
  learningFinalBuildCount: 3,
  learningFinalStrategyCount: 2,
  learningAttempts: 40,
}

const RAW_BALANCE_PROFILES = [
  {
    id: 'average1-1000ms-5pct',
    tier: 'average',
    reactionDelayMs: 1000,
    reactionDelayJitterMs: 250,
    reactionDelayFastChance: 0.08,
    reactionDelayFastMs: 200,
    mistakeRate: 0.05,
    forgetSkillRate: 0.02,
    wrongTargetRate: 0.02,
    prioritySlipRate: 0.01,
    decisionIntervalMs: 350,
    preserveKeyStopSkills: false,
    evaluateEnemySkillImpact: false,
    preferControlForChanneling: false,
  },
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
    preserveKeyStopSkills: false,
    evaluateEnemySkillImpact: false,
    preferControlForChanneling: false,
  },
  {
    id: 'average3-500ms-15pct',
    tier: 'average',
    reactionDelayMs: 500,
    reactionDelayJitterMs: 200,
    reactionDelayFastChance: 0.15,
    reactionDelayFastMs: 180,
    mistakeRate: 0.15,
    forgetSkillRate: 0.06,
    wrongTargetRate: 0.05,
    prioritySlipRate: 0.04,
    decisionIntervalMs: 250,
    preserveKeyStopSkills: false,
    evaluateEnemySkillImpact: false,
    preferControlForChanneling: false,
  },
  {
    id: 'skilled1-450ms-3pct',
    tier: 'skilled',
    reactionDelayMs: 450,
    reactionDelayJitterMs: 150,
    reactionDelayFastChance: 0.1,
    reactionDelayFastMs: 160,
    mistakeRate: 0.03,
    forgetSkillRate: 0.01,
    wrongTargetRate: 0.01,
    prioritySlipRate: 0.01,
    decisionIntervalMs: 220,
    endCastStopWindowMs: 850,
    preserveKeyStopSkills: true,
    evaluateEnemySkillImpact: true,
    preferControlForChanneling: true,
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
    endCastStopWindowMs: 750,
    preserveKeyStopSkills: true,
    evaluateEnemySkillImpact: true,
    preferControlForChanneling: true,
  },
  {
    id: 'skilled3-200ms-8pct',
    tier: 'skilled',
    reactionDelayMs: 200,
    reactionDelayJitterMs: 90,
    reactionDelayFastChance: 0.15,
    reactionDelayFastMs: 100,
    mistakeRate: 0.08,
    forgetSkillRate: 0.03,
    wrongTargetRate: 0.03,
    prioritySlipRate: 0.02,
    decisionIntervalMs: 150,
    endCastStopWindowMs: 650,
    preserveKeyStopSkills: true,
    evaluateEnemySkillImpact: true,
    preferControlForChanneling: true,
  },
  {
    id: 'expert1-200ms-1pct',
    tier: 'expert',
    reactionDelayMs: 200,
    reactionDelayJitterMs: 80,
    reactionDelayFastChance: 0.12,
    reactionDelayFastMs: 90,
    mistakeRate: 0.01,
    forgetSkillRate: 0.003,
    wrongTargetRate: 0.004,
    prioritySlipRate: 0.003,
    decisionIntervalMs: 120,
    endCastStopWindowMs: 550,
    preserveKeyStopSkills: true,
    evaluateEnemySkillImpact: true,
    preferControlForChanneling: true,
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
    endCastStopWindowMs: 500,
    preserveKeyStopSkills: true,
    evaluateEnemySkillImpact: true,
    preferControlForChanneling: true,
  },
  {
    id: 'expert3-100ms-3pct',
    tier: 'expert',
    reactionDelayMs: 100,
    reactionDelayJitterMs: 50,
    reactionDelayFastChance: 0.18,
    reactionDelayFastMs: 60,
    mistakeRate: 0.03,
    forgetSkillRate: 0.01,
    wrongTargetRate: 0.01,
    prioritySlipRate: 0.01,
    decisionIntervalMs: 100,
    endCastStopWindowMs: 450,
    preserveKeyStopSkills: true,
    evaluateEnemySkillImpact: true,
    preferControlForChanneling: true,
  },
]

const COMMON_TACTIC_PROFILE = {
  endCastStopWindowMs: 800,
  preserveKeyStopSkills: true,
  evaluateEnemySkillImpact: true,
  preferControlForChanneling: true,
}

const BALANCE_PROFILES = RAW_BALANCE_PROFILES.map((profile) => ({
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

const LABEL_RANK = {
  trivial: 0,
  easy: 1,
  balanced: 2,
  hard: 3,
  expert: 4,
  near_impossible: 5,
  impossible: 6,
  invalid_data: 7,
}

function readWorkbook(fileName) {
  return XLSX.readFile(path.join(designerDataDir, fileName))
}

function loadManualPlaytestEntries() {
  if (!fs.existsSync(manualPlaytestBuildsPath)) {
    return []
  }

  try {
    const entries = parseManualPlaytestWorkbook(XLSX.readFile(manualPlaytestBuildsPath))
    console.log(`[balance] manual playtest builds loaded: ${entries.length}`)
    return entries
  } catch (error) {
    console.warn(`[balance] unable to read manual playtest builds: ${error.message}`)
    return []
  }
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return []
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
}

function readBoolean(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (text === '') {
    return true
  }

  return ['true', '1', 'yes', 'y'].includes(text)
}

function parseCsv(value) {
  return String(value ?? '')
    .split(/[,，]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeLookupText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function createActiveSkillLookup() {
  const lookup = new Map()
  for (const skill of getActiveSkillCatalog()) {
    for (const key of [skill.id, skill.name, skill.shortName]) {
      const normalizedKey = normalizeLookupText(key)
      if (normalizedKey) {
        lookup.set(normalizedKey, skill.id)
      }
    }
  }
  return lookup
}

function createPassiveTalentLookup() {
  const lookup = new Map()
  for (const talent of getPassiveTalentCatalog()) {
    for (const key of [talent.id, talent.name]) {
      const normalizedKey = normalizeLookupText(key)
      if (normalizedKey) {
        lookup.set(normalizedKey, talent.id)
      }
    }
  }
  return lookup
}

function resolveRecommendedIds(value, lookup) {
  return parseCsv(value)
    .map((entry) => lookup.get(normalizeLookupText(entry)))
    .filter(Boolean)
}

function buildChallengeRecommendedBuildCandidate(row, stage) {
  const activeSkillIds = resolveRecommendedIds(row.recommendedActiveSkillNamesCsv, createActiveSkillLookup())
  const passiveTalentIds = resolveRecommendedIds(row.recommendedPassiveTalentNamesCsv, createPassiveTalentLookup())
  if (activeSkillIds.length === 0 && passiveTalentIds.length === 0) {
    return null
  }

  const loadout = Object.fromEntries(SKILL_HOTKEYS.map((hotkey) => [hotkey, null]))
  for (let index = 0; index < Math.min(activeSkillIds.length, SKILL_HOTKEYS.length); index += 1) {
    loadout[SKILL_HOTKEYS[index]] = activeSkillIds[index]
  }

  const normalized = normalizePersistedBuildForRule(
    { loadout, passiveTalentIds },
    row.buildRuleId ? String(row.buildRuleId) : 'standard_5slot',
    getPassiveTalentUnlockTierForStage(stage),
    getUnlockedActiveSkillIdsForStage(stage),
    [],
  ).build

  return {
    id: 'challenge_recommended',
    build: normalized,
  }
}

function buildChallengeStageWorkbookOverrides(challengeStageWorkbook) {
  const parsedStageWorkbook = parseStageWorkbook(challengeStageWorkbook)
  const challengeRows = readSheetRows(challengeStageWorkbook, '关卡')
    .filter((row) => row.stageId && readBoolean(row.enabled))

  return {
    ...parsedStageWorkbook,
    stageOverrides: challengeRows.map((row, index) => ({
      ...(parsedStageWorkbook.stageOverrides.find((override) => override.stageId === String(row.stageId)) ?? {}),
      stageId: String(row.stageId),
      areaId: 'Challenge',
      order: Number(row.order) || index + 1,
    })),
    updateCampaignOrder: false,
  }
}

function readChallengeStageEntries(challengeStageWorkbook) {
  return readSheetRows(challengeStageWorkbook, '关卡')
    .filter((row) => row.stageId && readBoolean(row.enabled))
    .map((row, index) => ({
      index: index + 1,
      stageId: String(row.stageId),
      title: String(row.title || row.stageId),
      manualLabel: String(row.recommendedDifficulty || 'unrated'),
      sourceStageIds: parseCsv(row.sourceStageIdsCsv),
      buildRuleId: String(row.buildRuleId || ''),
      recommendedActiveSkillNamesCsv: String(row.recommendedActiveSkillNamesCsv || ''),
      recommendedPassiveTalentNamesCsv: String(row.recommendedPassiveTalentNamesCsv || ''),
    }))
}

function filterRequestedChallengeEntries(entries) {
  if (cliOptions.stages.length === 0) {
    return entries
  }

  const requestedStageIds = new Set(cliOptions.stages)
  return entries.filter((entry) => requestedStageIds.has(entry.stageId))
}

function loadDesignerDataIntoCatalogs() {
  const stageWorkbook = parseStageWorkbook(readWorkbook('stage_content.xlsx'))
  applyStageWorkbookOverrides(stageWorkbook)
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(readWorkbook('encounter_balance.xlsx')))
  applyEnemyWorkbookOverrides(parseEnemyWorkbook(readWorkbook('enemy_data.xlsx')))
  applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(readWorkbook('player_build.xlsx')))
  manualPlaytestEntries = loadManualPlaytestEntries()
  const challengeStageContentWorkbook = readWorkbook('challenge_stage_content.xlsx')
  const challengeEntries = readChallengeStageEntries(challengeStageContentWorkbook)
  if (!cliOptions.challenge) {
    return {
      ...stageWorkbook,
      allChallengeEntries: challengeEntries,
    }
  }

  applyChallengeDesignerDataIntoCatalogs()

  return {
    ...buildChallengeStageWorkbookOverrides(challengeStageContentWorkbook),
    challengeEntries: filterRequestedChallengeEntries(challengeEntries),
    allChallengeEntries: challengeEntries,
  }
}

function applyChallengeDesignerDataIntoCatalogs() {
  const challengeStageContentWorkbook = readWorkbook('challenge_stage_content.xlsx')
  const challengeEncounterWorkbook = readWorkbook('challenge_encounter_balance.xlsx')
  const challengeStageWorkbook = buildChallengeStageWorkbookOverrides(challengeStageContentWorkbook)
  applyStageWorkbookOverrides(challengeStageWorkbook)
  appendEncounterWorkbookOverrides(
    parseEncounterWorkbook(challengeEncounterWorkbook),
    { stageIdPrefix: 'Challenge-' },
  )
}

function applyStoryDesignerDataIntoCatalogs() {
  applyStageWorkbookOverrides(parseStageWorkbook(readWorkbook('stage_content.xlsx')))
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(readWorkbook('encounter_balance.xlsx')))
}

function parseCliOptions(args) {
  const options = {
    area: null,
    stages: [],
    sample: 'full',
    budget: 'full',
    trace: false,
    challenge: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--area=')) {
      options.area = arg.slice('--area='.length).trim()
    } else if (arg.startsWith('--stage=')) {
      options.stages = [arg.slice('--stage='.length).trim()].filter(Boolean)
    } else if (arg.startsWith('--stages=')) {
      options.stages = arg.slice('--stages='.length).split(',').map((stageId) => stageId.trim()).filter(Boolean)
    } else if (arg === '--quick') {
      options.sample = 'quick'
      options.budget = 'quick'
    } else if (arg === '--challenge') {
      options.challenge = true
      options.area = null
    } else if (arg === '--trace') {
      options.trace = true
    } else if (arg.startsWith('--budget=')) {
      const budget = arg.slice('--budget='.length).trim()
      if (budget === 'quick' || budget === 'normal' || budget === 'full') {
        options.sample = budget
        options.budget = budget
      }
    } else if (arg.startsWith('--sample=')) {
      const sample = arg.slice('--sample='.length).trim()
      if (sample === 'quick' || sample === 'normal' || sample === 'full') {
        options.sample = sample
        options.budget = sample
      }
    }
  }

  return options
}

function getSampleConfig() {
  if (cliOptions.sample === 'quick') {
    return QUICK_SAMPLE_CONFIG
  }

  if (cliOptions.sample === 'normal') {
    return NORMAL_SAMPLE_CONFIG
  }

  return FULL_SAMPLE_CONFIG
}

function getReportSlug() {
  if (cliOptions.challenge) {
    return 'challenge'
  }
  if (cliOptions.area) {
    return cliOptions.area.toLowerCase()
  }
  if (cliOptions.stages.length > 0) {
    return 'custom-stages'
  }
  return 'chapter-one'
}

function getReportTitle() {
  if (cliOptions.challenge) {
    return '挑战模式自动评测'
  }

  const reportSlug = getReportSlug()
  if (CHINESE_REPORT_FILE_NAMES[reportSlug]?.title) {
    return CHINESE_REPORT_FILE_NAMES[reportSlug].title
  }

  if (cliOptions.area) {
    return `${cliOptions.area} 自动评分`
  }
  if (cliOptions.stages.length > 0) {
    return '自定义关卡自动评分'
  }
  return '第一章自动评分'
}

function getChineseReportBaseName(reportSlug) {
  if (reportSlug === 'challenge') {
    return '挑战模式自动评测'
  }
  if (reportSlug === 'chapter-one') {
    return '第一章自动评分'
  }
  if (reportSlug === 'westfall') {
    return '第二章自动评分'
  }
  if (reportSlug === "zul'aman") {
    return '第三章自动评分'
  }
  if (reportSlug === 'custom-stages') {
    return '自定义关卡自动评分'
  }

  return `${getReportTitle()}`
}

function getReportOutputPaths(reportSlug) {
  const targetOutputDir = cliOptions.challenge ? challengeOutputDir : storyOutputDir
  const fileNames = CHINESE_REPORT_FILE_NAMES[reportSlug] ?? {
    markdown: `${getChineseReportBaseName(reportSlug)}.md`,
    json: `${getChineseReportBaseName(reportSlug)}.json`,
    diffMarkdown: `${getChineseReportBaseName(reportSlug)}-变更对比.md`,
  }

  return {
    outputDir: targetOutputDir,
    json: path.join(targetOutputDir, fileNames.json),
    markdown: path.join(targetOutputDir, fileNames.markdown),
    diffMarkdown: path.join(targetOutputDir, fileNames.diffMarkdown),
    legacyJson: path.join(targetOutputDir, `${reportSlug}-auto-scoring.json`),
  }
}

function getLegacyAutoScoringMarkdownPath(reportSlug) {
  if (reportSlug === 'chapter-one' || reportSlug === 'westfall' || reportSlug === "zul'aman") {
    return null
  }

  return path.join(storyOutputDir, `${reportSlug}-auto-scoring.md`)
}

function getLatestReportAreaLabel() {
  if (cliOptions.challenge) {
    return '挑战模式'
  }
  if (cliOptions.area) {
    return cliOptions.area
  }
  if (cliOptions.stages.length > 0) {
    return '自定义关卡'
  }

  return 'RingingDeeps'
}

function formatReportPathForConsole(filePath) {
  return path.relative(projectRoot, filePath)
}

function writeReportArtifacts(report, serializableReport, reportSlug, previousReport, outputPaths) {
  const chapterMarkdown = renderChapterAutoScoringMarkdown(report)

  fs.writeFileSync(path.join(outputPaths.outputDir, 'latest.json'), `${JSON.stringify(serializableReport, null, 2)}\n`)
  fs.writeFileSync(path.join(outputPaths.outputDir, 'latest.md'), renderBalanceReportMarkdown(report))
  fs.writeFileSync(outputPaths.json, `${JSON.stringify(serializableReport, null, 2)}\n`)
  fs.writeFileSync(outputPaths.markdown, chapterMarkdown)

  const legacyMarkdownPath = getLegacyAutoScoringMarkdownPath(reportSlug)
  if (legacyMarkdownPath) {
    fs.writeFileSync(legacyMarkdownPath, chapterMarkdown)
  }

  if (previousReport) {
    fs.writeFileSync(
      outputPaths.diffMarkdown,
      renderBalanceReportDiffMarkdown(summarizeBalanceReportDiff(previousReport, serializableReport)),
    )
  }

  return {
    latestMarkdownPath: path.join(outputPaths.outputDir, 'latest.md'),
    autoScoringMarkdownPath: outputPaths.markdown,
    diffMarkdownPath: previousReport ? outputPaths.diffMarkdown : null,
  }
}

function writeChallengeReportArtifacts(report) {
  if (!cliOptions.challenge) {
    return []
  }

  const writtenPaths = []

  for (let startIndex = CHALLENGE_REPORT_GROUP_SIZE; startIndex < report.stages.length; startIndex += CHALLENGE_REPORT_GROUP_SIZE) {
    const groupedStages = report.stages.slice(startIndex, startIndex + CHALLENGE_REPORT_GROUP_SIZE)
    const firstStageNumber = startIndex + 1
    const lastStageNumber = startIndex + groupedStages.length
    const groupedReport = {
      ...report,
      stages: groupedStages,
    }
    const serializableGroupedReport = stripCombatLogTraceFromBalanceReport(groupedReport)
    const markdownFileName = `第${firstStageNumber}~${lastStageNumber}关自动评分.md`
    const baseName = path.basename(markdownFileName, '.md')
    const markdownPath = path.join(challengeOutputDir, markdownFileName)
    const jsonPath = path.join(challengeOutputDir, `${baseName}.json`)

    fs.writeFileSync(markdownPath, renderChapterAutoScoringMarkdown(groupedReport))
    fs.writeFileSync(jsonPath, `${JSON.stringify(serializableGroupedReport, null, 2)}\n`)

    writtenPaths.push(markdownPath)
  }

  return writtenPaths
}

function getDataEstimateBaseName(reportSlug) {
  if (reportSlug === 'chapter-one') {
    return '第一章基础数值统计'
  }
  if (reportSlug === 'westfall') {
    return '第二章基础数值统计'
  }
  if (reportSlug === "zul'aman") {
    return '第三章基础数值统计'
  }
  if (reportSlug === 'custom-stages') {
    return '自定义关卡基础数值统计'
  }

  return `${getLatestReportAreaLabel()}基础数值统计`
}

function writeDataEstimateArtifacts(report, reportSlug) {
  if (cliOptions.challenge) {
    return null
  }

  const dataEstimateReport = buildDataEstimateReport({
    generatedAt: report.generatedAt,
    title: getDataEstimateBaseName(reportSlug),
    stages: report.stages,
  })
  const baseName = getDataEstimateBaseName(reportSlug)
  const markdownPath = path.join(dataEstimateStoryOutputDir, `${baseName}.md`)
  const jsonPath = path.join(dataEstimateStoryOutputDir, `${baseName}.json`)

  fs.writeFileSync(path.join(dataEstimateStoryOutputDir, 'latest.md'), renderDataEstimateMarkdown(dataEstimateReport))
  fs.writeFileSync(path.join(dataEstimateStoryOutputDir, 'latest.json'), `${JSON.stringify(dataEstimateReport, null, 2)}\n`)
  fs.writeFileSync(markdownPath, renderDataEstimateMarkdown(dataEstimateReport))
  fs.writeFileSync(jsonPath, `${JSON.stringify(dataEstimateReport, null, 2)}\n`)

  return markdownPath
}

function getChallengeStageNumber(stage, fallbackNumber) {
  const match = String(stage.stageId).match(/(\d+)$/)
  return match ? Number(match[1]) : fallbackNumber
}

function getChallengeDataEstimateGroupBounds(stages) {
  const firstStageNumber = stages.reduce((min, stage, index) =>
    Math.min(min, getChallengeStageNumber(stage, index + 1)),
  Number.POSITIVE_INFINITY)
  const normalizedFirstStageNumber = Number.isFinite(firstStageNumber) ? firstStageNumber : 1
  const firstGroupStageNumber =
    Math.floor((normalizedFirstStageNumber - 1) / CHALLENGE_REPORT_GROUP_SIZE) * CHALLENGE_REPORT_GROUP_SIZE + 1

  return {
    firstStageNumber: firstGroupStageNumber,
    lastStageNumber: firstGroupStageNumber + CHALLENGE_REPORT_GROUP_SIZE - 1,
  }
}

function writeChallengeDataEstimateArtifacts(report) {
  if (!cliOptions.challenge) {
    return []
  }

  const { firstStageNumber, lastStageNumber } = getChallengeDataEstimateGroupBounds(report.stages)
  const title = `挑战模式第${firstStageNumber}~${lastStageNumber}关基础数值统计`
  const dataEstimateReport = buildDataEstimateReport({
    generatedAt: report.generatedAt,
    title,
    stages: report.stages,
  })
  const markdownPath = path.join(dataEstimateChallengeOutputDir, `${title}.md`)
  const jsonPath = path.join(dataEstimateChallengeOutputDir, `${title}.json`)

  fs.writeFileSync(path.join(dataEstimateChallengeOutputDir, 'latest.md'), renderDataEstimateMarkdown(dataEstimateReport))
  fs.writeFileSync(path.join(dataEstimateChallengeOutputDir, 'latest.json'), `${JSON.stringify(dataEstimateReport, null, 2)}\n`)
  fs.writeFileSync(markdownPath, renderDataEstimateMarkdown(dataEstimateReport))
  fs.writeFileSync(jsonPath, `${JSON.stringify(dataEstimateReport, null, 2)}\n`)

  return [markdownPath]
}

function getChallengeEntryByStageId(stageWorkbook, stageId) {
  return (stageWorkbook.allChallengeEntries ?? []).find((entry) => entry.stageId === stageId) ?? null
}

function buildDataEstimateStageEntries(stageWorkbook, group) {
  return group.stageIds.map((stageId) => {
    const challengeEntry = stageId.startsWith('Challenge-')
      ? getChallengeEntryByStageId(stageWorkbook, stageId)
      : null
    return [
      stageId,
      challengeEntry?.manualLabel ?? getManualDifficultyBaseline(stageId),
      challengeEntry,
    ]
  })
}

function writeDataEstimateGroupArtifact(group, stages, generatedAt) {
  const dataEstimateReport = buildDataEstimateReport({
    generatedAt,
    title: group.fileName,
    stages,
  })
  const markdownPath = path.join(group.outputDir, `${group.fileName}.md`)
  const jsonPath = path.join(group.outputDir, `${group.fileName}.json`)

  fs.writeFileSync(markdownPath, renderDataEstimateMarkdown(dataEstimateReport))
  fs.writeFileSync(jsonPath, `${JSON.stringify(dataEstimateReport, null, 2)}\n`)

  return markdownPath
}

function collectMonsterStatusDefinitions(templates) {
  const statusDefinitions = {}

  for (const template of templates) {
    for (const enemy of template.enemies) {
      for (const skill of enemy.skills) {
        for (const statusId of [...skill.appliedTargetStatusIds, ...skill.appliedSelfStatusIds]) {
          if (statusDefinitions[statusId]) {
            continue
          }

          const definition = getEnemyStatusDefinition(statusId)
          if (definition) {
            statusDefinitions[statusId] = {
              statusId: definition.statusId,
              statusName: definition.statusName,
              durationMs: definition.durationMs,
              effectLogicId: definition.effectLogicId,
              kind: definition.kind,
              ...(typeof definition.valueA === 'number' ? { valueA: definition.valueA } : {}),
              ...(typeof definition.valueB === 'number' ? { valueB: definition.valueB } : {}),
              ...(typeof definition.tickIntervalMs === 'number' ? { tickIntervalMs: definition.tickIntervalMs } : {}),
            }
          }
        }
      }
    }
  }

  return statusDefinitions
}

function buildMonsterCodexTemplateEntries(stageWorkbook) {
  return DATA_ESTIMATE_STORY_GROUPS.flatMap((group) =>
    group.stageIds.map((stageId) => {
      const stage = getStageById(stageId)
      const template = createEncounterTemplate(stage)
      return {
        stageId,
        title: stage.title,
        enemies: template.enemies.map((enemy) => ({
          enemyId: enemy.definitionId,
          name: enemy.name,
          maxHp: enemy.maxHp,
          threatLogic: enemy.threatLogic,
          isSkull: enemy.isSkull,
          skillCycle: enemy.skillCycle,
          skills: enemy.skillIds
            .map((skillId) => getEnemySkillDefinition(skillId))
            .filter(Boolean)
            .map((skill) => ({
              skillId: skill.skillId,
              skillName: skill.skillName,
              targetRuleId: skill.targetRuleId,
              castTimeMs: skill.castTimeMs,
              channelingMs: skill.channelingMs,
              recoveryMs: skill.recoveryMs,
              damageType: skill.damageType,
              playerDamage: skill.playerDamage,
              partyDamageOnHit: skill.partyDamageOnHit,
              partyDamageOnMiss: skill.partyDamageOnMiss,
              pressureOnHit: skill.pressureOnHit,
              pressureOnMiss: skill.pressureOnMiss,
              appliedTargetStatusIds: skill.appliedTargetStatusIds,
              appliedSelfStatusIds: skill.appliedSelfStatusIds,
              castBreakRule: skill.castBreakRule,
              dangerLevel: skill.dangerLevel,
            })),
        })),
      }
    }),
  )
}

function writeMonsterCodexDataEstimateArtifact(stageWorkbook, generatedAt) {
  applyStoryDesignerDataIntoCatalogs()
  const templates = buildMonsterCodexTemplateEntries(stageWorkbook)
  const report = buildMonsterCodexEstimateReport({
    generatedAt,
    title: '怪物图鉴数值估算',
    templates,
    statusDefinitions: collectMonsterStatusDefinitions(templates),
  })
  const markdownPath = path.join(dataEstimateStoryOutputDir, '怪物图鉴数值估算.md')
  const jsonPath = path.join(dataEstimateStoryOutputDir, '怪物图鉴数值估算.json')

  fs.writeFileSync(markdownPath, renderMonsterCodexEstimateMarkdown(report))
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)

  return markdownPath
}

function writeCompleteDataEstimateArtifacts(stageWorkbook, generatedAt, sampleConfig) {
  const writtenPaths = []

  applyStoryDesignerDataIntoCatalogs()
  analyzedStageCache.clear()

  for (const group of DATA_ESTIMATE_STORY_GROUPS) {
    const stages = buildDataEstimateStageEntries(stageWorkbook, group)
      .map(([stageId, manualLabel, stageEntry]) =>
        analyzeStageEntry(stageId, manualLabel, stageEntry, sampleConfig),
      )
    writtenPaths.push(writeDataEstimateGroupArtifact(group, stages, generatedAt))
  }

  applyChallengeDesignerDataIntoCatalogs()
  analyzedStageCache.clear()

  for (const group of DATA_ESTIMATE_CHALLENGE_GROUPS) {
    const stages = buildDataEstimateStageEntries(stageWorkbook, group)
      .map(([stageId, manualLabel, stageEntry]) =>
        analyzeStageEntry(stageId, manualLabel, stageEntry, sampleConfig),
      )
    writtenPaths.push(writeDataEstimateGroupArtifact(group, stages, generatedAt))
  }

  return writtenPaths
}

function readPreviousReport(reportPath, legacyReportPath) {
  for (const candidatePath of [reportPath, legacyReportPath]) {
    if (!candidatePath || !fs.existsSync(candidatePath)) {
      continue
    }

    try {
      return JSON.parse(fs.readFileSync(candidatePath, 'utf8'))
    } catch (error) {
      console.warn(`[balance] unable to read previous report diff source (${path.relative(projectRoot, candidatePath)}): ${error.message}`)
    }
  }

  return null
}

function getRequestedStageEntries(stageWorkbook) {
  if (cliOptions.challenge) {
    return (stageWorkbook.challengeEntries ?? []).map((entry) => [entry.stageId, entry.manualLabel, entry])
  }

  const getStoryManualLabel = (stageId) =>
    getManualPlaytestEntryForStage(manualPlaytestEntries, stageId)?.manualDifficulty ??
    getManualDifficultyBaseline(stageId)

  if (cliOptions.stages.length > 0) {
    return cliOptions.stages.map((stageId) => [stageId, getStoryManualLabel(stageId)])
  }

  if (cliOptions.area) {
    return stageWorkbook.stageOverrides
      .filter((stage) => stage.areaId === cliOptions.area && typeof stage.order === 'number')
      .sort((left, right) => {
        const leftOrder = left.order ?? 0
        const rightOrder = right.order ?? 0
        return leftOrder - rightOrder || left.stageId.localeCompare(right.stageId)
      })
      .map((stage) => [stage.stageId, getStoryManualLabel(stage.stageId)])
  }

  return Object.entries(RINGING_DEEPS_MANUAL_BASELINES)
    .map(([stageId, manualLabel]) => [
      stageId,
      getStoryManualLabel(stageId) ?? manualLabel,
    ])
}

function prependUniqueBuildCandidates(...candidateGroups) {
  const candidates = []
  const seen = new Set()

  for (const group of candidateGroups) {
    for (const candidate of group ?? []) {
      if (!candidate) {
        continue
      }
      const signature = getBuildSignature(candidate.build)
      if (seen.has(signature)) {
        continue
      }
      seen.add(signature)
      candidates.push(candidate)
    }
  }

  return candidates
}

function manualRank(manualLabel) {
  if (manualLabel === 'near_impossible / impossible') {
    return LABEL_RANK.near_impossible
  }

  return LABEL_RANK[manualLabel] ?? LABEL_RANK.invalid_data
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`
}

function recommendationFor(manualLabel, automatedLabel) {
  if (manualLabel === 'unrated') {
    return '暂无人工基线，仅展示自动评分结果；不根据人工目标输出削弱或增强建议。'
  }

  if (
    manualLabel === 'near_impossible / impossible' &&
    (automatedLabel === 'near_impossible' || automatedLabel === 'impossible')
  ) {
    return '自动通过率评级落在当前人工记录的不确定失败区间内。'
  }

  const manual = manualRank(manualLabel)
  const automated = LABEL_RANK[automatedLabel] ?? LABEL_RANK.invalid_data

  if (automated === LABEL_RANK.invalid_data) {
    return '自动样本无效；在做数值判断前需要先检查数据加载或模拟器覆盖。'
  }

  if (automated === manual) {
    return '自动通过率评级与当前人工基线一致。'
  }

  if (automated < manual) {
    return '自动通过率评级比人工基线更简单；在操作 profile 继续校准前，先视为模拟器覆盖不足。'
  }

  return '自动通过率评级比人工基线更困难；需要检查通过率样本，并确认测试 build 是否符合预期玩家工具。'
}

function formatRatingCell(rating) {
  return `\`${rating.label}\` (${formatPercent(rating.averageBestPassRate)} / ${formatPercent(rating.skilledBestPassRate)} / ${formatPercent(rating.expertBestPassRate)})`
}

function formatLearningDifficultyCell(learning) {
  const rating = learning.learningDifficultyRating
  return `\`${rating.label}\` (${formatPercent(rating.bestPassRate)})`
}

function formatLearningBuildCount(learning) {
  const rating = learning.learningDifficultyRating
  return `${rating.flexibleBuildCount}（阈值：${formatPercent(rating.flexibleBuildThreshold)}）`
}

function formatLearningEffortCell(learning) {
  const effort = learning.learningEffort
  return `\`${effort.label}\` (${effort.score})`
}

function formatLearningExecutionLoadCell(learning) {
  const load = learning.learningExecutionLoad
  return load ? `操作负载：\`${load.label}\` (${load.score})` : '操作负载：`unknown`'
}

function formatLearningPathCell(learning) {
  const path = learning.learningPath ?? learning.learningDifficultyRating.learningPath
  if (!path) {
    return '学习路径：`unknown`'
  }

  return `学习路径：\`${path.label}\`（${path.score}，作为独立维度参与综合取最大值）`
}

function formatHalfBestBuildCount(rating) {
  return `${rating.halfBestBuildCount}（空余4点达标：${rating.sparePointHalfBestBuildCount}）`
}

function formatIssueTypes(issueTypes) {
  if (!issueTypes || issueTypes.length === 0) {
    return '无明显自动信号'
  }

  const translations = {
    raw_numbers_too_high: '原始数值偏高',
    raw_numbers_too_low: '原始数值偏低',
    mechanic_execution_load: '机制/执行负载偏高',
    ai_strategy_gap: 'AI 策略覆盖差异',
    build_dependency: '构筑依赖较窄',
    static_ai_disagreement: '静态与模拟分歧',
  }

  return issueTypes.map((type) => translations[type] ?? type).join('；')
}

function formatDesignRecommendation(recommendation) {
  return [
    `严重度：${recommendation.severity}；置信度：${recommendation.confidence}`,
    recommendation.summary,
    ...recommendation.suggestions,
  ].join('<br>')
}

function formatStageSummaryConclusion(stage) {
  const labels = [
    stage.staticScore.label,
    stage.fixedAnalysis.rating.label,
    stage.learningAnalysis.learningDifficultyRating.label,
  ]
  const matchingSignals = labels.filter((label) => label === stage.manualLabel).length
  const conclusion = matchingSignals >= 2
    ? '基本符合人工预期'
    : '需要人工复核'

  return `${conclusion}：人工 \`${stage.manualLabel}\`，静态 \`${stage.staticScore.label}\`，固定策略 AI \`${stage.fixedAnalysis.rating.label}\`，学习型 AI \`${stage.learningAnalysis.learningDifficultyRating.label}\`。`
}

function renderReportSummaryRows(report) {
  return report.stages.map((stage) => `- \`${stage.stageId}\`：${formatStageSummaryConclusion(stage)}`)
}

function translateStrategyId(id) {
  const translations = {
    'broad-window': '宽读条窗口',
    'balanced-window': '均衡读条窗口',
    'late-window': '尽量末端打断',
    'broad-low-mid-casts': '更愿意处理中低危读条',
    'strict-threat': '严格抢回仇恨',
    'kill-high-impact': '优先击杀高威胁目标',
    'allow-irregular-leak': '坦克承压时允许 irregular 分摊',
    'mechanic-focus': '机制目标优先',
    'mechanic-wax-party-chain': '蜡像与暗影之锄都规划给队伍',
    'mechanic-wax-tank-chain': '蜡像与暗影之锄都规划给坦克',
    default: '默认',
  }

  return translations[id] ?? id
}

function renderStaticThresholdRows() {
  return [
    '| 静态分数 | 难度标签 | 含义 |',
    '| ---: | --- | --- |',
    '| `<15` | `trivial` | 敌人数量、血量、读条风险和队伍压力都明显低于当前工具强度。 |',
    '| `15-29.9` | `easy` | 原始压力较低，基础操作通常可以通关。 |',
    '| `30-44.9` | `balanced` | 原始压力有意义，但理论上能被当前工具覆盖。 |',
    '| `45-59.9` | `hard` | 静态数值显示工具使用会比较紧。 |',
    '| `60-74.9` | `expert` | 在考虑操作模拟前，原始压力已经较高。 |',
    '| `75-94.9` | `near_impossible` | 静态风险显著超过当前工具预计能缓解的范围。 |',
    '| `>=95` | `impossible` | 静态风险已经超出当前评分预算。 |',
  ]
}

function renderPassRateThresholdRows() {
  return [
    '| 通过率条件 | 难度标签 |',
    '| --- | --- |',
    '| 所有采样 profile/build 都没有有效通关 | `impossible` |',
    '| expert 通过率 `<20%` 且 skilled 通过率 `<10%` | `near_impossible` |',
    '| average 通过率 `>=95%` | `trivial` |',
    '| average 通过率 `>=80%` | `easy` |',
    '| average 通过率 `>=55%` | `balanced` |',
    '| average 通过率 `>=25%` 或 skilled 通过率 `>=55%` | `hard` |',
    '| expert 通过率 `>=35%` 或 skilled 通过率 `>=20%` | `expert` |',
    '| 其他情况 | `near_impossible` |',
    '| 任意空余 `>=4` 技能点的 build 达到最优 build 通过率的一半以上 | 记录 build 宽容度；不再直接下调难度 |',
  ]
}

function renderLearningPassRateThresholdRows() {
  return [
    '| 学习型 AI 最佳通过率 | 难度标签 |',
    '| --- | --- |',
    '| `>=85%` | `trivial` |',
    '| `70%-84%` | `easy` |',
    '| `55%-69%` | `balanced` |',
    '| `35%-54%` | `hard` |',
    '| `15%-34%` | `expert` |',
    '| `5%-14%` | `near_impossible` |',
    '| `<5%` | `impossible` |',
    '| 至少 3 个 build 达到 `max(65%, 最优通过率 * 80%)` | 记录学习型 build 宽容度；不再直接下调难度 |',
  ]
}

function renderLearningEffortThresholdRows() {
  return [
    '| 技巧需求分 | 标签 | 含义 |',
    '| ---: | --- | --- |',
    '| `0-19` | `none` | 基本沿用常规打法 |',
    '| `20-39` | `basic` | 需要轻微调整目标或打断时机 |',
    '| `40-59` | `moderate` | 需要明确学习本关节奏或 build 调整 |',
    '| `60-79` | `high` | 需要掌握关卡机制级技巧 |',
    '| `80+` | `specialist` | 接近特解，需要专门策略 |',
  ]
}

function formatSelectedLearningStrategies(learning) {
  const builds = learning.selectedBuildIds.map((id) => `\`${id}\``).join(', ')
  const casts = learning.selectedCastStrategyIds.map((id) => `\`${translateStrategyId(id)}\``).join(', ')
  const tactics = learning.selectedTacticalStrategyIds.map((id) => `\`${translateStrategyId(id)}\``).join(', ')
  return `build：${builds}；读条策略：${casts}；战术策略：${tactics}`
}

function formatLearningSelectionCell(learning) {
  return `${formatSelectedLearningStrategies(learning)}；技巧需求：${formatLearningEffortCell(learning)}；${formatLearningExecutionLoadCell(learning)}；${formatLearningPathCell(learning)}`
}

function formatTacticalAdviceList(entries, formatEntry) {
  if (!entries || entries.length === 0) {
    return '无'
  }

  return entries.slice(0, 3).map(formatEntry).join('<br>')
}

function formatPriorityKillTargets(staticScore) {
  return formatTacticalAdviceList(staticScore.priorityKillTargets, (entry) =>
    `${entry.enemyName}（${Math.round(entry.score)}）：${entry.reason}`,
  )
}

function formatPriorityInterruptTargets(staticScore) {
  return formatTacticalAdviceList(staticScore.priorityInterruptTargets, (entry) =>
    `${entry.enemyName} / ${entry.skillName}（${Math.round(entry.score)}）：${entry.reason}`,
  )
}

function rankDifficultyLabel(label) {
  return LABEL_RANK[label] ?? LABEL_RANK.invalid_data
}

function formatEnemyAdviceEntries(entries, formatter) {
  if (!entries || entries.length === 0) {
    return []
  }

  return entries.slice(0, 3).map(formatter)
}

function renderStageEnemyBalanceAdvice(stage) {
  const staticRank = rankDifficultyLabel(stage.staticScore.label)
  const fixedRank = rankDifficultyLabel(stage.fixedAnalysis.rating.label)
  const learningRank = rankDifficultyLabel(stage.learningAnalysis.learningDifficultyRating.label)
  const highestRank = Math.max(staticRank, fixedRank, learningRank)
  const lowestRank = Math.min(staticRank, fixedRank, learningRank)
  const advice = [
    ...formatEnemyAdviceEntries(stage.staticScore.priorityKillTargets, (entry) =>
      `优先复核 ${entry.enemyName}：静态击杀优先级 ${Math.round(entry.score)}，${entry.reason}`,
    ),
    ...formatEnemyAdviceEntries(stage.staticScore.priorityInterruptTargets, (entry) =>
      `优先复核 ${entry.enemyName} 的 ${entry.skillName}：静态打断优先级 ${Math.round(entry.score)}，${entry.reason}`,
    ),
  ]

  if (highestRank >= LABEL_RANK.expert) {
    advice.push('如果人工测试也偏难，优先小幅下调上述敌人的生命、治疗/护盾收益或高危技能伤害，不建议先削弱全章节规则。')
  } else if (lowestRank <= LABEL_RANK.easy && stage.manualLabel !== 'easy') {
    advice.push('如果人工测试也偏易，优先小幅上调上述核心敌人的生命或关键技能压力，避免平均强化所有敌人。')
  } else {
    advice.push('自动信号暂未显示极端偏差，建议先用这些敌人作为人工复测观察点。')
  }

  return advice.join('<br>')
}

function selectCombatLogTrace(scenarios) {
  return scenarios.find((scenario) => scenario.combatLogTrace && scenario.combatLogTrace.length > 0)?.combatLogTrace ?? []
}

function writeStageTimelineTrace(stageId, fixedAnalysis, learningAnalysis) {
  if (!cliOptions.trace) {
    return
  }

  const traceDir = path.join(cliOptions.challenge ? challengeOutputDir : storyOutputDir, 'traces')
  fs.mkdirSync(traceDir, { recursive: true })
  const fixedEvents = selectCombatLogTrace(fixedAnalysis.scenarios)
  const learningEvents = selectCombatLogTrace(learningAnalysis.finalAnalysis?.scenarios ?? [])
  const fixedTimeline = buildCombatTimeline(fixedEvents, { limit: 40, importantOnly: true })
  const learningTimeline = buildCombatTimeline(learningEvents, { limit: 40, importantOnly: true })
  const payload = {
    stageId,
    generatedAt: new Date().toISOString(),
    fixed: fixedTimeline,
    learning: learningTimeline,
  }
  const markdown = [
    `# ${stageId} Combat Timeline Trace`,
    '',
    `summary: fixed=${fixedTimeline.summary.totalEvents} events (${fixedTimeline.filteredEventCount} filtered), learning=${learningTimeline.summary.totalEvents} events (${learningTimeline.filteredEventCount} filtered)`,
    `fixedCounts: ${Object.entries(fixedTimeline.summary.countsByType).map(([type, count]) => `${type}=${count}`).join(', ') || 'none'}`,
    `learningCounts: ${Object.entries(learningTimeline.summary.countsByType).map(([type, count]) => `${type}=${count}`).join(', ') || 'none'}`,
    '',
    '## Fixed AI',
    '',
    renderCombatTimelineMarkdown(fixedTimeline).replace(/^# Combat Timeline Trace\n\n/, '').trimEnd(),
    '',
    '## Learning AI',
    '',
    renderCombatTimelineMarkdown(learningTimeline).replace(/^# Combat Timeline Trace\n\n/, '').trimEnd(),
    '',
  ].join('\n')

  fs.writeFileSync(path.join(traceDir, `${stageId}-latest-timeline.json`), `${JSON.stringify(payload, null, 2)}\n`)
  fs.writeFileSync(path.join(traceDir, `${stageId}-latest-timeline.md`), markdown)
  console.log(`[balance] ${stageId}: trace written to ${path.relative(projectRoot, path.join(traceDir, `${stageId}-latest-timeline.md`))}`)
}

function renderChapterAutoScoringMarkdown(report) {
  const lines = [
    `# ${getReportTitle()}`,
    '',
    `生成时间：${report.generatedAt}`,
    '',
    '本文档由 `npm run analyze:balance` 只读生成。脚本只读取 `public/designer-data/*.xlsx`，不会修改策划表；数值调整仍应由策划在表中执行后再覆盖数据。',
    '',
    '## 总结',
    '',
    ...renderReportSummaryRows(report),
    '',
    '## 三层评分',
    '',
    '| 层级 | 名称 | 用途 | 输出 |',
    '| --- | --- | --- | --- |',
    '| 1 | 静态评分 V3 | 不跑战斗，拆分不可处理压力、可处理压力、敌方表面/有效支援、玩家工具抵消和执行复杂度；用于解释静态与模拟差异。 | `unavoidablePressureScore + answerablePressureScore + toolMitigationScore + effectiveSupportRisk + executionComplexityScore + adjustedThreatScore + label` |',
    '| 2 | 固定策略 AI | 使用统一战术假设的 average/skilled/expert 操作档位跑确定性战斗样本；差异来自反应延迟和失误率。 | 通过率难度标签 |',
    '| 3 | 学习型 AI | 先探索 build、读条处理策略和目标/仇恨战术策略，再坍缩到共享最优 build/策略集合做正式样本，模拟玩家反复尝试后的学习结果。 | 被选中的 build/策略与通过率难度标签 |',
    '',
    '## 静态分数标准',
    '',
    ...renderStaticThresholdRows(),
    '',
    '## AI 通过率标准',
    '',
    '下表同时用于固定策略 AI 与学习型 AI。三列通过率在总表中按 `average / skilled / expert` 展示，均为同一操作档位内各 profile 最佳合法 build 的平均通过率。',
    '',
    ...renderPassRateThresholdRows(),
    '',
    '## 学习型 AI 通过率标准',
    '',
    '学习型 AI 使用单一较强玩家 profile，因此通过率阈值比固定策略 AI 更严格，不再展示 skilled / expert 等拆分列。',
    '',
    ...renderLearningPassRateThresholdRows(),
    '',
    '## 学习技巧需求标准',
    '',
    '学习技巧需求不是关卡难度，而是衡量玩家为了达到学习型 AI 的过关率，需要额外掌握多少本关专属技巧。',
    '',
    ...renderLearningEffortThresholdRows(),
    '',
    '## 学习路径评分标准',
    '',
    '学习路径评分衡量“学习型 AI 从探索到最终高通过率”的曲折程度。它不是玩家可见评价，用于避免极窄构筑或特解策略把关卡误判得过低。',
    '',
    '| 学习路径分 | 标签 | 维度难度 | 含义 |',
    '| ---: | --- | --- | --- |',
    '| `0-24` | `direct` | 不修正 | 默认构筑或常规策略已经能覆盖主要通关路径。 |',
    '| `25-49` | `learned` | 不修正 | 需要学习打法，但不应单独改变难度标签。 |',
    '| `50-74` | `specialized` | `hard` | 成功明显依赖特定构筑、战术或较窄探索路径，作为独立维度参与综合取最大值。 |',
    '| `75+` | `hidden_solution` | `hard` | 高通过率更像隐藏解法或极窄被动堆叠，应防止难度被学习型 AI 低估，作为独立维度参与综合取最大值。 |',
    '',
    `## ${getLatestReportAreaLabel()} 总表`,
    '',
    '| 关卡 | 人工结论 | 静态评分 | 固定策略 AI | 固定策略半最优 build | 学习型 AI | 学习型半最优 build | 学习型选择结果 |',
    '| --- | --- | --- | --- | ---: | --- | ---: | --- |',
    ...report.stages.map((stage) => {
      const learning = stage.learningAnalysis
      return `| ${[
        `\`${stage.stageId}\``,
        `\`${stage.manualLabel}\``,
        `\`${stage.staticScore.label}\` (${stage.staticScore.score})`,
        formatRatingCell(stage.fixedAnalysis.rating),
        formatHalfBestBuildCount(stage.fixedAnalysis.rating),
        formatLearningDifficultyCell(learning),
        formatLearningBuildCount(learning),
        formatLearningSelectionCell(learning),
      ].join(' | ')} |`
    }),
    '',
    '## 评分理由摘要',
    '',
    '| 关卡 | 静态评分理由 | 静态优先击杀目标 | 静态优先打断目标 | 策划策略提示 | 固定策略 AI 理由 | 学习型 AI 理由 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.stages.map((stage) => {
      const staticReasons = stage.staticScore.reasons.join('<br>')
      const priorityKills = formatPriorityKillTargets(stage.staticScore)
      const priorityInterrupts = formatPriorityInterruptTargets(stage.staticScore)
      const strategyTips = stage.strategyTips ? stage.strategyTips.replace(/\n/g, '<br>') : '无'
      const fixedReasons = stage.fixedAnalysis.rating.reasons.join('<br>')
      const learningReasons = [
        ...stage.learningAnalysis.learningDifficultyRating.reasons,
        `技巧需求：${formatLearningEffortCell(stage.learningAnalysis)}；${stage.learningAnalysis.learningEffort.reasons.join('；')}`,
        `${formatLearningExecutionLoadCell(stage.learningAnalysis)}；${stage.learningAnalysis.learningExecutionLoad?.reasons.join('；') ?? ''}`,
        `${formatLearningPathCell(stage.learningAnalysis)}；${stage.learningAnalysis.learningPath?.reasons.join('；') ?? ''}`,
      ].join('<br>')
      return `| \`${stage.stageId}\` | ${staticReasons} | ${priorityKills} | ${priorityInterrupts} | ${strategyTips} | ${fixedReasons} | ${learningReasons} |`
    }),
    '',
    '## 使用建议',
    '',
    '- 静态评分 V3 用于尽早发现明显表值、敌方支援结构、工具覆盖缺口和执行复杂度风险，不替代战斗模拟。',
    '- 第二章包含治疗、升级、标记和锁目标过量治疗等机制；人工测试应结合敌方支援风险组件与通过率结果校准，不应仅依据静态标签改单项数值。',
    '- 固定策略 AI 用于观察“按当前工具链和统一策略直接打”的通过率。',
    '- 学习型 AI 更接近教程关玩家在反复尝试后找到强 build 和合适打断/控制节奏的表现。',
    '- 如果三层评分与人工测试冲突，优先保留人工记录，下一步应检查 AI 行为 trace 或补充策略，而不是直接要求策划改表。',
  ]

  lines.push(
    '',
    '## 数值与敌人设计建议',
    '',
    '这一部分只生成给策划参考的建议，不会修改 `public/designer-data` 下的任何策划表。建议需要结合人工测试和设计目标再决定是否执行。',
    '',
    '| 关卡 | 自动信号 | 建议 |',
    '| --- | --- | --- |',
    ...report.stages.map((stage) => {
      const recommendation = stage.designRecommendation
      return `| \`${stage.stageId}\` | ${formatIssueTypes(recommendation.issueTypes)} | ${formatDesignRecommendation(recommendation)} |`
    }),
    '',
    '## 每关敌人数值建议',
    '',
    '这一部分按关卡列出最值得优先复核的敌人与技能。它只给出调数方向，不直接替代人工测试结论。',
    '',
    '| 关卡 | 敌人建议 |',
    '| --- | --- |',
    ...report.stages.map((stage) => `| \`${stage.stageId}\` | ${renderStageEnemyBalanceAdvice(stage)} |`),
  )

  return `${lines.join('\n').trimEnd()}\n`
}

const analyzedStageCache = new Map()

function getStageEntryKey(stageId, manualLabel, stageEntry) {
  return `${stageId}:${manualLabel}:${stageEntry ? 'challenge' : 'story'}`
}

function analyzeStageEntry(stageId, manualLabel, stageEntry, sampleConfig) {
  const cacheKey = getStageEntryKey(stageId, manualLabel, stageEntry)
  const cached = analyzedStageCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const stageStartMs = Date.now()
  console.log(`[balance] ${stageId}: start`)
  const stage = getStageById(stageId)
  if (!stage) {
    throw new Error(`Missing stage after designer data load: ${stageId}`)
  }

  console.log(`[balance] ${stageId}: fixed AI start`)
  const manualPlaytestBuildCandidate = !stageEntry
    ? buildManualPlaytestCandidateForStage(manualPlaytestEntries, stage)
    : null
  const analysis = runTwoPhaseStageBalanceAnalysis({
    stage,
    profiles: BALANCE_PROFILES,
    extraBuildCandidates: manualPlaytestBuildCandidate ? [manualPlaytestBuildCandidate] : [],
    phaseOneAttemptsPerScenario: sampleConfig.fixedPhaseOneAttempts,
    phaseOneMaxActiveBuilds: sampleConfig.fixedPhaseOneMaxActiveBuilds,
    phaseOneMaxPassiveVariants: sampleConfig.fixedPhaseOneMaxPassiveVariants,
    finalBuildCount: sampleConfig.fixedFinalBuildCount,
    attemptsPerScenario: sampleConfig.fixedAttempts,
    maxDurationMs: 120_000,
    collectTrace: cliOptions.trace,
    collectDiagnostics: true,
  })
  console.log(
    `[balance] ${stageId}: fixed AI done (${Math.round((Date.now() - stageStartMs) / 1000)}s, phaseOneBuilds=${analysis.phaseOneBuildCount ?? 0}, finalBuilds=${analysis.finalBuildCount ?? 0})`,
  )

  console.log(`[balance] ${stageId}: static score start`)
  const staticScore = scoreStageStaticDifficulty(stage)
  console.log(`[balance] ${stageId}: static score done (${staticScore.label}, score=${staticScore.score})`)

  const challengeRecommendedBuildCandidate = stageEntry
    ? buildChallengeRecommendedBuildCandidate(stageEntry, stage)
    : null
  const generatedBuildCandidates = selectLearningBuildCandidatesFromFixedAnalysis(
    analysis.scenarios,
    analysis.analyzedBuilds ?? [],
    {
      minBuildCount: 5,
      maxBuildCount: 10,
      gapThreshold: 0.07,
    },
  )
  const fixedBuildCandidates = generatedBuildCandidates.length > 0
    ? generatedBuildCandidates
    : analysis.bestBuildsByProfile.map((summary) => ({
      id: summary.buildId,
      build: {
        loadout: summary.loadout,
        passiveTalentIds: summary.passiveTalentIds,
      },
    }))
  const strategyTipBuildCandidates = generateStrategyTipBuildCandidates(stage, {
    maxCandidates: cliOptions.quick ? 6 : 4,
  })
  const learningBuildCandidates = prependUniqueBuildCandidates(
    manualPlaytestBuildCandidate ? [manualPlaytestBuildCandidate] : [],
    challengeRecommendedBuildCandidate ? [challengeRecommendedBuildCandidate] : [],
    strategyTipBuildCandidates,
    fixedBuildCandidates,
  )

  console.log(
    `[balance] ${stageId}: learning AI start (profiles=${LEARNING_BALANCE_PROFILES.length}, candidateBuilds=${learningBuildCandidates.length})`,
  )
  const learningAnalysis = runLearningStageBalanceAnalysis({
    stage,
    profiles: LEARNING_BALANCE_PROFILES,
    buildCandidates: learningBuildCandidates,
    castStrategies: LEARNING_CAST_STRATEGIES,
    tacticalStrategies: LEARNING_TACTICAL_STRATEGIES,
    phaseOneAttemptsPerScenario: sampleConfig.learningPhaseOneAttempts,
    finalBuildCount: sampleConfig.learningFinalBuildCount,
    finalStrategyCount: sampleConfig.learningFinalStrategyCount,
    attemptsPerScenario: sampleConfig.learningAttempts,
    maxDurationMs: 120_000,
    collectTrace: cliOptions.trace,
    collectDiagnostics: true,
  })
  console.log(
    `[balance] ${stageId}: learning AI done (${Math.round((Date.now() - stageStartMs) / 1000)}s, selectedBuilds=${learningAnalysis.selectedBuildIds.length})`,
  )
  const designRecommendation = createBalanceDesignRecommendation({
    stageId,
    manualLabel,
    staticLabel: staticScore.label,
    fixedLabel: analysis.rating.label,
    learningLabel: learningAnalysis.learningDifficultyRating.label,
    staticMetrics: staticScore.metrics,
    fixedBestPassRate: analysis.rating.overallBestPassRate,
    learningBestPassRate: learningAnalysis.learningDifficultyRating.bestPassRate,
    learningEffortScore: learningAnalysis.learningEffort.score,
    learningExecutionLoadScore: learningAnalysis.learningExecutionLoad.score,
    halfBestBuildCount: analysis.rating.halfBestBuildCount,
  })
  writeStageTimelineTrace(stageId, analysis, learningAnalysis)
  console.log(`[balance] ${stageId}: done (${Math.round((Date.now() - stageStartMs) / 1000)}s)`)

  const result = {
    stageId,
    title: stage.title,
    strategyTips: stage.strategyTips ?? '',
    manualLabel,
    staticScore,
    fixedAnalysis: analysis,
    learningAnalysis,
    designRecommendation,
    automatedLabel: analysis.rating.label,
    scoringMode: analysis.scoringMode,
    buildSearchMode: analysis.buildSearchMode,
    phaseOneBuildCount: analysis.phaseOneBuildCount ?? 0,
    finalBuildCount: analysis.finalBuildCount ?? analysis.bestBuildsByProfile.length,
    testedBuildCount: analysis.finalBuildCount ?? analysis.bestBuildsByProfile.length,
    bestBuildsByProfile: analysis.bestBuildsByProfile,
    ratingReasons: analysis.rating.reasons,
    scenarios: analysis.scenarios,
    recommendation: recommendationFor(manualLabel, analysis.rating.label),
  }

  analyzedStageCache.set(cacheKey, result)
  return result
}

function buildReport() {
  const stageWorkbook = loadDesignerDataIntoCatalogs()
  const stageEntries = getRequestedStageEntries(stageWorkbook)
  const sampleConfig = getSampleConfig()
  console.log(`[balance] sample budget: ${cliOptions.budget}`)

  const stages = stageEntries.map(([stageId, manualLabel, stageEntry]) =>
    analyzeStageEntry(stageId, manualLabel, stageEntry, sampleConfig),
  )

  return {
    generatedAt: new Date().toISOString(),
    stageWorkbook,
    sampleConfig,
    stages,
  }
}

const report = buildReport()
const { stageWorkbook: reportStageWorkbook, sampleConfig: reportSampleConfig, ...artifactReport } = report
const serializableReport = stripCombatLogTraceFromBalanceReport(artifactReport)
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(storyOutputDir, { recursive: true })
fs.mkdirSync(challengeOutputDir, { recursive: true })
fs.mkdirSync(dataEstimateOutputDir, { recursive: true })
fs.mkdirSync(dataEstimateStoryOutputDir, { recursive: true })
fs.mkdirSync(dataEstimateChallengeOutputDir, { recursive: true })
const reportSlug = getReportSlug()
const outputPaths = getReportOutputPaths(reportSlug)
const previousReport = readPreviousReport(outputPaths.json, outputPaths.legacyJson)
const writtenPaths = writeReportArtifacts(artifactReport, serializableReport, reportSlug, previousReport, outputPaths)
const challengeReportPaths = writeChallengeReportArtifacts(artifactReport)
const dataEstimateReportPath = writeDataEstimateArtifacts(artifactReport, reportSlug)
const challengeDataEstimateReportPaths = writeChallengeDataEstimateArtifacts(artifactReport)
const shouldWriteCompleteDataEstimateArtifacts = cliOptions.stages.length === 0 && !cliOptions.area
const completeDataEstimateReportPaths = shouldWriteCompleteDataEstimateArtifacts
  ? writeCompleteDataEstimateArtifacts(
      reportStageWorkbook,
      artifactReport.generatedAt,
      reportSampleConfig,
    )
  : []
const monsterCodexDataEstimateReportPath = shouldWriteCompleteDataEstimateArtifacts
  ? writeMonsterCodexDataEstimateArtifact(
      reportStageWorkbook,
      artifactReport.generatedAt,
    )
  : null

console.log(`Balance report written to ${formatReportPathForConsole(writtenPaths.latestMarkdownPath)}`)
console.log(`Auto scoring written to ${formatReportPathForConsole(writtenPaths.autoScoringMarkdownPath)}`)
if (dataEstimateReportPath) {
  console.log(`Data estimate written to ${formatReportPathForConsole(dataEstimateReportPath)}`)
}
for (const challengeReportPath of challengeReportPaths) {
  console.log(`Challenge auto scoring written to ${formatReportPathForConsole(challengeReportPath)}`)
}
for (const challengeDataEstimateReportPath of challengeDataEstimateReportPaths) {
  console.log(`Challenge data estimate written to ${formatReportPathForConsole(challengeDataEstimateReportPath)}`)
}
for (const completeDataEstimateReportPath of completeDataEstimateReportPaths) {
  console.log(`Complete data estimate written to ${formatReportPathForConsole(completeDataEstimateReportPath)}`)
}
if (monsterCodexDataEstimateReportPath) {
  console.log(`Monster codex data estimate written to ${formatReportPathForConsole(monsterCodexDataEstimateReportPath)}`)
}
if (writtenPaths.diffMarkdownPath) {
  console.log(`Auto scoring diff written to ${formatReportPathForConsole(writtenPaths.diffMarkdownPath)}`)
} else {
  console.log('Auto scoring diff skipped: no previous report for this slug.')
}
