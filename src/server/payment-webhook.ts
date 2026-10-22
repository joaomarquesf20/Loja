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

/**
 * Limite superior aceito para a janela configurada por ambiente. Impede que
 * um erro de configuração desative de facto a proteção anti-replay.
 */
export const PAYMENT_WEBHOOK_MAX_AGE_SECONDS_LIMIT =
  24 * 60 * 60

const PAYMENT_WEBHOOK_SECRET_MIN_LENGTH =
  32

const signaturePattern =
  /^sha256=([a-f0-9]{64})$/i

const paymentAmountPattern =
  /^\d{1,8}(?:\.\d{1,2})?$/

const currencyPattern =
  /^[A-Z]{3}$/

type PaymentWebhookEventBase = {
  orderId: string
  paymentProvider: string
  paymentReference: string
}

/**
 * `amount` é uma string decimal (ex.: "129.90") para evitar erros de
 * arredondamento de números de vírgula flutuante. `currency` é o código
 * ISO 4217 em maiúsculas. A coerência com a encomenda é validada no serviço
 * de encomendas.
 */
export type PaymentPaidWebhookEvent =
  PaymentWebhookEventBase & {
    type: 'PAYMENT_PAID'
    amount: string
    currency: string
  }

export type PaymentFailedWebhookEvent =
  PaymentWebhookEventBase & {
    type: 'PAYMENT_FAILED'
  }

export type PaymentWebhookEvent =
  | PaymentPaidWebhookEvent
  | PaymentFailedWebhookEvent

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
  constructor(
    message = 'Configuração do webhook de pagamento inválida (PAYMENT_WEBHOOK_SECRET / PAYMENT_WEBHOOK_MAX_AGE_SECONDS)',
  ) {
    super(message)
    this.name =
      'PaymentWebhookConfigurationError'
  }
}

type VerifyPaymentWebhookOptions = {
  secret?: string
  previousSecret?: string
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

function isValidWebhookSecret(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.length >=
      PAYMENT_WEBHOOK_SECRET_MIN_LENGTH
  )
}

/**
 * Resolve os segredos aceites pelo verificador: o segredo ativo e,
 * opcionalmente, o segredo anterior durante a rotação (R11/L3 do documento
 * `payment-provider-webhook-requirements.md`). Ambos têm de cumprir o
 * comprimento mínimo; um segredo anterior mal configurado falha em fechado.
 */
function resolveActiveSecrets(
  override?: string,
  previousOverride?: string,
) {
  const current =
    override ??
    process.env.PAYMENT_WEBHOOK_SECRET

  if (
    !isValidWebhookSecret(current)
  ) {
    throw new PaymentWebhookConfigurationError()
  }

  const secrets = [current]

  const previous =
    previousOverride ??
    process.env.PAYMENT_WEBHOOK_SECRET_PREVIOUS

  if (
    typeof previous === 'string' &&
    previous.length > 0
  ) {
    if (
      !isValidWebhookSecret(previous)
    ) {
      throw new PaymentWebhookConfigurationError(
        'PAYMENT_WEBHOOK_SECRET_PREVIOUS não é um segredo válido para rotação',
      )
    }

    if (!secrets.includes(previous)) {
      secrets.push(previous)
    }
  }

  return secrets
}

/**
 * Janela temporal da assinatura, em segundos (R9/M1): usa por omissão
 * `PAYMENT_WEBHOOK_MAX_AGE_SECONDS` (±5 minutos = 300 s) e pode ser
 * configurada por ambiente. Valores inválidos falham em fechado —
 * a proteção anti-replay nunca é rebaixada em silêncio.
 */
function resolveConfiguredMaxAgeSeconds(
  override?: number,
) {
  if (override !== undefined) {
    return override
  }

  const rawValue =
    process.env.PAYMENT_WEBHOOK_MAX_AGE_SECONDS

  const normalized =
    typeof rawValue === 'string'
      ? rawValue.trim()
      : ''

  if (!normalized) {
    return PAYMENT_WEBHOOK_MAX_AGE_SECONDS
  }

  const value = Number(normalized)

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value >
      PAYMENT_WEBHOOK_MAX_AGE_SECONDS_LIMIT
  ) {
    throw new PaymentWebhookConfigurationError(
      'PAYMENT_WEBHOOK_MAX_AGE_SECONDS tem de ser um inteiro entre 1 e 86400',
    )
  }

  return value
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
  secrets: string[],
  timestamp: string,
  body: Uint8Array,
  providedSignature: Buffer,
) {
  let signatureMatches = false

  for (const secret of secrets) {
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
      providedSignature.length ===
        expectedSignature.length &&
      timingSafeEqual(
        providedSignature,
        expectedSignature,
      )
    ) {
      signatureMatches = true

      break
    }
  }

  if (!signatureMatches) {
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

function normalizePattern(
  value: unknown,
  pattern: RegExp,
) {
  if (typeof value !== 'string') {
    throw new PaymentWebhookValidationError()
  }

  const normalized =
    value.trim()

  if (!pattern.test(normalized)) {
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

  const base: PaymentWebhookEventBase = {
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

  if (value.type === 'PAYMENT_FAILED') {
    return {
      ...base,
      type: 'PAYMENT_FAILED',
    }
  }

  return {
    ...base,
    type: 'PAYMENT_PAID',
    amount: normalizePattern(
      value.amount,
      paymentAmountPattern,
    ),
    currency: normalizePattern(
      value.currency,
      currencyPattern,
    ),
  }
}

export async function verifyPaymentWebhookRequest(
  request: Request,
  options: VerifyPaymentWebhookOptions = {},
): Promise<PaymentWebhookEvent> {
  const secrets =
    resolveActiveSecrets(
      options.secret,
      options.previousSecret,
    )

  const nowMs =
    options.nowMs ??
    Date.now()

  const maxAgeSeconds =
    resolveConfiguredMaxAgeSeconds(
      options.maxAgeSeconds,
    )

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
    secrets,
    timestamp,
    body,
    providedSignature,
  )

  return parseEvent(
    parseJson(body),
  )
}
