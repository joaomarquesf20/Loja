import { prisma } from './db'

import type { ReactElement } from 'react'

import { Resend } from 'resend'

import { STORE_NAME } from '@/emails/brand'

import {
  OrderConfirmationEmail,
} from '@/emails/order-confirmation'

import type {
  OrderConfirmationEmailItem,
  OrderConfirmationEmailProps,
} from '@/emails/order-confirmation'

import {
  OrderStatusUpdateEmail,
} from '@/emails/order-status-update'

/**
 * Serviço de emails transacionais: envia a confirmação de encomenda (quando o
 * pagamento é confirmado pelo webhook) e notificações de alteração de estado
 * de encomenda (ações administrativas).
 *
 * Contrato essencial: as funções deste serviço NUNCA lançam. Emails são
 * auxiliares ao ciclo de vida das encomendas — uma falha de envio tem de ser
 * registada e ignorada, nunca interromper a confirmação de um pagamento nem a
 * resposta de uma ação administrativa. O resultado (`EmailSendOutcome`) dá o
 * desfecho sem propagar exceções.
 */

export type EmailSendOutcome =
  | {
      status: 'sent'
      id: string
    }
  | {
      status: 'skipped'
      reason:
        | 'invalid-order-id'
        | 'missing-api-key'
        | 'missing-recipient'
        | 'already-confirmed'
        | 'order-not-found'
        | 'order-not-paid'
        | 'invalid-order-data'
    }
  | {
      status: 'error'
      error: string
    }

/**
 * Menor superfície usada do cliente Resend: apenas `emails.send`, do qual são
 * lidos `data.id` ou `error.message`. Duplos de teste implementam esta
 * interface — o Resend nunca é feito mock globalmente.
 */
export type EmailSendPayload = {
  from: string
  to: string
  subject: string
  react: ReactElement
}

export type EmailSendResponse = {
  data:
    | {
        id: string
      }
    | null
  error:
    | {
        message: string
      }
    | null
}

export interface EmailClient {
  emails: {
    send(
      payload: EmailSendPayload,
    ): Promise<EmailSendResponse>
  }
}

/**
 * Valores monetários chegam do cliente Prisma em forma de `Prisma.Decimal`;
 * só é necessário `toString()` para a conversão em cêntimos.
 */
export type EmailMoneyValue = {
  toString(): string
}

export type EmailOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'

export type EmailOrderPaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type EmailOrderFulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

export type EmailOrderShippingMethod =
  | 'STANDARD'
  | 'EXPRESS'
  | null

type EmailOrderItemRecord = {
  productNameAtPurchase: string
  productSkuAtPurchase: string
  quantity: number
  priceAtPurchase: EmailMoneyValue
  subtotalAtPurchase: EmailMoneyValue
  variantOptionsAtPurchase: unknown
}

type EmailOrderEventRecord = {
  type: string
  createdAt: Date
}

export type EmailOrderRecord = {
  id: string
  orderNumber: string
  status: EmailOrderStatus
  paymentStatus: EmailOrderPaymentStatus
  fulfillmentMethod: EmailOrderFulfillmentMethod
  shippingMethod: EmailOrderShippingMethod
  subtotal: EmailMoneyValue
  shippingCost: EmailMoneyValue
  tax: EmailMoneyValue
  total: EmailMoneyValue
  shippingName: string
  shippingEmail: string
  shippingAddressLine1: string | null
  shippingAddressLine2: string | null
  shippingCity: string | null
  shippingPostalCode: string | null
  shippingCountry: string | null
  createdAt: Date
  updatedAt: Date
  items: EmailOrderItemRecord[]
  events: EmailOrderEventRecord[]
}

export type EmailOrderItemSelect = {
  productNameAtPurchase: true
  productSkuAtPurchase: true
  quantity: true
  priceAtPurchase: true
  subtotalAtPurchase: true
  variantOptionsAtPurchase: true
}

export type EmailOrderEventSelect = {
  type: true
  createdAt: true
}

