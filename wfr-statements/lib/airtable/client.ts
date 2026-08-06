import 'server-only'

const API_BASE = 'https://api.airtable.com/v0'

export function credentials(): { token: string; baseId: string } {
  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!token) throw new Error('AIRTABLE_TOKEN is not set.')
  if (!baseId) throw new Error('AIRTABLE_BASE_ID is not set.')
  return { token, baseId }
}

/** `path` is appended after the base ID, e.g. `/tblEKgseTcvYkoBaH?pageSize=100`. */
export async function airtableFetch(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const { token, baseId } = credentials()

  const response = await fetch(`${API_BASE}/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Airtable request failed (${response.status}): ${body}`)
  }

  return response.json()
}
