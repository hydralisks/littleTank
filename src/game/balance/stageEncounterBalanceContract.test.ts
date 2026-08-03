import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

type CellValue = string | number | boolean
type WorkbookRow = Record<string, CellValue>
type EncounterValues = Partial<Record<string, CellValue>>

interface EncounterUpdate {
  stageId: string
  spawnId: string
  expectedBefore: EncounterValues
  values: EncounterValues
}

type EncounterManifest = Record<string, EncounterUpdate[]>

const manifestPath = path.join(
  process.cwd(),
  'reports',
  'balance',
  '挑战与西部荒野前段关卡最终候选-2026-08-02.json',
)
const reportPath = path.join(
  process.cwd(),
  'reports',
  'balance',
  '挑战1至9与西部荒野1至3数值平衡报告-2026-08-02.md',
)
const evidencePath = path.join(
  process.cwd(),
  'reports',
  'balance',
  '关卡候选扫描-2026-08-02.json',
)

const allowedFiles = new Set([
  'challenge_encounter_balance.xlsx',
  'encounter_balance.xlsx',
])

const allowedFields = new Set([
  'enemyId',
  'row',
  'col',
  'nameOverride',
  'hpOverride',
  'maxHpOverride',
  'openingCastSkillNum',
  'openingRecoveryRemainingMs',
])

const challengePools = {
  1: new Set(['kobold_miner', 'kobold_apprentice', 'kobold_monk', 'kobold_geomancer', 'kobold_rummager', 'The_Candle_King']),
  2: new Set(['murloc_scout', 'murloc_tidehunter', 'murloc_blowgiller', 'murloc_warleader', 'coldlight_seer', 'coldlight_oracle', 'Old_Murk-Eye']),
  3: new Set(['troll_headhunter', 'troll_berserker', 'forest_troll_berserker', 'troll_high_priest', 'troll_shadow_priest', 'troll_soul_summoner', 'troll_warlord', 'troll_shieldmasta']),
} as const

const westFallPools: Record<string, Set<string>> = {
  'WestFall-1': new Set(['murloc_scout', 'murloc_tidehunter']),
  'WestFall-2': new Set(['murloc_scout', 'murloc_tidehunter', 'murloc_blowgiller']),
  'WestFall-3': new Set(['murloc_scout', 'murloc_tidehunter', 'murloc_blowgiller', 'murloc_warleader', 'coldlight_seer']),
}

const targetStageIds = [
  'Challenge-1',
  'Challenge-2',
  'Challenge-3',
  'Challenge-4',
  'Challenge-5',
  'Challenge-6',
  'Challenge-7',
  'Challenge-8',
  'Challenge-9',
  'WestFall-1',
  'WestFall-2',
  'WestFall-3',
]

function readManifest(): EncounterManifest {
  expect(fs.existsSync(manifestPath), `Missing balance manifest: ${manifestPath}`).toBe(true)
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as EncounterManifest
}

function readRows(fileName: string): WorkbookRow[] {
  const workbook = XLSX.readFile(path.join('public', 'designer-data', fileName))
  const sheet = workbook.Sheets['敌人布置']
  if (!sheet) throw new Error(`Missing 敌人布置 in ${fileName}`)
  return XLSX.utils.sheet_to_json<WorkbookRow>(sheet, { defval: '' })
}

function getChallengePool(stageId: string) {
  const stageNumber = Number(stageId.slice('Challenge-'.length))
  const chapter = stageNumber <= 3 ? 1 : stageNumber <= 6 ? 2 : 3
  return challengePools[chapter]
}

