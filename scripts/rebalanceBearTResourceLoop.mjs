import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'player_build.xlsx')
const workbook = XLSX.readFile(workbookPath, { cellStyles: true })

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function getTable(sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`Missing sheet: ${sheetName}`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { sheetName, sheet, range, columns }
}

function findRow(table, keyColumn, keyValue) {
  const keyCol = table.columns.get(keyColumn)
  if (keyCol === undefined) throw new Error(`Missing ${table.sheetName}.${keyColumn}`)
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    if (String(readCell(table.sheet, row, keyCol)) === keyValue) return row
  }
  return -1
}

function writeCell(table, row, header, value) {
  const col = table.columns.get(header)
  if (col === undefined) throw new Error(`Missing ${table.sheetName}.${header}`)
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const styleSourceAddress = XLSX.utils.encode_cell({
    r: Math.max(table.range.s.r + 1, Math.min(row, table.range.e.r)),
    c: col,
  })
  const existing = table.sheet[address] ?? table.sheet[styleSourceAddress] ?? {}
  const type = typeof value === 'boolean' ? 'b' : typeof value === 'number' ? 'n' : 's'
  table.sheet[address] = { ...existing, t: type, v: value, w: String(value) }
}

function updateRow(sheetName, keyColumn, keyValue, values) {
  const table = getTable(sheetName)
  const row = findRow(table, keyColumn, keyValue)
  if (row < 0) throw new Error(`Missing row ${sheetName}.${keyColumn}=${keyValue}`)
  for (const [header, value] of Object.entries(values)) writeCell(table, row, header, value)
}

function appendRowIfMissing(sheetName, keyColumn, keyValue, values) {
  const table = getTable(sheetName)
  const existingRow = findRow(table, keyColumn, keyValue)
  if (existingRow >= 0) {
    for (const [header, value] of Object.entries(values)) writeCell(table, existingRow, header, value)
    return
  }
  const row = table.range.e.r + 1
  for (const [header, value] of Object.entries(values)) writeCell(table, row, header, value)
  table.range.e.r = row
  table.sheet['!ref'] = XLSX.utils.encode_range(table.range)
}

updateRow('主动技能定义', 'skillId', 'druid_bear_t_skull_bash', {
  description: '打断当前目标施法，不消耗怒气；成功打断可由天赋获得额外怒气。',
  resourceCost: 0,
})
updateRow('主动技能定义', 'skillId', 'druid_bear_t_ironfur', { resourceCost: 20 })
updateRow('主动技能定义', 'skillId', 'druid_bear_t_frenzied_regeneration', { resourceCost: 20 })
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_mangle_main', {
  valueB: 15,
  notes: '裂伤伤害并在成功释放后获得15怒气。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_thrash_main', {
  valueB: 5,
  notes: '痛击对3x3范围产生伤害和仇恨，成功释放后获得5怒气。',
})
updateRow('主动技能定义', 'skillId', 'druid_bear_t_mangle', {
  description: '成功释放获得15点怒气并产生高额单体仇恨。',
})
updateRow('主动技能定义', 'skillId', 'druid_bear_t_thrash', {
  description: '对3x3范围造成伤害和仇恨，成功释放获得5点怒气。',
})

updateRow('被动天赋定义', 'talentId', 'druid_bear_t_savage_focus', {
  description: '裂伤额外获得5怒。',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_savage_focus_main', {
  notes: '裂伤额外获得5怒。',
})
appendRowIfMissing('被动天赋定义', 'talentId', 'druid_bear_t_pain_rage', {
  talentId: 'druid_bear_t_pain_rage',
  classId: 'druid_bear_t',
  talentName: '痛苦之怒',
  category: 'skill',
  cost: 4,
  description: '痛击每命中一个敌人额外获得2怒，单次最多额外获得10怒。',
  iconId: 'druid_bear_t_pain_rage_pic',
  talentLogicId: 'bear_pain_rage',
  tier: 0,
  talentTagsCsv: 'rage,aoe',
  uiOrder: 21,
  exclusiveGroup: '',
  grantedStatusIdsCsv: '',
  enabled: true,
})
appendRowIfMissing('被动天赋效果', 'talentEffectId', 'druid_bear_t_pain_rage_main', {
  talentEffectId: 'druid_bear_t_pain_rage_main',
  talentId: 'druid_bear_t_pain_rage',
  effectIndex: 1,
  talentLogicId: 'bear_pain_rage',
  targetScope: 'skill',
  valueA: 2,
  valueB: 10,
  statusId: '',
  skillId: 'druid_bear_t_thrash',
  notes: '痛击每命中一个敌人额外获得2怒，单次最多10怒。',
  enabled: true,
})

