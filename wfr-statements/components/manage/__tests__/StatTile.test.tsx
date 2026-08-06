import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatTile } from '../StatTile'

describe('StatTile', () => {
  it('renders its label and value', () => {
    render(<StatTile label="Total payable" value="$1,069.99" />)
    expect(screen.getByText('Total payable')).toBeInTheDocument()
    expect(screen.getByText('$1,069.99')).toBeInTheDocument()
  })

  it('renders a hint when given one', () => {
    render(<StatTile label="Submitted" value="1 of 21" hint="20 outstanding" />)
    expect(screen.getByText('20 outstanding')).toBeInTheDocument()
  })

  it('renders no hint element when none is given', () => {
    const { container } = render(<StatTile label="GST" value="$92.73" />)
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('marks a tile as a problem when told to', () => {
    render(<StatTile label="Unclaimable GST" value="$92.73" tone="problem" />)
    expect(screen.getByText('$92.73')).toHaveStyle({ color: 'var(--wfr-error)' })
  })
})
