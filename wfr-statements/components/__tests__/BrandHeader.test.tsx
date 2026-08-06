import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandHeader } from '../BrandHeader'

describe('BrandHeader', () => {
  it('renders the WFR logo with accessible alt text', () => {
    render(<BrandHeader />)
    expect(screen.getByAltText('Wrong Fuel Rescue')).toBeInTheDocument()
  })

  it('renders a subtitle when given one', () => {
    render(<BrandHeader subtitle="Fortnightly Work Statement" />)
    expect(screen.getByText('Fortnightly Work Statement')).toBeInTheDocument()
  })
})
