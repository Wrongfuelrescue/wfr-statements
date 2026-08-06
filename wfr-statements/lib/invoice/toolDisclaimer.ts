/**
 * WFR's disclaimer about what this tool is and, more importantly, what it is
 * not. Shown before a contractor chooses which statement to submit.
 *
 * A single constant, exactly like `CONTRACTOR_DECLARATION`, because the words
 * are legally operative and were supplied verbatim by the client. Their point
 * is to keep the tool from reading as direction or control over how a
 * contractor works — the substance of the independent-contractor
 * relationship — so paraphrasing it, tightening it or "improving" the prose
 * would defeat it. Do not reword.
 *
 * Stored as paragraphs rather than one blob so the UI can space them without
 * splitting on a delimiter, which would silently reflow if the text ever
 * changed.
 */
export const TOOL_DISCLAIMER: readonly string[] = [
  'This optional tool is provided by Wrong Fuel Rescue Pty Ltd to assist independent contractors with preparing and submitting invoices for services they have supplied.',
  'Contractors are not required to use this tool and may instead submit an independently prepared, valid tax invoice to WFR Accounts. Using this tool does not restrict a contractor’s ability to review, amend or dispute the services, fees, expenses or other information shown.',
  'This is an administrative invoicing tool only. It is not a timesheet, payroll system, employment record or direction about when, where or how services must be performed. Information displayed in the tool is provided for convenience and must be independently reviewed and approved by the contractor before an invoice is submitted.',
  'Use of this tool does not change the parties’ contractual relationship or determine their respective rights and obligations under applicable law.',
]

/** The heading on the panel that carries the disclaimer. */
export const TOOL_DISCLAIMER_HEADING = 'About this tool'

/**
 * The one sentence shown without the contractor having to open anything.
 *
 * Of the four paragraphs, this is the load-bearing one: "optional" on its own
 * is a weaker notice than "optional, and here is the other way", and it is the
 * stated alternative that matters if anyone ever asks whether contractors were
 * on notice. Behind a collapsed panel it would be the strongest claim in the
 * disclaimer and the least likely to be read.
 *
 * Deliberately a slice of the approved text rather than a summary of it — a
 * test asserts it appears verbatim inside `TOOL_DISCLAIMER`, so this line can
 * never drift into wording the client never agreed.
 */
export const TOOL_DISCLAIMER_HIGHLIGHT =
  'Contractors are not required to use this tool and may instead submit an independently prepared, valid tax invoice to WFR Accounts.'
