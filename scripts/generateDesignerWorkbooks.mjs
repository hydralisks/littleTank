import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

const projectRoot = process.cwd()
const outputDir = path.join(projectRoot, 'public', 'designer-data')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeWorkbook(filePath, sheets) {
  const workbook = XLSX.utils.book_new()

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  XLSX.writeFile(workbook, filePath)
}

function buildStageWorkbook() {
  return {
    区域: [
      {
        areaId: 'harbor',
        title: '潮湾前哨',
        shortTitle: '潮湾',
        mapLabel: '雾港外湾',
        description: '港区区域强调起手接怪、双目标稳仇与连续读条处理。',
        accent: '#6fd3ff',
      },
      {
        areaId: 'midland',
        title: '焰痕腹地',
        shortTitle: '焰痕',
        mapLabel: '灰桥腹地',
        description: '腹地区域更强调十字站位、多目标控制和队伍压力管理。',
        accent: '#ffcd62',
      },
      {
        areaId: 'highland',
        title: '雷崖高地',
        shortTitle: '雷崖',
        mapLabel: '王座山脊',
        description: '高地区域主打长线承压、持续增益和终局构筑检定。',
        accent: '#ff7d66',
      },
    ],
    关卡: [
      {
        stageId: 'harbor-1',
        title: '潮湾堤口',
        subtitle: '基础仇恨与起手接怪',
        affix1Title: '余烬过载',
        affix1Description: '施法敌人更容易维持火焰强化。',
        affix1IconId: 'ember-aegis',
        affix2Title: '裂甲回响',
        affix2Description: '重击与破防技能更容易连着出现。',
        affix2IconId: 'sundered',
        rule1Title: '先手快照',
        rule1Description: '更强调起手仇恨变化的快速读取。',
        rule1IconId: 'battle-seal',
        rule2Title: '外部状态图例',
        rule2Description: '右侧图例持续说明本关场外状态来源。',
        rule2IconId: 'stable',
        unlockedActiveSkillIdsCsv: 'warrior_t_taunt',
      },
      {
        stageId: 'midland-2',
        title: '火线回廊',
        subtitle: '连续打断与位移压力',
        affix1Title: '热线连射',
        affix1Description: '短条会更密集地穿插在高危技能之间。',
        affix1IconId: 'haste',
        affix2Title: '急袭轮转',
        affix2Description: '危险读条之间的间隔更短。',
        affix2IconId: 'formation-break',
        rule1Title: '打断预算',
        rule1Description: '关键不在全断，而在把打断留给最危险的条。',
        rule1IconId: 'battle-seal',
        rule2Title: '时机判定',
        rule2Description: '技能释放时点会被明显放大。',
        rule2IconId: 'battle-seal',
        unlockedActiveSkillIdsCsv: '',
      },
      {
        stageId: 'highland-4',
        title: '战歌断崖',
        subtitle: '持续增益场中的控场稳定',
        affix1Title: '断崖战歌',
        affix1Description: '高地战歌会不断放大敌人的后段攻势。',
        affix1IconId: 'enrage-song',
        affix2Title: '无尽战歌',
        affix2Description: '敌方增益层数持续更久。',
        affix2IconId: 'enrage-song',
        rule1Title: '后段控场',
        rule1Description: '局面开始发散后仍要稳住节奏。',
        rule1IconId: 'battle-seal',
        rule2Title: '后程检定',
        rule2Description: '构筑是否能撑到后段会被放大检验。',
        rule2IconId: 'battle-seal',
        unlockedActiveSkillIdsCsv: '',
      },
    ],
    图例: [
      { areaId: 'harbor', id: 'ember-aegis', label: '余烬护幕', source: '敌人 Buff', target: '敌方', description: '施法敌人给自身维持的护幕效果。' },
      { areaId: 'midland', id: 'formation-break', label: '阵型冲散', source: '敌人 Debuff', target: '队伍', description: '冲锋或背刺之后常见的团队减益。' },
      { areaId: 'highland', id: 'enrage-song', label: '战歌', source: '关卡状态', target: '敌方', description: '高地区域常见的持续性敌方增益。' },
    ],
  }
}

