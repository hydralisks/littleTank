import XLSX from 'xlsx'

const path = 'public/designer-data/player_build.xlsx'
const workbook = XLSX.readFile(path)

const rows = (sheet) => XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: '' })
const replaceBy = (list, key, additions) => {
  const byId = new Map(list.map((row) => [row[key], row]))
  for (const addition of additions) byId.set(addition[key], addition)
  return [...byId.values()]
}
const replaceByComposite = (list, keyOf, additions) => {
  const byId = new Map(list.map((row) => [keyOf(row), row]))
  for (const addition of additions) byId.set(keyOf(addition), addition)
  return [...byId.values()]
}
const write = (sheet, data) => {
  workbook.Sheets[sheet] = XLSX.utils.json_to_sheet(data)
}

const classRow = {
  classId: 'druid_bear_t',
  className: '熊T',
  roleTag: 'tank',
  classDescription: '以怒气技能循环、铁鬃物理减伤和最大生命值联动自疗为核心的守护德鲁伊坦克。',
  recommendedBuildRuleIdsCsv: 'standard_5slot,8slot_0,8slot_2',
  enabled: false,
}

const active = [
  ['growl', '低吼', '低吼', '单体嘲讽当前目标，使用公共被嘲讽状态。', 0, 8000, 0, 'currentEnemy', 'taunt_single', 'threat', 'RD-6解锁'],
  ['mangle', '裂伤', '裂伤', '成功释放获得20点怒气并产生高额单体仇恨。', 0, 6000, 1500, 'currentEnemy', 'bear_mangle', 'damage,rage,threat', 'RD-6解锁'],
  ['thrash', '痛击', '痛击', '对3x3范围造成伤害和仇恨，成功释放获得15点怒气。', 0, 8000, 1500, 'matrix3x3Enemy', 'bear_thrash', 'damage,aoe,rage,threat', 'RD-6解锁'],
  ['skull_bash', '迎头痛击', '打断', '打断当前目标施法，成功打断可由天赋获得额外怒气。', 10, 12000, 1500, 'currentEnemy', 'interrupt_cast', 'anti-cast,rage', 'RD-6解锁'],
  ['ironfur', '铁鬃', '铁鬃', '消耗怒气叠加只对物理伤害生效的减伤，最多3层。', 35, 0, 0, 'self', 'bear_ironfur', 'survival,physical', 'RD-6解锁'],
  ['frenzied_regeneration', '狂暴回复', '回复', '消耗怒气，按当前最大生命值进行不可被控制暂停的持续治疗。', 35, 24000, 0, 'self', 'bear_frenzied_regeneration', 'survival,heal', 'WF-1解锁'],
  ['swipe', '横扫', '横扫', '对近身cross范围造成范围伤害和仇恨，只受公共GCD限制。', 0, 0, 1500, 'crossEnemy', 'bear_swipe', 'damage,aoe,threat', 'WF-1解锁'],
  ['moonfire', '月火术', '月火', '对当前目标施加持续伤害，不消耗怒气。', 0, 10000, 1500, 'currentEnemy', 'bear_moonfire', 'damage,dot', 'WF-3解锁'],
  ['barkskin', '树皮术', '树皮', '自身获得6秒全伤害减伤，结束时可由天赋驱散减益。', 0, 28000, 0, 'self', 'bear_barkskin', 'survival,dispel', 'WF-3解锁'],
  ['survival_instincts', '生存本能', '本能', '短时间提高最大生命值并获得全伤害减伤。', 0, 90000, 0, 'self', 'bear_survival_instincts', 'survival,max-hp', 'WF-5解锁'],
  ['lunar_beam', '明月普照', '月光', '短时间提高最大生命值并周期治疗自身。', 20, 60000, 1500, 'self', 'bear_lunar_beam', 'survival,heal,max-hp', 'ZA-1解锁'],
  ['incarnation_ursoc', '乌索克的化身', '化身', '短时间提高最大生命值、物理减伤和仇恨稳定性。', 0, 90000, 0, 'self', 'bear_incarnation_ursoc', 'survival,max-hp,threat', 'ZA-2解锁'],
  ['rage_of_the_sleeper', '沉睡者之怒', '沉睡', '自身获得全伤害减伤，并将部分承伤转化为反击伤害与仇恨。', 20, 45000, 0, 'self', 'bear_rage_of_the_sleeper', 'survival,retaliation,party', 'ZA-3解锁'],
  ['regrowth', '愈合', '愈合', '仅能对自身施放的即时治疗与持续恢复。', 20, 20000, 1500, 'self', 'bear_regrowth', 'heal,survival', 'ZA-5解锁'],
  ['berserk', '狂暴', '狂暴', '立即获得怒气并解除自身一个可驱散控制或减速。', 0, 90000, 0, 'self', 'bear_berserk', 'rage,dispel', 'ZA-5解锁'],
  ['roar', '咆哮', '咆哮', '对当前格及上下左右共5格进行范围嘲讽。', 20, 30000, 1500, 'crossEnemy', 'taunt', 'threat,aoe', 'ZA-5解锁'],
].map(([suffix, name, shortName, description, resourceCost, cooldownMs, gcdMs, targetingType, skillLogicId, tags, unlockHint], index) => ({
  skillId: `druid_bear_t_${suffix}`,
  classId: 'druid_bear_t',
  skillName: name,
  shortName,
  description,
  iconId: `druid_bear_t_${suffix}_pic`,
  pointCost: 4,
  resourceCost,
  cooldownMs,
  initialRemainingCooldownMs: 0,
  gcdMs,
  targetingType,
  skillLogicId,
  castStopMode: skillLogicId === 'interrupt_cast' ? 'interrupt' : 'none',
  canAffectSkull: skillLogicId !== 'bear_moonfire',
  skillTagsCsv: tags,
  uiOrder: index + 1,
  unlockHint,
  grantedStatusIdsCsv: ['growl', 'roar'].includes(suffix) ? 'taunted' : skillLogicId === 'interrupt_cast' ? 'countered' : '',
  enabled: true,
}))

