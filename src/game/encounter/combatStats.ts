import type {
  CombatCastEvent,
  CombatLogActorKind,
  CombatLogEvent,
  DangerLevel,
  EncounterState,
} from './encounterTypes'

export interface StatAmountRow {
  id: string
  sourceName: string
  effectName: string
  category: string
  total: number
  count: number
  average: number
  share: number
}

export interface CastHandlingRow {
  id: string
  enemyName: string
  skillName: string
  dangerLevel: DangerLevel
  interruptedCount: number
  controlledCount: number
  completedCount: number
  unhandleableCount: number
  totalCasts: number
  handlerNames: string[]
}

export interface HealingAbsorbRow extends StatAmountRow {
  kind: 'healing' | 'absorb'
  rawTotal?: number
  overhealTotal?: number
}

export interface EncounterStats {
  durationMs: number
  tankDamageTaken: StatAmountRow[]
  partyDamageTaken: StatAmountRow[]
  pressureGained: StatAmountRow[]
  castHandling: CastHandlingRow[]
  damageDealt: StatAmountRow[]
  playerHealingAndAbsorb: HealingAbsorbRow[]
  partyHealingAndAbsorb: HealingAbsorbRow[]
  healingAndAbsorb: HealingAbsorbRow[]
  enemyHealingAndAbsorb: HealingAbsorbRow[]
  absorbConsumed: StatAmountRow[]
}

interface AmountAccumulator {
  id: string
  sourceName: string
  effectName: string
  category: string
  total: number
  count: number
  rawTotal?: number
  overhealTotal?: number
}

function displayName(name: string | undefined, id: string | undefined, fallback: string) {
  return name ?? id ?? fallback
}

function categoryForDamageDealt(event: CombatLogEvent) {
  if (event.type !== 'damage') {
    return '伤害'
  }

  if (event.source.kind === 'playerAutoAttack') {
    return '玩家自动攻击伤害'
  }

  if (event.source.kind === 'partyAutoAttack') {
    return '队伍自动攻击伤害'
  }

  if (event.source.kind === 'talent' || event.ability?.kind === 'talent') {
    return '天赋伤害'
  }

  return '玩家技能伤害'
}

function categoryForHealingAndAbsorb(event: CombatLogEvent) {
  const suffix = event.type === 'absorb-created' || event.type === 'absorb-consumed' ? '吸收' : '治疗'

  if (event.source.kind === 'partyAutoHeal') {
    return '队伍自动治疗'
  }

  if (event.source.kind === 'enemy') {
    return `敌人${suffix}`
  }

  if (event.source.kind === 'talent' || event.ability?.kind === 'talent') {
    return `天赋${suffix}`
  }

  return `玩家技能${suffix}`
}

function categoryForTankDamage(event: CombatLogEvent) {
  if (event.source.kind === 'status') {
    return '状态'
  }
  if (event.source.kind === 'affix') {
    return '词缀'
  }
  if (event.source.kind === 'stageRule') {
    return '关卡规则'
  }
  return '敌人技能'
}

function categoryForPressure(event: CombatLogEvent) {
  if (event.source.kind === 'status') {
    return '状态'
  }
  if (event.source.kind === 'affix') {
    return '词缀'
  }
  if (event.source.kind === 'stageRule') {
    return '关卡规则'
  }
  return '压力'
}

function categoryForPartyDamage(event: CombatLogEvent) {
  if (event.source.kind === 'status') {
    return '状态'
  }
  if (event.source.kind === 'affix') {
    return '词缀'
  }
  if (event.source.kind === 'stageRule') {
    return '关卡规则'
  }
  return '敌人技能'
}

function addAmount(
  rows: Map<string, AmountAccumulator>,
  event: Extract<CombatLogEvent, { amount: number }>,
  category: string,
) {
  const sourceName = displayName(event.source.name, event.source.id, '未知来源')
  const effectName = displayName(event.ability?.name, event.ability?.id, sourceName)
  const sourceKey = event.source.kind === 'enemy' ? sourceName : event.source.id ?? sourceName
  const key = `${event.type}:${event.source.kind}:${sourceKey}:${event.ability?.kind ?? 'none'}:${event.ability?.id ?? effectName}:${category}`
  const current = rows.get(key) ?? {
    id: key,
    sourceName,
    effectName,
    category,
    total: 0,
    count: 0,
  }

  const rawAmount = event.type === 'healing'
    ? event.rawAmount ?? event.amount
    : undefined
  const overhealAmount = event.type === 'healing'
    ? event.overhealAmount ?? 0
    : undefined

  rows.set(key, {
    ...current,
    total: current.total + event.amount,
    count: current.count + 1,
    ...(rawAmount === undefined ? {} : { rawTotal: (current.rawTotal ?? 0) + rawAmount }),
    ...(overhealAmount === undefined ? {} : { overhealTotal: (current.overhealTotal ?? 0) + overhealAmount }),
  })
}

