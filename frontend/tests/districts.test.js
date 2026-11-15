// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DISTRICTS, findDistrict, nearestDistrict } from '../src/data/districts'

describe('districts', () => {
  it('covers all eight local government areas', () => {
    expect(DISTRICTS).toHaveLength(8)
    expect(DISTRICTS.map((district) => district.id)).toContain('banjul')
    expect(DISTRICTS.map((district) => district.id)).toContain('basse')
  })

  it('keeps every point inside The Gambia', () => {
    for (const district of DISTRICTS) {
      expect(district.lat).toBeGreaterThan(13)
      expect(district.lat).toBeLessThan(13.9)
      expect(district.lon).toBeGreaterThan(-17)
      expect(district.lon).toBeLessThan(-13.7)
    }
  })

  it('matches a typed name regardless of case or padding', () => {
    expect(findDistrict('  banjul ')).toMatchObject({ id: 'banjul' })
    expect(findDistrict('BASSE')).toMatchObject({ id: 'basse' })
    expect(findDistrict('kere')).toMatchObject({ id: 'kerewan' })
  })

  it('returns null for a place it does not know', () => {
    expect(findDistrict('Dakar')).toBeNull()
    expect(findDistrict('   ')).toBeNull()
  })

  it('snaps a GPS fix to the closest district', () => {
    const { district, distanceKm } = nearestDistrict(13.4549, -16.579)
    expect(district.id).toBe('banjul')
    expect(distanceKm).toBeLessThan(5)
  })
})
