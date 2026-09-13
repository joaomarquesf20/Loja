#!/usr/bin/env node

import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import pg from 'pg'

const { Client } = pg

const PAYMENT_PROVIDER = 'PFA_SIMULATED'
const DEFAULT_BASE_URL = 'http://localhost:3000'
const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
])

function fail(message) {
  console.error(`Erro: ${message}`)
  process.exit(1)
}

function parseEnvFile(contents) {
  const values = new Map()

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')

    if (separatorIndex <= 0) {
      continue
    }

    const key = line
      .slice(0, separatorIndex)
      .trim()

    let value = line
      .slice(separatorIndex + 1)
      .trim()

    if (
      value.length >= 2 &&
      (
        (
          value.startsWith('"') &&
          value.endsWith('"')
        ) ||
        (
          value.startsWith("'") &&
          value.endsWith("'")
        )
      )
    ) {
      value = value.slice(1, -1)
    }

    values.set(key, value)
  }

  return values
}

async function loadLocalEnvironment() {
  let contents

  try {
    contents = await readFile(
      new URL('../.env', import.meta.url),
      'utf8',
    )
  } catch {
    fail(
      'Não foi possível ler o ficheiro .env na raiz do projeto.',
    )
  }

  const values = parseEnvFile(contents)

  const databaseUrl =
    process.env.DATABASE_URL ??
    values.get('DATABASE_URL')

  const webhookSecret =
    process.env.PAYMENT_WEBHOOK_SECRET ??
    values.get('PAYMENT_WEBHOOK_SECRET')

  if (!databaseUrl) {
    fail(
      'DATABASE_URL não está configurado.',
    )
  }

  if (
    !webhookSecret ||
    webhookSecret.length < 32
  ) {
    fail(
      'PAYMENT_WEBHOOK_SECRET não está configurado corretamente.',
    )
  }

  return {
    databaseUrl,
    webhookSecret,
  }
}

function normalizeBaseUrl(rawValue) {
  let url

  try {
    url = new URL(
      rawValue || DEFAULT_BASE_URL,
    )
  } catch {
    fail('URL base inválido.')
  }

  if (
    url.protocol !== 'http:' &&
    url.protocol !== 'https:'
  ) {
    fail(
      'A URL base tem de usar HTTP ou HTTPS.',
    )
  }

  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    fail(
      'Este simulador só pode enviar webhooks para localhost.',
    )
  }

  return url.origin
}

function normalizeOrderIdentifier(value) {
  const normalized = value?.trim()

  if (
    !normalized ||
    normalized.length > 191
  ) {
    fail(
      'Indica um id ou número de encomenda válido.',
    )
  }

  return normalized
}

async function findOrder(
  databaseUrl,
  orderIdentifier,
) {
  const client = new Client({
    connectionString: databaseUrl,
  })

  try {
    await client.connect()

    const result = await client.query(
      `
        SELECT
          id,
          "orderNumber",
          "paymentStatus",
          "paymentProvider",
          "paymentReference"
        FROM "Order"
        WHERE
          id = $1
          OR "orderNumber" = $1
        LIMIT 2
      `,
      [orderIdentifier],
    )

    if (result.rows.length !== 1) {
      fail(
        result.rows.length === 0
          ? 'Encomenda não encontrada.'
          : 'Identificador de encomenda ambíguo.',
      )
    }

    return result.rows[0]
  } finally {
    await client.end().catch(() => {})
  }
}

function validateOrderForSimulation(order) {
  if (
    order.paymentProvider !==
    PAYMENT_PROVIDER
  ) {
    fail(
      'A encomenda não tem um pagamento PFA_SIMULATED iniciado.',
    )
  }

  if (
    typeof order.paymentReference !==
      'string' ||
    !order.paymentReference.trim()
  ) {
    fail(
      'A encomenda não tem referência de pagamento.',
    )
  }

  if (
    order.paymentStatus !== 'PENDING' &&
    order.paymentStatus !== 'PAID'
  ) {
    fail(
      `Estado de pagamento incompatível: ${order.paymentStatus}.`,
    )
  }
}

function createSignedWebhook(
  order,
  webhookSecret,
) {
  const timestamp = Math.floor(
    Date.now() / 1000,
  ).toString()

  const body = JSON.stringify({
    type: 'PAYMENT_PAID',
    orderId: order.id,
    paymentProvider:
      PAYMENT_PROVIDER,
    paymentReference:
      order.paymentReference,
  })

  const digest = createHmac(
    'sha256',
    webhookSecret,
  )
    .update(timestamp)
    .update('.')
    .update(body)
    .digest('hex')

  return {
    timestamp,
    body,
    signature: `sha256=${digest}`,
  }
}

async function sendWebhook(
  baseUrl,
  signedWebhook,
) {
  const response = await fetch(
    `${baseUrl}/api/payments/webhook`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
        'x-payment-timestamp':
          signedWebhook.timestamp,
        'x-payment-signature':
          signedWebhook.signature,
      },
      body: signedWebhook.body,
    },
  )

  const responseText =
    await response.text()

  let responseBody = null

  if (responseText) {
    try {
      responseBody =
        JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }
  }

  if (!response.ok) {
    console.error(
      `Webhook rejeitado (${response.status}).`,
    )

    if (responseBody !== null) {
      console.error(responseBody)
    }

    process.exit(1)
  }

  return responseBody
}

async function main() {
  const orderIdentifier =
    normalizeOrderIdentifier(
      process.argv[2],
    )

  const baseUrl = normalizeBaseUrl(
    process.argv[3],
  )

  const {
    databaseUrl,
    webhookSecret,
  } = await loadLocalEnvironment()

  const order = await findOrder(
    databaseUrl,
    orderIdentifier,
  )

  validateOrderForSimulation(order)

  if (order.paymentStatus === 'PAID') {
    console.log(
      `A encomenda ${order.orderNumber} já está PAID.`,
    )
    return
  }

  const signedWebhook =
    createSignedWebhook(
      order,
      webhookSecret,
    )

  const result = await sendWebhook(
    baseUrl,
    signedWebhook,
  )

  console.log(
    `Pagamento simulado confirmado para ${order.orderNumber}.`,
  )

  if (
    result &&
    typeof result === 'object' &&
    'paymentStatus' in result
  ) {
    console.log(
      `Estado: ${result.paymentStatus}`,
    )
  }
}

main().catch((error) => {
  console.error(
    'Erro inesperado no simulador de pagamento.',
  )

  if (
    error instanceof Error &&
    error.message
  ) {
    console.error(error.message)
  }

  process.exit(1)
})