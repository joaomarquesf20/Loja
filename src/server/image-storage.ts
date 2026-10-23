import { randomUUID } from 'node:crypto'
import {
  mkdir,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import { put } from '@vercel/blob'

export const MAX_IMAGE_UPLOAD_BYTES =
  10 * 1024 * 1024

const MIME_EXTENSIONS: Record<
  string,
  string
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

export type StoredImage = {
  url: string
  path: string
  originalName: string
  mimeType: string
  size: number
}

export type ImageUpload = {
  originalName: string
  mimeType: string
  bytes: Uint8Array<ArrayBuffer>
}

export interface ImageStorageAdapter {
  store(
    upload: ImageUpload,
  ): Promise<StoredImage>
}

export class ImageStorageError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 503 = 400,
  ) {
    super(message)
    this.name = 'ImageStorageError'
  }
}

function getUploadDirectory() {
  return (
    process.env.PRODUCT_IMAGE_UPLOAD_DIR ??
    path.join(
      process.cwd(),
      'public',
      'uploads',
      'products',
    )
  )
}

function getPublicPath() {
  const configured =
    process.env.PRODUCT_IMAGE_PUBLIC_PATH?.trim()
  if (!configured) {
    return '/uploads/products'
  }
  if (
    !configured.startsWith('/') ||
    configured.startsWith('//')
  ) {
    throw new ImageStorageError(
      'PRODUCT_IMAGE_PUBLIC_PATH tem de ser um caminho relativo válido.',
      503,
    )
  }
  return configured.replace(/\/$/, '')
}

function getImageExtension(
  upload: ImageUpload,
): string {
  const extension =
    MIME_EXTENSIONS[upload.mimeType]
  if (!extension) {
    throw new ImageStorageError(
      'Formato de imagem não suportado. Usa JPG, PNG, WebP, AVIF ou GIF.',
    )
  }

  if (upload.bytes.byteLength === 0) {
    throw new ImageStorageError(
      'O ficheiro de imagem está vazio.',
    )
  }

  if (
    upload.bytes.byteLength >
    MAX_IMAGE_UPLOAD_BYTES
  ) {
    throw new ImageStorageError(
      'A imagem excede o limite de 10 MB.',
    )
  }

  return extension
}

/**
 * Development adapter. ProductImage rows only ever receive the
 * returned URL/path; bytes live in the configured upload directory.
 * A production deployment can replace this adapter with S3, R2,
 * or another provider without changing the product data model.
 */
class LocalImageStorage
  implements ImageStorageAdapter
{
  async store(
    upload: ImageUpload,
  ): Promise<StoredImage> {
    const extension =
      getImageExtension(upload)

    const directory = getUploadDirectory()
    const filename = `${randomUUID()}.${extension}`
    const destination = path.join(
      /* turbopackIgnore: true */
      directory,
      filename,
    )

    await mkdir(directory, {
      recursive: true,
    })
    await writeFile(
      destination,
      upload.bytes,
    )

    const publicPath = getPublicPath()
    return {
      url: `${publicPath}/${filename}`,
      path: destination,
      originalName:
        upload.originalName,
      mimeType: upload.mimeType,
      size: upload.bytes.byteLength,
    }
  }
}

/**
 * Production adapter for Vercel, which has no persistent local disk.
 * Requires BLOB_READ_WRITE_TOKEN (provided by the Vercel Blob store).
 */
class VercelBlobImageStorage
  implements ImageStorageAdapter
{
  async store(
    upload: ImageUpload,
  ): Promise<StoredImage> {
    const extension =
      getImageExtension(upload)

    if (
      !process.env
        .BLOB_READ_WRITE_TOKEN
    ) {
      throw new ImageStorageError(
        'O armazenamento de imagens na Vercel não está configurado (BLOB_READ_WRITE_TOKEN em falta).',
        503,
      )
    }

    const pathname = `products/${randomUUID()}.${extension}`
    const blob = await put(
      pathname,
      new Blob([upload.bytes], {
        type: upload.mimeType,
      }),
      {
        access: 'public',
        contentType:
          upload.mimeType,
        addRandomSuffix: false,
      },
    )

    return {
      url: blob.url,
      path: blob.pathname,
      originalName:
        upload.originalName,
      mimeType: upload.mimeType,
      size: upload.bytes.byteLength,
    }
  }
}

export function getImageStorage(): ImageStorageAdapter {
  const provider =
    process.env.PRODUCT_IMAGE_STORAGE?.trim()

  if (provider === 'vercel-blob') {
    return new VercelBlobImageStorage()
  }

  if (
    provider &&
    provider !== 'local'
  ) {
    throw new ImageStorageError(
      `O armazenamento de imagens "${provider}" ainda não está configurado.`,
      503,
    )
  }

  if (process.env.VERCEL) {
    throw new ImageStorageError(
      'Na Vercel o disco local não é persistente. Define PRODUCT_IMAGE_STORAGE=vercel-blob.',
      503,
    )
  }

  return new LocalImageStorage()
}

export async function storeImageFile(
  file: File,
): Promise<StoredImage> {
  if (
    typeof file.arrayBuffer !== 'function'
  ) {
    throw new ImageStorageError(
      'O ficheiro enviado não é válido.',
    )
  }

  if (
    file.size > MAX_IMAGE_UPLOAD_BYTES
  ) {
    throw new ImageStorageError(
      'A imagem excede o limite de 10 MB.',
    )
  }

  return getImageStorage().store({
    originalName:
      file.name || 'image',
    mimeType: file.type.toLowerCase(),
    bytes: new Uint8Array(
      await file.arrayBuffer(),
    ),
  })
}