const activeEffects = [
  ['growl', 'taunt_single', 'current', 0, 0, 3000, 'taunted', 72, 0, '低吼使用公共被嘲讽状态。'],
  ['mangle', 'bear_mangle', 'current', 15, 20, 0, '', 0, 5, '裂伤伤害并在成功释放后获得20怒气。'],
  ['thrash', 'bear_thrash', 'matrix3x3', 10, 15, 0, '', 0, 4, '痛击对3x3范围产生伤害和仇恨。'],
  ['skull_bash', 'interrupt_cast', 'current', 0, 0, 3000, 'countered', 0, 0, '迎头痛击打断施法。'],
  ['ironfur', 'bear_ironfur', 'self', 15, 0, 8000, 'druid_bear_t_ironfur', 0, 0, '每层15%物理减伤，最多3层。'],
  ['frenzied_regeneration', 'bear_frenzied_regeneration', 'self', 0.06, 4, 8000, 'druid_bear_t_frenzied_regeneration', 0, 0, '8秒4跳，每跳按最大生命值6%治疗。'],
  ['swipe', 'bear_swipe', 'cross', 10, 0, 0, '', 0, 4, '横扫只受GCD限制。'],
  ['moonfire', 'bear_moonfire', 'current', 6, 3, 12000, 'druid_bear_t_moonfire', 12, 3, '月火术12秒持续伤害，每3秒一跳。'],
  ['barkskin', 'bear_barkskin', 'self', 0, 0.2, 6000, 'druid_bear_t_barkskin', 0, 0, '6秒20%全伤害减伤。'],
  ['survival_instincts', 'bear_survival_instincts', 'self', 0.3, 0.2, 8000, 'druid_bear_t_survival_instincts', 0, 0, '8秒最大生命值+30%和全伤害减伤20%。'],
  ['lunar_beam', 'bear_lunar_beam', 'self', 0.2, 0.03, 10000, 'druid_bear_t_lunar_beam', 0, 0, '10秒最大生命值+20%，每2秒治疗最大生命值3%。'],
  ['incarnation_ursoc', 'bear_incarnation_ursoc', 'self', 0.35, 0.2, 12000, 'druid_bear_t_incarnation_ursoc', 0, 0, '12秒最大生命值+35%和20%物理减伤。'],
  ['rage_of_the_sleeper', 'bear_rage_of_the_sleeper', 'self', 0.25, 0.25, 8000, 'druid_bear_t_rage_of_the_sleeper', 0, 0, '8秒25%全伤害减伤和反击。'],
  ['regrowth', 'bear_regrowth', 'self', 0.12, 0.03, 6000, 'druid_bear_t_regrowth', 0, 0, '立即治疗12%，随后3跳各3%。'],
  ['berserk', 'bear_berserk', 'self', 40, 0, 0, '', 0, 0, '立即获得40怒并解除一个自身控制或减速。'],
  ['roar', 'taunt', 'cross', 0, 0, 3000, 'taunted', 72, 0, '咆哮对cross五格进行范围嘲讽。'],
].flatMap(([suffix, logicId, targetSelector, valueA, valueB, durationMs, statusId, threatDelta, threatMultiplier, notes]) => {
  const main = {
    skillEffectId: `druid_bear_t_${suffix}_main`,
    skillId: `druid_bear_t_${suffix}`,
    effectIndex: 1,
    skillLogicId: logicId,
    targetSelector,
    valueA,
    valueB,
    durationMs,
    statusId,
    threatDelta,
    threatMultiplier,
    threatSource: 'player',
    notes,
    enabled: true,
  }
  if (!['frenzied_regeneration', 'lunar_beam', 'regrowth'].includes(suffix)) {
    return [main]
  }
  return [
    main,
    {
      skillEffectId: `druid_bear_t_${suffix}_tick`,
      skillId: `druid_bear_t_${suffix}`,
      effectIndex: 2,
      skillLogicId: logicId,
      targetSelector: 'self',
      valueA: suffix === 'frenzied_regeneration' ? 0.06 : 0.03,
      valueB: suffix === 'frenzied_regeneration' ? 4 : suffix === 'lunar_beam' ? 5 : 3,
      durationMs,
      statusId,
      threatDelta: 0,
      threatMultiplier: 0,
      threatSource: 'player',
      notes: '周期治疗数据。',
      enabled: true,
    },
  ]
})

