import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'player_build.xlsx')
const workbook = readDesignerWorkbook(workbookPath)

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function getTable(sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`Missing sheet ${sheetName}`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { sheetName, sheet, range, columns }
}

function findRow(table, keyHeader, keyValues) {
  const col = table.columns.get(keyHeader)
  if (col === undefined) throw new Error(`Missing ${table.sheetName}.${keyHeader}`)
  const values = Array.isArray(keyValues) ? keyValues : [keyValues]
  const matches = []
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    if (values.includes(String(readCell(table.sheet, row, col)))) matches.push(row)
  }
  if (matches.length !== 1) {
    throw new Error(`Expected one ${table.sheetName}.${keyHeader} row for ${values.join('/')}, found ${matches.length}`)
  }
  return matches[0]
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

function updateRow(sheetName, keyHeader, keyValues, values) {
  const table = getTable(sheetName)
  const row = findRow(table, keyHeader, keyValues)
  for (const [header, value] of Object.entries(values)) writeCell(table, row, header, value)
}

function appendRowIfMissing(sheetName, keyHeader, keyValue, values) {
  const table = getTable(sheetName)
  const keyCol = table.columns.get(keyHeader)
  if (keyCol === undefined) throw new Error(`Missing ${sheetName}.${keyHeader}`)
  let row = -1
  for (let candidate = table.range.s.r + 1; candidate <= table.range.e.r; candidate += 1) {
    if (String(readCell(table.sheet, candidate, keyCol)) === keyValue) {
      row = candidate
      break
    }
  }
  if (row < 0) {
    row = table.range.e.r + 1
    table.range.e.r = row
    table.sheet['!ref'] = XLSX.utils.encode_range(table.range)
  }
  for (const [header, value] of Object.entries(values)) writeCell(table, row, header, value)
}

