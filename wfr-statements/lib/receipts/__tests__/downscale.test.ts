import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  processReceiptFile,
  ReceiptError,
  MAX_RECEIPT_BYTES,
  totalReceiptsBytes,
} from '../downscale'

/**
 * jsdom does not implement real canvas rendering or image decoding, so the
 * browser APIs the module depends on are faked here: a controllable Image
 * stand-in (drives naturalWidth/naturalHeight and onload/onerror timing) and
 * a canvas whose getContext/toBlob are stubbed to observe what the module
 * asked for and hand back a Blob of a chosen size.
 */

let nextImageSize = { width: 4000, height: 3000 }
let imageShouldError = false
let nextBlobSize = 100_000
let toBlobCalls: Array<{ type: string; quality: number | undefined }>
let drawImageCalls: Array<{ width: number; height: number }>
let canvasSizes: Array<{ width: number; height: number }>

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  width = 0
  height = 0

  set src(_value: string) {
    queueMicrotask(() => {
      if (imageShouldError) {
        this.onerror?.()
        return
      }
      this.naturalWidth = nextImageSize.width
      this.naturalHeight = nextImageSize.height
      this.width = nextImageSize.width
      this.height = nextImageSize.height
      this.onload?.()
    })
  }
}

beforeEach(() => {
  nextImageSize = { width: 4000, height: 3000 }
  imageShouldError = false
  nextBlobSize = 100_000
  toBlobCalls = []
  drawImageCalls = []
  canvasSizes = []

  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:fake-url'),
    revokeObjectURL: vi.fn(),
  })

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    canvasSizes.push({ width: this.width, height: this.height })
    return {
      drawImage: (_img: unknown, _x: number, _y: number, w: number, h: number) => {
        drawImageCalls.push({ width: w, height: h })
      },
    } as unknown as CanvasRenderingContext2D
  })

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    toBlobCalls.push({ type: type ?? '', quality })
    callback(new Blob([new Uint8Array(nextBlobSize)], { type: type ?? 'image/jpeg' }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function imageFile(name = 'photo.heic', type = 'image/heic'): File {
  return new File([new Uint8Array(10)], name, { type })
}

describe('processReceiptFile', () => {
  it('rejects a non-image file with a clear, actionable message', async () => {
    const file = new File(['not an image'], 'receipt.pdf', { type: 'application/pdf' })
    await expect(processReceiptFile(file)).rejects.toThrow(ReceiptError)
    await expect(processReceiptFile(file)).rejects.toThrow(/image/i)
  })

  it('downscales an oversized photo to fit within the 1600px longest-edge cap, preserving aspect ratio', async () => {
    nextImageSize = { width: 4000, height: 3000 }
    await processReceiptFile(imageFile())

    expect(canvasSizes).toHaveLength(1)
    expect(canvasSizes[0]).toEqual({ width: 1600, height: 1200 })
    expect(drawImageCalls[0]).toEqual({ width: 1600, height: 1200 })
  })

  it('does not upscale a photo already smaller than the cap', async () => {
    nextImageSize = { width: 800, height: 600 }
    await processReceiptFile(imageFile())

    expect(canvasSizes[0]).toEqual({ width: 800, height: 600 })
  })

  it('exports as JPEG at roughly 0.7 quality', async () => {
    await processReceiptFile(imageFile())
    expect(toBlobCalls).toHaveLength(1)
    expect(toBlobCalls[0].type).toBe('image/jpeg')
    expect(toBlobCalls[0].quality).toBeCloseTo(0.7, 5)
  })

  it('resolves with base64 data that carries no data: URL prefix', async () => {
    const receipt = await processReceiptFile(imageFile())
    expect(receipt.contentType).toBe('image/jpeg')
    expect(receipt.data.startsWith('data:')).toBe(false)
    expect(receipt.filename).toBe('photo.jpg')
  })

  it('rejects a receipt still over 1 MB after downscaling, with an actionable message', async () => {
    nextBlobSize = MAX_RECEIPT_BYTES + 1
    await expect(processReceiptFile(imageFile())).rejects.toThrow(ReceiptError)
    await expect(processReceiptFile(imageFile())).rejects.toThrow(/too large/i)
  })

  it('accepts a receipt that lands exactly at the 1 MB cap', async () => {
    nextBlobSize = MAX_RECEIPT_BYTES
    await expect(processReceiptFile(imageFile())).resolves.toMatchObject({
      contentType: 'image/jpeg',
    })
  })

  it('surfaces a readable error when the image cannot be decoded', async () => {
    imageShouldError = true
    await expect(processReceiptFile(imageFile())).rejects.toThrow(ReceiptError)
  })
})

describe('totalReceiptsBytes', () => {
  it('returns 0 when there is no receipt', () => {
    expect(totalReceiptsBytes(undefined)).toBe(0)
  })

  it('returns the base64 payload length of the receipt', () => {
    const receipt = { filename: 'a.jpg', contentType: 'image/jpeg', data: 'a'.repeat(100) }
    expect(totalReceiptsBytes(receipt)).toBe(100)
  })
})
