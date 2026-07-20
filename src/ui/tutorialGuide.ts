import type { StageInfo } from '../game/data/stageTemplates'

export type TutorialPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center'
export type TutorialBuildPanel = 'skills' | 'passives'

export interface TutorialStep {
  id: string
  title: string
  body: string
  target: string
  placement: TutorialPlacement
  openPanel?: TutorialBuildPanel
}

export function getMonsterCodexTutorialScript(): TutorialStep[] {
  return [
    {
      id: 'monster-codex-intro',
      title: '查看怪物图鉴',
      body: '右上角的怪物图鉴会记录你已经战斗过的敌人。仇恨逻辑说明敌人如何选择目标：普通按仇恨判断，无理会更容易打队友，嗜血会盯住更容易击杀的目标；输出循环是敌人按顺序释放的技能；技能伤害中的命中坦克、命中队伍和压力分别表示技能打到坦克、波及队伍以及增加队伍压力时的数值。',
      target: '[data-tutorial-id="monster-codex-button"]',
      placement: 'left',
    },
  ]
}

export function isRingingDeepsTutorialStage(stage: StageInfo) {
  return stage.areaId === 'RingingDeeps' && stage.stageNumber >= 1 && stage.stageNumber <= 4
}

function isWestFallHealerTutorialStage(stage: StageInfo) {
  return stage.areaId === 'WestFall' && stage.stageNumber === 1
}

function isZulAmanPartyHealTutorialStage(stage: StageInfo) {
  return stage.areaId === "Zul'Aman" && stage.stageNumber === 1
}

export function getEncounterTutorialScript(stage: StageInfo): TutorialStep[] | null {
  if (isWestFallHealerTutorialStage(stage)) {
    return [
      {
        id: 'wf1-healer-intro',
        title: '我们终于组到治疗来帮帮你了',
        body: '从 WestFall 开始，治疗者会让玩家每秒自动受到治疗。你仍然要拉好仇恨，但短时间内受伤不会再只能靠自己硬扛。',
        target: '[data-tutorial-id="team-status"]',
        placement: 'left',
      },
    ]
  }

  if (isZulAmanPartyHealTutorialStage(stage)) {
    return [
      {
        id: 'za1-party-heal',
        title: '坚实可靠的你能让治疗有空捞一捞其他兄弟',
        body: "从 Zul'Aman 开始，队伍每秒受到治疗。队伍受到治疗时，压力会按实际治疗量等量下降，最低降到 0。你把主要仇恨拉稳后，治疗就有余裕补队伍血量并缓解压力。",
        target: '[data-tutorial-id="team-status"]',
        placement: 'left',
      },
    ]
  }

  if (!isRingingDeepsTutorialStage(stage)) {
    return null
  }

  if (stage.stageNumber === 1) {
    return [
      {
        id: 'rd1-target-selection',
        title: '选择攻击目标',
        body: '点击敌人框可以选择目标。白色描边表示当前目标，玩家和队伍的自动攻击都会优先打这个目标。',
        target: '[data-tutorial-id="enemy-frames"]',
        placement: 'right',
      },
      {
        id: 'rd1-skill-use',
        title: '使用主动技能',
        body: '坦克的第一招是自动攻击造成伤害创造仇恨。坦克的第一要义是通过向怪物制造高于队伍的仇恨值来拉好仇恨；当前选中的目标会被玩家自动攻击，攻击会产生怒气和仇恨值。',
        target: '[data-tutorial-id="skill-bar"]',
        placement: 'top',
      },
      {
        id: 'rd1-threat-cast',
        title: '读懂敌人框',
        body: '敌人边框颜色代表当前仇恨状态：绿色稳定，黄色警告，红色说明敌人正在威胁队友。底部读条显示敌人正在释放的技能。',
        target: '[data-tutorial-id="enemy-cast-and-threat"]',
        placement: 'right',
      },
      {
        id: 'rd1-win-lose',
        title: '胜利与失败',
        body: '击败全部敌人即可胜利。玩家死亡、队伍血量归零，或队伍压力涨满都会失败。',
        target: '[data-tutorial-id="team-status"]',
        placement: 'left',
      },
    ]
  }

  if (stage.stageNumber === 2) {
    return [
      {
        id: 'rd2-interrupt-cast',
        title: '黄色读条可以打断',
        body: '看到黄色读条时，先选择正在施法的敌人，再使用打断技能。成功后敌人会停止这次施法并进入恢复。',
        target: '[data-tutorial-id="enemy-cast-and-threat"]',
        placement: 'right',
      },
      {
        id: 'rd2-interrupt-button',
        title: '找到打断技能',
        body: '打断技能在技能栏中，按热键或点击都可以释放。注意冷却和怒气，别把打断交给不危险的读条。',
        target: '[data-tutorial-id="skill-bar"]',
        placement: 'top',
      },
    ]
  }

  if (stage.stageNumber === 3) {
    return [
      {
        id: 'rd3-control-cast',
        title: '蓝色读条需要控制',
        body: '有些读条不能用普通打断处理。蓝色读条代表需要控制技能，例如昏迷，才能中止当前动作。',
        target: '[data-tutorial-id="enemy-cast-and-threat"]',
        placement: 'right',
      },
      {
        id: 'rd3-control-button',
        title: '使用控制技能',
        body: '选中目标后使用控制技能。控制技能通常更珍贵，优先留给蓝色读条或关键敌人。',
        target: '[data-tutorial-id="skill-bar"]',
        placement: 'top',
      },
      {
        id: 'rd3-channel-rule',
        title: '引导施法会推进循环',
        body: '敌人进入引导施法后，如果你用控制中止它，这个敌人会跳到下一个技能循环，不会重试当前技能。',
        target: '[data-tutorial-id="enemy-cast-and-threat"]',
        placement: 'right',
      },
    ]
  }

  return null
}

