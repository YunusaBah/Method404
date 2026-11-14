import { expect, test } from '@playwright/test'

test('a farmer reaches a first plan in six taps or fewer', async ({ page }) => {
  let taps = 0
  const tap = async (locator) => {
    taps += 1
    await locator.click()
  }

  await page.goto('/')

  // The app has never run here, so it opens on the location step.
  await tap(page.getByRole('button', { name: 'Choose your district' }))
  await tap(page.getByRole('button', { name: 'Banjul' }))

  await expect(page.getByRole('heading', { name: 'Best plan for your farm' })).toBeVisible()

  const seasons = page.getByRole('button', { name: /past seasons/ })
  await expect(seasons.first()).toBeVisible()

  expect(taps).toBeLessThanOrEqual(6)
})

test('the back button closes a sheet instead of leaving the plan', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Choose your district' }).click()
  await page.getByRole('button', { name: 'Banjul' }).click()

  await page.getByRole('button', { name: /past seasons/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.goBack()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Best plan for your farm' })).toBeVisible()
})