export type EmailOrderSelect = {
  id: true
  orderNumber: true
  status: true
  paymentStatus: true
  fulfillmentMethod: true
  shippingMethod: true
  subtotal: true
  shippingCost: true
  tax: true
  total: true
  shippingName: true
  shippingEmail: true
  shippingAddressLine1: true
  shippingAddressLine2: true
  shippingCity: true
  shippingPostalCode: true
  shippingCountry: true
  createdAt: true
  updatedAt: true
  items: {
    orderBy: {
      id: 'asc'
    }
    select: EmailOrderItemSelect
  }
  events: {
    where: {
      type: 'PAYMENT_CONFIRMED'
    }
    orderBy: {
      createdAt: 'desc'
    }
    take: 1
    select: EmailOrderEventSelect
  }
}

export type EmailOrderFindUniqueArgs = {
  where: {
    id: string
  }
  select: EmailOrderSelect
}

export interface EmailOrderClient {
  order: {
    findUnique(
      args: EmailOrderFindUniqueArgs,
    ): Promise<EmailOrderRecord | null>
  }
}

const emailOrderItemSelect: EmailOrderItemSelect = {
  productNameAtPurchase: true,
  productSkuAtPurchase: true,
  quantity: true,
  priceAtPurchase: true,
  subtotalAtPurchase: true,
  variantOptionsAtPurchase: true,
}

const emailOrderEventSelect: EmailOrderEventSelect = {
  type: true,
  createdAt: true,
}

const emailOrderSelect: EmailOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  fulfillmentMethod: true,
  shippingMethod: true,
  subtotal: true,
  shippingCost: true,
  tax: true,
  total: true,
  shippingName: true,
  shippingEmail: true,
  shippingAddressLine1: true,
  shippingAddressLine2: true,
  shippingCity: true,
  shippingPostalCode: true,
  shippingCountry: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: {
      id: 'asc',
    },
    select: emailOrderItemSelect,
  },
  events: {
    where: {
      type: 'PAYMENT_CONFIRMED',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    select: emailOrderEventSelect,
  },
}

/**
 * Tolerância na comparação de relógios (aplicação vs. base de dados) quando se
 * decide se o evento `PAYMENT_CONFIRMED` pertence a esta entrega do webhook.
 */
const confirmationEventSkewMs = 5_000

/**
 * Limite defensivo para strings monetárias: evita interpretar formas
 * exóticas/exponenciais de `Decimal` como cêntimos a apresentar ao cliente.
 */
const MAX_MONEY_STRING_LENGTH = 14

/**
 * Sobreposições de configuração para testes, no mesmo estilo das opções do
 * serviço de webhooks (`payment-webhook.ts`): o parâmetro tem precedência
 * sobre `process.env`, permitindo testes sem alterar ambiente.
 */
export type SendEmailDeliveryOptions = {
  /** Chave do Resend; ausente/vazia → modo de simulação. */
  apiKey?: string
  /** Remetente mostrado ao cliente (`EMAIL_FROM`). */
  from?: string
  /** Duplo do cliente de envio; por omissão é criado um `Resend` real. */
  emailClient?: EmailClient
}

export type SendOrderConfirmationEmailOptions =
  SendEmailDeliveryOptions & {
    /** Cliente de dados (Prisma) para carregar a encomenda. */
    client?: EmailOrderClient
  }

export type SendOrderStatusUpdateEmailOptions =
  SendEmailDeliveryOptions & {
    client?: EmailOrderClient
  }

function getClient(
  client?: EmailOrderClient,
): EmailOrderClient {
  return (
    client ??
    (prisma as unknown as EmailOrderClient)
  )
}

function createResendEmailClient(
  apiKey: string,
): EmailClient {
  return new Resend(apiKey)
}

function normalizeOptionalString(
  value: unknown,
) {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized || null
}

/**
 * Resolve a configuração de envio: parâmetros têm precedência sobre ambiente;
 * valores ausentes/vazios devolvem `null` (a chave em falta ativa o modo de
 * simulação, `EMAIL_FROM` em falta é tratado como erro de configuração).
 */
function resolveEmailDeliveryConfig(
  options: SendEmailDeliveryOptions,
) {
  return {
    apiKey: normalizeOptionalString(
      options.apiKey ??
        process.env.RESEND_API_KEY,
    ),
    from: normalizeOptionalString(
      options.from ??
        process.env.EMAIL_FROM,
    ),
  }
}

