export type StageAreaId = string
export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6
export type StageId = string
export type StageUnlockedActiveSkillId = string

export interface StageSectionEntry {
  id: string
  title: string
  description: string
  iconId: string
}

export interface StageLegendEntry {
  id: string
  iconId?: string
  label: string
  source: string
  target: string
  description: string
}

export interface StageAreaInfo {
  id: StageAreaId
  title: string
  shortTitle: string
  mapLabel: string
  description: string
  accent: string
}

export interface StageInfo {
  id: StageId
  areaId: StageAreaId
  areaTitle: string
  stageNumber: StageNumber
  title: string
  subtitle: string
  strategyTips?: string
  affixes: StageSectionEntry[]
  rules: StageSectionEntry[]
  legend: StageLegendEntry[]
  unlockedActiveSkillIds: StageUnlockedActiveSkillId[]
}

export interface StageAreaWorkbookOverride {
  areaId: StageAreaId
  title?: string
  shortTitle?: string
  mapLabel?: string
  description?: string
  accent?: string
}

export interface StageWorkbookOverride {
  stageId: StageId
  areaId?: StageAreaId
  order?: StageNumber
  title?: string
  subtitle?: string
  strategyTips?: string
  affix1Title?: string
  affix1Description?: string
  affix1IconId?: string
  affix2Title?: string
  affix2Description?: string
  affix2IconId?: string
  rule1Title?: string
  rule1Description?: string
  rule1IconId?: string
  rule2Title?: string
  rule2Description?: string
  rule2IconId?: string
  unlockedActiveSkillIds?: StageUnlockedActiveSkillId[]
}

export interface StageLegendWorkbookOverride {
  areaId: StageAreaId
  id: string
  iconId?: string
  label?: string
  source?: string
  target?: string
  description?: string
}

export interface StageWorkbookOverrides {
  areaOverrides: StageAreaWorkbookOverride[]
  stageOverrides: StageWorkbookOverride[]
  legendOverrides: StageLegendWorkbookOverride[]
}

interface StageSeed {
  id: StageId
  title: string
  subtitle: string
  affixTitle: string
  affixDescription: string
  affixIconId: string
  ruleTitle: string
  ruleDescription: string
  ruleIconId: string
}

const harborCommon = {
  affix: {
    id: 'harbor-common-affix',
    title: '裂甲回响',
    description: '重击与破防会更频繁地穿插出现，减伤与稳仇都不能掉线。',
    iconId: 'sundered',
  },
  rule: {
    id: 'harbor-common-rule',
    title: '外部状态图例',
    description: '右侧图例持续收录本区敌人和机制带来的状态，方便快速读图。',
    iconId: 'stable',
  },
  legend: [
    {
      id: 'ember-aegis',
      label: '余烬护幕',
      source: '港区敌方施法',
      target: '敌方',
      description: '施法单位维持的火焰护幕，会让高危读条更难被及时压住。',
    },
    {
      id: 'guarded',
      label: '守备',
      source: '港区护卫',
      target: '敌方',
      description: '守备单位提供的减伤覆盖，会让关键目标更耐打。',
    },
    {
      id: 'fortified',
      label: '强化',
      source: '敌方自疗',
      target: '敌方',
      description: '自疗成功后额外获得的强化层，短时间会明显变硬。',
    },
    {
      id: 'sundered',
      label: '破甲',
      source: '敌方重击',
      target: '玩家',
      description: '重击后留下的破甲窗口，会让后续接怪更加危险。',
    },
    {
      id: 'heat-haze',
      label: '热浪侵袭',
      source: '环境效果',
      target: '队伍',
      description: '夹杂在潮雾中的热浪会放大队伍后排承压。',
    },
  ] satisfies StageLegendEntry[],
}

