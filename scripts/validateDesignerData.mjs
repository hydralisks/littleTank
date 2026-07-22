import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { validateDesignerDataWorkbooks } from '../src/game/data/designerDataValidator.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')

function readWorkbook(fileName) {
  return XLSX.readFile(path.join(designerDataDir, fileName))
}

const result = validateDesignerDataWorkbooks({
  stageContent: readWorkbook('stage_content.xlsx'),
  encounterBalance: readWorkbook('encounter_balance.xlsx'),
  enemyData: readWorkbook('enemy_data.xlsx'),
  playerBuild: readWorkbook('player_build.xlsx'),
  challengeStageContent: readWorkbook('challenge_stage_content.xlsx'),
  challengeEncounterBalance: readWorkbook('challenge_encounter_balance.xlsx'),
})

function formatCounts(counts) {
  const entries = Object.entries(counts)
  if (entries.length === 0) {
    return 'none'
  }

  return entries.map(([code, count]) => `${code}=${count}`).join(', ')
}

console.log('Designer data health summary:')
console.log(`- stages=${result.summary.totalStages}, openings=${result.summary.totalOpenings}, placements=${result.summary.totalPlacements}`)
console.log(`- enemies=${result.summary.totalEnemyDefinitions}, enemySkills=${result.summary.totalEnemySkills}`)
console.log(`- activeSkills=${result.summary.totalActiveSkills}, passiveTalents=${result.summary.totalPassiveTalents}`)
console.log(`- warnings=${result.warnings.length} (${formatCounts(result.summary.warningCountsByCode)})`)

if (result.warnings.length > 0) {
  console.log('Designer data validation warnings:')
  for (const warning of result.warnings) {
    const row = warning.row ? ` row ${warning.row}` : ''
    const field = warning.field ? ` ${warning.field}` : ''
    const value = warning.value ? ` value=${warning.value}` : ''
    console.log(`- [${warning.code}] ${warning.workbook} / ${warning.sheet}${row}${field}${value}`)
  }
}

if (result.valid) {
  console.log('Designer data validation passed.')
  process.exit(0)
}

console.error(`Designer data validation failed: ${result.errors.length} error(s).`)
console.error(`Error counts: ${formatCounts(result.summary.issueCountsByCode)}`)
for (const error of result.errors) {
  const row = error.row ? ` row ${error.row}` : ''
  const field = error.field ? ` ${error.field}` : ''
  const value = error.value ? ` value=${error.value}` : ''
  console.error(`- [${error.code}] ${error.workbook} / ${error.sheet}${row}${field}${value}`)
}

process.exit(1)