function buildEncounterWorkbook() {
  return {
    关卡开场: [
      { stageId: 'harbor-1', playerHp: 900, playerMaxHp: 1000, playerResource: 56, playerGcdRemainingMs: 0, partyHp: 930, partyMaxHp: 1000, partyPressure: 18, partyMaxPressure: 100, buildRuleId: 'tutorial_2slot', partyAutoDamageIntervalMs: 1000, partyAutoDamageTargetCount: 1, partyAutoDamageMin: 10, partyAutoDamageMax: 20 },
      { stageId: 'midland-2', playerHp: 884, playerMaxHp: 1000, playerResource: 46, playerGcdRemainingMs: 0, partyHp: 912, partyMaxHp: 1000, partyPressure: 33, partyMaxPressure: 100, buildRuleId: 'standard_5slot', partyAutoDamageIntervalMs: 1000, partyAutoDamageTargetCount: 2, partyAutoDamageMin: 12, partyAutoDamageMax: 24 },
      { stageId: 'highland-4', playerHp: 828, playerMaxHp: 1000, playerResource: 36, playerGcdRemainingMs: 0, partyHp: 846, partyMaxHp: 1000, partyPressure: 58, partyMaxPressure: 100, buildRuleId: 'full_8slot', partyAutoDamageIntervalMs: 1000, partyAutoDamageTargetCount: 2, partyAutoDamageMin: 16, partyAutoDamageMax: 30 },
    ],
    敌人布置: [
      { stageId: 'harbor-1', spawnId: 'harbor-1-e01', enemyId: 'harbor_raider', row: 1, col: 1, nameOverride: '潮湾打手 A', hpOverride: 92, maxHpOverride: '', skillCycleCsv: '', threatLogic: 'normal', target: 'tank', threatState: 'safe', isSkullOverride: '', openingCastSkillId: '', openingCastRemainingMs: '', openingRecoveryRemainingMs: '' },
      { stageId: 'midland-2', spawnId: 'midland-2-e02', enemyId: 'midland_pyromancer', row: 1, col: 2, nameOverride: '焰痕术士 B', hpOverride: 124, maxHpOverride: '', skillCycleCsv: 'flame-lance,ember-bolt,dark-mend,staff-smash,ember-rush', threatLogic: 'normal', target: 'ally', threatState: 'lost', isSkullOverride: false, openingCastSkillId: '', openingCastRemainingMs: '', openingRecoveryRemainingMs: '' },
      { stageId: 'highland-4', spawnId: 'highland-4-e05', enemyId: 'highland_commander', row: 1, col: 5, nameOverride: '王座统尽者 E', hpOverride: 392, maxHpOverride: 470, skillCycleCsv: 'crusher-slam,ruin-volley,crusher-slam', threatLogic: 'bloodlust', target: 'ally', threatState: 'warning', isSkullOverride: true, openingCastSkillId: 'ruin-volley', openingCastRemainingMs: 1122, openingRecoveryRemainingMs: 0 },
    ],
    开场状态: [
      { stageId: 'harbor-1', targetType: 'enemy', targetId: 'harbor-1-e02', statusId: 'ember-aegis', durationMsOverride: 3800, stacks: 1, sourceType: 'manual', sourceId: '' },
      { stageId: 'midland-2', targetType: 'party', targetId: '', statusId: 'suppression', durationMsOverride: 2600, stacks: 1, sourceType: 'manual', sourceId: '' },
      { stageId: 'highland-4', targetType: 'enemy', targetId: 'highland-4-e05', statusId: 'enraged', durationMsOverride: 5200, stacks: 1, sourceType: 'manual', sourceId: '' },
    ],
    关卡词缀绑定: [
      { stageId: 'harbor-1', affixIdsCsv: 'harbor_opening_guard' },
      { stageId: 'midland-2', affixIdsCsv: 'midland_pressure_spike' },
      { stageId: 'highland-4', affixIdsCsv: 'highland_blood_song' },
    ],
    词缀定义: [
      { affixId: 'harbor_opening_guard', affixName: '港口护幕', iconId: 'ember-aegis', description: '战斗开始后为前排敌人施加余烬护幕。', delayMs: 1600, targetType: 'enemy', targetSelector: 'frontRow', statusId: 'ember-aegis', durationMsOverride: 3600, stacks: 1, enabled: true },
      { affixId: 'midland_pressure_spike', affixName: '腹地压制', iconId: 'suppression', description: '战斗开始后固定给队伍施加灼烧压制。', delayMs: 2200, targetType: 'party', targetSelector: 'party', statusId: 'suppression', durationMsOverride: 3200, stacks: 1, enabled: true },
      { affixId: 'highland_blood_song', affixName: '高地战歌', iconId: 'enrage-song', description: '战斗开始后固定给首领施加战歌。', delayMs: 2400, targetType: 'enemy', targetSelector: 'skullOnly', statusId: 'enrage-song', durationMsOverride: 4200, stacks: 1, enabled: true },
    ],
    伤害来源定义: [
      { sourceId: 'party_ambient_random', sourceKind: 'party_ambient_random', ownerSide: 'party', sourceTagsCsv: 'party,ambient,random', intervalMs: 1000, startReady: false, invalidTargetPolicy: 'retargetLivingEnemy', targetRule: 'randomLivingEnemy', targetSelector: 'randomLivingEnemy', targetCount: 1, damageMode: 'randomRange', baseDamage: 0, minDamage: 10, maxDamage: 20, threatMode: 'formula', threatMultiplier: 1, flatThreat: 0, threatSource: 'party', enabled: true, notes: '当前运行时仍优先兼容关卡开场中的 partyAutoDamage* 字段；此表先作为后续正式切换入口。' },
      { sourceId: 'party_focus_fire', sourceKind: 'party_focus_fire', ownerSide: 'party', sourceTagsCsv: 'party,burst,focus', intervalMs: 3000, startReady: false, invalidTargetPolicy: 'retargetLivingEnemy', targetRule: 'randomLivingEnemy', targetSelector: 'randomLivingEnemy', targetCount: 1, damageMode: 'fixed', baseDamage: 36, minDamage: 36, maxDamage: 36, threatMode: 'formula', threatMultiplier: 1, flatThreat: 0, threatSource: 'party', enabled: false, notes: '预留样例：队友阶段性集火。' },
      { sourceId: 'environment_shock', sourceKind: 'environment_shock', ownerSide: 'neutral', sourceTagsCsv: 'neutral,environment', intervalMs: 5000, startReady: false, invalidTargetPolicy: 'retargetLivingEnemy', targetRule: 'randomLivingEnemy', targetSelector: 'randomLivingEnemy', targetCount: 2, damageMode: 'fixed', baseDamage: 18, minDamage: 18, maxDamage: 18, threatMode: 'none', threatMultiplier: 0, flatThreat: 0, threatSource: 'party', enabled: false, notes: '预留样例：环境伤害，不计入仇恨。' },
    ],
    关卡伤害来源绑定: [
      { stageId: 'harbor-1', sourceIdsCsv: 'party_ambient_random', notes: '当前第一关仍建议以 partyAutoDamage* 为主；这里保留未来切换入口。' },
      { stageId: 'midland-2', sourceIdsCsv: 'party_ambient_random,party_focus_fire', notes: '预留样例：普通随机伤害 + 阶段性集火。' },
      { stageId: 'highland-4', sourceIdsCsv: 'party_ambient_random,environment_shock', notes: '预留样例：普通随机伤害 + 环境额外伤害。' },
    ],
    特殊规则绑定: [
      { stageId: 'harbor-1', ruleIdsCsv: 'opening_pressure_shift' },
      { stageId: 'midland-2', ruleIdsCsv: 'periodic_reinforcement' },
      { stageId: 'highland-4', ruleIdsCsv: 'player_control_tax' },
    ],
    特殊规则定义: [
      { ruleId: 'opening_pressure_shift', ruleName: '开场承压偏移', iconId: 'battle-seal', description: '战斗开始时一次性提高队伍压力，当前样例为 +8。', ruleLogicId: 'opening_pressure_shift', grantedStatusIdsCsv: 'suppression', enabled: true },
      { ruleId: 'periodic_reinforcement', ruleName: '周期强化', iconId: 'enrage-song', description: '战斗中每隔 3 秒给第一个存活敌人施加战歌。', ruleLogicId: 'periodic_reinforcement', grantedStatusIdsCsv: 'enrage-song', enabled: true },
      { ruleId: 'player_control_tax', ruleName: '控制税', iconId: 'stunned', description: '玩家处于昏迷时，每隔 1 秒提高队伍压力，当前样例为 +6。', ruleLogicId: 'player_control_tax', grantedStatusIdsCsv: 'stunned', enabled: true },
    ],
  }
}

