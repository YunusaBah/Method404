// @vitest-environment node
// The crop catalogue is generated reference data, so check it without a DOM:
// every listed crop must have two real WebP photographs and an attribution.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import catalogue from '../src/data/catalogue.json'
import { cropPhoto, cropThumb } from '../src/data/crops'

const photoDir = fileURLToPath(new URL('../public/crops/', import.meta.url))
const creditsPath = fileURLToPath(new URL('../../backend/src/data/photo-credits.json', import.meta.url))
const publicCredits = readFileSync(join(photoDir, 'CREDITS.md'), 'utf8')
const photoCredits = JSON.parse(readFileSync(creditsPath, 'utf8'))

describe('bundled crop catalogue', () => {
  it('separates seven scored annual crops from browse-only and orchard crops', () => {
    expect(catalogue.crops).toHaveLength(19)
    expect(catalogue.crops.filter((crop) => crop.scored)).toHaveLength(7)
    expect(catalogue.crops.filter((crop) => crop.category === 'annual')).toHaveLength(13)
    expect(catalogue.crops.filter((crop) => crop.category === 'orchard')).toHaveLength(6)

    for (const crop of catalogue.crops) {
      if (!crop.scored) {
        expect(crop.agronomy).toBeNull()
        expect(crop.rotation).toBeNull()
      }
      if (crop.category === 'orchard') expect(crop.scored).toBe(false)
      expect(crop.scientificName).toBeTruthy()
    }
  })

  it('has a large photograph, a thumbnail and attribution for every crop', () => {
    for (const crop of catalogue.crops) {
      expect(existsSync(join(photoDir, `${crop.id}.webp`))).toBe(true)
      expect(existsSync(join(photoDir, `${crop.id}-sm.webp`))).toBe(true)
      expect(cropPhoto(crop.id)).toMatch(new RegExp(`/crops/${crop.id}\\.webp$`))
      expect(cropThumb(crop.id)).toMatch(new RegExp(`/crops/${crop.id}-sm\\.webp$`))
      expect(photoCredits[crop.id]?.author).toBeTruthy()
      expect(photoCredits[crop.id]?.licence).toBeTruthy()
      expect(photoCredits[crop.id]?.source).toMatch(/commons\.wikimedia\.org/)
      expect(publicCredits).toContain(`| ${crop.id} |`)
    }
  })

  it('ships only WebP crop photographs', () => {
    const images = readdirSync(photoDir).filter((file) => /\.(webp|jpe?g|png)$/i.test(file))
    expect(images).toHaveLength(38)
    expect(images.every((file) => file.endsWith('.webp'))).toBe(true)
  })
})
