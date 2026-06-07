import type { SkillId } from '../game/encounter/encounterTypes'

export const statusIconMap: Record<string, string> = {
  stable: '/status-icons/stable.svg',
  enraged: '/status-icons/enraged.svg',
  fortified: '/status-icons/fortified.svg',
  weakened: '/status-icons/weakened.svg',
  lurking: '/status-icons/lurking.svg',
  stunned: '/status-icons/stunned.svg',
  taunted: '/status-icons/taunted.svg',
  'mass-taunt': '/status-icons/mass-taunt.svg',
  haste: '/status-icons/haste.svg',
  sundered: '/status-icons/sundered.svg',
  evasion: '/status-icons/evasion.svg',
  silenced: '/status-icons/silenced.svg',
  guarded: '/status-icons/guarded.svg',
  'enrage-song': '/status-icons/enrage-song.svg',
  snared: '/status-icons/snared.svg',
  shieldWall: '/status-icons/shield-wall.svg',
  'vanguard-oath': '/status-icons/vanguard-oath.svg',
  'ember-aegis': '/status-icons/ember-aegis.svg',
  'heat-haze': '/status-icons/heat-haze.svg',
  'battle-seal': '/status-icons/battle-seal.svg',
  suppression: '/status-icons/heat-haze.svg',
  'formation-break': '/status-icons/sundered.svg',
  'chaos-volley': '/status-icons/enrage-song.svg',
}

export const skillIconMap: Record<SkillId, string> = {
  warrior_t_taunt: '/skill-icons/taunt.svg',
  warrior_t_interrupt: '/skill-icons/interrupt.svg',
  warrior_t_stun: '/skill-icons/stun.svg',
  warrior_t_mass_taunt: '/skill-icons/mass-taunt.svg',
  warrior_t_shield_wall: '/skill-icons/shield-wall.svg',
  warrior_t_cleave: '/skill-icons/cleave.svg',
  warrior_t_burst: '/skill-icons/burst.svg',
  warrior_t_last_stand: '/skill-icons/panic.svg',
  taunt: '/skill-icons/taunt.svg',
  interrupt: '/skill-icons/interrupt.svg',
  stun: '/skill-icons/stun.svg',
  massTaunt: '/skill-icons/mass-taunt.svg',
  shieldWall: '/skill-icons/shield-wall.svg',
  cleave: '/skill-icons/cleave.svg',
  burst: '/skill-icons/burst.svg',
  panic: '/skill-icons/panic.svg',
}

export const lockedSkillIcon = '/skill-icons/locked.svg'