const activeStatuses = [
  ['druid_bear_t_ironfur', '铁鬃', 'playerBuff', 8000, 3, false, 'playerBuff_bearIronfur', '只对物理伤害生效的叠层减伤。'],
  ['druid_bear_t_frenzied_regeneration', '狂暴回复', 'playerBuff', 8000, 1, false, 'playerBuff_bearFrenziedRegeneration', '不可被控制暂停的周期治疗。'],
  ['druid_bear_t_moonfire', '月火术', 'enemyDebuff', 12000, 1, true, 'enemyDebuff_bearMoonfire', '熊T月火术持续伤害。'],
  ['druid_bear_t_barkskin', '树皮术', 'playerBuff', 6000, 1, false, 'playerBuff_bearBarkskin', '全伤害减伤。'],
  ['druid_bear_t_survival_instincts', '生存本能', 'playerBuff', 8000, 1, false, 'playerBuff_bearSurvivalInstincts', '最大生命值和全伤害减伤。'],
  ['druid_bear_t_lunar_beam', '明月普照', 'playerBuff', 10000, 1, false, 'playerBuff_bearLunarBeam', '最大生命值和周期治疗。'],
  ['druid_bear_t_incarnation_ursoc', '乌索克的化身', 'playerBuff', 12000, 1, false, 'playerBuff_bearIncarnationUrsoc', '最大生命值和物理减伤。'],
  ['druid_bear_t_rage_of_the_sleeper', '沉睡者之怒', 'playerBuff', 8000, 1, false, 'playerBuff_bearRageOfTheSleeper', '全伤害减伤和反击。'],
  ['druid_bear_t_regrowth', '愈合', 'playerBuff', 6000, 1, false, 'playerBuff_bearRegrowth', '即时治疗后的周期恢复。'],
  ['druid_bear_t_ironfur_reserve', '铁鬃余韵', 'playerBuff', 3000, 1, false, 'playerBuff_bearIronfurReserve', '铁鬃结束后的残留物理减伤。'],
  ['druid_bear_t_pack_presence', '兽群威势', 'partyBuff', -1, 1, false, 'partyBuff_bearPackPresence', '队伍全伤害减伤。'],
  ['druid_bear_t_moonlit_resolve', '月下坚守', 'playerBuff', -1, 1, false, 'playerBuff_bearMoonlitResolve', '月火术存在时的全伤害减伤。'],
  ['druid_bear_t_ursoc_shelter', '乌索克庇护', 'partyBuff', 8000, 1, false, 'partyBuff_bearUrsocShelter', '队伍全伤害减伤。'],
  ['druid_bear_t_wild_recovery', '野性复原', 'playerBuff', 5000, 1, false, 'playerBuff_bearWildRecovery', '临时最大生命值提升。'],
  ['druid_bear_t_guardian_of_the_grove', '林地守护者', 'partyBuff', -1, 1, false, 'partyBuff_bearGuardianOfTheGrove', '熊T高于80%生命时的队伍全伤害减伤。'],
  ['druid_bear_t_feral_aftershock', '野性余震', 'playerBuff', 6000, 1, false, 'playerBuff_bearFeralAftershock', '咆哮命中多个目标后的物理减伤。'],
].map(([statusId, statusName, statusCategory, durationMs, maxStacks, dispellable, effectLogicId, description]) => ({
  statusId,
  statusName,
  statusCategory,
  iconId: `${statusId}_status_pic`,
  durationMs,
  maxStacks,
  dispellable,
  description,
  effectLogicId,
  enabled: true,
}))

