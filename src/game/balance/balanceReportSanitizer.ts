export function stripCombatLogTraceFromBalanceReport<T>(report: T): T {
  return stripCombatLogTrace(report) as T
}

function stripCombatLogTrace(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripCombatLogTrace)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'combatLogTrace')
      .map(([key, nestedValue]) => [key, stripCombatLogTrace(nestedValue)]),
  )
}
