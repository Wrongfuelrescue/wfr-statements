import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReimbursementSection } from '../ReimbursementSection'

function renderSection(over = {}) {
  return render(
    <ReimbursementSection
      value={{ amount: 0, description: '' }}
      onChange={vi.fn()}
      receipt={null}
      onReceiptChange={vi.fn()}
      {...over}
    />,
  )
}

describe('ReimbursementSection', () => {
  it('asks for an amount', () => {
    renderSection()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
  })

  it('clamps a negative amount to zero', () => {
    const onChange = vi.fn()
    renderSection({ onChange })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '-5' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ amount: 0 }))
  })

  it('only asks what it was for once there is an amount', () => {
    const { rerender } = renderSection()
    expect(screen.queryByLabelText(/what was it for/i)).not.toBeInTheDocument()

    rerender(
      <ReimbursementSection
        value={{ amount: 45, description: '' }}
        onChange={vi.fn()}
        receipt={null}
        onReceiptChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/what was it for/i)).toBeInTheDocument()
  })

  it('warns when an amount has no description yet', () => {
    renderSection({ value: { amount: 45, description: '' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/what.*for/i)
  })

  it('stops warning once a description is entered', () => {
    renderSection({ value: { amount: 45, description: 'Car wash' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers a receipt upload once there is an amount', () => {
    renderSection({ value: { amount: 45, description: 'Car wash' } })
    expect(screen.getByLabelText(/receipt/i)).toBeInTheDocument()
  })

  // Coverage gap 2: the file input must open the phone's rear camera, not
  // just any file picker — lost when the per-day receipt input (DayCard) was
  // removed in Task 4, though the equivalent input still exists here.
  it('accepts images via the rear camera', () => {
    renderSection({ value: { amount: 45, description: 'Car wash' } })
    const input = screen.getByLabelText(/receipt/i)
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('capture', 'environment')
  })

  // Coverage gap 3: no receipt input (or any hint of one) should be reachable
  // at all while there is nothing to reimburse.
  it('shows no receipt block when the reimbursement amount is zero', () => {
    renderSection({ value: { amount: 0, description: '' } })
    expect(screen.queryByLabelText(/receipt/i)).not.toBeInTheDocument()
  })

  it('clears the file input so reselecting the same photo still fires', () => {
    // jsdom reports a file input's .value as '' regardless, so asserting on the
    // property cannot distinguish the reset from its absence. Spy on the setter
    // instead: it is called only when the handler actually clears the input.
    //
    // The spy must be installed BEFORE the component mounts: React's input
    // value-tracker (react-dom's inputValueTracking) captures a reference to
    // whatever setter is on HTMLInputElement.prototype at mount time and
    // calls that captured reference directly on future writes, bypassing any
    // prototype spy installed afterwards. Spying first means React captures
    // the spy itself as "the native setter".
    const setValue = vi.spyOn(HTMLInputElement.prototype, 'value', 'set')

    const onReceiptChange = vi.fn()
    renderSection({ value: { amount: 45, description: 'Car wash' }, onReceiptChange })

    const input = screen.getByLabelText(/receipt/i) as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })] },
    })

    expect(onReceiptChange).toHaveBeenCalledTimes(1)
    expect(setValue).toHaveBeenCalledWith('')

    setValue.mockRestore()
  })
})
