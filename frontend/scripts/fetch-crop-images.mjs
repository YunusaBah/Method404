/**
 * Build-time photo pipeline. Run with `npm run images`.
 *
 * There is deliberately NO runtime image API. Each photo is a real, curated
 * Wikimedia Commons file (see photo-sources.json, picked by eye so a farmer is
 * never shown the wrong plant). We download a 1600px rendition, centre-crop it
 * to 4:3, and write two high-quality WebP sizes:
 *
 *   public/crops/{id}.webp      1280 x 960, quality 0.90  (cards, hero)
 *   public/crops/{id}-sm.webp    320 x 240, quality 0.86  (chips, plan slots)
 *
 * The same run writes attribution to public/crops/CREDITS.md and
 * backend/src/data/photo-credits.json, and syncs the backend catalogue into
 * frontend/src/data/catalogue.json so the app has an offline copy.
 *
 * Requires network access and the installed Google Chrome (Playwright channel
 * 'chrome'). The generated files are committed; the app itself needs neither
 * this script nor the network. Existing photos are skipped, so after changing
 * a source use `--force=id1,id2` to regenerate only those crops and credits.
 */

import { access, copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = path.resolve(ROOT, '../backend')
const OUT = path.join(ROOT, 'public/crops')
const HEADERS = { 'User-Agent': 'FarmShift/1.0 (NASA Space Apps Challenge; educational crop catalogue)' }
const SIZES = [
  { suffix: '', width: 1280, height: 960, quality: 0.9 },
  { suffix: '-sm', width: 320, height: 240, quality: 0.86 },
]

const { sources } = JSON.parse(await readFile(path.join(ROOT, 'scripts/photo-sources.json'), 'utf8'))
const forceArg = process.argv.find((arg) => arg.startsWith('--force='))
const forceIds = new Set(forceArg ? forceArg.slice('--force='.length).split(',') : [])
await mkdir(OUT, { recursive: true })

function plain(value) {
  return (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry(work, label) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      const retryable = /429|5\d\d|fetch failed|aborted/i.test(error.message)
      if (!retryable || attempt === 4) throw error
      const wait = 1500 * 2 ** attempt
      console.log(`${label}: ${error.message}, retrying in ${wait / 1000}s`)
      await pause(wait)
    }
  }
  return null
}

async function imageInfo(title) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
    '&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=1600&titles=' +
    encodeURIComponent(title)
  const response = await withRetry(async () => {
    const result = await fetch(url, { headers: HEADERS })
    if (!result.ok) throw new Error(`Commons API returned ${result.status}`)
    return result
  }, title)
  const data = await response.json()
  const page = Object.values(data.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!info) throw new Error(`No image info for ${title}`)
  const meta = info.extmetadata ?? {}
  return {
    url: info.thumburl || info.url,
    originalWidth: info.width,
    originalHeight: info.height,
    artist: plain(meta.Artist?.value) || 'Unknown author',
    licence: plain(meta.LicenseShortName?.value) || 'See source page',
    licenceUrl: meta.LicenseUrl?.value ?? '',
    descriptionUrl: info.descriptionurl,
  }
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto('about:blank')

async function convert(buffer, mime, width, height, quality) {
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`
  const result = await page.evaluate(
    async ({ src, w, h, q }) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
      const sw = w / scale
      const sh = h / scale
      ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h)
      return canvas.toDataURL('image/webp', q)
    },
    { src: dataUrl, w: width, h: height, q: quality },
  )
  return Buffer.from(result.split(',')[1], 'base64')
}

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

const CREDITS_FILE = path.join(BACKEND, 'src/data/photo-credits.json')
const previous = JSON.parse(
  await readFile(CREDITS_FILE, 'utf8').catch(() => '{}'),
)
const credits = { ...previous }

for (const [id, source] of Object.entries(sources)) {
  const done = await exists(path.join(OUT, `${id}.webp`)) && await exists(path.join(OUT, `${id}-sm.webp`))
  // Resume: keep both the images and their attribution from an earlier run.
  if (done && credits[id] && !forceIds.has(id)) {
    console.log(`${id.padEnd(14)} already generated`)
    continue
  }

  const info = await imageInfo(source.title)
  const response = await withRetry(async () => {
    const result = await fetch(info.url, { headers: HEADERS })
    if (!result.ok) throw new Error(`${id}: download failed (${result.status})`)
    return result
  }, id)
  const mime = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  const original = Buffer.from(await response.arrayBuffer())

  for (const size of SIZES) {
    const output = await convert(original, mime, size.width, size.height, size.quality)
    await writeFile(path.join(OUT, `${id}${size.suffix}.webp`), output)
  }

  credits[id] = {
    title: source.title,
    author: info.artist,
    licence: info.licence,
    licenceUrl: info.licenceUrl,
    source: info.descriptionUrl || source.descriptionUrl,
    originalSize: `${info.originalWidth}x${info.originalHeight}`,
  }
  await writeFile(CREDITS_FILE, `${JSON.stringify(credits, null, 2)}\n`)
  console.log(`${id.padEnd(14)} ${info.originalWidth}x${info.originalHeight}  ${info.licence}`)
  await pause(900)
}

await browser.close()

await writeFile(path.join(BACKEND, 'src/data/photo-credits.json'), `${JSON.stringify(credits, null, 2)}\n`)

const lines = [
  '# Crop photograph credits',
  '',
  'These are real photographs from Wikimedia Commons, chosen by eye for each crop.',
  'Generated by `npm run images`. Each entry keeps the author, licence and source page.',
  'If you reuse this project, keep this file and follow the individual licences',
  '(several are CC BY-SA, which requires attribution and share-alike).',
  '',
  '| Crop | Author | Licence | Source |',
  '| --- | --- | --- | --- |',
]
for (const [id, credit] of Object.entries(credits)) {
  const author = credit.author.replace(/\|/g, '\\|').slice(0, 90)
  lines.push(`| ${id} | ${author} | ${credit.licence} | [Commons file](${credit.source}) |`)
}
lines.push('')
await writeFile(path.join(OUT, 'CREDITS.md'), `${lines.join('\n')}\n`)

await copyFile(
  path.join(BACKEND, 'src/data/crops.json'),
  path.join(ROOT, 'src/data/catalogue.json'),
)

// The old AI-generated stand-ins are replaced once every new file exists.
for (const file of await readdir(OUT)) {
  if (file.endsWith('.jpg')) await unlink(path.join(OUT, file))
}

console.log(`\nWrote ${Object.keys(credits).length} crops, two sizes each, plus credits and the synced catalogue.`)