updateRow('主动技能定义', 'skillId', 'druid_bear_t_thrash', {
  cooldownMs: 9000,
  description: '对3x3范围造成10点伤害和仇恨，成功释放获得10点怒气。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_thrash_main', {
  valueA: 10,
  valueB: 10,
  threatMultiplier: 5,
  notes: '痛击对3x3范围造成10点伤害和仇恨，成功释放后获得10怒。',
})
updateRow('主动技能定义', 'skillId', 'druid_bear_t_ironfur', {
  resourceCost: 20,
  description: '消耗20点怒气叠加物理伤害减免，默认每层20%且最多3层。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_ironfur_main', {
  valueA: 20,
  notes: '默认每层20%物理伤害减免，最多3层。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_swipe_main', {
  valueA: 8,
  threatMultiplier: 5,
  notes: '横扫对cross范围造成8点伤害和仇恨，只受公共GCD限制。',
})
updateRow('主动技能定义', 'skillId', 'druid_bear_t_moonfire', {
  cooldownMs: 15000,
  description: '成功释放获得5点怒气；对当前目标立即造成5点伤害，并在12秒内每3秒造成5点伤害。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_moonfire_main', {
  valueA: 5,
  valueB: 3,
  durationMs: 12000,
  threatDelta: 0,
  threatMultiplier: 5,
  notes: '成功释放获得5怒；立即造成5点伤害，随后3/6/9/12秒各造成5点伤害；每次伤害5倍仇恨。',
})
updateRow('主动技能定义', 'skillId', 'druid_bear_t_frenzied_regeneration', {
  cooldownMs: 18000,
})
updateRow('主动技能定义', 'skillId', 'druid_bear_t_barkskin', {
  cooldownMs: 30000,
  description: '自身获得10秒30%全伤害减伤，结束时可由天赋驱散减益。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_barkskin_main', {
  valueB: 0.3,
  durationMs: 10000,
  notes: '10秒30%全伤害减伤。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_regrowth_main', {
  valueA: 25,
  valueB: 5,
  durationMs: 6000,
  notes: '立即固定治疗25点，随后3跳各固定治疗5点。',
})
updateRow('主动技能效果', 'skillEffectId', 'druid_bear_t_regrowth_tick', {
  valueA: 5,
  valueB: 3,
  durationMs: 6000,
  notes: '愈合周期治疗3跳，每跳固定5点。',
})
updateRow('玩家主动状态定义', 'statusId', 'druid_bear_t_ironfur', {
  description: '只对物理伤害生效的叠层减伤，每层默认20%，最多3层。',
  maxStacks: 3,
})
updateRow('玩家主动状态定义', 'statusId', 'druid_bear_t_barkskin', {
  durationMs: 10000,
  description: '10秒30%全伤害减伤。',
})
updateRow('玩家主动状态定义', 'statusId', 'druid_bear_t_regrowth', {
  durationMs: 6000,
  description: '即时固定治疗25点后的3跳周期恢复。',
})

updateRow('被动天赋定义', 'talentId', 'druid_bear_t_thick_hide', {
  description: '常驻10%物理减伤，与铁鬃线性叠加。',
  exclusiveGroup: 'druid_bear_t_ironfur_choice',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_thick_hide_main', {
  valueA: 0.1,
  notes: '常驻10%物理减伤，与铁鬃线性叠加。',
})
updateRow('被动天赋定义', 'talentId', 'druid_bear_t_moonlit_resolve', {
  description: '月火术存在时熊T获得10%全伤害减免。',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_moonlit_resolve_main', {
  valueA: 0.1,
  notes: '月火术存在时熊T获得10%全伤害减免。',
})
updateRow('被动天赋定义', 'talentId', 'druid_bear_t_broken_bark', {
  description: '树皮术额外消耗10点怒气并获得5秒30点全伤害吸收护盾；护盾提前耗尽时获得30点怒气。',
})
updateRow('被动天赋效果', 'talentEffectId', 'druid_bear_t_broken_bark_main', {
  valueA: 30,
  valueB: 10,
  notes: '树皮术额外消耗10怒并获得5秒30点全伤害吸收护盾；护盾提前耗尽返还30怒。',
})
updateRow('玩家被动状态定义', 'statusId', 'druid_bear_t_broken_bark_shield', {
  description: '吸收30点全伤害；持续时间结束前完全破碎时返还30点怒气。',
})

updateRow('被动天赋定义', 'talentId', ['druid_bear_t_natural_tenacity', 'druid_bear_t_pain_immunity'], {
  talentId: 'druid_bear_t_pain_immunity',
  talentName: '疼痛豁免',
  category: 'skill',
  cost: 3,
  description: '痛击不再产生怒气且伤害降低30%；每个命中目标获得5点全伤害吸收，单次最多20点。',
  iconId: 'druid_bear_t_pain_immunity_pic',
  talentLogicId: 'bear_pain_immunity',
  tier: 0,
  talentTagsCsv: 'survival,thrash,absorb',
  exclusiveGroup: 'druid_bear_t_thrash_choice',
  grantedStatusIdsCsv: 'druid_bear_t_pain_immunity_shield',
  enabled: true,
})
updateRow('被动天赋效果', 'talentEffectId', ['druid_bear_t_natural_tenacity_main', 'druid_bear_t_pain_immunity_main'], {
  talentEffectId: 'druid_bear_t_pain_immunity_main',
  talentId: 'druid_bear_t_pain_immunity',
  talentLogicId: 'bear_pain_immunity',
  targetScope: 'skill',
  valueA: 5,
  valueB: 20,
  statusId: 'druid_bear_t_pain_immunity_shield',
  skillId: 'druid_bear_t_thrash',
  notes: '痛击不再产生怒气且伤害降低30%；每个命中目标获得5点全伤害吸收，单次最多20点。',
  enabled: true,
})
updateRow('被动天赋定义', 'talentId', ['druid_bear_t_wild_recovery', 'druid_bear_t_water_fire_immunity'], {
  talentId: 'druid_bear_t_water_fire_immunity',
  talentName: '水火不侵',
  category: 'player',
  cost: 4,
  description: '铁鬃每层获得20%物理伤害减免和10%魔法伤害减免，最多3层。',
  iconId: 'druid_bear_t_water_fire_immunity_pic',
  talentLogicId: 'bear_water_fire_immunity',
  tier: 2,
  talentTagsCsv: 'survival,ironfur,magic',
  exclusiveGroup: 'druid_bear_t_ironfur_choice',
  grantedStatusIdsCsv: '',
  enabled: true,
})
updateRow('被动天赋效果', 'talentEffectId', ['druid_bear_t_wild_recovery_main', 'druid_bear_t_water_fire_immunity_main'], {
  talentEffectId: 'druid_bear_t_water_fire_immunity_main',
  talentId: 'druid_bear_t_water_fire_immunity',
  talentLogicId: 'bear_water_fire_immunity',
  targetScope: 'player',
  valueA: 0.2,
  valueB: 0.1,
  statusId: '',
  skillId: 'druid_bear_t_ironfur',
  notes: '铁鬃每层获得20%物理伤害减免和10%魔法伤害减免，最多3层。',
  enabled: true,
})
updateRow('被动天赋定义', 'talentId', 'druid_bear_t_pain_rage', {
  exclusiveGroup: 'druid_bear_t_thrash_choice',
})

appendRowIfMissing('玩家被动状态定义', 'statusId', 'druid_bear_t_pain_immunity_shield', {
  statusId: 'druid_bear_t_pain_immunity_shield',
  statusName: '疼痛豁免护盾',
  statusCategory: 'playerBuff',
  iconId: 'druid_bear_t_pain_immunity_status_pic',
  durationMs: 9000,
  maxStacks: 1,
  dispellable: false,
  description: '疼痛豁免由痛击命中产生的全伤害吸收护盾。',
  effectLogicId: 'playerBuff_bearPainImmunity',
  enabled: true,
})
for (const sheetName of ['玩家主动状态定义', '玩家被动状态定义']) {
  const table = getTable(sheetName)
  const idCol = table.columns.get('statusId')
  if (idCol === undefined) continue
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    const statusId = String(readCell(table.sheet, row, idCol))
    if (statusId === 'druid_bear_t_wild_recovery') {
      writeCell(table, row, 'enabled', false)
    }
  }
}

for (const [oldId, newId, name] of [
  ['druid_bear_t_natural_tenacity_pic', 'druid_bear_t_pain_immunity_pic', '疼痛豁免'],
  ['druid_bear_t_wild_recovery_pic', 'druid_bear_t_water_fire_immunity_pic', '水火不侵'],
]) {
  updateRow('图标资源映射', 'iconId', [oldId, newId], {
    iconId: newId,
    iconName: name,
    assetKey: 'bear-leaf',
    iconType: 'talent',
    enabled: true,
  })
}
appendRowIfMissing('图标资源映射', 'iconId', 'druid_bear_t_pain_immunity_status_pic', {
  iconId: 'druid_bear_t_pain_immunity_status_pic',
  iconName: '疼痛豁免护盾',
  assetKey: 'bear-aura',
  iconType: 'status',
  enabled: true,
})

const defaults = getTable('默认被动构筑')
const defaultTalentCol = defaults.columns.get('talentId')
if (defaultTalentCol === undefined) throw new Error('Missing 默认被动构筑.talentId')
for (let row = defaults.range.s.r + 1; row <= defaults.range.e.r; row += 1) {
  const talentId = String(readCell(defaults.sheet, row, defaultTalentCol))
  if (talentId === 'druid_bear_t_natural_tenacity') writeCell(defaults, row, 'talentId', 'druid_bear_t_pain_immunity')
  if (talentId === 'druid_bear_t_wild_recovery') writeCell(defaults, row, 'talentId', 'druid_bear_t_water_fire_immunity')
}

writeDesignerWorkbookCompact(workbook, workbookPath, projectRoot)
console.log('Applied Bear T WF6 defense rebalance workbook updates')
