import { NextResponse } from 'next/server'
import {
  GuestCartServerValidationError,
  resolveGuestCartItems,
  type GuestCartInputItem,
} from '@/server/guest-cart'

function errorResponse(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  )
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

function parseItems(
  value: unknown,
): GuestCartInputItem[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const items: GuestCartInputItem[] = []

  for (const item of value) {
    if (!isRecord(item)) {
      return null
    }

    if (
      typeof item.productId !==
        'string' ||
      typeof item.quantity !==
        'number'
    ) {
      return null
    }

    items.push({
      productId: item.productId,
      quantity: item.quantity,
    })
  }

  return items
}

export async function POST(
  request: Request,
) {
  try {
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return errorResponse(
        'JSON inválido',
        400,
      )
    }

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        400,
      )
    }

    const items = parseItems(
      body.items,
    )

    if (!items) {
      return errorResponse(
        'Itens inválidos',
        400,
      )
    }

    const resolvedItems =
      await resolveGuestCartItems(
        items,
      )

    return NextResponse.json({
      items: resolvedItems,
    })
  } catch (error) {
    if (
      error instanceof
      GuestCartServerValidationError
    ) {
      return errorResponse(
        error.message,
        400,
      )
    }

    console.error(
      'Unexpected guest cart API error:',
      error,
    )

    return errorResponse(
      'Erro interno do servidor',
      500,
    )
  }
}