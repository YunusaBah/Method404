// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../src/i18n/en.json'
import { PRIORITIES, SOILS } from '../src/data/traits'

const root = resolve(process.cwd(), 'src')

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...walk(full))
    } else if (/\.jsx?$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

const sources = walk(root).map((file) => ({
  file: file.slice(root.length + 1),
  text: readFileSync(file, 'utf8'),
}))

describe('user-facing strings', () => {
  it('never hardcodes text in an accessible attribute', () => {
    const offenders = []
    for (const source of sources) {
      const matches = source.text.match(
        /\b(aria-label|placeholder|alt|title)="[^"]*[A-Za-z][^"]*"/g,
      )
      if (matches) offenders.push(`${source.file}: ${matches.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('never hardcodes text between tags', () => {
    const offenders = []
    for (const source of sources) {
      const matches = source.text.match(/(?<![=/])>\s*[A-Za-z][A-Za-z ,.'-]{2,}\s*</g)
      if (matches) offenders.push(`${source.file}: ${matches.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('only references keys that exist in the English dictionary', () => {
    const missing = new Set()
    for (const source of sources) {
      const patterns = [
        /\bt\(\s*'([^']+)'/g,
        /\bt\(\s*"([^"]+)"/g,
        /\btranslate\(\s*[^,]+,\s*'([^']+)'/g,
      ]
      for (const pattern of patterns) {
        for (const match of source.text.matchAll(pattern)) {
          if (!(match[1] in en)) missing.add(`${source.file}: ${match[1]}`)
        }
      }
    }
    expect([...missing]).toEqual([])
  })

  it('has a word for every month and every month status', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(en[`month.${month}`]).toBeTruthy()
      expect(en[`month.short.${month}`]).toBeTruthy()
    }
    for (const status of ['good', 'marginal', 'poor']) {
      expect(en[`status.${status}`]).toBeTruthy()
    }
  })

  it('has a word for every soil, priority, rotation reason and explainer step', () => {
    for (const soil of SOILS) {
      expect(en[`setup.soil.${soil}`]).toBeTruthy()
      expect(en[`setup.soil.${soil}Hint`]).toBeTruthy()
    }
    for (const priority of PRIORITIES) {
      expect(en[`setup.priority.${priority}`]).toBeTruthy()
    }
    for (let step = 1; step <= 4; step += 1) {
      expect(en[`rotation.why.${step}`]).toBeTruthy()
    }
    for (const note of ['short', 'legumeFirst', 'legume', 'noLegume', 'builds', 'repeat', 'variety', 'soil', 'cover']) {
      expect(en[`rotation.note.${note}`]).toBeTruthy()
    }
  })

  it('has no leftover wizard strings', () => {
    const stale = Object.keys(en).filter((key) => /^(swap|season|why\.numbers)\./.test(key))
    expect(stale).toEqual([])
  })
})
