import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')
const fileNames = [
  'player_build.xlsx',
  'challenge_encounter_balance.xlsx',
  'challenge_stage_content.xlsx',
  'manual_playtest_builds.xlsx',
]

for (const fileName of fileNames) {
  const workbookPath = path.join(designerDataDir, fileName)
  const workbook = readDesignerWorkbook(workbookPath)
  writeDesignerWorkbookCompact(workbook, workbookPath, projectRoot)
  console.log(`Rebuilt compact workbook packaging for ${fileName}`)
}
