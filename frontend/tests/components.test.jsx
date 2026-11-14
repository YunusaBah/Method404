import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OutcomeSquares } from '../src/components/OutcomeSquares'
import { Sheet } from '../src/components/Sheet'

const outcomes = [
  'good', 'good', 'good', 'poor', 'poor', 'good', 'failed', 'good', 'good', 'poor',
]

describe('outcome squares', () => {
  it('reads out the ten past seasons for screen readers', () => {
    render(<OutcomeSquares outcomes={outcomes} />)
    expect(
      screen.getByRole('img', {
        name: 'Good in 6 of 10 past seasons, poor in 3, failed in 1',
      }),
    ).toBeInTheDocument()
  })

  it('draws one square per season', () => {
    const { container } = render(<OutcomeSquares outcomes={outcomes} />)
    expect(container.querySelectorAll('svg')).toHaveLength(10)
  })
})

describe('sheet', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Sheet onClose={onClose} open title="Why this plan">
        <p>Reason</p>
      </Sheet>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is a modal dialog while it is open', () => {
    render(
      <Sheet onClose={() => {}} open title="Why this plan">
        <p>Reason</p>
      </Sheet>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('renders nothing when closed', () => {
    render(
      <Sheet onClose={() => {}} open={false} title="Why this plan">
        <p>Reason</p>
      </Sheet>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
