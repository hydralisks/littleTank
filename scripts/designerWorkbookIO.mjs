import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import XLSX from 'xlsx'

function getProjectRelativePath(projectRoot, workbookPath) {
  const relativePath = path.relative(projectRoot, workbookPath).replaceAll('\\', '/')
  if (relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    throw new Error(`Workbook path must stay inside project root: ${workbookPath}`)
  }
  return relativePath
}

function getWorkbookDataFingerprint(workbook) {
  return JSON.stringify(workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    return {
      sheetName,
      ref: sheet?.['!ref'] ?? null,
      rows: sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) : [],
    }
  }))
}

function projectCurrentDataOntoTemplate(currentWorkbook, templateWorkbook) {
  const outputWorkbook = { ...templateWorkbook, SheetNames: [...currentWorkbook.SheetNames], Sheets: {} }
  for (const sheetName of currentWorkbook.SheetNames) {
    const currentSheet = currentWorkbook.Sheets[sheetName]
    const templateSheet = templateWorkbook.Sheets[sheetName] ?? {}
    const outputSheet = {}

    for (const [key, value] of Object.entries(templateSheet)) {
      if (key.startsWith('!')) outputSheet[key] = value
    }
    for (const [key, value] of Object.entries(currentSheet ?? {})) {
      if (key.startsWith('!')) {
        outputSheet[key] = value
        continue
      }
      const templateCell = templateSheet[key]
      outputSheet[key] = templateCell?.s === undefined ? { ...value } : { ...value, s: templateCell.s }
    }
    outputWorkbook.Sheets[sheetName] = outputSheet
  }
  outputWorkbook.Props = currentWorkbook.Props
  outputWorkbook.Custprops = currentWorkbook.Custprops
  return outputWorkbook
}

export function readDesignerWorkbook(workbookPath) {
  return XLSX.readFile(workbookPath, { cellStyles: false })
}

export function writeDesignerWorkbookCompact(currentWorkbook, workbookPath, projectRoot) {
  const relativePath = getProjectRelativePath(projectRoot, workbookPath)
  const templateBuffer = execFileSync('git', ['show', `HEAD:${relativePath}`], {
    cwd: projectRoot,
    maxBuffer: 64 * 1024 * 1024,
  })
  const templateWorkbook = XLSX.read(templateBuffer, { type: 'buffer', cellStyles: true })
  const outputWorkbook = projectCurrentDataOntoTemplate(currentWorkbook, templateWorkbook)
  const tempPath = `${workbookPath}.compact.tmp.xlsx`

  XLSX.writeFile(outputWorkbook, tempPath, { bookType: 'xlsx', cellStyles: true, compression: true })
  const verifiedWorkbook = XLSX.readFile(tempPath, { cellStyles: false })
  const expectedFingerprint = getWorkbookDataFingerprint(currentWorkbook)
  const actualFingerprint = getWorkbookDataFingerprint(verifiedWorkbook)
  if (actualFingerprint !== expectedFingerprint) {
    fs.rmSync(tempPath, { force: true })
    throw new Error(`Compact workbook verification failed for ${relativePath}`)
  }

  fs.copyFileSync(tempPath, workbookPath)
  fs.rmSync(tempPath, { force: true })
}

export { XLSX }
