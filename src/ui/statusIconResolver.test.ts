import { describe, expect, it } from 'vitest'
import { resolveIconAssetUrl, sanitizeIconAssetKey } from './statusIconResolver'

describe('statusIconResolver', () => {
  it('uses the registered icon type instead of a caller-selected folder', () => {
    expect(resolveIconAssetUrl('taunt')).toBe('/skill-icons/taunt.svg')
    expect(resolveIconAssetUrl('vitalReserve')).toBe('/status-icons/guarded.svg')
    expect(resolveIconAssetUrl('taunted')).toBe('/status-icons/taunted.svg')
  })

  it('sanitizes unsafe asset keys and returns null for unknown icons', () => {
    expect(sanitizeIconAssetKey('../bad key')).toBe('---bad-key')
    expect(resolveIconAssetUrl('missing-icon')).toBeNull()
  })
})
