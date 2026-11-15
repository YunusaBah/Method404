import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppDataProvider } from '../src/context/AppData'
import { CropCard } from '../src/components/CropCard'
import { LocationForm } from '../src/components/LocationForm'
import { MonthStrip } from '../src/components/MonthStrip'
import { MonthCalendar } from '../src/components/MonthCalendar'
import { LanguageMenu } from '../src/components/LanguageMenu'
import { climate, cowpea, maize, millet } from './fixtures'

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (originalGeolocation) {
    Object.defineProperty(navigator, 'geolocation', originalGeolocation)
  } else {
    delete navigator.geolocation
  }
})

describe('LocationForm', () => {
  it('uses the browser location after a place search fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ matches: [] }),
      }),
    )
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success, _failure, options) => {
          expect(options).toEqual({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 })
          success({ coords: { latitude: 13.6, longitude: -14.9 } })
        }),
      },
    })
    const onPlace = vi.fn()
    render(
      <AppDataProvider>
        <LocationForm onPlace={onPlace} />
      </AppDataProvider>,
    )

    fireEvent.change(screen.getByLabelText('Where is your field?'), {
      target: { value: 'unknown village' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Show my crops' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use my location')

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    await waitFor(() => {
      expect(onPlace).toHaveBeenCalledWith({
        id: 'kuntaur',
        name: 'Kuntaur',
        lat: 13.6,
        lon: -14.9,
      })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Where is your field?')).toHaveValue('Kuntaur')
  })

  it('explains when a browser blocks access to location', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) => error({ code: 1 }),
      },
    })
    render(
      <AppDataProvider>
        <LocationForm onPlace={vi.fn()} />
      </AppDataProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Location access is blocked. Allow it in your browser settings, or choose a district below.',
    )
  })

  it('explains when the GPS request times out', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) => error({ code: 3 }),
      },
    })
    render(
      <AppDataProvider>
        <LocationForm onPlace={vi.fn()} />
      </AppDataProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Finding your location took too long. Try again or choose a district below.',
    )
  })

  it('does not use an invalid GPS fix', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success) =>
          success({ coords: { latitude: Number.NaN, longitude: -14.9 } }),
      },
    })
    const onPlace = vi.fn()
    render(
      <AppDataProvider>
        <LocationForm onPlace={onPlace} />
      </AppDataProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your location could not be determined.',
    )
    expect(onPlace).not.toHaveBeenCalled()
  })
})

describe('MonthStrip', () => {
  it('draws one cell per month and names each one for screen readers', () => {
    render(<MonthStrip months={cowpea.months} bestMonth={7} language="en" />)

    const cells = screen.getAllByRole('listitem')
    expect(cells).toHaveLength(12)
    expect(screen.getByRole('listitem', { name: 'July: Good' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'January: Not suitable' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'September: Possible' })).toBeInTheDocument()
  })

  it('explains the three shades in a legend', () => {
    render(<MonthStrip months={cowpea.months} bestMonth={7} language="en" />)
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Possible')).toBeInTheDocument()
    expect(screen.getByText('Not suitable')).toBeInTheDocument()
  })
})

describe('CropCard', () => {
  it('shows the photo, the name and the match badge', () => {
    render(<CropCard crop={cowpea} rank={1} language="en" isBest />)

    expect(screen.getByRole('heading', { name: 'Cowpea' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Cowpea' })).toHaveAttribute('src', '/crops/cowpea.webp')
    expect(screen.getByText('Best match')).toBeInTheDocument()
  })

  it('shows the weather that suits the crop', () => {
    render(<CropCard crop={cowpea} rank={2} language="en" />)

    expect(screen.getByText('Rain in July')).toBeInTheDocument()
    expect(screen.getByText('793 mm')).toBeInTheDocument()
    expect(screen.getByText('28.9 °C')).toBeInTheDocument()
    expect(screen.getByText('5 days')).toBeInTheDocument()
    expect(screen.getByText('77% match')).toBeInTheDocument()
  })

  it('explains a crop the rain does not reach', () => {
    render(<CropCard crop={maize} rank={3} language="en" />)

    expect(screen.getByText('41% match')).toBeInTheDocument()
    expect(screen.getByText(/The rain misses it/)).toBeInTheDocument()
  })

  it('offers to read the card aloud only when speech is available', () => {
    const { rerender } = render(<CropCard crop={cowpea} rank={1} language="en" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    rerender(<CropCard crop={cowpea} rank={1} language="en" onSpeak={() => {}} />)
    expect(screen.getByRole('button', { name: 'Listen — Cowpea' })).toBeInTheDocument()
  })
})

describe('MonthCalendar', () => {
  it('lists the crops that suit each month', () => {
    render(
      <AppDataProvider>
        <MonthCalendar crops={[cowpea, millet]} climate={climate} language="en" />
      </AppDataProvider>,
    )

    const july = screen.getByText('July').closest('li')
    expect(within(july).getByText('Cowpea')).toBeInTheDocument()
    expect(within(july).getByText('Millet')).toBeInTheDocument()
  })

  it('folds a run of empty months into a single row', () => {
    render(
      <AppDataProvider>
        <MonthCalendar crops={[cowpea, millet]} climate={climate} language="en" />
      </AppDataProvider>,
    )

    const dry = screen.getByText('January – May').closest('li')
    expect(within(dry).getByText('Too dry or too hot for the crops we know.')).toBeInTheDocument()
    expect(within(dry).getByText('11 mm over 5 months')).toBeInTheDocument()
    expect(screen.queryByText('March')).not.toBeInTheDocument()
  })

  it('shows the rainfall beside each month', () => {
    render(
      <AppDataProvider>
        <MonthCalendar crops={[cowpea]} climate={climate} language="en" />
      </AppDataProvider>,
    )

    const august = screen.getByText('August').closest('li')
    expect(within(august).getByText('304 mm')).toBeInTheDocument()
  })
})

describe('LanguageMenu', () => {
  const setup = () => {
    const onSelect = vi.fn()
    render(
      <LanguageMenu
        language="en"
        onSelect={onSelect}
        label="Language"
        chooseLabel="Choose a language"
        pendingLabel="Mandinka is shown in English until a native-reviewed translation is available."
      />,
    )
    return { onSelect }
  }

  it('opens a list of the four languages', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
    expect(options.map((option) => option.textContent)).toEqual([
      'English',
      'MandinkaEN',
      'Wolof',
      'Pulaar',
    ])
  })

  it('marks English as selected and only Mandinka as untranslated', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))

    expect(screen.getByRole('option', { name: /English/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByTitle('Mandinka is shown in English until a native-reviewed translation is available.')).toHaveLength(1)
  })

  it('reports the chosen language', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByRole('option', { name: /Wolof/ }))

    expect(onSelect).toHaveBeenCalledWith('wo')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
