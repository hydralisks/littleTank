import type { StageInfo } from '../data/stageTemplates'
import type { PassiveTalentId, PersistedBuildState, SkillId, SkillLoadout } from '../encounter/encounterTypes'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  SKILL_HOTKEYS,
  canUseSkillInRule,
  canUseTalentInRule,
  getActiveSkillCatalog,
  getBuildRuleDefinition,
  getDefaultPersistedBuildForRule,
  getPassiveTalentDefinition,
  getPassiveTalentCatalog,
  getRemainingBuildPoints,
  normalizePersistedBuildForRule,
} from '../data/playerBuildCatalog'
import { getPassiveTalentUnlockTierForStage, getUnlockedActiveSkillIdsForStage } from '../data/stageTemplates'

export interface BalanceBuildGenerationOptions {
  maxActiveBuilds?: number
  maxPassiveVariants?: number
}

export interface StrategyTipBuildCandidateOptions {
  maxActiveBuilds?: number
  maxPassiveVariants?: number
  maxCandidates?: number
  maxActiveSkillCount?: number
  minPassiveTalentCount?: number
}

export function getBuildSignature(build: PersistedBuildState) {
  const activePart = SKILL_HOTKEYS
    .map((hotkey) => `${hotkey}=${build.loadout[hotkey] ?? ''}`)
    .join(';')
  const passivePart = [...new Set(build.passiveTalentIds)]
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .join(',')

  return `${activePart}|${passivePart}`
}

function createEmptyLoadoutFromRule(buildRuleId: string): SkillLoadout {
  const template = getDefaultPersistedBuildForRule(buildRuleId, 'warrior_t').loadout
  const nextLoadout = { ...template }
  for (const hotkey of Object.keys(nextLoadout) as (keyof SkillLoadout)[]) {
    nextLoadout[hotkey] = null
  }
  return nextLoadout
}

function getOrderedLegalActiveSkillIds(buildRuleId: string, unlockedSkillIds: readonly SkillId[]) {
  const unlocked = [...new Set(unlockedSkillIds)]
  const unlockedSet = new Set(unlocked)
  const catalog = getActiveSkillCatalog()
  const catalogOrder = new Map<string, number>()
  for (let index = 0; index < catalog.length; index += 1) {
    catalogOrder.set(catalog[index].id, index)
  }

  return unlocked
    .filter((skillId) => unlockedSet.has(skillId) && canUseSkillInRule(buildRuleId, 'warrior_t', skillId, unlocked))
    .sort((left, right) => (catalogOrder.get(left) ?? 99999) - (catalogOrder.get(right) ?? 99999) || left.localeCompare(right))
}

function getOrderedLegalPassiveTalentIds(buildRuleId: string, maxUnlockedTier: number) {
  return getPassiveTalentCatalog()
    .map((talent) => talent.id)
    .filter((talentId) => canUseTalentInRule(buildRuleId, 'warrior_t', talentId, maxUnlockedTier))
}

function getPassiveTalentSearchScore(talentId: PassiveTalentId) {
  const talent = getPassiveTalentDefinition(talentId)
  if (!talent) {
    return 0
  }

  const tags = new Set(talent.talentTags ?? [])
  const tagScore =
    (tags.has('survival') ? 8 : 0) +
    (tags.has('anti-cast') || tags.has('control') ? 6 : 0) +
    (tags.has('party') ? 9 : 0) +
    (tags.has('rage') ? 5 : 0) +
    (tags.has('damage') || tags.has('aoe') ? 4 : 0) +
    (tags.has('focus') ? 2 : 0)

  return tagScore + talent.cost * 0.2 + Math.max(0, talent.tier) * 0.1 - (talent.uiOrder ?? 999) * 0.01
}

function getPassiveVariantSearchScore(passiveTalentIds: readonly PassiveTalentId[]) {
  const tags = new Set<string>()
  let score = 0

  for (const talentId of passiveTalentIds) {
    const talent = getPassiveTalentDefinition(talentId)
    score += getPassiveTalentSearchScore(talentId)
    for (const tag of talent?.talentTags ?? []) {
      tags.add(tag)
    }
  }

  return score + tags.size * 0.35 + passiveTalentIds.length * 0.2
}

