import { describe, it, expect, vi } from 'vitest'
import { createEvent, render, screen, fireEvent } from '@testing-library/react'
import { StatementReview } from '../StatementReview'
import { rollUpTotals } from '@/lib/calc/totals'
import { CONTRACTOR_DECLARATION } from '@/lib/invoice/declaration'

const totals = rollUpTotals(
  [
    {
      date: '2026-07-21',
      lineType: 'Sub Contractor Labour Hire',
      quantity: 1,
      unitRate: 425,
      amount: 425,
      description: '',
      gstBearing: true,
    },
    {
      date: '2026-07-22',
      lineType: 'Reimbursement',
      quantity: 1,
      unitRate: 45,
      amount: 45,
      description: 'Car wash',
      gstBearing: false,
    },
  ],
  true,
)

function renderReview(over: Partial<Parameters<typeof StatementReview>[0]> = {}) {
  return render(
    <StatementReview
      totals={totals}
      periodLabel="Tue 21 Jul – Mon 3 Aug"
      invoiceNumber="WFR-20260803"
      onInvoiceNumberChange={vi.fn()}
      // Ticked by default here so each test exercises the one condition it is
      // about; the real screen always mounts with it false.
      declarationAccepted
      onDeclarationChange={vi.fn()}
      busy={false}
      error=""
      onBack={vi.fn()}
      onConfirm={vi.fn()}
      {...over}
    />,
  )
}

describe('StatementReview', () => {
  it('shows the period being claimed', () => {
    renderReview()
    expect(screen.getByText('Tue 21 Jul – Mon 3 Aug')).toBeInTheDocument()
  })

  it('lists every claimed line', () => {
    renderReview()
    expect(screen.getByText('Sub Contractor Labour Hire')).toBeInTheDocument()
    expect(screen.getByText(/Car wash/)).toBeInTheDocument()
  })

  it('shows the date against a dated line', () => {
    renderReview()
    expect(screen.getByText('Tue 21 Jul')).toBeInTheDocument()
  })

  it('shows the GST line for a registered contractor', () => {
    renderReview()
    expect(screen.getByText('GST (10%)')).toBeInTheDocument()
  })

  it('hides the GST line and notes the status for an unregistered contractor', () => {
    renderReview({ totals: rollUpTotals(totals.lines, false) })
    expect(screen.queryByText('GST (10%)')).not.toBeInTheDocument()
    expect(screen.getByText(/not registered for GST/i)).toBeInTheDocument()
  })

  it('shows no note for a registered contractor on a bonus statement', () => {
    const bonusTotals = rollUpTotals(
      [
        {
          date: null,
          lineType: 'Google Review Bonus',
          quantity: 4,
          unitRate: 15,
          amount: 60,
          description: '',
          gstBearing: true,
        },
      ],
      true,
    )
    renderReview({ totals: bonusTotals })
    expect(screen.queryByText(/not registered for GST/i)).not.toBeInTheDocument()
  })

  it('shows the not-registered note for an unregistered contractor on a bonus statement', () => {
    const bonusTotals = rollUpTotals(
      [
        {
          date: null,
          lineType: 'Google Review Bonus',
          quantity: 4,
          unitRate: 15,
          amount: 60,
          description: '',
          gstBearing: true,
        },
      ],
      false,
    )
    renderReview({ totals: bonusTotals })
    expect(screen.getByText(/not registered for GST/i)).toBeInTheDocument()
  })

  it('shows reimbursements separately from the work subtotal', () => {
    renderReview()
    expect(screen.getByText(/Reimbursements \(no GST\)/)).toBeInTheDocument()
  })

  it('calls onConfirm when the submit button is pressed', () => {
    const onConfirm = vi.fn()
    renderReview({ onConfirm })
    fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onBack when the back button is pressed', () => {
    const onBack = vi.fn()
    renderReview({ onBack })
    fireEvent.click(screen.getByRole('button', { name: /back to edit/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('disables the submit button while busy', () => {
    renderReview({ busy: true })
    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
  })

  describe('invoice number', () => {
    it('shows the suggested number, which the contractor can change', () => {
      renderReview()
      expect(screen.getByLabelText(/invoice number/i)).toHaveValue('WFR-20260803')
    })

    it('reports what the contractor typed', () => {
      const onInvoiceNumberChange = vi.fn()
      renderReview({ onInvoiceNumberChange })
      fireEvent.change(screen.getByLabelText(/invoice number/i), {
        target: { value: 'HG-2026-014' },
      })
      expect(onInvoiceNumberChange).toHaveBeenCalledWith('HG-2026-014')
    })

    it('enables Confirm when an invoice number is present', () => {
      renderReview()
      expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeEnabled()
    })

    it('disables Confirm when the invoice number is blank', () => {
      renderReview({ invoiceNumber: '   ' })
      expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeDisabled()
    })

    it('says why Confirm is off when the field has been cleared', () => {
      // An unticked declaration is obvious on sight; an empty text field is
      // not, so a cleared number left the contractor with a dead button and
      // no stated reason.
      renderReview({ invoiceNumber: '   ' })
      expect(screen.getByText(/enter an invoice number/i)).toBeInTheDocument()
    })

    it('says nothing about it while the field holds a number', () => {
      renderReview()
      expect(screen.queryByText(/enter an invoice number/i)).not.toBeInTheDocument()
    })
  })

  it('keeps Confirm disabled until the declaration is ticked', async () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <StatementReview
        totals={totals}
        periodLabel="21 July – 3 August 2026"
        busy={false}
        error=""
        invoiceNumber="WFR-20260803"
        onInvoiceNumberChange={() => {}}
        declarationAccepted={false}
        onDeclarationChange={() => {}}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeDisabled()

    rerender(
      <StatementReview
        totals={totals}
        periodLabel="21 July – 3 August 2026"
        busy={false}
        error=""
        invoiceNumber="WFR-20260803"
        onInvoiceNumberChange={() => {}}
        declarationAccepted
        onDeclarationChange={() => {}}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeEnabled()
  })

  it('shows the declaration, word for word, beside the tick', () => {
    renderReview()
    expect(screen.getByText(CONTRACTOR_DECLARATION)).toBeInTheDocument()
  })

  it('reports the tick being given', () => {
    const onDeclarationChange = vi.fn()
    renderReview({ declarationAccepted: false, onDeclarationChange })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onDeclarationChange).toHaveBeenCalledWith(true)
  })

  it('confirms before the home link discards the statement being reviewed', () => {
    // By definition there are entries here — a review screen cannot be
    // reached without them — so leaving always costs the contractor work.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderReview()

    const link = screen.getByRole('link', { name: 'Return to home screen' })
    const event = createEvent.click(link)
    fireEvent(link, event)

    expect(confirmSpy).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    confirmSpy.mockRestore()
  })

  it('shows an error when given one', () => {
    renderReview({ error: 'Could not submit your statement.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not submit your statement.')
  })
})