function buildEnemyWorkbook() {
  return {
    敌人定义: [
      { enemyId: 'harbor_raider', name: '潮湾打手', baseMaxHp: 118, skillIdsCsv: 'bone-jab,reckless-rush', skillNamesCsv: '白骨刺击,莽撞冲撞', skillCycleCsv: 'bone-jab,reckless-rush,bone-jab', threatLogic: 'normal', counteredDurationMs: 1200, isSkull: false },
      { enemyId: 'midland_pyromancer', name: '焰痕术士', baseMaxHp: 96, skillIdsCsv: 'flame-lance,ember-bolt,dark-mend,staff-smash,ember-rush', skillNamesCsv: '烈焰枪,余烬箭,暗影愈合,法杖重击,余烬突袭', skillCycleCsv: 'flame-lance,ember-bolt,dark-mend,staff-smash,ember-rush', threatLogic: 'normal', counteredDurationMs: 1400, isSkull: false },
      { enemyId: 'highland_commander', name: '王座统尽者', baseMaxHp: 408, skillIdsCsv: 'crusher-slam,ruin-volley', skillNamesCsv: '粉碎重击,毁灭齐射', skillCycleCsv: 'crusher-slam,ruin-volley,crusher-slam', threatLogic: 'bloodlust', counteredDurationMs: 1800, isSkull: true },
    ],
    敌人技能: [
      { skillId: 'bone-jab', skillName: '白骨刺击', targetRuleId: 'threatTarget', castTimeMs: 1350, channelingMs: 0, recoveryMs: 700, damageType: 'physical', playerDamage: 18, partyDamageOnHit: 0, partyDamageOnMiss: 0, pressureOnHit: 0, pressureOnMiss: 6, appliedTargetStatusIdsCsv: '', appliedSelfStatusIdsCsv: '', castBreakRule: 'controlOnly', dangerLevel: 'low' },
      { skillId: 'ember-bolt', skillName: '余烬箭', targetRuleId: 'party', castTimeMs: 1800, channelingMs: 0, recoveryMs: 950, damageType: 'magic', playerDamage: 0, partyDamageOnHit: 0, partyDamageOnMiss: 52, pressureOnHit: 0, pressureOnMiss: 16, appliedTargetStatusIdsCsv: 'suppression', appliedSelfStatusIdsCsv: '', castBreakRule: 'controlOnly', dangerLevel: 'high' },
      { skillId: 'dark-mend', skillName: '暗影愈合', targetRuleId: 'otherEnemy', castTimeMs: 2100, channelingMs: 0, recoveryMs: 1200, damageType: 'magic', playerDamage: 0, partyDamageOnHit: 0, partyDamageOnMiss: 0, pressureOnHit: 0, pressureOnMiss: 0, appliedTargetStatusIdsCsv: 'fortified', appliedSelfStatusIdsCsv: '', castBreakRule: 'interruptOrControl', dangerLevel: 'medium' },
    ],
    敌方Buff: [
      { statusId: 'ember-aegis', statusName: '余烬护幕', durationMs: 3800, isDispellable: true, description: '施法敌人常见的自保 Buff。', effectLogicId: 'none' },
      { statusId: 'fortified', statusName: '强化', durationMs: 4000, isDispellable: true, description: '获得强化并触发小额自疗。', effectLogicId: 'enemy_heal_small' },
      { statusId: 'enrage-song', statusName: '战歌', durationMs: 5400, isDispellable: true, description: '高地敌人常见的持续战歌增益。', effectLogicId: 'none' },
      { statusId: 'countered', statusName: '被反制', durationMs: 1400, isDispellable: false, description: '施法被成功打断后陷入短暂僵直。', effectLogicId: 'none' },
    ],
    玩家Debuff: [
      { statusId: 'sundered', statusName: '破甲', durationMs: 4000, isDispellable: true, description: '玩家被破甲，连续承伤更危险。', effectLogicId: 'none' },
      { statusId: 'stunned', statusName: '昏迷', durationMs: 2000, isDispellable: true, description: '玩家短暂失去操作能力。', effectLogicId: 'none' },
      { statusId: 'silenced', statusName: '沉默', durationMs: 2000, isDispellable: true, description: '目标短时间无法完整执行技能节奏。', effectLogicId: 'none' },
    ],
    队伍Debuff: [
      { statusId: 'suppression', statusName: '灼烧压制', durationMs: 4200, isDispellable: false, description: '远程火力压向队伍，压力持续走高。', effectLogicId: 'none' },
      { statusId: 'formation-break', statusName: '阵型冲散', durationMs: 3600, isDispellable: false, description: '队伍阵型被打散，后排更危险。', effectLogicId: 'none' },
      { statusId: 'chaos-volley', statusName: '震荡乱流', durationMs: 5000, isDispellable: false, description: '高压齐射或践踏后的团队减益。', effectLogicId: 'none' },
    ],
  }
}

