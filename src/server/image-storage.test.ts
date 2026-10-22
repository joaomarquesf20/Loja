import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const putMock = vi.hoisted(() => vi.fn())

vi.mock('@vercel/blob', () => ({
  put: putMock,
}))

import {
  ImageStorageError,
  storeImageFile,
} from './image-storage'

const ENV_KEYS = [
  'PRODUCT_IMAGE_STORAGE',
  'BLOB_READ_WRITE_TOKEN',
  'VERCEL',
] as const

function makeFile(
  bytes: Uint8Array,
  type = 'image/png',
) {
  return new File([bytes as BlobPart], 'foto.png', {
    type,
  })
}

describe('image storage', () => {
  const originalEnv = new Map<string, string | undefined>()

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key])
      delete process.env[key]
    }
    putMock.mockReset()
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key)
      if (value === undefined) {
        delete process.env[key]
      } else {
        Object.assign(process.env, {
          [key]: value,
        })
      }
    }
  })

  it('uploads to Vercel Blob as a public, non-suffixed product path', async () => {
    process.env.PRODUCT_IMAGE_STORAGE = 'vercel-blob'
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    putMock.mockResolvedValue({
      url: 'https://store.public.blob.vercel-storage.com/products/a.png',
      pathname: 'products/a.png',
    })

    const stored = await storeImageFile(
      makeFile(new Uint8Array([1, 2, 3])),
    )

    expect(putMock).toHaveBeenCalledTimes(1)
    const [pathname, body, options] =
      putMock.mock.calls[0]
    expect(pathname).toMatch(
      /^products\/[0-9a-f-]+\.png$/,
    )
    expect(body).toBeInstanceOf(Blob)
    expect(options).toMatchObject({
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
    })
    expect(stored).toEqual({
      url: 'https://store.public.blob.vercel-storage.com/products/a.png',
      path: 'products/a.png',
      originalName: 'foto.png',
      mimeType: 'image/png',
      size: 3,
    })
  })

  it('rejects Vercel Blob uploads when the token is missing', async () => {
    process.env.PRODUCT_IMAGE_STORAGE = 'vercel-blob'

    await expect(
      storeImageFile(makeFile(new Uint8Array([1]))),
    ).rejects.toMatchObject({
      statusCode: 503,
    })
    expect(putMock).not.toHaveBeenCalled()
  })

  it('refuses the local disk on Vercel with a clear 503', async () => {
    Object.assign(process.env, {
      VERCEL: '1',
    })

    const error = await storeImageFile(
      makeFile(new Uint8Array([1])),
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ImageStorageError)
    expect(error).toMatchObject({
      statusCode: 503,
    })
    expect(putMock).not.toHaveBeenCalled()
  })

  it('rejects unsupported image types before storing', async () => {
    process.env.PRODUCT_IMAGE_STORAGE = 'vercel-blob'
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token'

    await expect(
      storeImageFile(
        makeFile(new Uint8Array([1]), 'image/svg+xml'),
      ),
    ).rejects.toBeInstanceOf(ImageStorageError)
    expect(putMock).not.toHaveBeenCalled()
  })
})
