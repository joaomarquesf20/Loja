import Stripe from 'stripe'

import { prisma } from './db'
import { PAYMENT_CURRENCY } from './order-lifecycle'

/**
 * Adaptador do Stripe para a loja (§13):
 * - o contrato é um cliente estrutural mínimo para que os testes usem fakes
 *   sem depender da SDK;
 * - a SDK real só é inicializada de forma preguiçosa a partir de STRIPE_SECRET_KEY;
 * - as chaves/sessões ficam registadas na encomenda através de
 *   paymentProvider/paymentProvider + paymentReference.
 */

export const STRIPE_PAYMENT_PROVIDER =
  'STRIPE'

export const STRIPE_CHECKOUT_COMPLETED_EVENT =
  'checkout.session.completed'

/**
 * Moeda usada nos parceiros de preço do Stripe: a SDK espera o código ISO
 * 4217 em minúsculas ("eur"), enquanto a loja normaliza para "EUR".
 */
const STRIPE_CURRENCY =
  PAYMENT_CURRENCY.toLowerCase()

const stripeCurrencyPattern =
  /^[a-z]{3}$/

export type StripeValidationErrorField =
  | 'orderId'
  | 'orderNumber'
  | 'customerEmail'
  | 'items'
  | 'quantity'
  | 'unitAmount'
  | 'urls'
  | 'amount'
  | 'currency'
  | 'sessionId'
  | 'metadata'
  | 'event'

export class StripeValidationError extends Error {
  constructor(
    public readonly field: StripeValidationErrorField,
    message: string,
  ) {
    super(message)
    this.name = 'StripeValidationError'
  }
}

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeConfigurationError'
  }
}

/**
 * A chamada à API do Stripe falhou (rede, chave inválida, recusas do
 * fornecedor). A mensagem não deve expor detalhes do erro externo.
 */
export class StripeSessionRequestError extends Error {
  constructor(
    message =
      'Não foi possível iniciar o pagamento no Stripe',
  ) {
    super(message)
    this.name = 'StripeSessionRequestError'
  }
}

/**
 * A encomenda já foi iniciada/alterada por outro pedido em paralelo.
 */
export class StripeCheckoutConflictError extends Error {
  constructor(
    message =
      'A encomenda foi alterada durante a iniciação do pagamento',
  ) {
    super(message)
    this.name =
      'StripeCheckoutConflictError'
  }
}

export class StripeCheckoutOrderNotFoundError extends Error {
  constructor() {
    super('Encomenda não encontrada')
    this.name =
      'StripeCheckoutOrderNotFoundError'
  }
}

/**
 * Assinatura do webhook inválida/ausente. Corresponde a um pedido não
 * fidedigno (resposta 400).
 */
export class StripeWebhookAuthenticationError extends Error {
  constructor(
    message =
      'Assinatura do webhook inválida',
  ) {
    super(message)
    this.name =
      'StripeWebhookAuthenticationError'
  }
}

type StripeCheckoutSessionCreateArgs =
  {
    mode: 'payment'
    customer_email: string
    client_reference_id: string
    success_url: string
    cancel_url: string
    locale: 'pt'
    metadata: Record<string, string>
    line_items: Array<{
      quantity: number
      price_data: {
        currency: string
        unit_amount: number
        product_data: {
          name: string
          description?: string
        }
      }
    }>
  }

export type StripeCheckoutSessionsDelegate =
  {
    create(
      args: StripeCheckoutSessionCreateArgs,
    ): Promise<unknown>
  }

export type StripeWebhooksDelegate = {
  constructEvent(
    payload: string,
    header: string,
    secret: string,
  ): unknown
}

export type StripeClient = {
  checkout: {
    sessions: StripeCheckoutSessionsDelegate
  }
  webhooks: StripeWebhooksDelegate
}

/**
 * Evento normalizado do gateway, apenas com o necessário para o fluxo de
 * checkout. `data.object` é validado antes de qualquer uso.
 */
