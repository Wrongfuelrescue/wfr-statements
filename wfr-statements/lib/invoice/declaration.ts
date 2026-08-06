/**
 * The declaration a contractor makes when submitting. One constant, shared by
 * the review screen (where it is ticked) and the PDF (where it is printed),
 * so the text a contractor agreed to and the text on the document can never
 * differ. Agreed with the client word for word — do not reword.
 */
export const CONTRACTOR_DECLARATION =
  'I confirm that I am submitting this invoice in the course of my independent ' +
  'business. I have reviewed and approved the services, dates, fees, GST treatment ' +
  'and payment details shown. I confirm that the services were supplied and that I ' +
  'am authorised to issue this invoice.'

/**
 * Strictly `true`, never merely truthy: a declaration is worth something only
 * if it was given deliberately, and accepting the string "true" or a stray 1
 * from a malformed client would record an acceptance nobody made.
 */
export function validateDeclaration(value: unknown): true {
  if (value !== true) {
    throw new Error('Please tick the declaration before submitting.')
  }
  return true
}