function generatePassiveVariants(
  buildRuleId: string,
  loadout: SkillLoadout,
  maxUnlockedTier: number,
  maxPassiveVariants: number,
): PassiveTalentId[][] {
  const legalTalentIds = getOrderedLegalPassiveTalentIds(buildRuleId, maxUnlockedTier)
  const variantsBySignature = new Map<string, PassiveTalentId[]>([['', []]])

  const canAffordVariant = (passiveTalentIds: PassiveTalentId[]) =>
    getRemainingBuildPoints(buildRuleId, loadout, passiveTalentIds) >= 0
  const addVariant = (passiveTalentIds: PassiveTalentId[]) => {
    const signature = passiveTalentIds.join(',')
    if (!variantsBySignature.has(signature) && canAffordVariant(passiveTalentIds)) {
      variantsBySignature.set(signature, passiveTalentIds)
    }
  }

  for (const talentId of legalTalentIds) {
    addVariant([talentId])
  }

  for (let leftIndex = 0; leftIndex < legalTalentIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < legalTalentIds.length; rightIndex += 1) {
      addVariant([legalTalentIds[leftIndex], legalTalentIds[rightIndex]])
    }
  }

  let frontier: PassiveTalentId[][] = [[]]
  const maxBeamWidth = 64
  for (const talentId of legalTalentIds) {
    const nextFrontier = [...frontier]
    for (const passiveTalentIds of frontier) {
      if (passiveTalentIds.includes(talentId)) {
        continue
      }

      const nextPassiveTalentIds = [...passiveTalentIds, talentId]
      if (canAffordVariant(nextPassiveTalentIds)) {
        addVariant(nextPassiveTalentIds)
        nextFrontier.push(nextPassiveTalentIds)
      }
    }

    frontier = nextFrontier
      .sort((left, right) =>
        getPassiveVariantSearchScore(right) - getPassiveVariantSearchScore(left) ||
        left.join(',').localeCompare(right.join(',')),
      )
      .slice(0, maxBeamWidth)
  }

  const rankedVariants = [...variantsBySignature.values()]
    .filter((variant) => variant.length > 0)
    .sort((left, right) =>
      getPassiveVariantSearchScore(right) - getPassiveVariantSearchScore(left) ||
      left.join(',').localeCompare(right.join(',')),
    )
  const selectedVariants: PassiveTalentId[][] = [[]]
  const selectedSignatures = new Set([''])
  const pushSelected = (passiveTalentIds: PassiveTalentId[] | undefined) => {
    if (!passiveTalentIds) {
      return
    }

    const signature = passiveTalentIds.join(',')
    if (!selectedSignatures.has(signature)) {
      selectedSignatures.add(signature)
      selectedVariants.push(passiveTalentIds)
    }
  }

  pushSelected(rankedVariants.find((variant) => variant.length === 2))
  pushSelected(rankedVariants.find((variant) => variant.length >= 4))

  for (const passiveTalentIds of rankedVariants) {
    if (selectedVariants.length >= maxPassiveVariants) {
      break
    }
    pushSelected(passiveTalentIds)
  }

  return selectedVariants.slice(0, maxPassiveVariants)
}

function getActiveSkillCount(build: PersistedBuildState) {
  return Object.values(build.loadout).filter(Boolean).length
}

