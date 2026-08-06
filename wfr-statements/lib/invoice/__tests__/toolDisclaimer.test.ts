import { describe, expect, it } from 'vitest'
import { TOOL_DISCLAIMER, TOOL_DISCLAIMER_HIGHLIGHT } from '../toolDisclaimer'

// The client supplied these words and they are legally operative — they exist
// to keep the tool from reading as direction or control over how a contractor
// works. A well-meaning edit (a "clearer" phrasing, a straight apostrophe, a
// dropped sentence) would weaken that quietly, so the text is pinned here in
// full rather than sampled.
describe('TOOL_DISCLAIMER', () => {
  it('is the client’s text, word for word', () => {
    expect(TOOL_DISCLAIMER).toEqual([
      'This optional tool is provided by Wrong Fuel Rescue Pty Ltd to assist independent contractors with preparing and submitting invoices for services they have supplied.',
      'Contractors are not required to use this tool and may instead submit an independently prepared, valid tax invoice to WFR Accounts. Using this tool does not restrict a contractor’s ability to review, amend or dispute the services, fees, expenses or other information shown.',
      'This is an administrative invoicing tool only. It is not a timesheet, payroll system, employment record or direction about when, where or how services must be performed. Information displayed in the tool is provided for convenience and must be independently reviewed and approved by the contractor before an invoice is submitted.',
      'Use of this tool does not change the parties’ contractual relationship or determine their respective rights and obligations under applicable law.',
    ])
  })

  it('keeps the four claims that carry the legal weight', () => {
    const all = TOOL_DISCLAIMER.join(' ')
    // Optional, not mandated.
    expect(all).toContain('are not required to use this tool')
    // The contractor keeps the right to disagree with what is shown.
    expect(all).toContain('review, amend or dispute')
    // Not a record of when or how work is done.
    expect(all).toContain('not a timesheet, payroll system, employment record')
    // Nothing here redefines the relationship.
    expect(all).toContain('does not change the parties’ contractual relationship')
  })

  it('highlights a sentence taken verbatim from the approved text, not a paraphrase of it', () => {
    // The highlight is the only part a contractor sees without opening the
    // panel, so it carries the most weight and needs the most protection.
    // Asserting it is a substring — rather than pinning it separately — means
    // it cannot drift into wording the client never approved, even if someone
    // edits it directly.
    expect(TOOL_DISCLAIMER.join('\n')).toContain(TOOL_DISCLAIMER_HIGHLIGHT)
  })

  it('highlights the sentence that names the alternative, not merely that it is optional', () => {
    expect(TOOL_DISCLAIMER_HIGHLIGHT).toContain('not required to use this tool')
    expect(TOOL_DISCLAIMER_HIGHLIGHT).toContain('independently prepared, valid tax invoice')
  })

  it('uses typographic apostrophes, as supplied', () => {
    // A straight apostrophe would be a silent edit of client-approved text.
    expect(TOOL_DISCLAIMER.join(' ')).not.toContain("'")
  })
})
