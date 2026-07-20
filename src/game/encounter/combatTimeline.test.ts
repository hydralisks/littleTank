import { describe, expect, it } from 'vitest'
import {
  buildCombatTimeline,
  renderCombatTimelineMarkdown,
  summarizeCombatTimeline,
} from './combatTimeline'
import type { CombatLogEvent } from './encounterTypes'

const events: CombatLogEvent[] = [
  {
    id: 'damage-2',
    occurredAtMs: 3000,
    type: 'damage',
    source: { kind: 'enemy', id: 'murloc', name: 'Murloc Scout' },
    target: { kind: 'tank', id: 'tank', name: 'Tank' },
    ability: { kind: 'enemySkill', id: 'stab', name: 'Murloc Stab' },
    amount: 18,
    damageType: 'physical',
  },
  {
    id: 'cast-1',
    occurredAtMs: 1000,
    type: 'cast-started',
    source: { kind: 'enemy', id: 'caster', name: 'Murloc Dartcaster' },
    target: { kind: 'party', id: 'party', name: 'Party' },
    ability: { kind: 'enemySkill', id: 'upgrade', name: 'Murloc Upgrade' },
    castId: 'cast-a',
    enemyId: 'caster',
    enemySkillId: 'upgrade',
    dangerLevel: 'high',
    breakRule: 'interruptOrControl',
  },
  {
    id: 'interrupt-1',
    occurredAtMs: 1800,
    type: 'cast-interrupted',
    source: { kind: 'enemy', id: 'caster', name: 'Murloc Dartcaster' },
    target: { kind: 'enemy', id: 'caster', name: 'Murloc Dartcaster' },
    ability: { kind: 'enemySkill', id: 'upgrade', name: 'Murloc Upgrade' },
    castId: 'cast-a',
    enemyId: 'caster',
    enemySkillId: 'upgrade',
    dangerLevel: 'high',
    breakRule: 'interruptOrControl',
    handlerSkillId: 'warrior_t_interrupt',
    handlerName: 'Pummel',
  },
  {
    id: 'heal-1',
    occurredAtMs: 2400,
    type: 'healing',
    source: { kind: 'player', id: 'player', name: 'Player' },
    target: { kind: 'tank', id: 'tank', name: 'Tank' },
    ability: { kind: 'playerSkill', id: 'ignore-pain', name: 'Ignore Pain' },
    amount: 30,
    rawAmount: 45,
    overhealAmount: 15,
  },
]

describe('combat timeline', () => {
  it('builds compact sorted timeline entries from combat log events', () => {
    const timeline = buildCombatTimeline(events, { limit: 3 })

    expect(timeline.entries).toEqual([
      expect.objectContaining({
        timeMs: 1000,
        type: 'cast-started',
        actor: 'Murloc Dartcaster',
        target: 'Party',
        ability: 'Murloc Upgrade',
        value: 'high interruptOrControl',
      }),
      expect.objectContaining({
        timeMs: 1800,
        type: 'cast-interrupted',
        actor: 'Murloc Dartcaster',
        target: 'Murloc Dartcaster',
        ability: 'Murloc Upgrade',
        value: 'by Pummel',
      }),
      expect.objectContaining({
        timeMs: 2400,
        type: 'healing',
        actor: 'Player',
        target: 'Tank',
        ability: 'Ignore Pain',
        value: '30 raw=45 overheal=15',
      }),
    ])
    expect(timeline.omittedEventCount).toBe(1)
  })

  it('summarizes event counts and important totals', () => {
    const summary = summarizeCombatTimeline(events)

    expect(summary.totalEvents).toBe(4)
    expect(summary.countsByType).toMatchObject({
      damage: 1,
      'cast-started': 1,
      'cast-interrupted': 1,
      healing: 1,
    })
    expect(summary.totals).toMatchObject({
      damage: 18,
      healing: 30,
      rawHealing: 45,
      overhealing: 15,
      highDangerCastStarts: 1,
      interruptedCasts: 1,
    })
  })

  it('renders concise markdown for agent-readable trace files', () => {
    const markdown = renderCombatTimelineMarkdown(buildCombatTimeline(events, { limit: 4 }))

    expect(markdown).toContain('# Combat Timeline Trace')
    expect(markdown).toContain('totalEvents=4')
    expect(markdown).toContain('damage=18')
    expect(markdown).toContain('| 00:01.000 | cast-started | Murloc Dartcaster | Party | Murloc Upgrade | high interruptOrControl |')
    expect(markdown).toContain('| 00:01.800 | cast-interrupted | Murloc Dartcaster | Murloc Dartcaster | Murloc Upgrade | by Pummel |')
  })

  it('can filter low-value automatic ticks for compact agent traces', () => {
    const timeline = buildCombatTimeline([
      {
        id: 'auto-heal',
        occurredAtMs: 500,
        type: 'healing',
        source: { kind: 'partyAutoHeal', id: 'party-auto', name: 'Party Auto Heal' },
        target: { kind: 'tank', id: 'tank', name: 'Tank' },
        ability: { kind: 'autoHeal', id: 'party-auto', name: 'Party Auto Heal' },
        amount: 0.3,
      },
      ...events,
    ], { importantOnly: true, limit: 20 })

    expect(timeline.entries.map((entry) => entry.id)).not.toContain('auto-heal')
    expect(timeline.entries.map((entry) => entry.type)).toEqual([
      'cast-started',
      'cast-interrupted',
      'healing',
      'damage',
    ])
    expect(timeline.filteredEventCount).toBe(1)
  })
})
