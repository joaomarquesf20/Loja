import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

import {
  RequestPayloadTooLargeError,
} from './http-request'

export const PAYMENT_WEBHOOK_MAX_BODY_BYTES =
  32 * 1024

export const PAYMENT_WEBHOOK_MAX_AGE_SECONDS =
  5 * 60

const PAYMENT_WEBHOOK_SECRET_MIN_LENGTH =
  32

const signaturePattern =
  /^sha256=([a-f0-9]{64})$/i

export type PaymentWebhookEvent = {
  type:
    | 'PAYMENT_PAID'
    | 'PAYMENT_FAILED'
  orderId: string
  paymentProvider: string
  paymentReference: string
}

export type PaymentPaidWebhookEvent =
  PaymentWebhookEvent & {
    type: 'PAYMENT_PAID'
  }

export class PaymentWebhookAuthenticationError extends Error {
  constructor(
    message = 'Assinatura do webhook inválida',
  ) {
    super(message)
    this.name =
      'PaymentWebhookAuthenticationError'
  }
}

export class PaymentWebhookValidationError extends Error {
  constructor(
    message = 'Evento de pagamento inválido',
  ) {
    super(message)
    this.name =
      'PaymentWebhookValidationError'
  }
}

export class PaymentWebhookConfigurationError extends Error {
  constructor() {
    super(
      'PAYMENT_WEBHOOK_SECRET não está configurado corretamente',
    )
    this.name =
      'PaymentWebhookConfigurationError'
  }
}

type VerifyPaymentWebhookOptions = {
  secret?: string
  nowMs?: number
  maxBodyBytes?: number
  maxAgeSeconds?: number
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

async function readRawBody(
  request: Request,
  maxBytes: number,
) {
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
    throw new PaymentWebhookValidationError()
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

  return bytes
}

function resolveSecret(
  override?: string,
) {
  const secret =
    override ??
    process.env.PAYMENT_WEBHOOK_SECRET

  if (
    typeof secret !== 'string' ||
    secret.length <
      PAYMENT_WEBHOOK_SECRET_MIN_LENGTH
  ) {
    throw new PaymentWebhookConfigurationError()
  }

  return secret
}

function normalizeTimestamp(
  request: Request,
  nowMs: number,
  maxAgeSeconds: number,
) {
  const rawTimestamp =
    request.headers.get(
      'x-payment-timestamp',
    )

  if (!rawTimestamp) {
    throw new PaymentWebhookAuthenticationError()
  }

  const timestamp =
    rawTimestamp.trim()

  if (!/^\d+$/.test(timestamp)) {
    throw new PaymentWebhookAuthenticationError()
  }

  const timestampSeconds =
    Number(timestamp)

  if (
    !Number.isSafeInteger(
      timestampSeconds,
    )
  ) {
    throw new PaymentWebhookAuthenticationError()
  }

  const nowSeconds =
    Math.floor(
      nowMs / 1000,
    )

  if (
    Math.abs(
      nowSeconds -
        timestampSeconds,
    ) > maxAgeSeconds
  ) {
    throw new PaymentWebhookAuthenticationError(
      'Timestamp do webhook inválido ou expirado',
    )
  }

  return timestamp
}

function getSignature(
  request: Request,
) {
  const rawSignature =
    request.headers.get(
      'x-payment-signature',
    )

  if (!rawSignature) {
    throw new PaymentWebhookAuthenticationError()
  }

  const signature =
    rawSignature.trim()

  const match =
    signaturePattern.exec(
      signature,
    )

  if (!match) {
    throw new PaymentWebhookAuthenticationError()
  }

  return Buffer.from(
    match[1],
    'hex',
  )
}

function verifySignature(
  secret: string,
  timestamp: string,
  body: Uint8Array,
  providedSignature: Buffer,
) {
  const expectedSignature =
    createHmac(
      'sha256',
      secret,
    )
      .update(timestamp)
      .update('.')
      .update(body)
      .digest()

  if (
    providedSignature.length !==
      expectedSignature.length ||
    !timingSafeEqual(
      providedSignature,
      expectedSignature,
    )
  ) {
    throw new PaymentWebhookAuthenticationError()
  }
}

function parseJson(
  body: Uint8Array,
): unknown {
  try {
    const text =
      new TextDecoder(
        'utf-8',
        {
          fatal: true,
        },
      ).decode(body)

    return JSON.parse(text) as unknown
  } catch {
    throw new PaymentWebhookValidationError(
      'JSON do webhook inválido',
    )
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function normalizeRequiredString(
  value: unknown,
  maxLength: number,
) {
  if (typeof value !== 'string') {
    throw new PaymentWebhookValidationError()
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    normalized.length > maxLength
  ) {
    throw new PaymentWebhookValidationError()
  }

  return normalized
}

function parseEvent(
  value: unknown,
): PaymentWebhookEvent {
  if (!isRecord(value)) {
    throw new PaymentWebhookValidationError()
  }

  if (
    value.type !==
      'PAYMENT_PAID' &&
    value.type !==
      'PAYMENT_FAILED'
  ) {
    throw new PaymentWebhookValidationError(
      'Tipo de evento de pagamento não suportado',
    )
  }

  return {
    type: value.type,
    orderId:
      normalizeRequiredString(
        value.orderId,
        191,
      ),
    paymentProvider:
      normalizeRequiredString(
        value.paymentProvider,
        100,
      ),
    paymentReference:
      normalizeRequiredString(
        value.paymentReference,
        191,
      ),
  }
}

export async function verifyPaymentWebhookRequest(
  request: Request,
  options: VerifyPaymentWebhookOptions = {},
): Promise<PaymentWebhookEvent> {
  const secret =
    resolveSecret(
      options.secret,
    )

  const nowMs =
    options.nowMs ??
    Date.now()

  const maxAgeSeconds =
    options.maxAgeSeconds ??
    PAYMENT_WEBHOOK_MAX_AGE_SECONDS

  if (
    !Number.isSafeInteger(
      maxAgeSeconds,
    ) ||
    maxAgeSeconds <= 0
  ) {
    throw new RangeError(
      'maxAgeSeconds tem de ser um inteiro positivo',
    )
  }

  const timestamp =
    normalizeTimestamp(
      request,
      nowMs,
      maxAgeSeconds,
    )

  const providedSignature =
    getSignature(request)

  const body =
    await readRawBody(
      request,
      options.maxBodyBytes ??
        PAYMENT_WEBHOOK_MAX_BODY_BYTES,
    )

  verifySignature(
    secret,
    timestamp,
    body,
    providedSignature,
  )

  return parseEvent(
    parseJson(body),
  )
}