const midlandCommon = {
  affix: {
    id: 'midland-common-affix',
    title: '急袭轮转',
    description: '危险读条之间的间隔被压得更短，控制链会显得格外珍贵。',
    iconId: 'haste',
  },
  rule: {
    id: 'midland-common-rule',
    title: '时机判定',
    description: '本区更强调技能释放时点，过早交出控制同样会亏掉节奏。',
    iconId: 'battle-seal',
  },
  legend: [
    {
      id: 'haste',
      label: '急速',
      source: '关卡词缀',
      target: '敌方',
      description: '会同时提高敌方读条与攻击节奏，让危险技能更密集。',
    },
    {
      id: 'stunned',
      label: '昏迷',
      source: '敌方控制',
      target: '玩家',
      description: '命中后会短时间切断玩家操作，容易错过关键处理点。',
    },
    {
      id: 'silenced',
      label: '沉默',
      source: '敌方压制',
      target: '玩家',
      description: '会短暂压住技能节奏，影响打断和爆发窗口。',
    },
    {
      id: 'weakened',
      label: '虚弱',
      source: '敌方减益',
      target: '玩家',
      description: '被点名后进入脆弱期，需要额外照顾仇恨与减伤。',
    },
    {
      id: 'ember-aegis',
      label: '余烬护幕',
      source: '环境节点',
      target: '敌方',
      description: '护阵节点会让中轴区域的关键目标更容易拥有火焰护幕。',
    },
  ] satisfies StageLegendEntry[],
}

const highlandCommon = {
  affix: {
    id: 'highland-common-affix',
    title: '无尽战歌',
    description: '敌方增益叠层持续更久，拖战斗只会让后段更加难处理。',
    iconId: 'enrage-song',
  },
  rule: {
    id: 'highland-common-rule',
    title: '后程检定',
    description: '本区偏向长线承压，构筑与技能调度能否撑到后段会被放大。',
    iconId: 'battle-seal',
  },
  legend: [
    {
      id: 'enrage-song',
      label: '战歌',
      source: '关卡词缀',
      target: '敌方',
      description: '会逐步强化敌方整体攻势，让后段显著更难处理。',
    },
    {
      id: 'guarded',
      label: '守备',
      source: '敌方增益',
      target: '敌方',
      description: '高价值目标更耐打，会拖慢清点效率。',
    },
    {
      id: 'fortified',
      label: '强化',
      source: '敌方自疗',
      target: '敌方',
      description: '强化自疗会把战斗继续往后拖，放大长线压力。',
    },
    {
      id: 'taunted',
      label: '被嘲讽',
      source: '外部控制',
      target: '敌方',
      description: '高地区域也会出现短暂强制仇恨，要求快速判断是否稳固接怪。',
    },
    {
      id: 'sundered',
      label: '破甲',
      source: '敌方重击',
      target: '玩家',
      description: '频繁破甲会让坦克在后段更容易被直接击穿。',
    },
  ] satisfies StageLegendEntry[],
}

