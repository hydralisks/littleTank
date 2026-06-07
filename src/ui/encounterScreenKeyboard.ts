import type { SkillHotkey, SkillId, SkillState } from '../game/encounter/encounterTypes'

export type EncounterScreenPanel = 'skills' | 'passives' | 'stage' | null
export type EncounterScreenKeyboardSkill = {
  hotkey: SkillHotkey
  id: SkillId
}

export type EncounterScreenKeyboardAction =
  | {
      type: 'close-panel' | 'open-pause' | 'close-pause'
      preventDefault: true
    }
  | {
      type: 'cycle-target'
      direction: 1 | -1
      preventDefault: true
    }
  | {
      type: 'activate-skill'
      skillId: SkillId
      preventDefault: true
    }
  | {
      type: 'noop'
      reason: 'panel-open' | 'paused' | 'unhandled-key'
      preventDefault: false
    }

export type EncounterScreenKeyDownEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>

export function getEncounterScreenKeyboardSkills(skills: SkillState[]): EncounterScreenKeyboardSkill[] {
  return skills.map(({ hotkey, id }) => ({ hotkey, id }))
}

function findSkillIdByHotkey(skills: EncounterScreenKeyboardSkill[], hotkey: string): SkillId | null {
  const skill = skills.find((entry) => entry.hotkey.toLowerCase() === hotkey.toLowerCase())
  return skill?.id ?? null
}

export function getEncounterScreenKeyboardAction({
  key,
  shiftKey,
  openPanel,
  pauseVisible,
  skills,
}: {
  key: string
  shiftKey: boolean
  openPanel: EncounterScreenPanel
  pauseVisible: boolean
  skills: EncounterScreenKeyboardSkill[]
}): EncounterScreenKeyboardAction {
  if (key === 'Escape') {
    if (openPanel) {
      return {
        type: 'close-panel',
        preventDefault: true,
      }
    }

    return {
      type: pauseVisible ? 'close-pause' : 'open-pause',
      preventDefault: true,
    }
  }

  if (openPanel) {
    return {
      type: 'noop',
      reason: 'panel-open',
      preventDefault: false,
    }
  }

  if (pauseVisible) {
    return {
      type: 'noop',
      reason: 'paused',
      preventDefault: false,
    }
  }

  if (key === 'Tab') {
    return {
      type: 'cycle-target',
      direction: shiftKey ? -1 : 1,
      preventDefault: true,
    }
  }

  const skillId = findSkillIdByHotkey(skills, key)
  if (skillId) {
    return {
      type: 'activate-skill',
      skillId,
      preventDefault: true,
    }
  }

  return {
    type: 'noop',
    reason: 'unhandled-key',
    preventDefault: false,
  }
}

export function handleEncounterScreenKeyDown({
  event,
  openPanel,
  pauseVisible,
  skills,
  onClosePanel,
  onOpenPause,
  onClosePause,
  onCycleTarget,
  onActivateSkill,
}: {
  event: EncounterScreenKeyDownEvent
  openPanel: EncounterScreenPanel
  pauseVisible: boolean
  skills: EncounterScreenKeyboardSkill[]
  onClosePanel: () => void
  onOpenPause: () => void
  onClosePause: () => void
  onCycleTarget: (direction: 1 | -1) => void
  onActivateSkill: (skillId: SkillId) => void
}): EncounterScreenKeyboardAction {
  const keyboardAction = getEncounterScreenKeyboardAction({
    key: event.key,
    shiftKey: event.shiftKey,
    openPanel,
    pauseVisible,
    skills,
  })

  if (keyboardAction.preventDefault) {
    event.preventDefault()
  }

  if (keyboardAction.type === 'close-panel') {
    onClosePanel()
    return keyboardAction
  }

  if (keyboardAction.type === 'open-pause') {
    onOpenPause()
    return keyboardAction
  }

  if (keyboardAction.type === 'close-pause') {
    onClosePause()
    return keyboardAction
  }

  if (keyboardAction.type === 'cycle-target') {
    onCycleTarget(keyboardAction.direction)
    return keyboardAction
  }

  if (keyboardAction.type === 'activate-skill') {
    onActivateSkill(keyboardAction.skillId)
    return keyboardAction
  }

  return keyboardAction
}