export type StripeGatewayEvent = {
  id: string
  type: string
  data: {
    object: unknown
  }
}

export type StripeConfirmedCheckoutSession =
  {
    sessionId: string
    orderId: string
    amount: string
    currency: string
  }

export type StripeCheckoutLineItemInput =
  {
    name: string
    description?: string | null
    quantity: number
    /**
     * Montante unitário em cêntimos — a unidade nativa do Stripe evita
     * aritmética de vírgula flutuante no lado do servidor.
     */
    unitAmountCents: number
  }

export type StripeCheckoutSessionInput = {
  orderId: string
  orderNumber: string
  customerEmail: string
  items: Array<StripeCheckoutLineItemInput>
  successUrl: string
  cancelUrl: string
}

export type StripeCheckoutSessionResult = {
  sessionId: string
  sessionUrl: string | null
}

let cachedDefaultClient: {
  secretKey: string
  client: StripeClient
} | null = null

export function resolveStripeSecretKey(
  override?: string | null,
) {
  const value = (
    override ??
    process.env.STRIPE_SECRET_KEY ??
    ''
  ).trim()

  if (!value) {
    throw new StripeConfigurationError(
      'A chave secreta do Stripe não está configurada',
    )
  }

  return value
}

export function resolveStripeWebhookSecret(
  override?: string | null,
) {
  const value = (
    override ??
    process.env.STRIPE_WEBHOOK_SECRET ??
    ''
  ).trim()

  if (!value) {
    throw new StripeConfigurationError(
      'O segredo do webhook do Stripe não está configurado',
    )
  }

  return value
}

function createRealStripeClient(
  secretKey: string,
): StripeClient {
  const client = new Stripe(secretKey)

  return client as unknown as StripeClient
}

/**
 * Cliente por predefinição (SDK real). A cache é indexada pela chave para
 * que testes que alterem o ambiente obtenham um cliente novo.
 */
export function getDefaultStripeClient(): StripeClient {
  const secretKey =
    resolveStripeSecretKey()

  if (
    cachedDefaultClient?.secretKey ===
    secretKey
  ) {
    return cachedDefaultClient.client
  }

  const client =
    createRealStripeClient(secretKey)

  cachedDefaultClient = {
    secretKey,
    client,
  }

  return client
}

/**
 * Converte cêntimos (inteiros, como o Stripe) numa string decimal
 * "inteiro.centavos" sem aritmética de vírgula flutuante.
 */
export function centsToDecimalString(
  cents: number,
): string {
  if (
    !Number.isSafeInteger(cents) ||
    cents < 0
  ) {
    throw new StripeValidationError(
      'amount',
      'Valor de pagamento inválido',
    )
  }

  const whole =
    Math.floor(cents / 100)
  const fraction = cents % 100

  return `${whole}.${String(fraction).padStart(2, '0')}`
}

/**
 * Converte montantes monetários (string decimal vinda do Prisma) em
 * cêntimos inteiros, para comparações seguras com o Stripe.
 */
export function decimalMoneyToCents(
  value: string,
): number {
  const normalized =
    typeof value === 'string'
      ? value.trim()
      : ''

  if (
    !/^\d{1,8}(?:\.\d{1,2})?$/.test(
      normalized,
    )
  ) {
    throw new StripeValidationError(
      'amount',
      'Montante monetário inválido',
    )
  }

  const [whole, fraction = ''] =
    normalized.split('.')

  return (
    Number(whole) * 100 +
    Number(fraction.padEnd(2, '0'))
  )
}