const harborSeeds: StageSeed[] = [
  {
    id: 'harbor-1',
    title: '潮湾堤口',
    subtitle: '基础仇恨与起手接怪',
    affixTitle: '余烬过载',
    affixDescription: '港口施法者更容易维持火焰类强化，起手读条要更早处理。',
    affixIconId: 'ember-aegis',
    ruleTitle: '先手快照',
    ruleDescription: '敌方框体会更明显地提示起手仇恨变化，便于快速接稳开怪。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'harbor-2',
    title: '船坞回声',
    subtitle: '双目标切换与稳仇',
    affixTitle: '锚链牵制',
    affixDescription: '次要目标会更频繁地拉扯后排，需要更快完成换目标稳仇。',
    affixIconId: 'guarded',
    ruleTitle: '双目标读秒',
    ruleDescription: '本关更强调两组敌人之间的切换节奏与嘲讽衔接。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'harbor-3',
    title: '雾灯栈桥',
    subtitle: '读条排序与短控衔接',
    affixTitle: '雾灯误导',
    affixDescription: '危险目标会和低威胁目标混排，要求更快识别真正要打断的条。',
    affixIconId: 'silenced',
    ruleTitle: '前后排分层',
    ruleDescription: '本关需要更清楚地分辨前排承压与后排点名的处理先后。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'harbor-4',
    title: '断潮泵站',
    subtitle: '高压点名与减伤覆盖',
    affixTitle: '逆流灌注',
    affixDescription: '点名技能会更频繁地压向队伍侧翼，减伤与打断都要更主动。',
    affixIconId: 'weakened',
    ruleTitle: '减伤窗口',
    ruleDescription: '本关更适合用固定减伤去吃一轮高压点名，而不是被动补救。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'harbor-5',
    title: '旧塔码头',
    subtitle: '多条同时出现时的处理优先级',
    affixTitle: '塔火余辉',
    affixDescription: '高位炮手会给施法者提供额外覆盖，使多条读条更容易重叠。',
    affixIconId: 'haste',
    ruleTitle: '侧翼警戒',
    ruleDescription: '你需要在主目标之外持续监控两翼的短条和点名。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'harbor-6',
    title: '潮湾指挥所',
    subtitle: '港区收束战与连续读条',
    affixTitle: '潮湾余压',
    affixDescription: '收尾阶段的施法者会更密集地抛出危险短条，要求连续处理。',
    affixIconId: 'ember-aegis',
    ruleTitle: '港区总检',
    ruleDescription: '这是港区的综合检查，要求你稳定完成接怪、打断和减伤轮转。',
    ruleIconId: 'battle-seal',
  },
]

const midlandSeeds: StageSeed[] = [
  {
    id: 'midland-1',
    title: '灰桥前段',
    subtitle: '十字站位与范围控制入门',
    affixTitle: '灼痕扩散',
    affixDescription: '中轴目标之间更容易形成连锁高压，群体控制价值明显提高。',
    affixIconId: 'heat-haze',
    ruleTitle: '横向扫线',
    ruleDescription: '本关需要更高频地把注意力横向扫过一整排敌方框体。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'midland-2',
    title: '火线回廊',
    subtitle: '连续打断与位移压力',
    affixTitle: '热轨连射',
    affixDescription: '连续短条会更频繁地穿插在高危大条之间，需要更谨慎留打断。',
    affixIconId: 'haste',
    ruleTitle: '打断预算',
    ruleDescription: '这关的关键不是全断，而是把有限打断留给最危险的几条。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'midland-3',
    title: '交汇风井',
    subtitle: '多目标互相增益时的拆解',
    affixTitle: '风井共鸣',
    affixDescription: '多个敌人会通过风井获得短时互相增益，拆解顺序更重要。',
    affixIconId: 'guarded',
    ruleTitle: '增益拆解',
    ruleDescription: '不要只看读条，还要注意哪些增益状态正在把局面推向失控。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'midland-4',
    title: '护阵枢纽',
    subtitle: '优先集火与守备覆盖',
    affixTitle: '枢纽护幕',
    affixDescription: '中心节点会不断给关键目标补守备，要求更坚定地优先集火。',
    affixIconId: 'ember-aegis',
    ruleTitle: '集火判定',
    ruleDescription: '本关会直接检验你是否能在混乱中坚持正确的集火目标。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'midland-5',
    title: '灰烬工场',
    subtitle: '持续点名与团队压力管理',
    affixTitle: '灰烬飞散',
    affixDescription: '多个点名型技能会持续把团队压力往上抬，拖延代价更高。',
    affixIconId: 'weakened',
    ruleTitle: '压力止损',
    ruleDescription: '允许少量漏条，但必须优先止住真正会推高团队压力的来源。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'midland-6',
    title: '裂日中庭',
    subtitle: '腹地总检与稳定控场',
    affixTitle: '裂日脉冲',
    affixDescription: '腹地末段会把前面出现过的高压机制混在一起轮番给出。',
    affixIconId: 'enrage-song',
    ruleTitle: '腹地总检',
    ruleDescription: '这是腹地收束战，需要你完整体现群控、打断和压力管理能力。',
    ruleIconId: 'battle-seal',
  },
]

