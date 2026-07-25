import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'challenge_stage_content.xlsx')
const sheetName = '关卡'

const BEAR_SKILLS = [
  'druid_bear_t_growl',
  'druid_bear_t_mangle',
  'druid_bear_t_thrash',
  'druid_bear_t_skull_bash',
  'druid_bear_t_ironfur',
  'druid_bear_t_frenzied_regeneration',
  'druid_bear_t_swipe',
  'druid_bear_t_moonfire',
  'druid_bear_t_barkskin',
  'druid_bear_t_survival_instincts',
  'druid_bear_t_lunar_beam',
  'druid_bear_t_incarnation_ursoc',
  'druid_bear_t_rage_of_the_sleeper',
  'druid_bear_t_regrowth',
  'druid_bear_t_berserk',
  'druid_bear_t_roar',
]

const STRATEGY_TIPS = {
  'Challenge-1': '起手建立多目标仇恨，优先打断寒光先知治疗，并用范围仇恨覆盖鱼人前排。',
  'Challenge-2': '优先打断狗头人学徒的烛火飞弹和寒光先知治疗；队伍被点名时及时用群体仇恨技能拉回目标。',
  'Challenge-3': '围绕老瞎眼冲锋安排主要减伤，优先击杀寒光智者，并为鱼人闪电术保留打断或法术应对。',
  'Challenge-4': '后排潮火期间优先打断法术读条，先击杀鱼人吹箭者或寒光智者，主要减伤留给标记后的集火窗口。',
  'Challenge-5': '寒光智者的鱼人闪电术优先打断或使用法术应对；寒光先知治疗和拾荒者拿下不要同时漏掉。',
  'Challenge-6': '保持蜡像和暗影之锄命中同一目标，优先处理鱼人领军增益，并为寒光智者保留关键法术应对。',
  'Challenge-7': '优先击杀寒光先知或后排智者，范围仇恨尽量覆盖后排两点；穿矛破口叠高后使用物理减伤或主要减伤。',
  'Challenge-8': '优先压制高阶牧师和寒光先知；药雾回甘会拖长巨魔单位存活时间，为关键法术保留打断或应对技能。',
  'Challenge-9': '优先处理巨魔高阶牧师的护盾和治疗；盾阵换防触发后先转火或补减伤，主要减伤留给督军撕裂窗口。',
}

function parseCsv(value) {
  return String(value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
}

function getBearSkillCount(stageNumber) {
  if (stageNumber <= 3) return 5
  if (stageNumber <= 6) return 10
  return 16
}

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function writeStringCell(sheet, row, col, value) {
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = sheet[address] ?? {}
  sheet[address] = {
    ...existing,
    t: 's',
    v: value,
    w: value,
  }
}

const workbook = XLSX.readFile(workbookPath, { cellStyles: true })
const sheet = workbook.Sheets[sheetName]
if (!sheet?.['!ref']) {
  throw new Error(`Missing ${sheetName} sheet in ${workbookPath}`)
}

const range = XLSX.utils.decode_range(sheet['!ref'])
const headerColumns = new Map()
for (let col = range.s.c; col <= range.e.c; col += 1) {
  headerColumns.set(String(readCell(sheet, range.s.r, col)), col)
}

for (const requiredHeader of [
  'stageId',
  'allowedClassIdsCsv',
  'unlockedActiveSkillIdsCsv',
  'strategyTips',
  'recommendedActiveSkillNamesCsv',
  'recommendedPassiveTalentNamesCsv',
]) {
  if (!headerColumns.has(requiredHeader)) {
    throw new Error(`Missing required challenge header: ${requiredHeader}`)
  }
}

const updatedStageIds = []
for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
  const stageId = String(readCell(sheet, row, headerColumns.get('stageId')))
  const match = /^Challenge-([1-9])$/.exec(stageId)
  if (!match) continue

  const stageNumber = Number(match[1])
  const unlockedColumn = headerColumns.get('unlockedActiveSkillIdsCsv')
  const warriorSkills = parseCsv(readCell(sheet, row, unlockedColumn))
    .filter((skillId) => skillId.startsWith('warrior_t_'))
  const unlockedSkills = [...warriorSkills, ...BEAR_SKILLS.slice(0, getBearSkillCount(stageNumber))]

  writeStringCell(sheet, row, headerColumns.get('allowedClassIdsCsv'), 'warrior_t,druid_bear_t')
  writeStringCell(sheet, row, unlockedColumn, unlockedSkills.join(','))
  writeStringCell(sheet, row, headerColumns.get('strategyTips'), STRATEGY_TIPS[stageId])
  writeStringCell(sheet, row, headerColumns.get('recommendedActiveSkillNamesCsv'), '')
  writeStringCell(sheet, row, headerColumns.get('recommendedPassiveTalentNamesCsv'), '')
  updatedStageIds.push(stageId)
}

if (updatedStageIds.length !== 9) {
  throw new Error(`Expected to update 9 challenge stages, updated ${updatedStageIds.length}`)
}

XLSX.writeFile(workbook, workbookPath, {
  bookType: 'xlsx',
  cellStyles: true,
  compression: true,
})

console.log(`Updated Bear T snapshots for ${updatedStageIds.join(', ')}`)
