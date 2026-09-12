export const DEFAULT_JSON_BODY_LIMIT_BYTES =
  64 * 1024

export class InvalidJsonBodyError extends Error {
  constructor() {
    super('JSON inválido')
    this.name = 'InvalidJsonBodyError'
  }
}

export class RequestPayloadTooLargeError extends Error {
  constructor(
    public readonly maxBytes: number,
  ) {
    super(
      `O corpo do pedido excede o limite de ${maxBytes} bytes`,
    )
    this.name =
      'RequestPayloadTooLargeError'
  }
}

function getDeclaredContentLength(
  request: Request,
) {
  const rawValue =
    request.headers.get(
      'content-length',
    )

  if (!rawValue) {
    return null
  }

  const normalized =
    rawValue.trim()

  if (!/^\d+$/.test(normalized)) {
    return null
  }

  const value = Number(normalized)

  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null
  }

  return value
}

export async function readJsonBody(
  request: Request,
  maxBytes =
    DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<unknown> {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0
  ) {
    throw new RangeError(
      'maxBytes tem de ser um inteiro positivo',
    )
  }

  const declaredContentLength =
    getDeclaredContentLength(
      request,
    )

  if (
    declaredContentLength !== null &&
    declaredContentLength > maxBytes
  ) {
    throw new RequestPayloadTooLargeError(
      maxBytes,
    )
  }

  if (!request.body) {
    throw new InvalidJsonBodyError()
  }

  const reader =
    request.body.getReader()

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const {
        done,
        value,
      } = await reader.read()

      if (done) {
        break
      }

      if (!value) {
        continue
      }

      totalBytes +=
        value.byteLength

      if (totalBytes > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          // O pedido já vai ser rejeitado.
        }

        throw new RequestPayloadTooLargeError(
          maxBytes,
        )
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes =
    new Uint8Array(totalBytes)

  let offset = 0

  for (const chunk of chunks) {
    bytes.set(
      chunk,
      offset,
    )

    offset += chunk.byteLength
  }

  try {
    const text =
      new TextDecoder(
        'utf-8',
        {
          fatal: true,
        },
      ).decode(bytes)

    return JSON.parse(text) as unknown
  } catch {
    throw new InvalidJsonBodyError()
  }
}