export function getStageSelectTutorialScript(stage: StageInfo): TutorialStep[] | null {
  if (!isRingingDeepsTutorialStage(stage)) {
    return null
  }

  if (stage.stageNumber === 2) {
    return [
      {
        id: 'rd2-build-menu',
        title: '进入本关构筑',
        body: '从这里查看并调整进入本关前的构筑。第二关开始，你需要主动检查技能栏配置。',
        target: '[data-tutorial-id="stage-build-menu"]',
        placement: 'left',
      },
      {
        id: 'rd2-skill-config-entry',
        title: '打开技能配置',
        body: '点击技能配置可以调整本关可用的主动技能。新增技能需要放进热键栏才会在战斗中出现。',
        target: '[data-tutorial-id="stage-skill-config-button"]',
        placement: 'left',
      },
      {
        id: 'rd2-hotkey-slots',
        title: '选择热键栏位',
        body: '先选择一个热键栏位。栏位决定战斗中按哪个键释放这个技能。',
        target: '[data-tutorial-id="skill-config-slots"]',
        placement: 'right',
        openPanel: 'skills',
      },
      {
        id: 'rd2-skill-library',
        title: '添加主动技能',
        body: '再从技能列表中选择要放入栏位的技能。主动技能会消耗构筑点数，点数不足时需要先清空别的栏位。',
        target: '[data-tutorial-id="skill-library"]',
        placement: 'left',
        openPanel: 'skills',
      },
    ]
  }

  if (stage.stageNumber === 4) {
    return [
      {
        id: 'rd4-build-menu',
        title: '本关构筑继续扩展',
        body: '第四关开始，构筑不仅包含主动技能，也包含被动天赋。先从本关构筑入口查看。',
        target: '[data-tutorial-id="stage-build-menu"]',
        placement: 'left',
      },
      {
        id: 'rd4-passive-entry',
        title: '打开被动天赋',
        body: '被动天赋会改变你的数值、技能效果或队伍承压能力，适合在进关前根据压力类型调整。',
        target: '[data-tutorial-id="stage-passive-config-button"]',
        placement: 'left',
      },
      {
        id: 'rd4-shared-points',
        title: '主动和被动共用点数',
        body: '主动技能和被动天赋共用同一池技能点。这里可以看到总点数、已用点数和剩余点数。',
        target: '[data-tutorial-id="build-points-summary"]',
        placement: 'bottom',
        openPanel: 'passives',
      },
      {
        id: 'rd4-passive-list',
        title: '选择被动天赋',
        body: '点击天赋卡选择或取消。点数不够时，需要移除某个主动技能或其他被动天赋再重新分配。',
        target: '[data-tutorial-id="passive-talent-list"]',
        placement: 'left',
        openPanel: 'passives',
      },
    ]
  }

  return null
}
