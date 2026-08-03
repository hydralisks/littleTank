import { describe, expect, it } from 'vitest'
import { resolveIconAssetUrl, resolveStatusIconUrl, sanitizeIconAssetKey } from './statusIconResolver'

describe('statusIconResolver', () => {
  it('uses the registered icon type instead of a caller-selected folder', () => {
    expect(resolveIconAssetUrl('taunt')).toBe('/skill-icons/taunt.svg')
    expect(resolveIconAssetUrl('vitalReserve')).toBe('/status-icons/guarded.svg')
    expect(resolveIconAssetUrl('taunted')).toBe('/status-icons/taunted.svg')
  })

  it('keeps colliding skill and status registrations in their own asset folders', () => {
    expect(resolveIconAssetUrl('shieldWall')).toBe('/skill-icons/shieldWall.svg')
    expect(resolveStatusIconUrl({ id: 'shieldWall', iconId: 'shieldWall' }))
      .toBe('/status-icons/shield-wall.svg')
  })

  it('sanitizes unsafe asset keys and returns null for unknown icons', () => {
    expect(sanitizeIconAssetKey('../bad key')).toBe('---bad-key')
    expect(resolveIconAssetUrl('missing-icon')).toBeNull()
  })
})