function getStrategyTipText(stage: StageInfo) {
  return `${stage.strategyTips ?? ''}`.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function shouldPreferPassiveHeavyBuildCandidates(stage: StageInfo) {
  const tips = getStrategyTipText(stage)
  if (!tips) {
    return false
  }

  const mentionsPassiveInvestment =
    tips.includes('被动') ||
    tips.includes('天赋') ||
    tips.includes('talent') ||
    tips.includes('passive') ||
    /tier\s*2/i.test(tips)
  const mentionsActiveTradeoff =
    tips.includes('放弃') ||
    tips.includes('腾出') ||
    tips.includes('少带') ||
    tips.includes('少主动') ||
    tips.includes('不适合当前关卡的主动技能') ||
    tips.includes('drop active') ||
    tips.includes('fewer active') ||
    tips.includes('skip active')

  return mentionsPassiveInvestment && mentionsActiveTradeoff
}

function getStrategyTipActiveSkillScore(skillId: SkillId) {
  if (skillId === 'warrior_t_shield_wall' || skillId === 'warrior_t_mass_taunt') {
    return 4
  }
  if (skillId === 'warrior_t_ignore_pain' || skillId === 'warrior_t_shield_block' || skillId === 'warrior_t_shield_reflection') {
    return 3
  }
  if (skillId === 'warrior_t_taunt' || skillId === 'warrior_t_interrupt' || skillId === 'warrior_t_stun') {
    return 2
  }
  return 0
}

function getStrategyTipBuildScore(buildRuleId: string, build: PersistedBuildState) {
  const activeSkillIds = Object.values(build.loadout).filter(Boolean) as SkillId[]
  const activeUtilityScore = activeSkillIds.reduce(
    (score, skillId) => score + getStrategyTipActiveSkillScore(skillId),
    0,
  )
  const remainingPoints = getRemainingBuildPoints(buildRuleId, build.loadout, build.passiveTalentIds)

  return build.passiveTalentIds.length * 8 + activeUtilityScore - Math.max(0, remainingPoints) * 0.1
}

export function generateStrategyTipBuildCandidates(
  stage: StageInfo,
  options: StrategyTipBuildCandidateOptions = {},
) {
  if (!shouldPreferPassiveHeavyBuildCandidates(stage)) {
    return []
  }

  const maxCandidates = Math.max(1, Math.floor(options.maxCandidates ?? 6))
  const maxActiveSkillCount = Math.max(0, Math.floor(options.maxActiveSkillCount ?? 2))
  const minPassiveTalentCount = Math.max(1, Math.floor(options.minPassiveTalentCount ?? 4))
  const buildRuleId = getStageBuildRuleId(stage)
  const candidates = generateStageBalanceBuilds(stage, {
    maxActiveBuilds: options.maxActiveBuilds ?? 18,
    maxPassiveVariants: options.maxPassiveVariants ?? 3,
  })

  return candidates
    .filter((variant) =>
      getActiveSkillCount(variant.build) <= maxActiveSkillCount &&
      variant.build.passiveTalentIds.length >= minPassiveTalentCount &&
      getRemainingBuildPoints(buildRuleId, variant.build.loadout, variant.build.passiveTalentIds) >= 0,
    )
    .sort((left, right) =>
      getStrategyTipBuildScore(buildRuleId, right.build) - getStrategyTipBuildScore(buildRuleId, left.build) ||
      left.id.localeCompare(right.id),
    )
    .slice(0, maxCandidates)
}

export function generateStageBalanceBuilds(stage: StageInfo, options: BalanceBuildGenerationOptions = {}) {
  const maxActiveBuilds = Math.max(0, Math.floor(options.maxActiveBuilds ?? 20))
  const maxPassiveVariants = Math.max(1, Math.floor(options.maxPassiveVariants ?? 8))

  const buildRuleId = getStageBuildRuleId(stage)
  const rule = getBuildRuleDefinition(buildRuleId)

  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const normalizedDefault = normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule(buildRuleId, 'warrior_t'),
    buildRuleId, 'warrior_t',
    passiveTier,
    unlockedSkillIds,
    stage.unlockedActiveSkillIds,
  ).build

  const results: Array<{ id: string; build: PersistedBuildState }> = [
    { id: 'default', build: normalizedDefault },
  ]

  const seen = new Set<string>([getBuildSignature(normalizedDefault)])

  if (!rule) {
    return results
  }

  const legalSkillIds = getOrderedLegalActiveSkillIds(buildRuleId, unlockedSkillIds)
  const emptyLoadout = createEmptyLoadoutFromRule(buildRuleId)
  const enabledHotkeys = rule.enabledHotkeys

  let generatedActiveCount = 0
  outer:
  for (let activeCount = 1; activeCount <= Math.min(rule.maxActiveSlots, enabledHotkeys.length, legalSkillIds.length); activeCount += 1) {
    for (let startIndex = 0; startIndex + activeCount <= legalSkillIds.length; startIndex += 1) {
      if (generatedActiveCount >= maxActiveBuilds) {
        break outer
      }

      const loadout: SkillLoadout = { ...emptyLoadout }
      for (let slotIndex = 0; slotIndex < activeCount; slotIndex += 1) {
        loadout[enabledHotkeys[slotIndex]] = legalSkillIds[startIndex + slotIndex]
      }

      const normalized = normalizePersistedBuildForRule(
        { loadout, passiveTalentIds: [] },
        buildRuleId, 'warrior_t',
        passiveTier,
        unlockedSkillIds,
        stage.unlockedActiveSkillIds,
      ).build

      generatedActiveCount += 1

      const passiveVariants = generatePassiveVariants(buildRuleId, normalized.loadout, passiveTier, maxPassiveVariants)
      for (let passiveIndex = 0; passiveIndex < passiveVariants.length; passiveIndex += 1) {
        const normalizedWithPassives = normalizePersistedBuildForRule(
          { loadout: normalized.loadout, passiveTalentIds: passiveVariants[passiveIndex] },
          buildRuleId, 'warrior_t',
          passiveTier,
          unlockedSkillIds,
          stage.unlockedActiveSkillIds,
        ).build

        const variantSignature = getBuildSignature(normalizedWithPassives)
        if (seen.has(variantSignature)) {
          continue
        }
        seen.add(variantSignature)
        results.push({
          id: `generated_${generatedActiveCount}_${passiveIndex}`,
          build: normalizedWithPassives,
        })
      }
    }
  }

  return results
}