const talentRows = [
  ['great_bear_vigor', '巨熊活力', 'player', 2, 'reinforced_plates', 0, '最大生命值提高20%。'], ['thick_hide', '厚皮', 'player', 2, 'bear_physical_reduction', 0, '常驻8%物理减伤。'], ['ursine_threat', '熊威', 'skill', 2, 'bear_threat_multiplier', 0, '熊T技能仇恨提高20%。'], ['savage_focus', '野性专注', 'player', 2, 'bear_generator_bonus', 0, '裂伤和痛击各额外获得5怒。'], ['natural_tenacity', '自然坚韧', 'player', 2, 'bear_control_duration_reduction', 0, '控制类减益持续时间缩短25%。'],
  ['ironfur_reserve', '铁鬃余韵', 'skill', 2, 'bear_ironfur_reserve', 1, '铁鬃结束后获得3秒8%物理减伤。'], ['blood_scent', '血性气息', 'skill', 2, 'bear_blood_scent', 1, '狂暴回复期间首次受伤获得8怒。'], ['skull_bash_instinct', '断法本能', 'skill', 2, 'bear_skull_bash_instinct', 1, '成功打断获得10怒。'], ['broken_bark', '破盾回响', 'skill', 2, 'bear_broken_bark', 1, '吸收盾提前破碎获得12怒。'], ['pack_presence', '兽群威势', 'party', 3, 'bear_pack_presence', 1, '铁鬃两层时队伍获得8%全伤害减伤。'],
  ['moonlit_resolve', '月下坚守', 'skill', 2, 'bear_moonlit_resolve', 2, '月火术存在时熊T获得5%全伤害减伤。'], ['bark_dispelling', '树皮净化', 'skill', 2, 'bear_bark_dispelling', 2, '树皮术结束时解除所有可驱散玩家减益。'], ['regenerative_bond', '回春羁绊', 'party', 3, 'bear_regenerative_bond', 2, '狂暴回复最后一跳治疗队伍5点。'], ['ursoc_shelter', '乌索克庇护', 'party', 3, 'bear_ursoc_shelter', 2, '沉睡者之怒减伤同时作用队伍。'], ['wild_recovery', '野性复原', 'player', 2, 'bear_wild_recovery', 2, '有效治疗后获得短时最大生命值提升。'],
  ['regrowth_of_the_pack', '兽群愈合', 'party', 3, 'bear_regrowth_of_the_pack', 3, '愈合同时治疗队伍原始治疗量25%。'], ['guardian_of_the_grove', '林地守护者', 'party', 3, 'bear_guardian_of_the_grove', 3, '熊T高于80%生命时队伍获得6%全伤害减伤。'], ['feral_aftershock', '野性余震', 'skill', 2, 'bear_feral_aftershock', 3, '咆哮命中至少2个目标后获得6秒12%物理减伤。'], ['last_bear_stand', '巨熊绝境', 'player', 4, 'bear_last_bear_stand', 3, '每场战斗一次致命伤害保留1生命并获得铁鬃。'], ['spring_returns', '春风吹又生', 'party', 3, 'bear_spring_returns', 3, '每累计获得30怒治疗队伍5点生命。'],
].map(([suffix, talentName, category, cost, talentLogicId, tier, description], index) => ({
  talentId: `druid_bear_t_${suffix}`,
  classId: 'druid_bear_t',
  talentName,
  category,
  cost,
  description,
  iconId: `druid_bear_t_${suffix}_pic`,
  talentLogicId,
  tier,
  talentTagsCsv: category === 'party' ? 'party,survival' : 'survival',
  uiOrder: index + 1,
  exclusiveGroup: '',
  grantedStatusIdsCsv: '',
  enabled: true,
}))

