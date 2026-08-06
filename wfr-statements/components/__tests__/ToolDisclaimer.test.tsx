import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToolDisclaimer } from '../ToolDisclaimer'
import { TOOL_DISCLAIMER, TOOL_DISCLAIMER_HIGHLIGHT } from '@/lib/invoice/toolDisclaimer'

describe('ToolDisclaimer', () => {
  it('shows the "you don’t have to use this" sentence without anything being opened', () => {
    // The claim that carries the most weight must not depend on a contractor
    // choosing to expand a panel. It sits outside <details> for that reason.
    const { container } = render(<ToolDisclaimer />)
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details).not.toContainElement(screen.getByText(TOOL_DISCLAIMER_HIGHLIGHT))
  })

  it('renders every paragraph of the client’s text, unabridged', () => {
    render(<ToolDisclaimer />)
    for (const paragraph of TOOL_DISCLAIMER) {
      expect(screen.getByText(paragraph)).toBeInTheDocument()
    }
  })

  it('starts collapsed, so the full text never buries the buttons below it', () => {
    const { container } = render(<ToolDisclaimer />)
    expect(container.querySelector('details')).not.toHaveAttribute('open')
  })

  it('labels the panel so a contractor knows what opening it gives them', () => {
    render(<ToolDisclaimer />)
    expect(screen.getByText('About this tool')).toBeInTheDocument()
  })
})