const highlandSeeds: StageSeed[] = [
  {
    id: 'highland-1',
    title: '山门折道',
    subtitle: '长线承压的起始试探',
    affixTitle: '崖风合唱',
    affixDescription: '高地敌人会更早开始叠增益，不能再用慢节奏慢慢磨过去。',
    affixIconId: 'enrage-song',
    ruleTitle: '长线热身',
    ruleDescription: '这是高地的入门关，开始检验长线减伤与爆发的排布。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'highland-2',
    title: '高压斜坡',
    subtitle: '减伤调度与爆发压缩',
    affixTitle: '压差堆叠',
    affixDescription: '连续高伤技能之间的间隔会进一步压缩，减伤必须更精确。',
    affixIconId: 'sundered',
    ruleTitle: '压缩轮转',
    ruleDescription: '本关会放大任何一轮减伤错位造成的后果。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'highland-3',
    title: '回响观测台',
    subtitle: '读图抗干扰与目标识别',
    affixTitle: '观测回响',
    affixDescription: '多个读条和状态会在视觉上互相覆盖，要求更冷静地识别关键点。',
    affixIconId: 'silenced',
    ruleTitle: '信息筛选',
    ruleDescription: '你要在更复杂的信息流里，保持对关键状态和关键条的关注。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'highland-4',
    title: '战歌断崖',
    subtitle: '持续增益场中的控场稳定性',
    affixTitle: '断崖战歌',
    affixDescription: '整片断崖都在放大战歌效果，敌方后段强化速度更快。',
    affixIconId: 'enrage-song',
    ruleTitle: '后段控场',
    ruleDescription: '本关需要你在局面已经开始发散时，依旧稳住控场节奏。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'highland-5',
    title: '裂甲峰顶',
    subtitle: '破甲高压与救火能力',
    affixTitle: '峰顶裂斧',
    affixDescription: '多个重击目标会轮番给出破甲窗口，对补救能力要求更高。',
    affixIconId: 'sundered',
    ruleTitle: '救火检定',
    ruleDescription: '这关允许短暂失衡，但要求你有能力把局势重新拉回正轨。',
    ruleIconId: 'battle-seal',
  },
  {
    id: 'highland-6',
    title: '雷脊王座',
    subtitle: '终局长线与完整构筑检定',
    affixTitle: '王座雷鸣',
    affixDescription: '高地最终关会把增益、破甲、点名和读条压力全部叠起来考你。',
    affixIconId: 'enrage-song',
    ruleTitle: '终局检定',
    ruleDescription: '这是整张地图的最终检查，需要你完整撑住长线承压与技能轮转。',
    ruleIconId: 'battle-seal',
  },
]

const BASE_STAGE_AREA_ORDER: StageAreaId[] = ['harbor', 'midland', 'highland']

export let stageAreaOrder: StageAreaId[] = [...BASE_STAGE_AREA_ORDER]

const BASE_STAGE_AREA_CATALOG: Record<StageAreaId, StageAreaInfo> = {
  harbor: {
    id: 'harbor',
    title: '潮湾前哨',
    shortTitle: '潮湾',
    mapLabel: '雾港外湾',
    description: '港区以起手接怪、双目标稳仇和连续读条为主，是整个地图的前线区域。',
    accent: '#6fd3ff',
  },
  midland: {
    id: 'midland',
    title: '灼痕腹地',
    shortTitle: '灼痕',
    mapLabel: '灰桥腹地',
    description: '中轴区域更强调十字站位、范围控制和队伍压力管理。',
    accent: '#ffcd62',
  },
  highland: {
    id: 'highland',
    title: '雷脊高地',
    shortTitle: '雷脊',
    mapLabel: '王座山脊',
    description: '高地区域主打长线承压、持续增益和终局构筑检定。',
    accent: '#ff7d66',
  },
}

