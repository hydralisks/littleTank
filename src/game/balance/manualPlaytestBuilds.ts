import * as XLSX from 'xlsx'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  SKILL_HOTKEYS,
  getActiveSkillCatalog,
  getPassiveTalentCatalog,
  normalizePersistedBuildForRule,
} from '../data/playerBuildCatalog'
import {
  getPassiveTalentUnlockTierForStage,
  getUnlockedActiveSkillIdsForStage,
  type StageInfo,
} from '../data/stageTemplates'
import type { BalanceBuildVariant } from './balanceSimulator'
import type { PassiveTalentId, SkillId, SkillLoadout } from '../encounter/encounterTypes'

type CellValue = string | number | boolean | null | undefined
type SheetRow = Record<string, CellValue>

export interface ManualPlaytestBuildEntry {
  stageId: string
  manualDifficulty: string
  recommendedActiveSkillNamesCsv: string
  recommendedPassiveTalentNamesCsv: string
  recommendedActiveSkillIds: SkillId[]
  recommendedPassiveTalentIds: PassiveTalentId[]
  source: string
  enabled: boolean
}

function normalizeLookupText(value: CellValue) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function parseList(value: CellValue) {
  return String(value ?? '')
    .split(/[,，、;；]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function readBoolean(value: CellValue) {
  if (typeof value === 'boolean') {
    return value
  }

  const text = normalizeLookupText(value)
  return text === '' || text === 'true' || text === '1' || text === 'yes' || text === 'y'
}

function readSheetRows(workbook: XLSX.WorkBook, preferredSheetName: string) {
  const sheet =
    workbook.Sheets[preferredSheetName] ??
    workbook.Sheets[workbook.SheetNames[0]]

  return sheet
    ? (XLSX.utils.sheet_to_json(sheet, { defval: '' }) as SheetRow[])
    : []
}

function createActiveSkillLookup() {
  const lookup = new Map<string, SkillId>()
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
  const lookup = new Map<string, PassiveTalentId>()
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

function resolveIds<T extends string>(namesCsv: CellValue, idsCsv: CellValue, lookup: Map<string, T>) {
  const byId = parseList(idsCsv).filter((id): id is T => Boolean(id))
  const byName = parseList(namesCsv)
    .map((name) => lookup.get(normalizeLookupText(name)))
    .filter((id): id is T => Boolean(id))

  return [...new Set([...byId, ...byName])]
}

export function parseManualPlaytestWorkbook(workbook: XLSX.WorkBook): ManualPlaytestBuildEntry[] {
  const activeSkillLookup = createActiveSkillLookup()
  const passiveTalentLookup = createPassiveTalentLookup()

  return readSheetRows(workbook, '人工测评')
    .filter((row) => row.stageId && readBoolean(row.enabled))
    .map((row) => ({
      stageId: String(row.stageId ?? '').trim(),
      manualDifficulty: String(row.manualDifficulty ?? row.recommendedDifficulty ?? 'unrated').trim(),
      recommendedActiveSkillNamesCsv: String(row.recommendedActiveSkillNamesCsv ?? '').trim(),
      recommendedPassiveTalentNamesCsv: String(row.recommendedPassiveTalentNamesCsv ?? '').trim(),
      recommendedActiveSkillIds: resolveIds<SkillId>(
        row.recommendedActiveSkillNamesCsv,
        row.recommendedActiveSkillIdsCsv,
        activeSkillLookup,
      ),
      recommendedPassiveTalentIds: resolveIds<PassiveTalentId>(
        row.recommendedPassiveTalentNamesCsv,
        row.recommendedPassiveTalentIdsCsv,
        passiveTalentLookup,
      ),
      source: String(row.source ?? '').trim(),
      enabled: readBoolean(row.enabled),
    }))
}

export function getManualPlaytestEntryForStage(
  entries: readonly ManualPlaytestBuildEntry[],
  stageId: string,
) {
  return entries.find((entry) => entry.stageId === stageId && entry.enabled)
}

export function buildManualPlaytestCandidateForStage(
  entries: readonly ManualPlaytestBuildEntry[],
  stage: StageInfo,
): BalanceBuildVariant | null {
  const entry = getManualPlaytestEntryForStage(entries, stage.id)
  if (!entry || (entry.recommendedActiveSkillIds.length === 0 && entry.recommendedPassiveTalentIds.length === 0)) {
    return null
  }

  const loadout = Object.fromEntries(SKILL_HOTKEYS.map((hotkey) => [hotkey, null])) as SkillLoadout
  for (let index = 0; index < Math.min(entry.recommendedActiveSkillIds.length, SKILL_HOTKEYS.length); index += 1) {
    loadout[SKILL_HOTKEYS[index]] = entry.recommendedActiveSkillIds[index]
  }

  const buildRuleId = getStageBuildRuleId(stage)
  const normalized = normalizePersistedBuildForRule(
    { loadout, passiveTalentIds: entry.recommendedPassiveTalentIds },
    buildRuleId, 'warrior_t',
    getPassiveTalentUnlockTierForStage(stage),
    getUnlockedActiveSkillIdsForStage(stage),
    [],
  ).build

  return {
    id: 'manual_playtest_recommended',
    build: normalized,
  }
}
