import type { StageInfo } from '../data/stageTemplates'
import type {
  PassiveTalentId,
  PersistedBuildState,
  PlayerClassId,
  SkillId,
  SkillLoadout,
} from '../encounter/encounterTypes'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  SKILL_HOTKEYS,
  canUseSkillInRule,
  canUseTalentInRule,
  getActiveSkillDefinition,
  getBuildRuleDefinition,
  getDefaultPersistedBuildForRule,
  getPassiveTalentDefinition,
  getPassiveTalentCatalog,
  getRemainingBuildPoints,
  getTalentEffectsForTalent,
  normalizePersistedBuildForRule,
} from '../data/playerBuildCatalog'
import { getPassiveTalentUnlockTierForStage, getUnlockedActiveSkillIdsForStage } from '../data/stageTemplates'

export interface BalanceBuildGenerationOptions {
  maxActiveBuilds?: number
  maxPassiveVariants?: number
}

export interface BalanceBuildVariant {
  id: string
  classId: PlayerClassId
  build: PersistedBuildState
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

function createEmptyLoadoutFromRule(buildRuleId: string, classId: PlayerClassId): SkillLoadout {
  const template = getDefaultPersistedBuildForRule(buildRuleId, classId).loadout
  const nextLoadout = { ...template }
  for (const hotkey of Object.keys(nextLoadout) as (keyof SkillLoadout)[]) {
    nextLoadout[hotkey] = null
  }
  return nextLoadout
}

function getOrderedLegalActiveSkillIds(
  buildRuleId: string,
  classId: PlayerClassId,
  unlockedSkillIds: readonly SkillId[],
) {
  const unlocked = [...new Set(unlockedSkillIds)]

  return unlocked
    .filter((skillId) => canUseSkillInRule(buildRuleId, classId, skillId, unlocked))
}

function getOrderedLegalPassiveTalentIds(
  buildRuleId: string,
  classId: PlayerClassId,
  maxUnlockedTier: number,
) {
  return getPassiveTalentCatalog()
    .map((talent) => talent.id)
    .filter((talentId) => canUseTalentInRule(buildRuleId, classId, talentId, maxUnlockedTier))
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

function getPassiveVariantSearchScore(
  passiveTalentIds: readonly PassiveTalentId[],
  equippedSkillSynergyTalentIds: ReadonlySet<PassiveTalentId> = new Set(),
) {
  const tags = new Set<string>()
  let score = 0
  let equippedSkillSynergyCount = 0

  for (const talentId of passiveTalentIds) {
    const talent = getPassiveTalentDefinition(talentId)
    score += getPassiveTalentSearchScore(talentId)
    if (equippedSkillSynergyTalentIds.has(talentId)) {
      equippedSkillSynergyCount += 1
    }
    for (const tag of talent?.talentTags ?? []) {
      tags.add(tag)
    }
  }

  return score + tags.size * 0.35 + passiveTalentIds.length * 0.2 + equippedSkillSynergyCount * 12
}

function getPassiveVariantUiOrderSpread(passiveTalentIds: readonly PassiveTalentId[]) {
  const orders = passiveTalentIds.map((talentId) => getPassiveTalentDefinition(talentId)?.uiOrder ?? 0)
  return orders.length > 1 ? Math.max(...orders) - Math.min(...orders) : 0
}

function generatePassiveVariants(
  buildRuleId: string,
  classId: PlayerClassId,
  loadout: SkillLoadout,
  maxUnlockedTier: number,
  maxPassiveVariants: number,
): PassiveTalentId[][] {
  const legalTalentIds = getOrderedLegalPassiveTalentIds(buildRuleId, classId, maxUnlockedTier)
  const equippedSkillIds = new Set(
    Object.values(loadout).filter((skillId): skillId is SkillId => Boolean(skillId)),
  )
  const equippedSkillSynergyTalentIds = new Set(
    legalTalentIds.filter((talentId) =>
      getTalentEffectsForTalent(talentId).some((effect) => effect.skillId && equippedSkillIds.has(effect.skillId)),
    ),
  )
  const variantsBySignature = new Map<string, PassiveTalentId[]>([['', []]])

  const hasExclusiveGroupConflict = (passiveTalentIds: PassiveTalentId[]) => {
    const groups = new Set<string>()
    for (const talentId of passiveTalentIds) {
      const group = getPassiveTalentDefinition(talentId)?.exclusiveGroup
      if (!group) continue
      if (groups.has(group)) return true
      groups.add(group)
    }
    return false
  }
  const canAffordVariant = (passiveTalentIds: PassiveTalentId[]) =>
    !hasExclusiveGroupConflict(passiveTalentIds) &&
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
        getPassiveVariantSearchScore(right, equippedSkillSynergyTalentIds) - getPassiveVariantSearchScore(left, equippedSkillSynergyTalentIds) ||
        left.join(',').localeCompare(right.join(',')),
      )
      .slice(0, maxBeamWidth)
  }