function runWriterWithManifest(
  label: string,
  manifest: unknown,
  prepareDesignerData?: (designerDataDir: string) => void,
) {
  const tempDir = path.join(process.cwd(), '.superpowers', 'stage-encounter-contract', `${label}-${process.pid}`)
  const designerDataDir = path.join(tempDir, 'designer-data')
  const tempManifestPath = path.join(tempDir, 'manifest.json')
  fs.mkdirSync(designerDataDir, { recursive: true })
  for (const fileName of allowedFiles) {
    fs.copyFileSync(
      path.join(process.cwd(), 'public', 'designer-data', fileName),
      path.join(designerDataDir, fileName),
    )
  }
  prepareDesignerData?.(designerDataDir)
  fs.writeFileSync(tempManifestPath, JSON.stringify(manifest))
  const challengePath = path.join(designerDataDir, 'challenge_encounter_balance.xlsx')
  const challengeBefore = fs.readFileSync(challengePath)
  try {
    const result = spawnSync(process.execPath, [
      'scripts/applyStageEncounterBalance.mjs',
      `--manifest=${path.relative(process.cwd(), tempManifestPath)}`,
      `--designer-data-dir=${path.relative(process.cwd(), designerDataDir)}`,
    ], { cwd: process.cwd(), encoding: 'utf8' })
    return {
      result,
      challengeBefore,
      challengeAfter: fs.readFileSync(challengePath),
      challengeRows: XLSX.utils.sheet_to_json<WorkbookRow>(
        XLSX.readFile(challengePath).Sheets['敌人布置'],
        { defval: '' },
      ),
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function manifestWithChallengeUpdates(updates: EncounterUpdate[]) {
  return {
    'challenge_encounter_balance.xlsx': updates,
    'encounter_balance.xlsx': [],
  }
}

describe('stage encounter balance contract', () => {
  it('uses an explicit manifest and stable compound keys for targeted workbook writes', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'applyStageEncounterBalance.mjs')
    expect(fs.existsSync(scriptPath), `Missing targeted writer: ${scriptPath}`).toBe(true)
    const script = fs.readFileSync(scriptPath, 'utf8').replaceAll('\r\n', '\n')

    expect(script).toContain("arg.startsWith('--manifest=')")
    expect(script).toContain("arg.startsWith('--designer-data-dir=')")
    expect(script).toContain("row.stageId === update.stageId")
    expect(script).toContain("row.spawnId === update.spawnId")
    expect(script).toContain('matches.length !== 1')
    expect(script).toContain('writeDesignerWorkbookCompact')
    expect(script).toContain("'challenge_encounter_balance.xlsx'")
    expect(script).toContain("'encounter_balance.xlsx'")
    expect(script).not.toContain('generateDesignerWorkbooks')
    expect(script).not.toContain('player_build.xlsx')
  })

  it('rejects an empty optimistic-lock snapshot before reading or writing workbooks', () => {
    const { result } = runWriterWithManifest('empty-before', manifestWithChallengeUpdates([{
        stageId: 'Challenge-1',
        spawnId: 'Challenge-1-e01',
        expectedBefore: {},
        values: { openingRecoveryRemainingMs: 0 },
    }]))

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('expectedBefore must cover every values field')
  })

  it('rejects duplicate compound keys and manifests outside the workbook allowlist', () => {
    const update: EncounterUpdate = {
      stageId: 'Challenge-1',
      spawnId: 'Challenge-1-e01',
      expectedBefore: { openingRecoveryRemainingMs: 0 },
      values: { openingRecoveryRemainingMs: 0 },
    }
    const { result: duplicate } = runWriterWithManifest('duplicate-key', manifestWithChallengeUpdates([update, update]))
    expect(duplicate.status).not.toBe(0)
    expect(duplicate.stderr).toContain('Duplicate update key')

    const { result: invalidWorkbook } = runWriterWithManifest('invalid-workbook', {
      'challenge_encounter_balance.xlsx': [],
      'enemy_data.xlsx': [],
    })
    expect(invalidWorkbook.status).not.toBe(0)
    expect(invalidWorkbook.stderr).toContain('Manifest must contain only')

    const { result: invalidStage } = runWriterWithManifest('invalid-stage', manifestWithChallengeUpdates([{
      ...update,
      stageId: 'Challenge-10',
      spawnId: 'Challenge-10-e01',
    }]))
    expect(invalidStage.status).not.toBe(0)
    expect(invalidStage.stderr).toContain('Update is outside approved stages')
  })

  it('rejects stale snapshots without changing the target workbook', () => {
    const publicWorkbookPath = path.join('public', 'designer-data', 'challenge_encounter_balance.xlsx')
    const publicBefore = fs.readFileSync(publicWorkbookPath)
    const { result, challengeBefore, challengeAfter } = runWriterWithManifest('stale-before', manifestWithChallengeUpdates([{
      stageId: 'Challenge-1',
      spawnId: 'Challenge-1-e01',
      expectedBefore: { openingRecoveryRemainingMs: 1234 },
      values: { openingRecoveryRemainingMs: 1000 },
    }]))

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Current values do not match expectedBefore')
    expect(challengeAfter).toEqual(challengeBefore)
    expect(fs.readFileSync(publicWorkbookPath)).toEqual(publicBefore)
  })

  it('keeps the workbook byte-identical when selected values already exist', () => {
    const { result, challengeBefore, challengeAfter } = runWriterWithManifest('idempotent', manifestWithChallengeUpdates([{
      stageId: 'Challenge-1',
      spawnId: 'Challenge-1-e01',
      expectedBefore: { openingRecoveryRemainingMs: 0 },
      values: { openingRecoveryRemainingMs: 0 },
    }]))

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('challenge_encounter_balance.xlsx: 0 targeted rows updated')
    expect(challengeAfter).toEqual(challengeBefore)
  })

  it('writes selected values only to an explicitly isolated designer-data directory', () => {
    const publicWorkbookPath = path.join('public', 'designer-data', 'challenge_encounter_balance.xlsx')
    const publicBefore = fs.readFileSync(publicWorkbookPath)
    const { result, challengeRows } = runWriterWithManifest(
      'isolated-write',
      manifestWithChallengeUpdates([{
        stageId: 'Challenge-1',
        spawnId: 'Challenge-1-e01',
        expectedBefore: { openingRecoveryRemainingMs: 1000 },
        values: { openingRecoveryRemainingMs: 0 },
      }]),
      (designerDataDir) => {
        const workbookPath = path.join(designerDataDir, 'challenge_encounter_balance.xlsx')
        const workbook = XLSX.readFile(workbookPath)
        const rows = XLSX.utils.sheet_to_json<WorkbookRow>(workbook.Sheets['敌人布置'], { defval: '' })
        const row = rows.find((entry) => entry.spawnId === 'Challenge-1-e01')
        if (!row) throw new Error('Missing isolated Challenge-1-e01')
        row.openingRecoveryRemainingMs = 1000
        workbook.Sheets['敌人布置'] = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) })
        XLSX.writeFile(workbook, workbookPath, { bookType: 'xlsx', compression: true })
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(challengeRows.find((row) => row.spawnId === 'Challenge-1-e01')).toMatchObject({
      openingRecoveryRemainingMs: 0,
    })
    expect(fs.readFileSync(publicWorkbookPath)).toEqual(publicBefore)
  })

  it('runs candidate scans against an isolated designer-data copy', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'scanStageEncounterCandidates.mjs')
    expect(fs.existsSync(scriptPath), `Missing candidate scanner: ${scriptPath}`).toBe(true)
    const script = fs.readFileSync(scriptPath, 'utf8').replaceAll('\r\n', '\n')

    expect(script).toContain("fs.cpSync(designerDataDir, isolatedDesignerDataDir")
    expect(script).toContain("'--designer-data-dir='")
    expect(script).toContain('spawnSync(process.execPath')
    expect(script).toContain('stageId')
    expect(script).toContain('averageBestPassRate')
    expect(script).toContain("arg.startsWith('--budget=')")
    expect(script).toContain("new Set(['quick', 'normal', 'full'])")
    expect(script).not.toContain('writeDesignerWorkbookCompact')
  })

  it('limits adopted manifest updates to the twelve approved stages and workbooks', () => {
    const manifest = readManifest()
    expect(new Set(Object.keys(manifest))).toEqual(allowedFiles)

    const updates = Object.values(manifest).flat()
    expect(updates.every((update) => targetStageIds.includes(update.stageId))).toBe(true)
    expect(updates.every((update) => update.spawnId.startsWith(`${update.stageId}-e`))).toBe(true)
  })

  it('records an explicit final decision for all twelve target stages', () => {
    expect(fs.existsSync(reportPath), `Missing Chinese balance report: ${reportPath}`).toBe(true)
    const report = fs.readFileSync(reportPath, 'utf8').replaceAll('\r\n', '\n')
    for (const stageId of targetStageIds) {
      expect(report, stageId).toContain(`| \`${stageId}\` |`)
    }
    expect(report).toContain('正式策划表采纳项：0')
    expect(report).toContain('不修改职业数值')
  })

  it('preserves the complete quick, normal, and full evidence set', () => {
    expect(fs.existsSync(evidencePath), `Missing candidate evidence: ${evidencePath}`).toBe(true)
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as {
      results: Array<{ id: string, budget?: string, stageId: string }>
    }
    const keys = evidence.results.map((result) => `${result.id}:${result.budget ?? 'quick'}`)
    expect(new Set(keys).size).toBe(69)
    expect(evidence.results.filter((result) => (result.budget ?? 'quick') === 'quick')).toHaveLength(35)
    expect(evidence.results.filter((result) => result.budget === 'normal')).toHaveLength(29)
    expect(evidence.results.filter((result) => result.budget === 'full')).toHaveLength(5)

    const normalStages = new Set(evidence.results
      .filter((result) => result.budget === 'normal')
      .map((result) => result.stageId))
    expect(normalStages).toEqual(new Set(targetStageIds))

    const fullStages = evidence.results
      .filter((result) => result.budget === 'full')
      .map((result) => result.stageId)
      .sort()
    expect(fullStages).toEqual([
      'Challenge-3',
      'Challenge-5',
      'Challenge-6',
      'Challenge-8',
      'Challenge-9',
    ])
    expect(keys).toContain('c1-wounded-candle-plus-geomancer:quick')
    expect(keys).toContain('c1-candle-plus-wounded-geomancer:quick')
  })

  it('uses at most two chapter-legal enemy replacements per stage', () => {
    const updates = Object.values(readManifest()).flat()

    for (const stageId of targetStageIds) {
      const replacements = updates.filter((update) => (
        update.stageId === stageId
        && update.values.enemyId !== undefined
        && update.values.enemyId !== update.expectedBefore.enemyId
      ))
      expect(replacements.length, stageId).toBeLessThanOrEqual(2)

      const pool = stageId.startsWith('Challenge-')
        ? getChallengePool(stageId)
        : westFallPools[stageId]
      for (const update of replacements) {
        expect(pool.has(String(update.values.enemyId)), `${stageId}/${update.spawnId}`).toBe(true)
      }
    }
  })

  it('keeps values inside the approved timing, position, and wounded-variant boundaries', () => {
    const updates = Object.values(readManifest()).flat()

    for (const update of updates) {
      expect(Object.keys(update.values).every((field) => allowedFields.has(field)), update.spawnId).toBe(true)
      if (update.values.row !== undefined) expect(Number(update.values.row), update.spawnId).toBeGreaterThanOrEqual(1)
      if (update.values.row !== undefined) expect(Number(update.values.row), update.spawnId).toBeLessThanOrEqual(5)
      if (update.values.col !== undefined) expect(Number(update.values.col), update.spawnId).toBeGreaterThanOrEqual(1)
      if (update.values.col !== undefined) expect(Number(update.values.col), update.spawnId).toBeLessThanOrEqual(5)
      if (update.values.openingCastSkillNum !== undefined) {
        expect(Number(update.values.openingCastSkillNum), update.spawnId).toBeGreaterThanOrEqual(1)
      }
      if (update.values.openingRecoveryRemainingMs !== undefined) {
        expect(Number(update.values.openingRecoveryRemainingMs), update.spawnId).toBeGreaterThanOrEqual(0)
        expect(Number(update.values.openingRecoveryRemainingMs), update.spawnId).toBeLessThanOrEqual(4000)
      }
    }

    for (const stageId of targetStageIds) {
      const wounded = updates.filter((update) => (
        update.stageId === stageId
        && String(update.values.nameOverride ?? '').startsWith('负伤的')
      ))
      expect(wounded.length, stageId).toBeLessThanOrEqual(1)
      for (const update of wounded) {
        expect(update.values.hpOverride, update.spawnId).toBe(update.values.maxHpOverride)
      }
    }
  })

  it('matches every selected final value in the two designer workbooks', () => {
    const manifest = readManifest()

    for (const [fileName, updates] of Object.entries(manifest)) {
      const rows = readRows(fileName)
      for (const update of updates) {
        const matches = rows.filter((row) => (
          String(row.stageId) === update.stageId && String(row.spawnId) === update.spawnId
        ))
        expect(matches, `${fileName}/${update.stageId}/${update.spawnId}`).toHaveLength(1)
        expect(matches[0]).toMatchObject(update.values)
      }
    }
  })
})