function isValidCheckoutUrl(
  value: unknown,
) {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function normalizeRequiredStripeString(
  value: unknown,
  field: StripeValidationErrorField,
  message: string,
) {
  const normalized =
    typeof value === 'string'
      ? value.trim()
      : ''

  if (!normalized) {
    throw new StripeValidationError(
      field,
      message,
    )
  }

  return normalized
}

/**
 * Constrói os parâmetros da sessão de Checkout a partir da projeção da
 * encomenda. O total da sessão tem de ser exatamente o total da encomenda
 * (artigos + portes); qualquer divergência é rejeitada.
 */
export function buildStripeCheckoutSessionParams(
  input: StripeCheckoutSessionInput,
): StripeCheckoutSessionCreateArgs {
  const orderId =
    normalizeRequiredStripeString(
      input.orderId,
      'orderId',
      'Encomenda inválida',
    )

  const orderNumber =
    normalizeRequiredStripeString(
      input.orderNumber,
      'orderNumber',
      'Número de encomenda inválido',
    )

  const customerEmail =
    normalizeRequiredStripeString(
      input.customerEmail,
      'customerEmail',
      'Email do cliente inválido',
    )

  if (
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    throw new StripeValidationError(
      'items',
      'A encomenda não tem artigos para pagamento',
    )
  }

  if (
    !isValidCheckoutUrl(
      input.successUrl,
    ) ||
    !isValidCheckoutUrl(
      input.cancelUrl,
    )
  ) {
    throw new StripeValidationError(
      'urls',
      'URLs de retorno do pagamento inválidos',
    )
  }

  let itemsSumCents = 0

  const lineItems =
    input.items.map(
      (item) => {
        const name =
          normalizeRequiredStripeString(
            item.name,
            'items',
            'Artigo sem nome para pagamento',
          )

        if (
          !Number.isSafeInteger(
            item.quantity,
          ) ||
          item.quantity <= 0
        ) {
          throw new StripeValidationError(
            'quantity',
            'Quantidade de artigo inválida',
          )
        }

        if (
          !Number.isSafeInteger(
            item.unitAmountCents,
          ) ||
          item.unitAmountCents <= 0
        ) {
          throw new StripeValidationError(
            'unitAmount',
            'Preço unitário de artigo inválido',
          )
        }

        itemsSumCents +=
          item.unitAmountCents *
          item.quantity

        const description =
          typeof item.description ===
            'string' &&
          item.description.trim()
            ? item.description.trim()
            : undefined

        return {
          quantity: item.quantity,
          price_data: {
            currency: STRIPE_CURRENCY,
            unit_amount:
              item.unitAmountCents,
            product_data: {
              name,
              ...(description
                ? {
                    description,
                  }
                : {}),
            },
          },
        }
      },
    )

  if (
    itemsSumCents <= 0
  ) {
    throw new StripeValidationError(
      'items',
      'O total a pagar não pode ser zero',
    )
  }

  return {
    mode: 'payment',
    customer_email: customerEmail,
    client_reference_id: orderId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    locale: 'pt',
    metadata: {
      orderId,
      orderNumber,
      paymentProvider:
        STRIPE_PAYMENT_PROVIDER,
    },
    line_items: lineItems,
  }
}

/**
 * Cria uma sessão de Checkout no Stripe a partir de valores já validados
 * pela lógica de negócio. Lança StripeSessionRequestError quando a
 * chamada externa falha — o erro original é registado em log.
 */
export async function createStripeCheckoutSession(
  input: StripeCheckoutSessionInput,
  client?: StripeClient,
): Promise<StripeCheckoutSessionResult> {
  const params =
    buildStripeCheckoutSessionParams(
      input,
    )

  const stripeClient =
    client ?? getDefaultStripeClient()

  let rawSession: unknown

  try {
    rawSession =
      await stripeClient.checkout.sessions.create(
        params,
      )
  } catch (error) {
    console.error(
      'Falha ao criar sessão de checkout no Stripe:',
      error,
    )

    throw new StripeSessionRequestError()
  }

  return normalizeCreatedSession(
    rawSession,
  )
}

function normalizeCreatedSession(
  rawSession: unknown,
): StripeCheckoutSessionResult {
  if (
    typeof rawSession !== 'object' ||
    rawSession === null
  ) {
    throw new Error(
      'Resposta inesperada do Stripe ao criar a sessão de pagamento',
    )
  }

  const session =
    rawSession as {
      id?: unknown
      url?: unknown
    }

  const sessionId = normalizeRequiredStripeString(
    session.id,
    'sessionId',
    'Resposta do Stripe sem identificador de sessão',
  )

  if (
    session.url !== undefined &&
    session.url !== null &&
    typeof session.url !== 'string'
  ) {
    throw new Error(
      'Resposta inesperada do Stripe ao criar a sessão de pagamento',
    )
  }

  return {
    sessionId,
    sessionUrl:
      typeof session.url ===
      'string' &&
      session.url
        ? session.url
        : null,
  }
}

/**
 * Verifica a assinatura do webhook e devolve o evento normalizado.
 * `constructEvent` da SDK é usado com o corpo cru, tal como exige o Stripe.
 */
export async function verifyStripeWebhookEvent(
  input: {
    payload: string
    signature: string | null
    secret?: string | null
    client?: StripeClient
  },
): Promise<StripeGatewayEvent> {
  const signature =
    typeof input.signature === 'string'
      ? input.signature.trim()
      : ''

  if (!signature) {
    throw new StripeWebhookAuthenticationError()
  }

  const secret =
    resolveStripeWebhookSecret(
      input.secret,
    )

  const stripeClient =
    input.client ??
    getDefaultStripeClient()

  let rawEvent: unknown

  try {
    rawEvent =
      stripeClient.webhooks.constructEvent(
        input.payload,
        signature,
        secret,
      )
  } catch (error) {
    console.error(
      'Assinatura do webhook do Stripe rejeitada:',
      error,
    )

    throw new StripeWebhookAuthenticationError()
  }

  if (
    typeof rawEvent !== 'object' ||
    rawEvent === null
  ) {
    throw new StripeValidationError(
      'event',
      'Evento do Stripe inválido',
    )
  }

  const event =
    rawEvent as {
      id?: unknown
      type?: unknown
      data?: unknown
    }

  const eventId =
    normalizeRequiredStripeString(
      event.id,
      'event',
      'Evento do Stripe sem identificador',
    )

  const eventType =
    normalizeRequiredStripeString(
      event.type,
      'event',
      'Evento do Stripe sem tipo',
    )

  if (
    typeof event.data !== 'object' ||
    event.data === null
  ) {
    throw new StripeValidationError(
      'event',
      'Evento do Stripe sem dados',
    )
  }

  const { object } =
    event.data as {
      object?: unknown
    }

  if (
    typeof object !== 'object' ||
    object === null
  ) {
    throw new StripeValidationError(
      'event',
      'Evento do Stripe sem objeto de dados',
    )
  }

  return {
    id: eventId,
    type: eventType,
    data: {
      object,
    },
  }
}

/**
 * Extrai da sessão de Checkout concluída os dados necessários para
 * confirmar o pagamento na encomenda. Devolve null quando o evento não
 * representa um pagamento pago (ex.: métodos assíncronos).
 */
export function mapConfirmedCheckoutSession(
  event: StripeGatewayEvent,
): StripeConfirmedCheckoutSession | null {
  const session =
    event.data.object as {
      id?: unknown
      amount_total?: unknown
      currency?: unknown
      payment_status?: unknown
      metadata?: unknown
    }

  const sessionId =
    normalizeRequiredStripeString(
      session.id,
      'sessionId',
      'Sessão de pagamento sem identificador',
    )

  if (
    session.payment_status !==
    'paid'
  ) {
    return null
  }

  if (
    typeof session.metadata !==
      'object' ||
    session.metadata === null
  ) {
    throw new StripeValidationError(
      'metadata',
      'Sessão sem metadados de encomenda',
    )
  }

  const metadata =
    session.metadata as Record<string, unknown>

  const orderId =
    normalizeRequiredStripeString(
      metadata.orderId,
      'metadata',
      'Sessão sem identificação da encomenda',
    )

  if (
    typeof session.amount_total !==
      'number' ||
    !Number.isInteger(session.amount_total)
  ) {
    throw new StripeValidationError(
      'amount',
      'Sessão sem valor de pagamento válido',
    )
  }

  const currency =
    normalizeRequiredStripeString(
      session.currency,
      'currency',
      'Sessão sem moeda de pagamento',
    )

  if (
    !stripeCurrencyPattern.test(
      currency,
    )
  ) {
    throw new StripeValidationError(
      'currency',
      'Moeda de pagamento inválida',
    )
  }

  const amount = centsToDecimalString(
    session.amount_total,
  )

  return {
    sessionId,
    orderId,
    amount,
    currency: currency.toUpperCase(),
  }
}

/**
 * Encomendas nestes estados podem receber a iniciação do pagamento, tal
 * como no fluxo simulado.
 */
const stripePayableOrderStatuses =
  new Set<string>([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_PICKUP',
  ])

export type StripeCheckoutProjection = {
  orderId: string
  orderNumber: string
  customerEmail: string
  status: string
  items: Array<StripeCheckoutLineItemInput>
}

type StripeOrderItemRecord = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: {
    toString(): string
  }
  quantity: number
}

