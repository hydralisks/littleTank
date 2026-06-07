import type { ActiveSkillDefinition, PassiveTalentModifiers } from '../encounter/encounterTypes'

type SkillTemplateMutator = (
  skill: ActiveSkillDefinition,
  modifiers: PassiveTalentModifiers,
) => ActiveSkillDefinition

const PLAYER_SKILL_TEMPLATE_MUTATORS: Record<string, SkillTemplateMutator> = {
  interrupt_cast: (skill, modifiers) => ({
    ...skill,
    gcdMs: modifiers.interruptIgnoresGcd ? 0 : skill.gcdMs,
  }),
  burst_single: (skill, modifiers) => ({
    ...skill,
    cooldownMs: Math.round(skill.cooldownMs * modifiers.burstCooldownMultiplier),
    initialRemainingCooldownMs: Math.round(
      skill.initialRemainingCooldownMs * modifiers.burstCooldownMultiplier,
    ),
  }),
  taunt_single: (skill, modifiers) => ({
    ...skill,
    cooldownMs: Math.round(skill.cooldownMs * modifiers.tauntCooldownMultiplier),
    initialRemainingCooldownMs: Math.round(
      skill.initialRemainingCooldownMs * modifiers.tauntCooldownMultiplier,
    ),
  }),
  mass_taunt: (skill, modifiers) => ({
    ...skill,
    cooldownMs: Math.round(skill.cooldownMs * modifiers.massTauntCooldownMultiplier),
    initialRemainingCooldownMs: Math.round(
      skill.initialRemainingCooldownMs * modifiers.massTauntCooldownMultiplier,
    ),
  }),
  shield_wall: (skill, modifiers) => ({
    ...skill,
    cooldownMs: Math.round(skill.cooldownMs * modifiers.shieldWallCooldownMultiplier),
    initialRemainingCooldownMs: Math.round(
      skill.initialRemainingCooldownMs * modifiers.shieldWallCooldownMultiplier,
    ),
  }),
}

export function applySkillTemplateMutation(
  skill: ActiveSkillDefinition,
  modifiers: PassiveTalentModifiers,
) {
  const mutator = PLAYER_SKILL_TEMPLATE_MUTATORS[skill.skillLogicId]
  return mutator ? mutator(skill, modifiers) : skill
}

export function hasPlayerSkillTemplateMutation(skillLogicId: string) {
  return skillLogicId in PLAYER_SKILL_TEMPLATE_MUTATORS
}