function toRows<T extends StatAmountRow = StatAmountRow>(
  rows: Map<string, AmountAccumulator>,
  extend?: (row: StatAmountRow) => T,
): T[] {
  const total = [...rows.values()].reduce((sum, row) => sum + row.total, 0)

  return [...rows.values()]
    .map((row) => {
      const amountRow: StatAmountRow = {
        ...row,
        average: row.count > 0 ? row.total / row.count : 0,
        share: total > 0 ? row.total / total : 0,
      }
      return extend ? extend(amountRow) : amountRow as T
    })
    .sort((left, right) => right.total - left.total || left.effectName.localeCompare(right.effectName))
}

function withCombinedShares<T extends StatAmountRow>(rows: T[]): T[] {
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.total / total : 0,
  }))
}

function isPlayerSideDamageSource(kind: CombatLogActorKind) {
  return kind === 'player' ||
    kind === 'playerAutoAttack' ||
    kind === 'party' ||
    kind === 'partyAutoAttack' ||
    kind === 'talent'
}

function castKey(event: CombatCastEvent) {
  return event.castId ?? `${event.enemyId}:${event.enemySkillId}:${event.occurredAtMs}`
}

function dangerRank(value: DangerLevel) {
  if (value === 'high') {
    return 3
  }
  if (value === 'medium') {
    return 2
  }
  return 1
}

function maxDanger(left: DangerLevel, right: DangerLevel) {
  return dangerRank(left) >= dangerRank(right) ? left : right
}

interface CastAccumulator {
  id: string
  enemyName: string
  skillName: string
  dangerLevel: DangerLevel
  interruptedCount: number
  controlledCount: number
  completedCount: number
  unhandleableCount: number
  totalCasts: number
  handlerNames: Set<string>
  firstOccurredAtMs: number
}

function buildCastHandling(events: readonly CombatLogEvent[]): CastHandlingRow[] {
  const casts = new Map<string, { start?: CombatCastEvent, result?: CombatCastEvent }>()

  for (const event of events) {
    if (
      event.type !== 'cast-started' &&
      event.type !== 'cast-resolved' &&
      event.type !== 'cast-interrupted' &&
      event.type !== 'cast-controlled'
    ) {
      continue
    }

    const key = castKey(event)
    const current = casts.get(key) ?? {}

    if (event.type === 'cast-started') {
      casts.set(key, { ...current, start: event })
      continue
    }

    casts.set(key, { ...current, result: event })
  }

  const grouped = new Map<string, CastAccumulator>()

  for (const [, cast] of casts.entries()) {
    const baseEvent = cast.start ?? cast.result
    if (!baseEvent) {
      continue
    }

    const resultEvent = cast.result
    const enemyName = displayName(baseEvent.source.name, baseEvent.enemyId, '未知敌人')
    const skillName = displayName(baseEvent.ability?.name, baseEvent.enemySkillId, '未知技能')
    const groupKey = `${enemyName}:${baseEvent.enemySkillId}:${skillName}`
    const current = grouped.get(groupKey) ?? {
      id: groupKey,
      enemyName,
      skillName,
      dangerLevel: baseEvent.dangerLevel,
      interruptedCount: 0,
      controlledCount: 0,
      completedCount: 0,
      unhandleableCount: 0,
      totalCasts: 0,
      handlerNames: new Set<string>(),
      firstOccurredAtMs: baseEvent.occurredAtMs,
    }

    current.totalCasts += 1
    current.dangerLevel = maxDanger(current.dangerLevel, baseEvent.dangerLevel)
    current.firstOccurredAtMs = Math.min(current.firstOccurredAtMs, baseEvent.occurredAtMs)

    if (resultEvent?.type === 'cast-interrupted') {
      current.interruptedCount += 1
    } else if (resultEvent?.type === 'cast-controlled') {
      current.controlledCount += 1
    } else if (resultEvent?.type === 'cast-resolved' && resultEvent.breakRule === 'unstoppable') {
      current.unhandleableCount += 1
    } else if (resultEvent?.type === 'cast-resolved') {
      current.completedCount += 1
    }

    const handlerName = resultEvent?.handlerName ?? resultEvent?.handlerSkillId ?? null
    if (handlerName) {
      current.handlerNames.add(handlerName)
    }

    grouped.set(groupKey, current)
  }

  return [...grouped.values()]
    .sort((left, right) => {
      const dangerDelta = dangerRank(right.dangerLevel) - dangerRank(left.dangerLevel)
      if (dangerDelta !== 0) {
        return dangerDelta
      }
      return left.firstOccurredAtMs - right.firstOccurredAtMs
    })
    .map((row) => {
      return {
        id: row.id,
        enemyName: row.enemyName,
        skillName: row.skillName,
        dangerLevel: row.dangerLevel,
        interruptedCount: row.interruptedCount,
        controlledCount: row.controlledCount,
        completedCount: row.completedCount,
        unhandleableCount: row.unhandleableCount,
        totalCasts: row.totalCasts,
        handlerNames: [...row.handlerNames].sort((left, right) => left.localeCompare(right)),
      }
    })
}

