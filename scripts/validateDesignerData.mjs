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
})

if (result.valid) {
  console.log('Designer data validation passed.')
  process.exit(0)
}

console.error(`Designer data validation failed: ${result.errors.length} error(s).`)
for (const error of result.errors) {
  const row = error.row ? ` row ${error.row}` : ''
  const field = error.field ? ` ${error.field}` : ''
  const value = error.value ? ` value=${error.value}` : ''
  console.error(`- [${error.code}] ${error.workbook} / ${error.sheet}${row}${field}${value}`)
}

process.exit(1)
