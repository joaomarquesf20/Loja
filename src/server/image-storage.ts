import { randomUUID } from 'node:crypto'
import {
  mkdir,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

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
  bytes: Uint8Array
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

export function getImageStorage(): ImageStorageAdapter {
  const provider =
    process.env.PRODUCT_IMAGE_STORAGE?.trim()
  if (
    provider &&
    provider !== 'local'
  ) {
    throw new ImageStorageError(
      `O armazenamento de imagens "${provider}" ainda não está configurado.`,
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
