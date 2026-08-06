import type { ManagementLine, ManagementStatement, RosterEntry } from '../types'

/**
 * Shaped on Patrick Hutchinson's real statement — the one fortnightly
 * statement in the base that follows the v2 Sunday-ending convention.
 */
export function statement(over: Partial<ManagementStatement> = {}): ManagementStatement {
  return {
    id: 'recSTATEMENT00001',
    reference: 'INV-MYFAAMJP',
    label: 'PATRICK HUTCHINSON — Fortnightly — 2026-07-20',
    contractorId: 'recCONTRACTOR0001',
    contractorName: 'PATRICK HUTCHINSON',
    type: 'Fortnightly',
    periodStart: '2026-07-20',
    periodEnd: '2026-08-02',
    subtotal: 927.26,
    gst: 92.73,
    reimbursements: 50,
    total: 1069.99,
    gstRegisteredAtSubmission: true,
    status: 'Submitted',
    warnings: '',
    submittedAt: '2026-08-05T12:47:02.972Z',
    pdfUrl: null,
    supersedesId: null,
    ...over,
  }
}

export function rosterEntry(over: Partial<RosterEntry> = {}): RosterEntry {
  return {
    id: 'recCONTRACTOR0001',
    name: 'PATRICK HUTCHINSON',
    city: 'MEL',
    van: 'MEL VAN 2',
    abn: '12 345 678 901',
    gstRegistered: true,
    hasPin: true,
    ...over,
  }
}

export function line(over: Partial<ManagementLine> = {}): ManagementLine {
  return {
    id: 'recLINE0000000001',
    statementId: 'recSTATEMENT00001',
    date: '2026-07-20',
    lineType: 'Base Shift',
    quantity: 1,
    unitRate: 320,
    amount: 320,
    description: '',
    ...over,
  }
}
