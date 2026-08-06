import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatDisplayDate, formatDisplayDateWithYear, perthDateFromInstant } from '@/lib/dates'
import { gstNote, subtotalLabel } from '@/lib/calc/notes'
import { CONTRACTOR_DECLARATION } from '@/lib/invoice/declaration'
import { WFR_PAYEE, invoiceHeading } from '@/lib/invoice/payee'
import type { StatementTotals } from '@/lib/calc/types'
import type { RateCard } from '@/lib/rates/types'

export type StatementMeta = {
  type: 'fortnightly' | 'monthly'
  periodStart: string
  periodEnd: string
  /**
   * Human-quotable id (see lib/reference.ts), generated before the PDF is
   * rendered — this is the *only* way from a printed PDF back to the
   * Airtable record, since the PDF renders before createStatement runs and
   * so can never carry the record id itself.
   */
  reference: string
  /** ISO instant. The same value written to the Airtable record's `Submitted At`. */
  submittedAt: string
  /**
   * The number the contractor chose. Theirs, from their own sequence.
   * Printed on the invoice (see `metaRows`) and also written to the Airtable
   * record, which is where WFR reconciles against it.
   */
  contractorInvoiceNumber: string
  /**
   * ISO instant the contractor ticked the declaration printed below the
   * totals. The same instant as `submittedAt` — generated once in the route
   * handler — so the acceptance and the invoice date can never disagree.
   * Written to the Airtable record's `Declaration Accepted At`.
   */
  declarationAcceptedAt: string
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: '#1a1a1a' },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  parties: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  party: { width: '48%' },
  partyLabel: { fontSize: 9, color: '#474747', marginBottom: 3 },
  partyName: { fontWeight: 'bold', marginBottom: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  note: { marginTop: 12, fontSize: 9, fontStyle: 'italic', color: '#474747' },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginTop: 16, marginBottom: 6 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e4e6e8',
  },
  colDate: { width: '18%' },
  colType: { width: '32%' },
  colQty: { width: '12%', textAlign: 'right' },
  colRate: { width: '18%', textAlign: 'right' },
  colAmount: { width: '20%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  totalLabel: { width: 140, textAlign: 'right', paddingRight: 12 },
  totalValue: { width: 80, textAlign: 'right' },
  grandTotal: { fontWeight: 'bold', fontSize: 12, color: '#3f6b0d' },
  payment: { marginTop: 20 },
  paymentLabel: { fontSize: 9, color: '#474747', marginBottom: 3 },
})

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

/**
 * The label/value pairs printed in the invoice's meta block, in order.
 *
 * Pulled out of the JSX as a pure function so the mapping itself can be
 * asserted in a unit test. Rendering to PDF bytes can only prove a file came
 * out; it cannot prove the right identifier is printed against the right
 * label.
 *
 * The contractor's own invoice number IS printed, from their own sequence.
 * It was omitted for a period at the client's request and restored on
 * 2026-08-07 at WFR's request, because accounts reconcile against a number on
 * the face of the page.
 *
 * The app's internal `INV-` reference is still NOT printed. It remains in the
 * PDF's filename, on the contractor's submissions list and in the Airtable
 * record's `Reference` field, which is how a document is traced back to its
 * row. Note the two are not interchangeable: a contractor's number is theirs
 * and two contractors could both submit "INV-001", so only the reference
 * identifies a statement unambiguously.
 *
 * An invoice number is not among the ATO's required elements of a valid tax
 * invoice, so the document was valid without it too.
 */
export function metaRows(meta: StatementMeta): Array<{ label: string; value: string }> {
  return [
    {
      label: 'Invoice no.',
      value: meta.contractorInvoiceNumber,
    },
    {
      label: 'Date',
      value: formatDisplayDateWithYear(perthDateFromInstant(meta.submittedAt)),
    },
    {
      label: 'Period',
      value: `${formatDisplayDateWithYear(meta.periodStart)} – ${formatDisplayDateWithYear(meta.periodEnd)}`,
    },
  ]
}

export function StatementDocument({
  totals,
  rates,
  meta,
}: {
  totals: StatementTotals
  rates: RateCard
  meta: StatementMeta
}) {
  const note = gstNote(totals)

  return (
    <Document title={`${invoiceHeading(rates.gstRegistered)} — ${rates.name}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{invoiceHeading(rates.gstRegistered)}</Text>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>{rates.name}</Text>
            {rates.address ? <Text>{rates.address}</Text> : null}
            {rates.abn ? <Text>{`ABN ${rates.abn}`}</Text> : null}
          </View>

          <View style={styles.party}>
            <Text style={styles.partyLabel}>Bill to</Text>
            <Text style={styles.partyName}>{WFR_PAYEE.name}</Text>
            {WFR_PAYEE.addressLines.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
            <Text>{`ABN ${WFR_PAYEE.abn}`}</Text>
          </View>
        </View>

        {metaRows(meta).map((row) => (
          <View key={row.label} style={styles.metaRow}>
            <Text>{row.label}</Text>
            <Text>{row.value}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Itemised claim</Text>

        <View style={styles.tableHeader}>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colType}>Item</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {totals.lines.map((line, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.colDate}>
              {line.date ? formatDisplayDate(line.date) : '—'}
            </Text>
            <Text style={styles.colType}>
              {line.description ? `${line.lineType} — ${line.description}` : line.lineType}
            </Text>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <Text style={styles.colRate}>{money(line.unitRate)}</Text>
            <Text style={styles.colAmount}>{money(line.amount)}</Text>
          </View>
        ))}

        <View style={[styles.totalRow, { marginTop: 12 }]} wrap={false}>
          <Text style={styles.totalLabel}>{subtotalLabel(totals)}</Text>
          <Text style={styles.totalValue}>{money(totals.workSubtotal)}</Text>
        </View>

        {totals.gstRegistered ? (
          <View style={styles.totalRow} wrap={false}>
            <Text style={styles.totalLabel}>GST (10%)</Text>
            <Text style={styles.totalValue}>{money(totals.gst)}</Text>
          </View>
        ) : null}

        {totals.reimbursements > 0 ? (
          <View style={styles.totalRow} wrap={false}>
            <Text style={styles.totalLabel}>Reimbursements (no GST)</Text>
            <Text style={styles.totalValue}>{money(totals.reimbursements)}</Text>
          </View>
        ) : null}

        <View style={styles.totalRow} wrap={false}>
          <Text style={[styles.totalLabel, styles.grandTotal]}>Total claimed</Text>
          <Text style={[styles.totalValue, styles.grandTotal]}>{money(totals.total)}</Text>
        </View>

        {totals.note ? <Text style={styles.note}>{totals.note}</Text> : null}

        {note ? <Text style={styles.note}>{note}</Text> : null}

        {rates.bankBsb || rates.bankAccount ? (
          <View style={styles.payment}>
            <Text style={styles.paymentLabel}>Payment</Text>
            {rates.bankBsb ? <Text>{`BSB ${rates.bankBsb}`}</Text> : null}
            {rates.bankAccount ? <Text>{`Account ${rates.bankAccount}`}</Text> : null}
          </View>
        ) : null}

        {/*
          The same constant the contractor ticked on the review screen, so
          the text they agreed to and the text on the invoice are one string.
        */}
        <View style={styles.payment}>
          <Text style={styles.paymentLabel}>Declaration</Text>
          <Text>{CONTRACTOR_DECLARATION}</Text>
        </View>
      </Page>
    </Document>
  )
}
