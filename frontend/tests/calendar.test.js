// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { groupMonths } from '../src/lib/calendar'
import { climate, cowpea, maize, millet, sorghum } from './fixtures'

const rows = (crops) => groupMonths(crops, climate)

describe('groupMonths', () => {
  it('keeps a month with something to sow as its own row', () => {
    const july = rows([cowpea, millet]).find((row) => row.type === 'sow' && row.from === 7)

    expect(july.to).toBe(7)
    expect(july.crops.map((crop) => crop.id)).toEqual(['cowpea', 'millet'])
    expect(july.rain).toBe(219)
  })

  it('puts the highest scoring crop first', () => {
    const july = rows([millet, cowpea]).find((row) => row.type === 'sow' && row.from === 7)

    expect(july.crops.map((crop) => crop.score)).toEqual([77, 64])
  })

  it('folds a run of empty months into one range and adds their rain', () => {
    const [first] = rows([cowpea, millet])

    expect(first).toMatchObject({ type: 'dry', from: 1, to: 5 })
    expect(first.rain).toBe(2 + 2 + 2 + 1 + 4)
  })

  it('does not fold across a month that has something to sow', () => {
    const dry = rows([cowpea, millet]).filter((row) => row.type === 'dry')

    expect(dry.map((row) => [row.from, row.to])).toEqual([
      [1, 5],
      [9, 12],
    ])
  })

  it('returns a single row when nothing can be sown all year', () => {
    const empty = groupMonths([], climate)

    expect(empty).toHaveLength(1)
    expect(empty[0]).toMatchObject({ type: 'dry', from: 1, to: 12 })
    expect(empty[0].rain).toBe(climate.reduce((total, month) => total + month.rainMm, 0))
  })

  it('never loses or repeats a month', () => {
    const months = rows([cowpea, millet, maize, sorghum]).flatMap((row) =>
      Array.from({ length: row.to - row.from + 1 }, (_, index) => row.from + index),
    )

    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('copes with a crop that has no month data at all', () => {
    const partial = { ...cowpea, months: [] }

    expect(rows([partial]).every((row) => row.type === 'dry')).toBe(true)
  })
})