type StripeOrderRecord = {
  id: string
  orderNumber: string
  userId: string | null
  status: string
  paymentStatus: string
  paymentProvider: string | null
  paymentReference: string | null
  fulfillmentMethod: string
  shippingCost: {
    toString(): string
  }
  total: {
    toString(): string
  }
  shippingEmail: string
  items: Array<StripeOrderItemRecord>
}

type StripeOrderFindFirstArgs = {
  where: {
    id: string
    userId?: string
  }
  select: {
    id: true
    orderNumber: true
    userId: true
    status: true
    paymentStatus: true
    paymentProvider: true
    paymentReference: true
    fulfillmentMethod: true
    shippingCost: true
    total: true
    shippingEmail: true
    items: {
      select: {
        id: true
        productNameAtPurchase: true
        productSkuAtPurchase: true
        priceAtPurchase: true
        quantity: true
      }
    }
  }
}

type StripeOrderUpdateManyArgs = {
  where: {
    id: string
    userId: string
    status: string
    paymentStatus: 'PENDING'
    paymentProvider: null
    paymentReference: null
  }
  data: {
    paymentProvider:
      typeof STRIPE_PAYMENT_PROVIDER
    paymentReference: string
  }
}

export interface StripeCheckoutDbClient {
  order: {
    findFirst(
      args: StripeOrderFindFirstArgs,
    ): Promise<StripeOrderRecord | null>
    updateMany(
      args: StripeOrderUpdateManyArgs,
    ): Promise<{ count: number }>
  }
}