/**
 * Converte uma string monetária (`Decimal.toString()`, ex.: "12.50") em
 * cêntimos inteiros. Devolve `null` para formas não confiáveis — os valores
 * apresentados no email nunca são inventados por aproximação.
 */
function parseMoneyToCents(
  value: EmailMoneyValue | null,
): number | null {
  if (!value) {
    return null
  }

  let raw: string

  try {
    raw = value.toString().trim()
  } catch {
    return null
  }

  if (
    !raw ||
    raw.length >
      MAX_MONEY_STRING_LENGTH ||
    /[eE]/.test(raw)
  ) {
    return null
  }

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(
      raw,
    )
  ) {
    return null
  }

  const [whole = '', fraction = ''] =
    raw.split('.')

  return (
    Number(whole) * 100 +
    Number(fraction.padEnd(2, '0'))
  )
}

/**
 * Mesma forma guardada pelo checkout:
 * `Array<{ code, name, value }>`.
 */
function normalizeVariantOptions(
  value: unknown,
) {
  const entries = Array.isArray(
    value,
  )
    ? value
    : []

  return entries.flatMap((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      Array.isArray(entry)
    ) {
      return []
    }

    const record =
      entry as Record<string, unknown>

    if (
      typeof record.name !==
        'string' ||
      typeof record.value !==
        'string'
    ) {
      return []
    }

    return [
      {
        name: record.name,
        value: record.value,
      },
    ]
  })
}

/**
 * Deteta entregas repetidas do webhook: se existir um evento
 * `PAYMENT_CONFIRMED` anterior ao momento em que este pedido começou
 * (`paymentEventSinceMs`, capturado antes do registo do pagamento), esta
 * entrega não é a que confirmou o pagamento.
 */
function isDuplicateConfirmation(
  order: EmailOrderRecord,
  paymentEventSinceMs?: number,
) {
  if (
    paymentEventSinceMs ===
    undefined
  ) {
    return false
  }

  const events = Array.isArray(
    order.events,
  )
    ? order.events
    : []

  const event = events[0]

  if (!event) {
    return false
  }

  return (
    event.createdAt.getTime() <
    paymentEventSinceMs -
      confirmationEventSkewMs
  )
}

function toEmailPreparationErrorOutcome(
  error: unknown,
  context: string,
): EmailSendOutcome {
  console.error(
    `Erro na preparação do email (${context}):`,
    error,
  )

  return {
    status: 'error',
    error:
      error instanceof Error &&
      error.message
        ? error.message
        : 'Erro na preparação do email',
  }
}

/**
 * Envio partilhado: valida configuração e destinatário, chama o cliente e
 * devolve um desfecho. Qualquer falha é registada localmente e convertida em
 * `{ status: 'error' }` — nada lança a partir daqui.
 */
async function deliverEmail(
  input: {
    to: string
    subject: string
    react: ReactElement
    context: string
  },
  options: SendEmailDeliveryOptions,
): Promise<EmailSendOutcome> {
  const config =
    resolveEmailDeliveryConfig(
      options,
    )

  const recipient =
    normalizeOptionalString(
      input.to,
    )

  if (!recipient) {
    console.warn(
      `Email (${input.context}) não enviado: sem destinatário`,
    )

    return {
      status: 'skipped',
      reason: 'missing-recipient',
    }
  }

  if (!config.apiKey) {
    console.info(
      `[email] Simulação sem RESEND_API_KEY (${input.context}): "${input.subject}" para ${recipient}`,
    )

    return {
      status: 'skipped',
      reason: 'missing-api-key',
    }
  }

  if (!config.from) {
    console.error(
      `Email (${input.context}) não enviado: EMAIL_FROM não configurado`,
    )

    return {
      status: 'error',
      error:
        'EMAIL_FROM não configurado',
    }
  }

  try {
    const client =
      options.emailClient ??
      createResendEmailClient(
        config.apiKey,
      )

    const response =
      await client.emails.send({
        from: config.from,
        to: recipient,
        subject: input.subject,
        react: input.react,
      })

    if (
      response.error &&
      response.error.message
    ) {
      console.error(
        `Falha no envio de email (${input.context}) para ${recipient}: ${response.error.message}`,
      )

      return {
        status: 'error',
        error:
          response.error.message,
      }
    }

    const id =
      response.data && response.data.id
        ? response.data.id
        : null

    if (!id) {
      console.error(
        `Resposta do fornecedor de email sem identificador (${input.context}) para ${recipient}`,
      )

      return {
        status: 'error',
        error:
          'Resposta do fornecedor de email sem identificador',
      }
    }

    return {
      status: 'sent',
      id,
    }
  } catch (error) {
    console.error(
      `Erro inesperado no envio de email (${input.context}) para ${recipient}:`,
      error,
    )

    return {
      status: 'error',
      error:
        error instanceof Error &&
        error.message
          ? error.message
          : 'Erro no envio do email',
    }
  }
}