const DEFAULT_STAGE_ACTIVE_SKILL_UNLOCKS: Partial<Record<StageId, StageUnlockedActiveSkillId[]>> = {
  'harbor-1': ['warrior_t_taunt'],
  'harbor-2': ['warrior_t_interrupt'],
  'harbor-3': ['warrior_t_stun'],
  'harbor-4': ['warrior_t_mass_taunt'],
  'harbor-5': ['warrior_t_shield_wall'],
  'midland-1': ['warrior_t_revenge', 'warrior_t_ignore_pain'],
  'midland-3': ['warrior_t_shield_block', 'warrior_t_shield_slam'],
  'midland-5': ['warrior_t_shield_reflection'],
  'highland-1': ['warrior_t_avatar'],
  'highland-2': ['warrior_t_shockwave'],
  'highland-3': ['warrior_t_thunderstruck'],
  'highland-5': ['warrior_t_rallying_cry', 'warrior_t_intervene', 'warrior_t_demoralizing_shout'],
}

function createStage(
  areaId: StageAreaId,
  stageNumber: StageNumber,
  seed: StageSeed,
  common: typeof harborCommon | typeof midlandCommon | typeof highlandCommon,
): StageInfo {
  const area = BASE_STAGE_AREA_CATALOG[areaId]

  return {
    id: seed.id,
    areaId,
    areaTitle: area.title,
    stageNumber,
    title: seed.title,
    subtitle: seed.subtitle,
    strategyTips: undefined,
    affixes: [
      {
        id: `${seed.id}-affix-a`,
        title: seed.affixTitle,
        description: seed.affixDescription,
        iconId: seed.affixIconId,
      },
      {
        id: `${seed.id}-affix-b`,
        title: common.affix.title,
        description: common.affix.description,
        iconId: common.affix.iconId,
      },
    ],
    rules: [
      {
        id: `${seed.id}-rule-a`,
        title: seed.ruleTitle,
        description: seed.ruleDescription,
        iconId: seed.ruleIconId,
      },
      {
        id: `${seed.id}-rule-b`,
        title: common.rule.title,
        description: common.rule.description,
        iconId: common.rule.iconId,
      },
    ],
    legend: common.legend,
    unlockedActiveSkillIds: DEFAULT_STAGE_ACTIVE_SKILL_UNLOCKS[seed.id] ?? [],
  }
}

const BASE_STAGE_ORDER: StageId[] = [
  'harbor-1',
  'harbor-2',
  'harbor-3',
  'harbor-4',
  'harbor-5',
  'harbor-6',
  'midland-1',
  'midland-2',
  'midland-3',
  'midland-4',
  'midland-5',
  'midland-6',
  'highland-1',
  'highland-2',
  'highland-3',
  'highland-4',
  'highland-5',
  'highland-6',
]

export let stageOrder: StageId[] = [...BASE_STAGE_ORDER]

const BASE_STAGE_CATALOG: Record<StageId, StageInfo> = {
  'harbor-1': createStage('harbor', 1, harborSeeds[0], harborCommon),
  'harbor-2': createStage('harbor', 2, harborSeeds[1], harborCommon),
  'harbor-3': createStage('harbor', 3, harborSeeds[2], harborCommon),
  'harbor-4': createStage('harbor', 4, harborSeeds[3], harborCommon),
  'harbor-5': createStage('harbor', 5, harborSeeds[4], harborCommon),
  'harbor-6': createStage('harbor', 6, harborSeeds[5], harborCommon),
  'midland-1': createStage('midland', 1, midlandSeeds[0], midlandCommon),
  'midland-2': createStage('midland', 2, midlandSeeds[1], midlandCommon),
  'midland-3': createStage('midland', 3, midlandSeeds[2], midlandCommon),
  'midland-4': createStage('midland', 4, midlandSeeds[3], midlandCommon),
  'midland-5': createStage('midland', 5, midlandSeeds[4], midlandCommon),
  'midland-6': createStage('midland', 6, midlandSeeds[5], midlandCommon),
  'highland-1': createStage('highland', 1, highlandSeeds[0], highlandCommon),
  'highland-2': createStage('highland', 2, highlandSeeds[1], highlandCommon),
  'highland-3': createStage('highland', 3, highlandSeeds[2], highlandCommon),
  'highland-4': createStage('highland', 4, highlandSeeds[3], highlandCommon),
  'highland-5': createStage('highland', 5, highlandSeeds[4], highlandCommon),
  'highland-6': createStage('highland', 6, highlandSeeds[5], highlandCommon),
}