function getStripeCheckoutDbClient(
  client?: StripeCheckoutDbClient,
): StripeCheckoutDbClient {
  return (
    client ??
    (prisma as unknown as StripeCheckoutDbClient)
  )
}

export type StripeCheckoutUrls = {
  successUrl: string
  cancelUrl: string
}

export type StripeInitiatedCheckoutSession =
  {
    orderId: string
    sessionId: string
    sessionUrl: string | null
  }

/**
 * Carrega a encomenda (com artigos e portes) e converte-a na projeção
 * necessária para a sessão de Checkout. Todos os montantes são convertidos
 * em cêntimos para coincidirem com o formato do Stripe.
 */
export async function loadStripeCheckoutProjection(
  orderId: string,
  userId: string,
  db?: StripeCheckoutDbClient,
): Promise<StripeCheckoutProjection> {
  const client =
    getStripeCheckoutDbClient(db)

  const order =
    await client.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        paymentStatus: true,
        paymentProvider: true,
        paymentReference: true,
        fulfillmentMethod: true,
        shippingCost: true,
        total: true,
        shippingEmail: true,
        items: {
          select: {
            id: true,
            productNameAtPurchase: true,
            productSkuAtPurchase: true,
            priceAtPurchase: true,
            quantity: true,
          },
        },
      },
    })

  if (!order) {
    throw new StripeCheckoutOrderNotFoundError()
  }

  if (
    !stripePayableOrderStatuses.has(
      order.status,
    )
  ) {
    throw new StripeCheckoutConflictError(
      'O estado da encomenda não permite iniciar o pagamento',
    )
  }

  if (
    order.paymentStatus !==
    'PENDING'
  ) {
    throw new StripeCheckoutConflictError(
      'A encomenda já tem um estado de pagamento iniciado',
    )
  }

  if (
    order.paymentProvider !==
      null ||
    order.paymentReference !==
      null
  ) {
    throw new StripeCheckoutConflictError(
      'O pagamento da encomenda já foi iniciado',
    )
  }

  const items: Array<
    StripeCheckoutLineItemInput
  > = order.items.map(
      (item) => ({
        name: item.productNameAtPurchase,
        description:
          item.productSkuAtPurchase,
        quantity: item.quantity,
        unitAmountCents:
          decimalMoneyToCents(
            item.priceAtPurchase.toString(),
          ),
      }),
    )

  const shippingCostCents =
    decimalMoneyToCents(
      order.shippingCost.toString(),
    )

  if (shippingCostCents > 0) {
    items.push({
      name: 'Portes de envio',
      description: null,
      quantity: 1,
      unitAmountCents: shippingCostCents,
    })
  }

  // A sessão do Stripe cobra a soma dos artigos; garanti que coincide
  // com o total da encomenda antes de abrir a sessão.
  const expectedTotalCents =
    decimalMoneyToCents(
      order.total.toString(),
    )

  let itemsSumCents = 0

  for (const item of items) {
    itemsSumCents +=
      item.unitAmountCents *
      item.quantity
  }

  if (
    itemsSumCents !==
    expectedTotalCents
  ) {
    throw new StripeCheckoutConflictError(
      'O total da encomenda não corresponde aos artigos e aos portes de envio',
    )
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerEmail: order.shippingEmail,
    status: order.status,
    items,
  }
}

