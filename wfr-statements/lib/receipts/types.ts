/**
 * The fortnight's single receipt photo, travelling beside the day entries
 * rather than as a field on any calc type — lib/calc stays pure money logic
 * with no file handling.
 */
export type Receipt = {
  filename: string
  contentType: string
  /** Base64-encoded file content, without a `data:` URL prefix. */
  data: string
}