const passiveEffectValues = {
  great_bear_vigor: [0.2, 0],
  thick_hide: [0.08, 0],
  ursine_threat: [0.2, 0],
  savage_focus: [5, 0],
  natural_tenacity: [0.25, 0],
  ironfur_reserve: [0.08, 3],
  blood_scent: [8, 0],
  skull_bash_instinct: [10, 0],
  broken_bark: [12, 0],
  pack_presence: [0.08, 0],
  moonlit_resolve: [0.05, 0],
  bark_dispelling: [0, 0],
  regenerative_bond: [5, 0],
  ursoc_shelter: [0.12, 0],
  wild_recovery: [0.1, 10],
  regrowth_of_the_pack: [0.25, 0],
  guardian_of_the_grove: [0.06, 0.8],
  feral_aftershock: [0.12, 6],
  last_bear_stand: [1, 0],
  spring_returns: [30, 5],
}

const passiveEffects = talentRows.map((row) => {
  const suffix = row.talentId.replace('druid_bear_t_', '')
  const [valueA, valueB] = passiveEffectValues[suffix] ?? [0, 0]
  return ({
  talentEffectId: `${row.talentId}_main`,
  talentId: row.talentId,
  effectIndex: 1,
  talentLogicId: row.talentLogicId,
  targetScope: row.category,
  valueA,
  valueB,
  statusId: ['pack_presence', 'moonlit_resolve', 'ursoc_shelter', 'wild_recovery', 'guardian_of_the_grove', 'feral_aftershock'].includes(suffix) ? `druid_bear_t_${suffix}` : '',
  skillId: row.talentId.includes('skull_bash') ? 'druid_bear_t_skull_bash' : row.talentId.includes('bark_dispelling') ? 'druid_bear_t_barkskin' : row.talentId.includes('regrowth') ? 'druid_bear_t_regrowth' : row.talentId.includes('moonlit') ? 'druid_bear_t_moonfire' : row.talentId.includes('ursoc_shelter') ? 'druid_bear_t_rage_of_the_sleeper' : '',
  notes: row.description,
  enabled: true,
  })
})

const passiveStatuses = activeStatuses.filter((status) => status.statusId.includes('pack_presence') || status.statusId.includes('moonlit_resolve') || status.statusId.includes('ursoc_shelter') || status.statusId.includes('wild_recovery') || status.statusId.includes('guardian_of_the_grove') || status.statusId.includes('feral_aftershock'))

const iconRows = [
  { iconId: 'druid_bear_t_class_pic', iconName: '熊T', assetKey: 'bear-aura', iconType: 'class', enabled: true },
  ...active.map((skill) => ({ iconId: skill.iconId, iconName: skill.skillName, assetKey: 'bear-claw', iconType: 'skill', enabled: true })),
  ...talentRows.map((talent) => ({ iconId: talent.iconId, iconName: talent.talentName, assetKey: 'bear-leaf', iconType: 'talent', enabled: true })),
  ...activeStatuses.map((status) => ({ iconId: status.iconId, iconName: status.statusName, assetKey: 'bear-aura', iconType: 'status', enabled: true })),
]