  const rankedVariants = [...variantsBySignature.values()]
    .filter((variant) => variant.length > 0)
    .sort((left, right) =>
      getPassiveVariantSearchScore(right, equippedSkillSynergyTalentIds) - getPassiveVariantSearchScore(left, equippedSkillSynergyTalentIds) ||
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

  const exclusiveTalentGroups = new Map<string, PassiveTalentId[]>()
  for (const talentId of legalTalentIds) {
    const group = getPassiveTalentDefinition(talentId)?.exclusiveGroup
    if (!group) continue
    exclusiveTalentGroups.set(group, [...(exclusiveTalentGroups.get(group) ?? []), talentId])
  }
  for (const talentIds of exclusiveTalentGroups.values()) {
    if (talentIds.length < 2 || maxPassiveVariants < talentIds.length + 3) continue
    for (const talentId of talentIds) {
      pushSelected(rankedVariants.find((variant) => variant.includes(talentId)))
    }
  }

  pushSelected(
    rankedVariants
      .filter((variant) => variant.length === 2)
      .sort((left, right) =>
        getPassiveVariantUiOrderSpread(right) - getPassiveVariantUiOrderSpread(left) ||
        getPassiveVariantSearchScore(right, equippedSkillSynergyTalentIds) - getPassiveVariantSearchScore(left, equippedSkillSynergyTalentIds) ||
        left.join(',').localeCompare(right.join(',')),
      )[0],
  )

  for (const passiveTalentIds of rankedVariants) {
    if (selectedVariants.length >= maxPassiveVariants) {
      break
    }
    pushSelected(passiveTalentIds)
  }

  return selectedVariants.slice(0, maxPassiveVariants)
}

function getRoleBalancedActiveSkillScore(skillIds: readonly SkillId[]) {
  const tagCounts = new Map<string, number>()
  let damageRageSkillCount = 0
  for (const skillId of skillIds) {
    const tags = new Set(getActiveSkillDefinition(skillId)?.skillTags ?? [])
    if (tags.has('damage') && tags.has('rage')) {
      damageRageSkillCount += 1
    }
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  const capped = (tag: string, cap: number, weight: number) =>
    Math.min(cap, tagCounts.get(tag) ?? 0) * weight
  const tankRoleClosureTags = [
    'damage',
    'rage',
    'anti-cast',
    'survival',
    'physical',
    'heal',
    'dispel',
    'max-hp',
    'party',
  ]
  const tankRoleClosureBonus = tankRoleClosureTags.every((tag) => tagCounts.has(tag)) ? 24 : 0

  return (
    capped('survival', 5, 7) +
    capped('damage', 3, 5) +
    capped('rage', 2, 5) +
    capped('heal', 2, 4) +
    capped('physical', 1, 3) +
    capped('aoe', 2, 3) +
    capped('anti-cast', 1, 6) +
    capped('threat', 2, 2) +
    capped('dispel', 1, 3) +
    capped('max-hp', 2, 3) +
    capped('party', 1, 8) +
    damageRageSkillCount * 6 +
    tagCounts.size * 0.05 +
    tankRoleClosureBonus
  )
}

function getRoleBalancedActiveSkillGroups(
  skillIds: readonly SkillId[],
  groupSize: number,
  maxGroups = 2,
) {
  if (groupSize <= 0 || skillIds.length <= groupSize) {
    return []
  }

  const groups: SkillId[][] = []
  const selected: SkillId[] = []
  const visit = (startIndex: number) => {
    if (selected.length === groupSize) {
      groups.push([...selected])
      return
    }

    const remaining = groupSize - selected.length
    for (let index = startIndex; index <= skillIds.length - remaining; index += 1) {
      selected.push(skillIds[index])
      visit(index + 1)
      selected.pop()
    }
  }
  visit(0)

  return groups
    .sort((left, right) =>
      getRoleBalancedActiveSkillScore(right) - getRoleBalancedActiveSkillScore(left) ||
      left.join(',').localeCompare(right.join(',')),
    )
    .slice(0, maxGroups)
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
  classId: PlayerClassId,
  options: StrategyTipBuildCandidateOptions = {},
) {
  if (!shouldPreferPassiveHeavyBuildCandidates(stage)) {
    return []
  }

  const maxCandidates = Math.max(1, Math.floor(options.maxCandidates ?? 6))
  const maxActiveSkillCount = Math.max(0, Math.floor(options.maxActiveSkillCount ?? 2))
  const minPassiveTalentCount = Math.max(1, Math.floor(options.minPassiveTalentCount ?? 4))
  const buildRuleId = getStageBuildRuleId(stage)
  const candidates = generateStageBalanceBuilds(stage, classId, {
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

export function generateStageBalanceBuilds(
  stage: StageInfo,
  classId: PlayerClassId,
  options: BalanceBuildGenerationOptions = {},
) {
  const maxActiveBuilds = Math.max(0, Math.floor(options.maxActiveBuilds ?? 20))
  const maxPassiveVariants = Math.max(1, Math.floor(options.maxPassiveVariants ?? 8))

  const buildRuleId = getStageBuildRuleId(stage)
  const rule = getBuildRuleDefinition(buildRuleId)

  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const normalizedDefault = normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule(buildRuleId, classId),
    buildRuleId, classId,
    passiveTier,
    unlockedSkillIds,
    stage.unlockedActiveSkillIds,
  ).build

  const results: BalanceBuildVariant[] = [
    { id: 'default', classId, build: normalizedDefault },
  ]

  const seen = new Set<string>([getBuildSignature(normalizedDefault)])

  if (!rule) {
    return results
  }

  const legalSkillIds = getOrderedLegalActiveSkillIds(buildRuleId, classId, unlockedSkillIds)
  const emptyLoadout = createEmptyLoadoutFromRule(buildRuleId, classId)
  const enabledHotkeys = rule.enabledHotkeys

  let generatedActiveCount = 0
  const appendActiveLoadout = (loadout: SkillLoadout) => {
    if (generatedActiveCount >= maxActiveBuilds) return
    const normalized = normalizePersistedBuildForRule(
      { loadout, passiveTalentIds: [] },
      buildRuleId, classId,
      passiveTier,
      unlockedSkillIds,
      [],
    ).build

    generatedActiveCount += 1
    const passiveVariants = generatePassiveVariants(
      buildRuleId,
      classId,
      normalized.loadout,
      passiveTier,
      maxPassiveVariants,
    )
    for (let passiveIndex = 0; passiveIndex < passiveVariants.length; passiveIndex += 1) {
      const normalizedWithPassives = normalizePersistedBuildForRule(
        { loadout: normalized.loadout, passiveTalentIds: passiveVariants[passiveIndex] },
        buildRuleId, classId,
        passiveTier,
        unlockedSkillIds,
        [],
      ).build

      const variantSignature = getBuildSignature(normalizedWithPassives)
      if (seen.has(variantSignature)) continue
      seen.add(variantSignature)
      results.push({
        id: `generated_${generatedActiveCount}_${passiveIndex}`,
        classId,
        build: normalizedWithPassives,
      })
    }
  }

  const coverageWindowSize = Math.min(rule.maxActiveSlots, enabledHotkeys.length, legalSkillIds.length)
  const coverageWindows: Array<{ startIndex: number; size: number }> = []
  const coverageSignatures = new Set<string>()
  const addCoverageWindow = (startIndex: number, size: number) => {
    if (size <= 0) return
    const boundedStart = Math.max(0, Math.min(startIndex, legalSkillIds.length - size))
    const signature = `${boundedStart}:${size}`
    if (coverageSignatures.has(signature)) return
    coverageSignatures.add(signature)
    coverageWindows.push({ startIndex: boundedStart, size })
  }
  if (coverageWindowSize > 0) {
    const lastFullWindowStart = legalSkillIds.length - coverageWindowSize
    addCoverageWindow(0, coverageWindowSize)
    addCoverageWindow(lastFullWindowStart, coverageWindowSize)
    addCoverageWindow(1, coverageWindowSize)
    addCoverageWindow(lastFullWindowStart - 1, coverageWindowSize)
  }
  for (const size of [coverageWindowSize - 2, Math.ceil(coverageWindowSize / 2), 1]) {
    if (size <= 0 || size >= coverageWindowSize) continue
    addCoverageWindow(0, size)
    addCoverageWindow(legalSkillIds.length - size, size)
  }

  const appendSkillGroup = (skillIds: readonly SkillId[]) => {
    const loadout: SkillLoadout = { ...emptyLoadout }
    for (let slotIndex = 0; slotIndex < skillIds.length; slotIndex += 1) {
      loadout[enabledHotkeys[slotIndex]] = skillIds[slotIndex]
    }
    appendActiveLoadout(loadout)
  }

  for (const { startIndex, size } of coverageWindows.slice(0, 2)) {
    if (generatedActiveCount >= maxActiveBuilds) break
    appendSkillGroup(legalSkillIds.slice(startIndex, startIndex + size))
  }
  for (const skillIds of getRoleBalancedActiveSkillGroups(legalSkillIds, coverageWindowSize)) {
    if (generatedActiveCount >= maxActiveBuilds) break
    appendSkillGroup(skillIds)
  }
  for (const { startIndex, size } of coverageWindows.slice(2)) {
    if (generatedActiveCount >= maxActiveBuilds) break
    appendSkillGroup(legalSkillIds.slice(startIndex, startIndex + size))
  }

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
      appendActiveLoadout(loadout)
    }
  }

  return results
}