function cloneStageAreaInfo(area: StageAreaInfo): StageAreaInfo {
  return {
    ...area,
  }
}

function cloneStageEntry(entry: StageSectionEntry): StageSectionEntry {
  return {
    ...entry,
  }
}

function cloneStageLegendEntry(entry: StageLegendEntry): StageLegendEntry {
  return {
    ...entry,
    iconId: entry.iconId ?? entry.id,
  }
}

function cloneStageInfo(stage: StageInfo): StageInfo {
  return {
    ...stage,
    affixes: stage.affixes.map(cloneStageEntry),
    rules: stage.rules.map(cloneStageEntry),
    legend: stage.legend.map(cloneStageLegendEntry),
    unlockedActiveSkillIds: [...stage.unlockedActiveSkillIds],
  }
}

function createFallbackAreaInfo(areaId: StageAreaId, index: number): StageAreaInfo {
  return {
    id: areaId,
    title: areaId,
    shortTitle: areaId,
    mapLabel: areaId,
    description: '',
    accent: ['#6fd3ff', '#ffcd62', '#ff7d66'][index % 3],
  }
}

function createFallbackStageInfo(
  override: StageWorkbookOverride,
  area: StageAreaInfo,
): StageInfo {
  const stageNumber = (override.order ?? 1) as StageNumber
  return {
    id: override.stageId,
    areaId: area.id,
    areaTitle: area.title,
    stageNumber,
    title: override.title ?? override.stageId,
    subtitle: override.subtitle ?? '',
    strategyTips: override.strategyTips,
    affixes: [
      {
        id: `${override.stageId}-affix-a`,
        title: override.affix1Title ?? '',
        description: override.affix1Description ?? '',
        iconId: override.affix1IconId ?? 'battle-seal',
      },
      {
        id: `${override.stageId}-affix-b`,
        title: override.affix2Title ?? '',
        description: override.affix2Description ?? '',
        iconId: override.affix2IconId ?? 'battle-seal',
      },
    ],
    rules: [
      {
        id: `${override.stageId}-rule-a`,
        title: override.rule1Title ?? '',
        description: override.rule1Description ?? '',
        iconId: override.rule1IconId ?? 'battle-seal',
      },
      {
        id: `${override.stageId}-rule-b`,
        title: override.rule2Title ?? '',
        description: override.rule2Description ?? '',
        iconId: override.rule2IconId ?? 'battle-seal',
      },
    ],
    legend: [],
    unlockedActiveSkillIds: [...(override.unlockedActiveSkillIds ?? [])],
  }
}

function createBaseStageAreaCatalog() {
  return Object.fromEntries(
    BASE_STAGE_AREA_ORDER.map((areaId) => [areaId, cloneStageAreaInfo(BASE_STAGE_AREA_CATALOG[areaId])]),
  ) as Record<StageAreaId, StageAreaInfo>
}

function createBaseStageCatalog() {
  return Object.fromEntries(
    BASE_STAGE_ORDER.map((stageId) => [stageId, cloneStageInfo(BASE_STAGE_CATALOG[stageId])]),
  ) as Record<StageId, StageInfo>
}

export let stageAreaCatalog: Record<StageAreaId, StageAreaInfo> = createBaseStageAreaCatalog()
export let stageCatalog: Record<StageId, StageInfo> = createBaseStageCatalog()

function buildAreaLegendMap(stageCatalogSource: Record<StageId, StageInfo>) {
  return Object.fromEntries(
    stageAreaOrder.map((areaId) => {
      const firstStage = stageOrder.find((stageId) => stageCatalogSource[stageId].areaId === areaId)
      return [areaId, firstStage ? stageCatalogSource[firstStage].legend.map(cloneStageLegendEntry) : []]
    }),
  ) as Record<StageAreaId, StageLegendEntry[]>
}

