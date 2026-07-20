import type { CombatLogActor, CombatLogEvent } from './encounterTypes'

export interface CombatTimelineEntry {
  id: string
  timeMs: number
  type: CombatLogEvent['type']
  actor: string
  target: string
  ability: string
  value: string
}

export interface CombatTimelineSummary {
  totalEvents: number
  countsByType: Partial<Record<CombatLogEvent['type'], number>>
  totals: {
    damage: number
    pressure: number
    healing: number
    rawHealing: number
    overhealing: number
    absorbCreated: number
    absorbConsumed: number
    highDangerCastStarts: number
    interruptedCasts: number
    controlledCasts: number
    resolvedCasts: number
  }
}

export interface CombatTimeline {
  summary: CombatTimelineSummary
  entries: CombatTimelineEntry[]
  omittedEventCount: number
  filteredEventCount: number
}

export interface BuildCombatTimelineOptions {
  limit?: number
  importantOnly?: boolean
}

const DEFAULT_TIMELINE_LIMIT = 80

function actorName(actor: CombatLogActor) {
  return actor.name || actor.id || actor.kind
}

function abilityName(event: CombatLogEvent) {
  return event.ability?.name || event.ability?.id || event.type
}

function formatAmount(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function eventValue(event: CombatLogEvent) {
  switch (event.type) {
    case 'damage':
      return event.damageType ? `${formatAmount(event.amount)} ${event.damageType}` : formatAmount(event.amount)
    case 'pressure':
      return formatAmount(event.amount)
    case 'healing':
      return [
        formatAmount(event.amount),
        event.rawAmount === undefined ? null : `raw=${formatAmount(event.rawAmount)}`,
        event.overhealAmount === undefined ? null : `overheal=${formatAmount(event.overhealAmount)}`,
      ].filter(Boolean).join(' ')
    case 'absorb-created':
    case 'absorb-consumed':
      return formatAmount(event.amount)
    case 'cast-started':
    case 'cast-resolved':
    case 'cast-controlled':
      return `${event.dangerLevel} ${event.breakRule}`
    case 'cast-interrupted':
      return event.handlerName || event.handlerSkillId ? `by ${event.handlerName || event.handlerSkillId}` : `${event.dangerLevel} ${event.breakRule}`
    default:
      return ''
  }
}

function isLowValueAutomaticTick(event: CombatLogEvent) {
  if (event.type !== 'healing' && event.type !== 'damage' && event.type !== 'absorb-consumed') {
    return false
  }

  const sourceKind = event.source.kind
  const abilityKind = event.ability?.kind
  const isAutomatic = sourceKind === 'partyAutoHeal' ||
    sourceKind === 'partyAutoAttack' ||
    sourceKind === 'playerAutoAttack' ||
    abilityKind === 'autoHeal' ||
    abilityKind === 'autoAttack'

  return isAutomatic && event.amount < 1
}

function isImportantEvent(event: CombatLogEvent) {
  if (event.type.startsWith('cast-') || event.type === 'pressure') {
    return true
  }

  return !isLowValueAutomaticTick(event)
}

function toEntry(event: CombatLogEvent): CombatTimelineEntry {
  return {
    id: event.id,
    timeMs: event.occurredAtMs,
    type: event.type,
    actor: actorName(event.source),
    target: actorName(event.target),
    ability: abilityName(event),
    value: eventValue(event),
  }
}

export function summarizeCombatTimeline(events: readonly CombatLogEvent[]): CombatTimelineSummary {
  const summary: CombatTimelineSummary = {
    totalEvents: events.length,
    countsByType: {},
    totals: {
      damage: 0,
      pressure: 0,
      healing: 0,
      rawHealing: 0,
      overhealing: 0,
      absorbCreated: 0,
      absorbConsumed: 0,
      highDangerCastStarts: 0,
      interruptedCasts: 0,
      controlledCasts: 0,
      resolvedCasts: 0,
    },
  }

  for (const event of events) {
    summary.countsByType[event.type] = (summary.countsByType[event.type] ?? 0) + 1

    switch (event.type) {
      case 'damage':
        summary.totals.damage += event.amount
        break
      case 'pressure':
        summary.totals.pressure += event.amount
        break
      case 'healing':
        summary.totals.healing += event.amount
        summary.totals.rawHealing += event.rawAmount ?? event.amount
        summary.totals.overhealing += event.overhealAmount ?? 0
        break
      case 'absorb-created':
        summary.totals.absorbCreated += event.amount
        break
      case 'absorb-consumed':
        summary.totals.absorbConsumed += event.amount
        break
      case 'cast-started':
        if (event.dangerLevel === 'high') {
          summary.totals.highDangerCastStarts += 1
        }
        break
      case 'cast-interrupted':
        summary.totals.interruptedCasts += 1
        break
      case 'cast-controlled':
        summary.totals.controlledCasts += 1
        break
      case 'cast-resolved':
        summary.totals.resolvedCasts += 1
        break
    }
  }

  return summary
}

export function buildCombatTimeline(
  events: readonly CombatLogEvent[],
  options: BuildCombatTimelineOptions = {},
): CombatTimeline {
  const limit = options.limit ?? DEFAULT_TIMELINE_LIMIT
  const filteredEvents = options.importantOnly ? events.filter(isImportantEvent) : [...events]
  const sortedEntries = [...events]
    .filter((event) => filteredEvents.includes(event))
    .sort((left, right) => left.occurredAtMs - right.occurredAtMs || left.id.localeCompare(right.id))
    .map(toEntry)

  return {
    summary: summarizeCombatTimeline(events),
    entries: sortedEntries.slice(0, limit),
    omittedEventCount: Math.max(0, sortedEntries.length - limit),
    filteredEventCount: events.length - filteredEvents.length,
  }
}

function formatTime(ms: number) {
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const milliseconds = ms % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

function formatCounts(counts: CombatTimelineSummary['countsByType']) {
  const entries = Object.entries(counts)
  return entries.length > 0 ? entries.map(([type, count]) => `${type}=${count}`).join(', ') : 'none'
}

function formatTotals(totals: CombatTimelineSummary['totals']) {
  return [
    `damage=${totals.damage}`,
    `pressure=${totals.pressure}`,
    `healing=${totals.healing}`,
    `rawHealing=${totals.rawHealing}`,
    `overhealing=${totals.overhealing}`,
    `absorbCreated=${totals.absorbCreated}`,
    `absorbConsumed=${totals.absorbConsumed}`,
    `highDangerCastStarts=${totals.highDangerCastStarts}`,
    `interruptedCasts=${totals.interruptedCasts}`,
    `controlledCasts=${totals.controlledCasts}`,
    `resolvedCasts=${totals.resolvedCasts}`,
  ].join(', ')
}

export function renderCombatTimelineMarkdown(timeline: CombatTimeline) {
  const lines = [
    '# Combat Timeline Trace',
    '',
    `summary: totalEvents=${timeline.summary.totalEvents}, omittedEvents=${timeline.omittedEventCount}`,
    `counts: ${formatCounts(timeline.summary.countsByType)}`,
    `totals: ${formatTotals(timeline.summary.totals)}`,
    '',
    '| Time | Type | Source | Target | Ability | Value |',
    '| --- | --- | --- | --- | --- | --- |',
    ...timeline.entries.map((entry) =>
      `| ${formatTime(entry.timeMs)} | ${entry.type} | ${entry.actor} | ${entry.target} | ${entry.ability} | ${entry.value} |`,
    ),
  ]

  return `${lines.join('\n').trimEnd()}\n`
}