updateRow('被动天赋定义', 'talentId', 'druid_bear_t_ironfur_reserve', {
  description: '铁鬃结束后获得5秒10%物理减伤，可与新获得的铁鬃线性叠加。',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_ironfur_reserve_main', {
  valueA: 0.1,
  valueB: 5,
  notes: '铁鬃结束后获得5秒10%物理减伤，可与新获得的铁鬃线性叠加。',
})
updateRow('被动天赋定义', 'talentId', 'druid_bear_t_broken_bark', {
  description: '树皮术改为消耗10怒并获得5秒20点吸收盾；该盾提前破碎时获得20怒。',
  grantedStatusIdsCsv: 'druid_bear_t_broken_bark_shield',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_broken_bark_main', {
  valueA: 20,
  valueB: 10,
  statusId: 'druid_bear_t_broken_bark_shield',
  skillId: 'druid_bear_t_barkskin',
  notes: '树皮术额外消耗10怒并获得5秒20点吸收盾；仅该盾提前破碎返还20怒。',
})
appendRowIfMissing('玩家被动状态定义', 'statusId', 'druid_bear_t_broken_bark_shield', {
  statusId: 'druid_bear_t_broken_bark_shield',
  statusName: '破盾树皮',
  statusCategory: 'playerBuff',
  iconId: 'druid_bear_t_broken_bark_pic',
  durationMs: 5000,
  maxStacks: 1,
  dispellable: false,
  description: '吸收20点全伤害；持续时间结束前完全破碎时返还怒气。',
  effectLogicId: 'bear_broken_bark_shield',
  enabled: true,
})

updateRow('被动天赋定义', 'talentId', 'druid_bear_t_guardian_of_the_grove', {
  description: '熊T高于80%生命时队伍获得25%全伤害减伤。',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_guardian_of_the_grove_main', {
  valueA: 0.25,
  notes: '熊T高于80%生命时队伍获得25%全伤害减伤。',
})
updateRow('被动天赋定义', 'talentId', 'druid_bear_t_last_bear_stand', {
  description: '每场战斗一次，致命伤害后保留15%最大生命并在10秒内无法获得怒气。',
  grantedStatusIdsCsv: 'druid_bear_t_rage_exhaustion',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_last_bear_stand_main', {
  valueA: 0.15,
  valueB: 10,
  statusId: 'druid_bear_t_rage_exhaustion',
  notes: '致命伤害后保留15%最大生命，并施加10秒可驱散禁怒减益。',
})
appendRowIfMissing('玩家被动状态定义', 'statusId', 'druid_bear_t_rage_exhaustion', {
  statusId: 'druid_bear_t_rage_exhaustion',
  statusName: '怒气枯竭',
  statusCategory: 'enemyDebuff',
  iconId: 'druid_bear_t_rage_exhaustion_pic',
  durationMs: 10000,
  maxStacks: 1,
  dispellable: true,
  description: '无法获得任何怒气。',
  effectLogicId: 'bear_rage_exhaustion',
  enabled: true,
})
updateRow('被动天赋定义', 'talentId', 'druid_bear_t_spring_returns', {
  description: '每累计获得60怒治疗队伍5点生命。',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_spring_returns_main', {
  valueA: 60,
  notes: '每累计获得60怒治疗队伍5点生命。',
})

appendRowIfMissing('图标资源映射', 'iconId', 'druid_bear_t_pain_rage_pic', {
  iconId: 'druid_bear_t_pain_rage_pic',
  iconName: '痛苦之怒',
  assetKey: 'bear-pain-rage',
  iconType: 'talent',
  enabled: true,
})
appendRowIfMissing('图标资源映射', 'iconId', 'druid_bear_t_rage_exhaustion_pic', {
  iconId: 'druid_bear_t_rage_exhaustion_pic',
  iconName: '怒气枯竭',
  assetKey: 'bear-rage-lock',
  iconType: 'status',
  enabled: true,
})

XLSX.writeFile(workbook, workbookPath, {
  bookType: 'xlsx',
  cellStyles: true,
  compression: true,
})

console.log('Applied Bear T resource-loop workbook updates')