const defaultActive = [
  ['standard_5slot', '1', 'growl', 1], ['standard_5slot', '2', 'mangle', 2], ['standard_5slot', '3', 'thrash', 3], ['standard_5slot', '4', 'skull_bash', 4], ['standard_5slot', 'Q', 'ironfur', 5],
  ['8slot_0', '1', 'growl', 1], ['8slot_0', '2', 'mangle', 2], ['8slot_0', '3', 'thrash', 3], ['8slot_0', '4', 'skull_bash', 4], ['8slot_0', 'Q', 'ironfur', 5], ['8slot_0', 'E', 'frenzied_regeneration', 6], ['8slot_0', 'R', 'swipe', 7], ['8slot_0', 'F', 'moonfire', 8],
  ['8slot_2', '1', 'growl', 1], ['8slot_2', '2', 'mangle', 2], ['8slot_2', '3', 'thrash', 3], ['8slot_2', '4', 'skull_bash', 4], ['8slot_2', 'Q', 'ironfur', 5], ['8slot_2', 'E', 'frenzied_regeneration', 6], ['8slot_2', 'R', 'swipe', 7], ['8slot_2', 'F', 'moonfire', 8],
].map(([buildRuleId, hotkey, suffix, priority]) => ({ presetId: 'druid_bear_t', buildRuleId, classId: 'druid_bear_t', hotkey, skillId: `druid_bear_t_${suffix}`, priority }))

const warriorDefaultActive = [
  { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
  { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
  { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
  { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
  { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: '3', skillId: 'warrior_t_stun', priority: 3 },
]

const defaultPassive = [
  ['standard_5slot', 'great_bear_vigor', 1], ['standard_5slot', 'thick_hide', 2], ['standard_5slot', 'savage_focus', 3],
  ['8slot_0', 'great_bear_vigor', 1], ['8slot_0', 'thick_hide', 2], ['8slot_0', 'savage_focus', 3], ['8slot_0', 'skull_bash_instinct', 4], ['8slot_0', 'pack_presence', 5],
  ['8slot_2', 'great_bear_vigor', 1], ['8slot_2', 'thick_hide', 2], ['8slot_2', 'savage_focus', 3], ['8slot_2', 'ursoc_shelter', 4], ['8slot_2', 'spring_returns', 5],
].map(([buildRuleId, suffix, priority]) => ({ presetId: 'druid_bear_t', buildRuleId, classId: 'druid_bear_t', talentId: `druid_bear_t_${suffix}`, selected: true, priority }))

const warriorDefaultPassive = [
  { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', talentId: 'warrior_t_reinforced_plates', selected: true, priority: 1 },
  { presetId: 'standard_5slot', buildRuleId: 'standard_5slot', classId: 'warrior_t', talentId: 'warrior_t_snap_interrupt', selected: true, priority: 2 },
  { presetId: 'standard_5slot', buildRuleId: 'standard_5slot', classId: 'warrior_t', talentId: 'warrior_t_defenders_aegis', selected: true, priority: 1 },
]

write('职业定义', replaceBy(rows('职业定义'), 'classId', [classRow]))
write('主动技能定义', replaceBy(rows('主动技能定义'), 'skillId', active))
write('主动技能效果', replaceBy(rows('主动技能效果'), 'skillEffectId', activeEffects))
write('玩家主动状态定义', replaceBy(rows('玩家主动状态定义'), 'statusId', activeStatuses))
write('被动天赋定义', replaceBy(rows('被动天赋定义'), 'talentId', talentRows))
write('被动天赋效果', replaceBy(rows('被动天赋效果'), 'talentEffectId', passiveEffects))
write('玩家被动状态定义', replaceBy(rows('玩家被动状态定义'), 'statusId', passiveStatuses))
write('图标资源映射', replaceBy(rows('图标资源映射'), 'iconId', iconRows))
write('默认主动构筑', replaceByComposite(warriorDefaultActive, (row) => `${row.classId}|${row.buildRuleId}|${row.hotkey}`, defaultActive))
write('默认被动构筑', replaceByComposite(warriorDefaultPassive, (row) => `${row.classId}|${row.buildRuleId}|${row.talentId}`, defaultPassive))

XLSX.writeFile(workbook, path)
console.log(`Updated ${path}: active=${active.length}, talents=${talentRows.length}, statuses=${activeStatuses.length}, icons=${iconRows.length}`)
