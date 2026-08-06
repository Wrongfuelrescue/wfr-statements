import type { Receipt } from './types'

/** Longest edge a downscaled receipt is capped at. */
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.7
/** A receipt that is still this large after downscaling is rejected client-side. */
export const MAX_RECEIPT_BYTES = 1024 * 1024

/** Thrown with a message that is safe and actionable to show the contractor. */
export class ReceiptError extends Error {}

function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= maxEdge && height <= maxEdge) return { width, height }
  const scale = maxEdge / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ReceiptError('Could not read this photo. Try a different one.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new ReceiptError('Could not process this photo. Try a different one.'))
      },
      type,
      quality,
    )
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new ReceiptError('Could not read this photo. Try a different one.'))
    reader.readAsDataURL(blob)
  })
}

function jpegFilename(originalName: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, '').trim()
  return `${base || 'receipt'}.jpg`
}

/**
 * Downscales a photographed receipt for upload: draws it to a canvas capped
 * at 1600px on the longest edge and re-exports it as a JPEG at ~0.7 quality.
 * A typical 3-8 MB phone photo lands well under 500 KB. Rejects non-image
 * files outright, and rejects anything still over 1 MB after downscaling
 * rather than letting it fail silently at submit time.
 */
export async function processReceiptFile(file: File): Promise<Receipt> {
  if (!file.type.startsWith('image/')) {
    throw new ReceiptError('Please choose an image file for the receipt.')
  }

  const img = await loadImage(file)
  const { width, height } = scaledDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, MAX_EDGE)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new ReceiptError('Could not process this photo. Try a different one.')
  }
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
  if (blob.size > MAX_RECEIPT_BYTES) {
    throw new ReceiptError(
      'This receipt photo is still too large after resizing. Try a clearer, closer photo.',
    )
  }

  const data = await blobToBase64(blob)
  return { filename: jpegFilename(file.name), contentType: 'image/jpeg', data }
}

/**
 * Sanity ceiling on the fortnight's single receipt, checked client-side
 * before the submit POST is even sent. A downscaled receipt is already
 * capped at ~1 MB (MAX_RECEIPT_BYTES above), comfortably under a typical
 * serverless request body limit (e.g. Vercel's 4.5 MB) — but if that changes,
 * or a mock/future path ever produces a larger payload, the platform would
 * reject the request before the route handler ever runs, the response body
 * wouldn't be JSON, and the contractor would otherwise be told to "try
 * submitting again" — advice that can never succeed. Catching it here, with
 * room to spare below that ceiling, turns an unwinnable retry loop into an
 * actionable "remove the photo" message.
 */
export const MAX_TOTAL_RECEIPTS_BYTES = 4 * 1024 * 1024

/** Size of the fortnight's receipt's base64 payload, in bytes; 0 if there is none. */
export function totalReceiptsBytes(receipt: Receipt | undefined): number {
  return receipt ? receipt.data.length : 0
}
