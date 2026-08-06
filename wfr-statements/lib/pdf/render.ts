import { renderToBuffer } from '@react-pdf/renderer'
import type { StatementTotals } from '@/lib/calc/types'
import type { RateCard } from '@/lib/rates/types'
import { StatementDocument, type StatementMeta } from './StatementDocument'

export type { StatementMeta }

export async function renderStatementPdf(
  totals: StatementTotals,
  rates: RateCard,
  meta: StatementMeta,
): Promise<Buffer> {
  return renderToBuffer(StatementDocument({ totals, rates, meta }))
}