export type SendOrderConfirmationEmailInput = {
  orderId: string
  /**
   * Instante (ms) imediatamente anterior ao registo do pagamento no webhook.
   * Combinado com o evento `PAYMENT_CONFIRMED`, impede emails repetidos em
   * entregas duplicadas do webhook. Omitido desativa a deteção.
   */
  paymentEventSinceMs?: number
}

/**
 * Constrói as propriedades do template de confirmação a partir da encomenda
 * registada. Devolve erro descritivo quando algum dado obrigatório não é
 * confiável — o email nunca mostra valores aproximados.
 */
function buildConfirmationEmailProps(
  order: EmailOrderRecord,
):
  | {
      props: OrderConfirmationEmailProps
    }
  | {
      error: string
    }
{
  const subtotalCents =
    parseMoneyToCents(order.subtotal)
  const shippingCostCents =
    parseMoneyToCents(
      order.shippingCost,
    )
  const taxCents = parseMoneyToCents(
    order.tax,
  )
  const totalCents =
    parseMoneyToCents(order.total)

  if (
    subtotalCents === null ||
    shippingCostCents === null ||
    taxCents === null ||
    totalCents === null
  ) {
    return {
      error:
        'Valores monetários da encomenda inválidos',
    }
  }

  const orderItems =
    Array.isArray(order.items)
      ? order.items
      : []

  const items: OrderConfirmationEmailItem[] =
    []

  for (const item of orderItems) {
    const unitPriceCents =
      parseMoneyToCents(
        item.priceAtPurchase,
      )
    const lineTotalCents =
      parseMoneyToCents(
        item.subtotalAtPurchase,
      )

    if (
      unitPriceCents === null ||
      lineTotalCents === null ||
      !Number.isSafeInteger(
        item.quantity,
      ) ||
      item.quantity < 1
    ) {
      return {
        error:
          'Artigos da encomenda inválidos',
      }
    }

    items.push({
      productName:
        item.productNameAtPurchase,
      sku: item.productSkuAtPurchase,
      quantity: item.quantity,
      unitPriceCents,
      lineTotalCents,
      options:
        normalizeVariantOptions(
          item.variantOptionsAtPurchase,
        ),
    })
  }

  return {
    props: {
      orderNumber: order.orderNumber,
      customerName:
        order.shippingName,
      fulfillmentMethod:
        order.fulfillmentMethod,
      shippingMethod:
        order.fulfillmentMethod ===
        'DELIVERY'
          ? (order.shippingMethod ??
            'STANDARD')
          : null,
      shippingAddress:
        order.fulfillmentMethod ===
          'PICKUP' ||
        !order.shippingAddressLine1
          ? null
          : {
              name: order.shippingName,
              line1:
                order.shippingAddressLine1,
              line2:
                order.shippingAddressLine2,
              postalCode:
                order.shippingPostalCode,
              city: order.shippingCity,
              country:
                order.shippingCountry,
            },
      items,
      subtotalCents,
      shippingCostCents,
      taxCents,
      totalCents,
    },
  }
}

/**
 * Envia o email de confirmação de encomenda após o pagamento ficar pago.
 * Nunca lança: devolve sempre um `EmailSendOutcome`.
 */
