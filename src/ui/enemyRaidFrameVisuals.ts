import type { EnemyState } from '../game/encounter/encounterTypes'

export function isHighDangerCastVisual(enemy: EnemyState) {
  if (!enemy.cast || enemy.hp <= 0) {
    return false
  }

  return (
    enemy.cast.dangerLevel === 'high' ||
    (enemy.cast.dangerLevel === 'medium' && enemy.cast.target === 'party')
  )
}

export function getEnemyCastFillPercent(enemy: EnemyState) {
  if (!enemy.cast) {
    return 100
  }

  if (enemy.cast.totalMs <= 0) {
    return enemy.cast.phase === 'channeling' ? 0 : 100
  }

  const progress = Math.round((enemy.cast.remainingMs / enemy.cast.totalMs) * 100)

  return enemy.cast.phase === 'channeling'
    ? Math.max(0, Math.min(100, progress))
    : Math.max(10, 100 - progress)
}
