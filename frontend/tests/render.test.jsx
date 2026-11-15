// @vitest-environment node
// Server-rendered checks for the pieces that also have jsdom tests. They need
// no DOM, so they still run on hosts where a jsdom worker cannot start.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppDataContext } from '../src/context/context'
import { translate } from '../src/i18n'
import { MonthCalendar } from '../src/components/MonthCalendar'
import { YearSummary } from '../src/components/YearSummary'
import { CropCard } from '../src/components/CropCard'
import { climate, cowpea, millet } from './fixtures'

const context = {
  t: (key, params) => translate('en', key, params),
  language: 'en',
}

function render(element) {
  return renderToStaticMarkup(
    <AppDataContext.Provider value={context}>{element}</AppDataContext.Provider>,
  )
}

describe('MonthCalendar rendered', () => {
  const html = render(
    <MonthCalendar crops={[cowpea, millet]} climate={climate} language="en" />,
  )

  it('shows a single range for the dry months', () => {
    expect(html).toContain('January – May')
    expect(html).toContain('11 mm over 5 months')
    expect(html).toContain('cal--dry')
    expect(html).not.toContain('>March<')
  })

  it('still shows the months that have something to sow', () => {
    expect(html).toContain('July')
    expect(html).toContain('304 mm')
    expect(html).toContain('Cowpea')
  })
})

describe('YearSummary rendered', () => {
  it('summarises the sowing windows for a later year', () => {
    const html = render(
      <YearSummary crops={[cowpea, millet]} climate={climate} language="en" />,
    )

    expect(html).toContain('June')
    expect(html).toContain('Cowpea')
    expect(html).toContain('window__months')
  })
})

describe('CropCard rendered', () => {
  it('only shows a soil verdict when the ranking supplies one', () => {
    expect(render(<CropCard crop={cowpea} rank={1} language="en" />)).not.toContain('Suits your soil')
    expect(
      render(<CropCard crop={{ ...cowpea, fit: 'good' }} rank={1} language="en" />),
    ).toContain('Suits your soil')
    expect(
      render(<CropCard crop={{ ...cowpea, fit: 'poor' }} rank={1} language="en" />),
    ).toContain('May struggle in your soil')
  })
})
