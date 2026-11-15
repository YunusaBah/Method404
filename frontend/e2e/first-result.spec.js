import { expect, test } from '@playwright/test'
import { payload, weatherPayload } from '../tests/fixtures.js'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/recommend**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  )
  await page.route('**/api/weather**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(weatherPayload),
    }),
  )
  await page.route('**/api/places**', (route) => {
    const url = new URL(route.request().url())
    const query = (url.searchParams.get('q') ?? '').toLowerCase()
    const matches = query.startsWith('banj')
      ? [{ id: 'banjul', name: 'Banjul', region: 'Banjul City', lat: 13.4549, lon: -16.579, score: 100, exact: true }]
      : []
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, queries: [query], matches }),
    })
  })
})

test('a farmer reaches a recommendation in three taps', async ({ page }) => {
  let taps = 0
  const tap = async (locator) => {
    taps += 1
    await locator.click()
  }

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Know what to plant, and when.' })).toBeVisible()

  await tap(page.getByRole('button', { name: 'Banjul' }))

  await expect(page.getByRole('heading', { name: 'Crops for Banjul' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cowpea' })).toBeVisible()
  await expect(page.getByText('Best match')).toBeVisible()

  expect(taps).toBeLessThanOrEqual(3)
})

test('the month strip says which months suit the crop', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Banjul' }).click()

  await expect(page.getByRole('listitem', { name: 'July: Good' }).first()).toBeVisible()
  await expect(page.getByRole('listitem', { name: 'January: Not suitable' }).first()).toBeVisible()
})

test('typing a district works as well as tapping one', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Where is your field?').fill('banj')
  await page.getByRole('button', { name: 'Show my crops' }).click()

  await expect(page.getByRole('heading', { name: 'Crops for Banjul' })).toBeVisible()
})

test('an unknown place is explained instead of failing silently', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Where is your field?').fill('Dakar')
  await page.getByRole('button', { name: 'Show my crops' }).click()

  await expect(page.getByRole('alert')).toContainText('We could not find that place')
})

test('every section is reachable from the tab bar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Banjul' }).click()
  await expect(page.getByRole('heading', { name: 'Crops for Banjul' })).toBeVisible()

  await page.getByRole('link', { name: 'Weather' }).click()
  await expect(page.getByRole('heading', { name: 'Weather for Banjul' })).toBeVisible()
  await expect(page.getByText('1,043 mm')).toBeVisible()

  await page.getByRole('link', { name: 'Crops' }).click()
  await expect(page.getByRole('heading', { name: 'Crops for Banjul' })).toBeVisible()

  await page.getByRole('link', { name: 'Planting' }).click()
  await expect(page.getByRole('heading', { name: 'What to plant, month by month' })).toBeVisible()

  await page.getByRole('link', { name: 'Rotations' }).click()
  await expect(page.getByRole('heading', { name: 'Plan a rotation' })).toBeVisible()
})

test('soil and priorities change the advice, not the weather', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Banjul' }).click()
  await expect(page.getByRole('heading', { name: 'Crops for Banjul' })).toBeVisible()

  await page.getByRole('button', { name: /^Sandy/ }).click()
  await expect(page.getByText('Advice for sandy soil')).toBeVisible()

  await page.getByRole('button', { name: 'Build soil' }).click()
  await expect(page.getByText('ranked for build soil')).toBeVisible()

  const first = page.locator('.crop').first()
  await expect(first.getByRole('heading', { name: 'Cowpea' })).toBeVisible()
  await expect(first.getByText('Suits your soil')).toBeVisible()
})

test('the rotation planner compares two editable plans', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Banjul' }).click()
  await page.getByRole('link', { name: 'Rotations' }).click()

  await expect(page.getByRole('heading', { name: 'Plan A', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plan B', exact: true })).toBeVisible()
  await expect(page.getByText('Better for your priorities')).toBeVisible()

  // Two plans, two years each by default.
  await expect(page.locator('.season__select')).toHaveCount(4)

  // The horizon drives the rotation length: three years means three per plan.
  await page.getByRole('button', { name: '3 years' }).click()
  await expect(page.locator('.season__select')).toHaveCount(6)

  const planA = page.locator('.plan').first()
  const total = planA.locator('.plan__total b')
  const before = await total.textContent()
  await planA.locator('.season__select').nth(1).selectOption('cowpea')
  await expect(total).not.toHaveText(before)

  await expect(page.getByRole('heading', { name: 'Why rotations protect the soil' })).toBeVisible()
})

test('the planting calendar names crops for each month', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Banjul' }).click()
  await page.getByRole('link', { name: 'Planting' }).click()

  await expect(page.getByRole('heading', { name: 'This year' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Next year' })).toBeVisible()

  const july = page.getByRole('listitem').filter({ hasText: 'July' }).first()
  await expect(july.getByText('Cowpea')).toBeVisible()

  const january = page.getByRole('listitem').filter({ hasText: 'January' }).first()
  await expect(january.getByText('Too dry or too hot for the crops we know.')).toBeVisible()

  // A longer horizon adds the year after next as a compact summary.
  await page.getByRole('button', { name: '3 years' }).click()
  await expect(page.getByRole('heading', { name: 'In 2 years' })).toBeVisible()
})

test('the language menu switches language and remembers it', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Language' }).click()
  await expect(page.getByRole('option')).toHaveCount(4)

  await page.getByRole('option', { name: /Wolof/ }).click()
  await expect(page.getByRole('button', { name: 'Language' })).toContainText('Wolof')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Language' })).toContainText('Wolof')
})

test('a suggestion is offered when the typed name is close', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Where is your field?').fill('banj')

  await expect(page.getByRole('listbox', { name: 'Did you mean' })).toBeVisible()
  await page.getByRole('option').filter({ hasText: 'Banjul' }).click()

  await expect(page.getByRole('heading', { name: 'Crops for Banjul' })).toBeVisible()
})