function buildPlayerBuildWorkbook() {
  return {
    职业定义: [
      {
        classId: 'warrior_t',
        className: '战士T',
        roleTag: 'tank',
        classDescription: '以仇恨控制、打断控制和减伤轮转为核心的基础坦克职业。',
        recommendedBuildRuleIdsCsv: 'tutorial_2slot,standard_5slot,full_8slot',
        enabled: true,
      },
      {
        classId: 'druid_bear_t',
        className: '德鲁伊熊T（预留）',
        roleTag: 'tank',
        classDescription: '预留给未来熊T职业接入的空骨架样例。',
        recommendedBuildRuleIdsCsv: '',
        enabled: false,
      },
    ],
    构筑规则定义: [
      {
        buildRuleId: 'tutorial_2slot',
        classId: 'warrior_t',
        ruleName: '教程一：双技能入门',
        description: '只开放 1/2 两个主动键位，强制带嘲讽。',
        totalBuildPoints: 10,
        maxActiveSlots: 2,
        enabledHotkeysCsv: '1,2',
        inheritancePolicy: 'keep_active_first',
        enabled: true,
      },
      {
        buildRuleId: 'standard_5slot',
        classId: 'warrior_t',
        ruleName: '标准五键构筑',
        description: '开放 1/2/3/4/Q 五个键位，主动与被动共享完整点数池。',
        totalBuildPoints: 28,
        maxActiveSlots: 5,
        enabledHotkeysCsv: '1,2,3,4,Q',
        inheritancePolicy: 'keep_active_first',
        enabled: true,
      },
      {
        buildRuleId: 'full_8slot',
        classId: 'warrior_t',
        ruleName: '完整八键构筑',
        description: '开放全部键位和完整点数预算，适合后期关卡。',
        totalBuildPoints: 36,
        maxActiveSlots: 8,
        enabledHotkeysCsv: '1,2,3,4,Q,E,R,F',
        inheritancePolicy: 'keep_active_first',
        enabled: true,
      },
    ],
    主动技能定义: [
      { skillId: 'warrior_t_taunt', classId: 'warrior_t', skillName: '嘲讽', shortName: '嘲讽', description: '瞬间抬高当前目标对坦克的仇恨并强制回头。', iconId: 'taunt', pointCost: 4, resourceCost: 0, cooldownMs: 8000, initialRemainingCooldownMs: 0, gcdMs: 800, targetingType: 'currentEnemy', skillLogicId: 'taunt_single', castStopMode: 'none', canAffectSkull: true, skillTagsCsv: 'threat', uiOrder: 1, unlockHint: '基础核心技能', grantedStatusIdsCsv: 'taunted', enabled: true },
      { skillId: 'warrior_t_interrupt', classId: 'warrior_t', skillName: '盾击打断', shortName: '打断', description: '打断当前施法目标，并施加被反制僵直。', iconId: 'interrupt', pointCost: 4, resourceCost: 10, cooldownMs: 12000, initialRemainingCooldownMs: 0, gcdMs: 800, targetingType: 'currentEnemy', skillLogicId: 'interrupt_cast', castStopMode: 'interrupt', canAffectSkull: true, skillTagsCsv: 'control,anti-cast', uiOrder: 2, unlockHint: '教程第二关核心技能', grantedStatusIdsCsv: 'countered', enabled: true },
      { skillId: 'warrior_t_stun', classId: 'warrior_t', skillName: '震荡猛击', shortName: '眩晕', description: '眩晕当前目标，适合阻止只能被控制阻止的技能。', iconId: 'stun', pointCost: 4, resourceCost: 15, cooldownMs: 14000, initialRemainingCooldownMs: 0, gcdMs: 800, targetingType: 'currentEnemy', skillLogicId: 'stun_single', castStopMode: 'control', canAffectSkull: false, skillTagsCsv: 'control', uiOrder: 3, unlockHint: '非首领控制技能', grantedStatusIdsCsv: 'stunned', enabled: true },
      { skillId: 'warrior_t_mass_taunt', classId: 'warrior_t', skillName: '挑战怒吼', shortName: '群嘲', description: '快速建立全体敌人对玩家的仇恨。', iconId: 'massTaunt', pointCost: 4, resourceCost: 20, cooldownMs: 30000, initialRemainingCooldownMs: 0, gcdMs: 800, targetingType: 'allEnemy', skillLogicId: 'mass_taunt', castStopMode: 'none', canAffectSkull: true, skillTagsCsv: 'threat,aoe', uiOrder: 4, unlockHint: '多目标收拢技能', grantedStatusIdsCsv: 'mass-taunt', enabled: true },
      { skillId: 'warrior_t_shield_wall', classId: 'warrior_t', skillName: '盾墙', shortName: '盾墙', description: '获得持续减伤，用于承接高危技能。', iconId: 'shieldWall', pointCost: 4, resourceCost: 20, cooldownMs: 28000, initialRemainingCooldownMs: 0, gcdMs: 0, targetingType: 'self', skillLogicId: 'shield_wall', castStopMode: 'none', canAffectSkull: true, skillTagsCsv: 'survival', uiOrder: 5, unlockHint: '基础减伤技能', grantedStatusIdsCsv: 'shieldWall', enabled: true },
      { skillId: 'warrior_t_revenge', classId: 'warrior_t', skillName: '复仇', shortName: '复仇', description: '消耗怒气，对当前目标与周围目标造成伤害并建立仇恨。', iconId: 'cleave', pointCost: 4, resourceCost: 20, cooldownMs: 3500, initialRemainingCooldownMs: 0, gcdMs: 800, targetingType: 'crossEnemy', skillLogicId: 'revenge', castStopMode: 'none', canAffectSkull: true, skillTagsCsv: 'damage,threat,aoe', uiOrder: 6, unlockHint: '消耗怒气的范围反击。', grantedStatusIdsCsv: '', enabled: true },
      { skillId: 'warrior_t_ignore_pain', classId: 'warrior_t', skillName: '无视苦痛', shortName: '吸收盾', description: '消耗怒气，获得会按比例吸收玩家承伤的护盾。', iconId: 'shieldWall', pointCost: 4, resourceCost: 20, cooldownMs: 1000, initialRemainingCooldownMs: 0, gcdMs: 800, targetingType: 'self', skillLogicId: 'ignore_pain', castStopMode: 'none', canAffectSkull: true, skillTagsCsv: 'survival,absorb', uiOrder: 7, unlockHint: '消耗怒气的漏气护盾。', grantedStatusIdsCsv: 'ignorePain', enabled: true },
      { skillId: 'warrior_t_shield_block', classId: 'warrior_t', skillName: '盾牌格挡', shortName: '物理减伤', description: '耗怒物理减伤。', iconId: 'shieldWall', pointCost: 4, resourceCost: 20, cooldownMs: 12000, initialRemainingCooldownMs: 0, gcdMs: 800, targetingType: 'self', skillLogicId: 'shield_block', castStopMode: 'none', canAffectSkull: true, skillTagsCsv: 'survival,physical', uiOrder: 8, unlockHint: '消耗怒气的物理减伤。', grantedStatusIdsCsv: 'shieldBlock', enabled: true },
    ],
    主动技能效果: [
      { skillEffectId: 'warrior_t_taunt_main', skillId: 'warrior_t_taunt', effectIndex: 1, targetSelector: 'current', valueA: 0, valueB: 0, durationMs: 3000, statusId: 'taunted', threatDelta: 72, threatMultiplier: 0, threatSource: 'player', notes: '提高当前目标仇恨并回头。', enabled: true },
      { skillEffectId: 'warrior_t_interrupt_main', skillId: 'warrior_t_interrupt', effectIndex: 1, targetSelector: 'current', valueA: 24, valueB: 0, durationMs: 1200, statusId: 'countered', threatDelta: 24, threatMultiplier: 0, threatSource: 'player', notes: '打断成功后附加被反制。', enabled: true },
      { skillEffectId: 'warrior_t_stun_main', skillId: 'warrior_t_stun', effectIndex: 1, targetSelector: 'current', valueA: 18, valueB: 0, durationMs: 2000, statusId: 'stunned', threatDelta: 18, threatMultiplier: 0, threatSource: 'player', notes: '控制结束后敌人重试原技能。', enabled: true },
      { skillEffectId: 'warrior_t_mass_taunt_main', skillId: 'warrior_t_mass_taunt', effectIndex: 1, targetSelector: 'allEnemy', valueA: 0, valueB: 0, durationMs: 2000, statusId: 'mass-taunt', threatDelta: 48, threatMultiplier: 0, threatSource: 'player', notes: '对所有敌人建立群体嘲讽。', enabled: true },
      { skillEffectId: 'warrior_t_shield_wall_main', skillId: 'warrior_t_shield_wall', effectIndex: 1, targetSelector: 'self', valueA: 0, valueB: 0, durationMs: 4000, statusId: 'shieldWall', threatDelta: 0, threatMultiplier: 0, threatSource: 'player', notes: '给予玩家盾墙减伤。', enabled: true },
      { skillEffectId: 'warrior_t_revenge_main', skillId: 'warrior_t_revenge', effectIndex: 1, targetSelector: 'cross', valueA: 30, valueB: 0, durationMs: 0, statusId: '', threatDelta: 24, threatMultiplier: 5, threatSource: 'player', notes: '对十字范围目标造成伤害并建立仇恨。', enabled: true },
      { skillEffectId: 'warrior_t_ignore_pain_main', skillId: 'warrior_t_ignore_pain', effectIndex: 1, targetSelector: 'self', valueA: 30, valueB: 0.5, durationMs: 5000, statusId: 'ignorePain', threatDelta: 0, threatMultiplier: 0, threatSource: 'player', notes: 'valueA 为可吸收总量，valueB 为单次承伤吸收比例。', enabled: true },
      { skillEffectId: 'warrior_t_shield_block_main', skillId: 'warrior_t_shield_block', effectIndex: 1, targetSelector: 'self', valueA: 0, valueB: 0.5, durationMs: 7000, statusId: 'shieldBlock', threatDelta: 0, threatMultiplier: 0, threatSource: 'player', notes: '物理减伤50%，持续时间以策划表 7000ms 为准。', enabled: true },
      { skillEffectId: 'warrior_t_cleave_main', skillId: 'warrior_t_cleave', effectIndex: 1, targetSelector: 'adjacent', valueA: 22, valueB: 10, durationMs: 0, statusId: '', threatDelta: 28, threatMultiplier: 5, threatSource: 'player', notes: '主目标与同排相邻目标受击，主目标伤害更高。', enabled: true },
      { skillEffectId: 'warrior_t_burst_main', skillId: 'warrior_t_burst', effectIndex: 1, targetSelector: 'current', valueA: 48, valueB: 0, durationMs: 0, statusId: '', threatDelta: 38, threatMultiplier: 5, threatSource: 'player', notes: '对当前目标造成高伤害并获得高额仇恨。', enabled: true },
    ],
    玩家主动状态定义: [
      { statusId: 'taunted', statusName: '被嘲讽', statusCategory: 'enemyDebuff', iconId: 'taunted', durationMs: 3000, maxStacks: 1, dispellable: false, description: '目标会短时间优先盯住坦克。', effectLogicId: 'enemy_taunted', enabled: true },
      { statusId: 'silenced', statusName: '沉默', statusCategory: 'enemyDebuff', iconId: 'silenced', durationMs: 2000, maxStacks: 1, dispellable: true, description: '目标短时间无法稳定施法。', effectLogicId: 'enemy_damage_down', enabled: true },
      { statusId: 'countered', statusName: '被反制', statusCategory: 'enemyDebuff', iconId: 'silenced', durationMs: 1200, maxStacks: 1, dispellable: false, description: '施法被打断后进入短暂僵直。', effectLogicId: 'none', enabled: true },
      { statusId: 'shieldWall', statusName: '盾墙', statusCategory: 'playerBuff', iconId: 'shieldWall', durationMs: 4000, maxStacks: 1, dispellable: false, description: '玩家获得持续减伤。', effectLogicId: 'player_damage_reduction', enabled: true },
      { statusId: 'ignorePain', statusName: '无视苦痛', statusCategory: 'playerBuff', iconId: 'shieldWall', durationMs: 5000, maxStacks: 4, dispellable: false, description: '按比例吸收玩家承伤的护盾。', effectLogicId: 'playerBuff_ignorePain', enabled: true },
      { statusId: 'shieldBlock', statusName: '盾牌格挡', statusCategory: 'playerBuff', iconId: 'shieldWall', durationMs: 7000, maxStacks: 1, dispellable: false, description: '玩家获得物理减伤。', effectLogicId: 'playerBuff_shieldBlock', enabled: true },
    ],
    被动天赋定义: [
      { talentId: 'warrior_t_vital_reserve', classId: 'warrior_t', talentName: '生命储备', category: 'player', cost: 2, description: '玩家生命上限提高 180。', iconId: 'vitalReserve', talentLogicId: 'player_max_hp_up', tier: 1, talentTagsCsv: 'survival', uiOrder: 1, exclusiveGroup: '', grantedStatusIdsCsv: '', enabled: true },
      { talentId: 'warrior_t_snap_interrupt', classId: 'warrior_t', talentName: '瞬断手感', category: 'skill', cost: 2, description: '打断不再占用公共冷却。', iconId: 'snapInterrupt', talentLogicId: 'interrupt_ignore_gcd', tier: 2, talentTagsCsv: 'anti-cast', uiOrder: 2, exclusiveGroup: '', grantedStatusIdsCsv: '', enabled: true },
      { talentId: 'warrior_t_vanguard_oath', classId: 'warrior_t', talentName: '先锋誓约', category: 'player', cost: 2, description: '给予玩家常驻增益“先锋誓约”。', iconId: 'vanguardOath', talentLogicId: 'grant_permanent_buff', tier: 1, talentTagsCsv: 'survival', uiOrder: 3, exclusiveGroup: '', grantedStatusIdsCsv: 'vanguard-oath', enabled: true },
      { talentId: 'warrior_t_rallying_standard', classId: 'warrior_t', talentName: '高悬战旗', category: 'party', cost: 2, description: '提高队伍压力上限。', iconId: 'rallyingStandard', talentLogicId: 'party_pressure_cap_up', tier: 3, talentTagsCsv: 'party', uiOrder: 4, exclusiveGroup: '', grantedStatusIdsCsv: '', enabled: true },
    ],
    被动天赋效果: [
      { talentEffectId: 'warrior_t_vital_reserve_main', talentId: 'warrior_t_vital_reserve', effectIndex: 1, talentLogicId: 'player_max_hp_up', targetScope: 'player', valueA: 180, valueB: 0, statusId: '', skillId: '', notes: '直接增加玩家最大生命值。', enabled: true },
      { talentEffectId: 'warrior_t_snap_interrupt_main', talentId: 'warrior_t_snap_interrupt', effectIndex: 1, talentLogicId: 'interrupt_ignore_gcd', targetScope: 'skill', valueA: 0, valueB: 0, statusId: '', skillId: 'warrior_t_interrupt', notes: '把打断的gcd移除。', enabled: true },
      { talentEffectId: 'warrior_t_vanguard_oath_main', talentId: 'warrior_t_vanguard_oath', effectIndex: 1, talentLogicId: 'grant_permanent_buff', targetScope: 'player', valueA: 0, valueB: 0, statusId: 'vanguard-oath', skillId: '', notes: '给予常驻减伤状态。', enabled: true },
    ],
    玩家被动状态定义: [
      { statusId: 'vanguard-oath', statusName: '先锋誓约', statusCategory: 'playerBuff', iconId: 'vanguard-oath', durationMs: 0, maxStacks: 1, dispellable: false, description: '常驻减伤与稳固站位效果。', effectLogicId: 'player_damage_reduction', enabled: true },
      { statusId: 'build-focus', statusName: '构筑专注', statusCategory: 'playerBuff', iconId: 'battle-seal', durationMs: 0, maxStacks: 1, dispellable: false, description: '预留给后续被动的常驻构筑效果。', effectLogicId: 'none', enabled: true },
      { statusId: 'pressure-plan', statusName: '压力预案', statusCategory: 'partyBuff', iconId: 'guarded', durationMs: 0, maxStacks: 1, dispellable: false, description: '预留给后续团队被动的常驻效果。', effectLogicId: 'none', enabled: true },
    ],
    默认主动构筑: [
      { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
      { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: '3', skillId: 'warrior_t_stun', priority: 3 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: '4', skillId: 'warrior_t_mass_taunt', priority: 4 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: 'Q', skillId: 'warrior_t_shield_wall', priority: 5 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: 'E', skillId: 'warrior_t_revenge', priority: 6 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: 'R', skillId: 'warrior_t_ignore_pain', priority: 7 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', hotkey: 'F', skillId: 'warrior_t_shield_block', priority: 8 },
    ],
    默认被动构筑: [
      { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 },
      { presetId: 'standard_5slot', buildRuleId: 'standard_5slot', classId: 'warrior_t', talentId: 'warrior_t_snap_interrupt', selected: true, priority: 2 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', talentId: 'warrior_t_snap_interrupt', selected: true, priority: 2 },
      { presetId: 'warrior_t', buildRuleId: '', classId: 'warrior_t', talentId: 'warrior_t_rallying_standard', selected: true, priority: 3 },
    ],
    图标资源映射: [
      { iconId: 'warrior_t', iconName: '战士T职业图标', assetKey: 'battle-seal', iconType: 'class', enabled: true },
      { iconId: 'warrior_t_taunt', iconName: '战士T嘲讽图标', assetKey: 'taunt', iconType: 'skill', enabled: true },
      { iconId: 'warrior_t_interrupt', iconName: '战士T打断图标', assetKey: 'interrupt', iconType: 'skill', enabled: true },
      { iconId: 'warrior_t_revenge', iconName: '战士T复仇图标', assetKey: 'cleave', iconType: 'skill', enabled: true },
      { iconId: 'warrior_t_ignore_pain', iconName: '战士T无视苦痛图标', assetKey: 'shieldWall', iconType: 'skill', enabled: true },
      { iconId: 'warrior_t_shield_block', iconName: '战士T盾牌格挡图标', assetKey: 'shieldWall', iconType: 'skill', enabled: true },
      { iconId: 'warrior_t_vital_reserve', iconName: '战士T生命储备图标', assetKey: 'guarded', iconType: 'talent', enabled: true },
      { iconId: 'vanguard-oath', iconName: '先锋誓约状态图标', assetKey: 'vanguard-oath', iconType: 'status', enabled: true },
    ],
  }
}

ensureDir(outputDir)

writeWorkbook(path.join(outputDir, 'stage_content.xlsx'), buildStageWorkbook())
writeWorkbook(path.join(outputDir, 'encounter_balance.xlsx'), buildEncounterWorkbook())
writeWorkbook(path.join(outputDir, 'enemy_data.xlsx'), buildEnemyWorkbook())
writeWorkbook(path.join(outputDir, 'player_build.xlsx'), buildPlayerBuildWorkbook())

console.log('Designer workbooks generated in public/designer-data')