/**
 * Regista a referência da sessão Stripe na encomenda. O guard de escrita
 * garante a persistência apenas sobre o estado lido, em primeira
 * iniciação, e detecta alterações concorrentes.
 */
async function persistStripeCheckoutSession(
  orderId: string,
  userId: string,
  status: string,
  sessionId: string,
  db?: StripeCheckoutDbClient,
) {
  const client =
    getStripeCheckoutDbClient(db)

  const result =
    await client.order.updateMany({
      where: {
        id: orderId,
        userId,
        status,
        paymentStatus: 'PENDING',
        paymentProvider: null,
        paymentReference: null,
      },
      data: {
        paymentProvider:
          STRIPE_PAYMENT_PROVIDER,
        paymentReference: sessionId,
      },
    })

  if (result.count !== 1) {
    throw new StripeCheckoutConflictError(
      'A encomenda foi alterada durante a iniciação do pagamento',
    )
  }
}

/**
 * Fluxo completo de iniciação: projeta a encomenda, cria a sessão no
 * Stripe e guarda a referência. Se a persistência falhar por alteração
 * concorrente, a sessão externa fica sem efeito (webhook apenas confirma
 * encomendas com a referência registada).
 */
export async function initiateStripeCheckoutForOrder(
  orderId: string,
  userId: string,
  urls: StripeCheckoutUrls,
  dependencies?: {
    db?: StripeCheckoutDbClient
    stripeClient?: StripeClient
  },
): Promise<StripeInitiatedCheckoutSession> {
  const projection =
    await loadStripeCheckoutProjection(
      orderId,
      userId,
      dependencies?.db,
    )

  const session =
    await createStripeCheckoutSession(
      {
        orderId: projection.orderId,
        orderNumber:
          projection.orderNumber,
        customerEmail:
          projection.customerEmail,
        items: projection.items,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
      },
      dependencies?.stripeClient,
    )

  await persistStripeCheckoutSession(
    projection.orderId,
    userId,
    projection.status,
    session.sessionId,
    dependencies?.db,
  )

  return {
    orderId: projection.orderId,
    sessionId: session.sessionId,
    sessionUrl: session.sessionUrl,
  }
}
