import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from '../src/i18n/en.json'

const root = fileURLToPath(new URL('../src', import.meta.url))

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
      const matches = source.text.match(/>\s*[A-Za-z][A-Za-z ,.'-]{2,}\s*</g)
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
        /\btranslate\(\s*'[a-z]+',\s*'([^']+)'/g,
      ]
      for (const pattern of patterns) {
        for (const match of source.text.matchAll(pattern)) {
          if (!(match[1] in en)) missing.add(`${source.file}: ${match[1]}`)
        }
      }
    }
    expect([...missing]).toEqual([])
  })
})