export function applyStageWorkbookOverrides(overrides: StageWorkbookOverrides) {
  const hasDynamicStageRows = overrides.stageOverrides.some((override) => !BASE_STAGE_CATALOG[override.stageId])
  const nextStageAreaOrder = hasDynamicStageRows
    ? overrides.areaOverrides.map((override) => override.areaId)
    : [...BASE_STAGE_AREA_ORDER]
  const nextStageOrder = hasDynamicStageRows
    ? [...overrides.stageOverrides]
        .sort((left, right) => {
          const leftAreaIndex = nextStageAreaOrder.indexOf(left.areaId ?? '')
          const rightAreaIndex = nextStageAreaOrder.indexOf(right.areaId ?? '')
          return (
            (leftAreaIndex < 0 ? Number.MAX_SAFE_INTEGER : leftAreaIndex) -
              (rightAreaIndex < 0 ? Number.MAX_SAFE_INTEGER : rightAreaIndex) ||
            (left.order ?? 0) - (right.order ?? 0) ||
            left.stageId.localeCompare(right.stageId)
          )
        })
        .map((override) => override.stageId)
    : [...BASE_STAGE_ORDER]
  const nextStageAreaCatalog = hasDynamicStageRows ? {} as Record<StageAreaId, StageAreaInfo> : createBaseStageAreaCatalog()
  const nextStageCatalog = hasDynamicStageRows ? {} as Record<StageId, StageInfo> : createBaseStageCatalog()

  for (const [index, override] of overrides.areaOverrides.entries()) {
    const currentArea = nextStageAreaCatalog[override.areaId] ?? createFallbackAreaInfo(override.areaId, index)

    if (!nextStageAreaOrder.includes(override.areaId)) {
      nextStageAreaOrder.push(override.areaId)
    }

    nextStageAreaCatalog[override.areaId] = {
      ...currentArea,
      ...(override.title ? { title: override.title } : {}),
      ...(override.shortTitle ? { shortTitle: override.shortTitle } : {}),
      ...(override.mapLabel ? { mapLabel: override.mapLabel } : {}),
      ...(override.description ? { description: override.description } : {}),
      ...(override.accent ? { accent: override.accent } : {}),
    }
  }

  if (!hasDynamicStageRows) {
    for (const stageId of nextStageOrder) {
      const currentStage = nextStageCatalog[stageId]
      nextStageCatalog[stageId] = {
        ...currentStage,
        areaTitle: nextStageAreaCatalog[currentStage.areaId].title,
      }
    }
  }

  for (const override of overrides.stageOverrides) {
    const fallbackAreaId = override.areaId ?? nextStageAreaOrder[0] ?? 'default'
    const fallbackArea =
      nextStageAreaCatalog[fallbackAreaId] ??
      (nextStageAreaCatalog[fallbackAreaId] = createFallbackAreaInfo(fallbackAreaId, nextStageAreaOrder.length))
    const currentStage = nextStageCatalog[override.stageId]
      ?? createFallbackStageInfo(override, fallbackArea)

    if (!currentStage) {
      continue
    }

    const nextAreaId = override.areaId ?? currentStage.areaId
    const nextStageNumber = override.order ?? currentStage.stageNumber

    nextStageCatalog[override.stageId] = {
      ...currentStage,
      areaId: nextAreaId,
      stageNumber: nextStageNumber,
      ...(override.title ? { title: override.title } : {}),
      ...(override.subtitle ? { subtitle: override.subtitle } : {}),
      ...(override.strategyTips ? { strategyTips: override.strategyTips } : {}),
      affixes: [
        {
          ...currentStage.affixes[0],
          ...(override.affix1Title ? { title: override.affix1Title } : {}),
          ...(override.affix1Description ? { description: override.affix1Description } : {}),
          ...(override.affix1IconId ? { iconId: override.affix1IconId } : {}),
        },
        {
          ...currentStage.affixes[1],
          ...(override.affix2Title ? { title: override.affix2Title } : {}),
          ...(override.affix2Description ? { description: override.affix2Description } : {}),
          ...(override.affix2IconId ? { iconId: override.affix2IconId } : {}),
        },
      ],
      rules: [
        {
          ...currentStage.rules[0],
          ...(override.rule1Title ? { title: override.rule1Title } : {}),
          ...(override.rule1Description ? { description: override.rule1Description } : {}),
          ...(override.rule1IconId ? { iconId: override.rule1IconId } : {}),
        },
        {
          ...currentStage.rules[1],
          ...(override.rule2Title ? { title: override.rule2Title } : {}),
          ...(override.rule2Description ? { description: override.rule2Description } : {}),
          ...(override.rule2IconId ? { iconId: override.rule2IconId } : {}),
        },
      ],
      ...(override.unlockedActiveSkillIds ? { unlockedActiveSkillIds: [...override.unlockedActiveSkillIds] } : {}),
    }

    if (!nextStageOrder.includes(override.stageId)) {
      nextStageOrder.push(override.stageId)
    }
  }

  stageAreaOrder = nextStageAreaOrder
  stageOrder = nextStageOrder

  const areaLegendMap = buildAreaLegendMap(nextStageCatalog)

  for (const override of overrides.legendOverrides) {
    const currentLegendList = areaLegendMap[override.areaId]

    if (!currentLegendList) {
      continue
    }

    const entryIndex = currentLegendList.findIndex((entry) => entry.id === override.id)

    if (entryIndex >= 0) {
      currentLegendList[entryIndex] = {
        ...currentLegendList[entryIndex],
        ...(override.iconId ? { iconId: override.iconId } : {}),
        ...(override.label ? { label: override.label } : {}),
        ...(override.source ? { source: override.source } : {}),
        ...(override.target ? { target: override.target } : {}),
        ...(override.description ? { description: override.description } : {}),
      }
    } else if (override.label && override.source && override.target && override.description) {
      currentLegendList.push({
        id: override.id,
        iconId: override.iconId ?? override.id,
        label: override.label,
        source: override.source,
        target: override.target,
        description: override.description,
      })
    }
  }

  for (const stageId of stageOrder) {
    const currentStage = nextStageCatalog[stageId]
    nextStageCatalog[stageId] = {
      ...currentStage,
      areaTitle: nextStageAreaCatalog[currentStage.areaId].title,
      legend: areaLegendMap[currentStage.areaId].map(cloneStageLegendEntry),
    }
  }

  stageAreaCatalog = nextStageAreaCatalog
  stageCatalog = nextStageCatalog
}

