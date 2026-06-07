import type { SkillHotkey } from '../game/encounter/encounterTypes'


export interface StageSelectBuildRuleModalInput {
  ruleName: string
  description: string
  totalBuildPoints: number
  maxActiveSlots: number
  enabledHotkeys: SkillHotkey[]
}

export interface StageSelectModalSection {
  label: string
  value: string
}

export interface StageSelectBuildRuleModalViewModel {
  title: string
  sections: StageSelectModalSection[]
}

export interface StageSelectConflictModalViewModel {
  title: string
  items: string[]
}

function listOrFallback(values: string[], separator = '、') {
  return values.join(separator)
}

export function shouldShowBuildConflictButton(warnings: string[]) {
  return warnings.length > 0
}

export function buildStageSelectBuildRuleModal(
  input: StageSelectBuildRuleModalInput,
): StageSelectBuildRuleModalViewModel {
  return {
    title: input.ruleName,
    sections: [
      { label: '规则说明', value: input.description },
      { label: '总技能点', value: String(input.totalBuildPoints) },
      { label: '主动栏位', value: String(input.maxActiveSlots) },
      { label: '开放键位', value: listOrFallback(input.enabledHotkeys, '/') },
    ],
  }
}

export function buildStageSelectConflictModal(warnings: string[]): StageSelectConflictModalViewModel {
  return {
    title: '当前构筑冲突',
    items: warnings,
  }
}
