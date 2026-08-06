/**
 * Human-quotable reference for a submitted statement, printed on the PDF and
 * stored on the Airtable record's `Reference` field so WFR can find the
 * source row from the PDF alone — the PDF renders before `createStatement`
 * runs, so it can never carry the Airtable record id itself (see
 * lib/airtable/statements.ts).
 *
 * Short and read aloud over the phone: eight characters drawn from an
 * alphabet that deliberately excludes I, O, 0 and 1 — the four characters
 * most often mis-heard or mis-typed as one another (or as a lowercase L).
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERENCE_LENGTH = 8

function uuidToBytes(uuid: string): number[] {
  const hex = uuid.replace(/-/g, '')
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

export function generateStatementReference(): string {
  const bytes = uuidToBytes(crypto.randomUUID())
  const chars = bytes
    .slice(0, REFERENCE_LENGTH)
    .map((byte) => ALPHABET[byte % ALPHABET.length])
  return `INV-${chars.join('')}`
}