export function getStageById(stageId: StageId) {
  return stageCatalog[stageId]
}

export function getStageAreaById(areaId: StageAreaId) {
  return stageAreaCatalog[areaId]
}

export function getNextStageId(stageId: StageId) {
  const currentIndex = stageOrder.indexOf(stageId)
  if (currentIndex < 0 || currentIndex === stageOrder.length - 1) {
    return null
  }

  return stageOrder[currentIndex + 1]
}

function getStageAreaTier(stage: StageInfo) {
  return stageAreaOrder.indexOf(stage.areaId) + 1
}

export function getPassiveTalentUnlockTierForStage(stage: StageInfo) {
  const stageIndex = stageOrder.indexOf(stage.id)
  if (stageIndex >= 0 && stageIndex < 3) {
    return -1
  }

  const previousAreaTier = getStageAreaTier(stage) - 1
  return stage.stageNumber >= 6 ? previousAreaTier + 1 : previousAreaTier
}

export function getUnlockedActiveSkillIdsForStage(stage: StageInfo) {
  const stageIndex = stageOrder.indexOf(stage.id)
  if (stageIndex < 0) {
    return []
  }

  const unlockedIds = new Set<StageUnlockedActiveSkillId>()
  for (const stageId of stageOrder.slice(0, stageIndex + 1)) {
    for (const skillId of stageCatalog[stageId].unlockedActiveSkillIds) {
      unlockedIds.add(skillId)
    }
  }

  return [...unlockedIds]
}