export function buildEncounterStats(state: EncounterState): EncounterStats {
  const tankDamage = new Map<string, AmountAccumulator>()
  const partyDamage = new Map<string, AmountAccumulator>()
  const pressure = new Map<string, AmountAccumulator>()
  const damageDealt = new Map<string, AmountAccumulator>()
  const healing = new Map<string, AmountAccumulator>()
  const absorb = new Map<string, AmountAccumulator>()
  const playerHealing = new Map<string, AmountAccumulator>()
  const playerAbsorb = new Map<string, AmountAccumulator>()
  const partyHealing = new Map<string, AmountAccumulator>()
  const partyAbsorb = new Map<string, AmountAccumulator>()
  const enemyHealing = new Map<string, AmountAccumulator>()
  const enemyAbsorb = new Map<string, AmountAccumulator>()
  const absorbConsumed = new Map<string, AmountAccumulator>()

  for (const event of state.runtime.combatLog) {
    if (event.type === 'damage' && event.target.kind === 'tank') {
      addAmount(tankDamage, event, categoryForTankDamage(event))
    }

    if (event.type === 'damage' && event.target.kind === 'party') {
      addAmount(partyDamage, event, categoryForPartyDamage(event))
    }

    if (event.type === 'pressure' && event.target.kind === 'party') {
      addAmount(pressure, event, categoryForPressure(event))
    }

    if (event.type === 'damage' && event.target.kind === 'enemy' && isPlayerSideDamageSource(event.source.kind)) {
      addAmount(damageDealt, event, categoryForDamageDealt(event))
    }

    if (event.type === 'healing') {
      addAmount(event.source.kind === 'enemy' ? enemyHealing : healing, event, categoryForHealingAndAbsorb(event))
      if (event.source.kind !== 'enemy') {
        addAmount(event.target.kind === 'party' ? partyHealing : playerHealing, event, categoryForHealingAndAbsorb(event))
      }
    }

    if (event.type === 'absorb-created') {
      addAmount(event.source.kind === 'enemy' ? enemyAbsorb : absorb, event, categoryForHealingAndAbsorb(event))
      if (event.source.kind !== 'enemy') {
        addAmount(event.target.kind === 'party' ? partyAbsorb : playerAbsorb, event, categoryForHealingAndAbsorb(event))
      }
    }

    if (event.type === 'absorb-consumed') {
      addAmount(absorbConsumed, event, categoryForHealingAndAbsorb(event))
    }
  }

  const healingAndAbsorb = withCombinedShares([
    ...toRows<HealingAbsorbRow>(healing, (row) => ({ ...row, kind: 'healing' })),
    ...toRows<HealingAbsorbRow>(absorb, (row) => ({ ...row, kind: 'absorb' })),
  ]).sort((left, right) => right.total - left.total || left.effectName.localeCompare(right.effectName))
  const playerHealingAndAbsorb = withCombinedShares([
    ...toRows<HealingAbsorbRow>(playerHealing, (row) => ({ ...row, kind: 'healing' })),
    ...toRows<HealingAbsorbRow>(playerAbsorb, (row) => ({ ...row, kind: 'absorb' })),
  ]).sort((left, right) => right.total - left.total || left.effectName.localeCompare(right.effectName))
  const partyHealingAndAbsorb = withCombinedShares([
    ...toRows<HealingAbsorbRow>(partyHealing, (row) => ({ ...row, kind: 'healing' })),
    ...toRows<HealingAbsorbRow>(partyAbsorb, (row) => ({ ...row, kind: 'absorb' })),
  ]).sort((left, right) => right.total - left.total || left.effectName.localeCompare(right.effectName))
  const enemyHealingAndAbsorb = withCombinedShares([
    ...toRows<HealingAbsorbRow>(enemyHealing, (row) => ({ ...row, kind: 'healing' })),
    ...toRows<HealingAbsorbRow>(enemyAbsorb, (row) => ({ ...row, kind: 'absorb' })),
  ]).sort((left, right) => right.total - left.total || left.effectName.localeCompare(right.effectName))

  return {
    durationMs: state.timeMs,
    tankDamageTaken: toRows(tankDamage),
    partyDamageTaken: toRows(partyDamage),
    pressureGained: toRows(pressure),
    castHandling: buildCastHandling(state.runtime.combatLog),
    damageDealt: toRows(damageDealt),
    playerHealingAndAbsorb,
    partyHealingAndAbsorb,
    healingAndAbsorb,
    enemyHealingAndAbsorb,
    absorbConsumed: toRows(absorbConsumed),
  }
}