export async function sendOrderConfirmationEmail(
  input: SendOrderConfirmationEmailInput,
  options: SendOrderConfirmationEmailOptions = {},
): Promise<EmailSendOutcome> {
  const orderId =
    typeof input.orderId ===
    'string'
      ? input.orderId.trim()
      : ''

  if (!orderId) {
    console.warn(
      'Email de confirmação não enviado: identificador de encomenda inválido',
    )

    return {
      status: 'skipped',
      reason: 'invalid-order-id',
    }
  }

  const paymentEventSinceMs =
    typeof input.paymentEventSinceMs ===
      'number' &&
    Number.isFinite(
      input.paymentEventSinceMs,
    )
      ? input.paymentEventSinceMs
      : undefined

  const client =
    getClient(options.client)

  try {
    const order =
      await client.order.findUnique(
        {
          where: { id: orderId },
          select: emailOrderSelect,
        },
      )

    if (!order) {
      console.warn(
        `Email de confirmação não enviado: encomenda ${orderId} não encontrada`,
      )

      return {
        status: 'skipped',
        reason: 'order-not-found',
      }
    }

    if (
      order.paymentStatus !==
      'PAID'
    ) {
      console.warn(
        `Email de confirmação não enviado: pagamento da encomenda ${orderId} não está pago`,
      )

      return {
        status: 'skipped',
        reason: 'order-not-paid',
      }
    }

    if (
      isDuplicateConfirmation(
        order,
        paymentEventSinceMs,
      )
    ) {
      console.warn(
        `Email de confirmação não enviado: pagamento da encomenda ${orderId} já tinha sido confirmado (entrega repetida)`,
      )

      return {
        status: 'skipped',
        reason: 'already-confirmed',
      }
    }

    const built =
      buildConfirmationEmailProps(
        order,
      )

    if ('error' in built) {
      console.error(
        `Email de confirmação não enviado: ${built.error} (encomenda ${orderId})`,
      )

      return {
        status: 'error',
        error: built.error,
      }
    }

    return await deliverEmail(
      {
        to: order.shippingEmail,
        subject: `${STORE_NAME}: Encomenda ${order.orderNumber} confirmada`,
        react:
          OrderConfirmationEmail(
            built.props,
          ),
        context: 'order-confirmation',
      },
      options,
    )
  } catch (error) {
    return toEmailPreparationErrorOutcome(
      error,
      `confirmação da encomenda ${orderId}`,
    )
  }
}

export type SendOrderStatusUpdateEmailInput = {
  orderId: string
}

/**
 * Envia o email de atualização de estado após uma ação administrativa.
 * Mostra sempre o estado atual da encomenda (fonte de verdade). Nunca lança.
 */
export async function sendOrderStatusUpdateEmail(
  input: SendOrderStatusUpdateEmailInput,
  options: SendOrderStatusUpdateEmailOptions = {},
): Promise<EmailSendOutcome> {
  const orderId =
    typeof input.orderId ===
    'string'
      ? input.orderId.trim()
      : ''

  if (!orderId) {
    console.warn(
      'Email de atualização não enviado: identificador de encomenda inválido',
    )

    return {
      status: 'skipped',
      reason: 'invalid-order-id',
    }
  }

  const client =
    getClient(options.client)

  try {
    const order =
      await client.order.findUnique(
        {
          where: { id: orderId },
          select: emailOrderSelect,
        },
      )

    if (!order) {
      console.warn(
        `Email de atualização não enviado: encomenda ${orderId} não encontrada`,
      )

      return {
        status: 'skipped',
        reason: 'order-not-found',
      }
    }

    return await deliverEmail(
      {
        to: order.shippingEmail,
        subject: `${STORE_NAME}: Atualização da encomenda ${order.orderNumber}`,
        react:
          OrderStatusUpdateEmail({
            orderNumber:
              order.orderNumber,
            customerName:
              order.shippingName,
            status: order.status,
            paymentStatus:
              order.paymentStatus,
            updatedAt:
              order.updatedAt.toISOString(),
          }),
        context: 'order-status-update',
      },
      options,
    )
  } catch (error) {
    return toEmailPreparationErrorOutcome(
      error,
      `atualização da encomenda ${orderId}`,
    )
  }
}
