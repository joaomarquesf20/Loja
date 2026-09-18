import { NextResponse } from 'next/server'

import {
  AddressNotFoundError,
  AddressValidationError,
  setDefaultUserAddress,
} from '@/server/addresses'
import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
  readJsonBody,
} from '@/server/http-request'
import {
  requireActiveUserId,
  UnauthorizedUserError,
} from '@/server/user-auth'

const ADDRESSES_BODY_LIMIT_BYTES =
  64 * 1024

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
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function handleAddressError(
  error: unknown,
) {
  if (
    error instanceof
    UnauthorizedUserError
  ) {
    return errorResponse(
      'Não autenticado',
      401,
    )
  }

  if (
    error instanceof
    RequestPayloadTooLargeError
  ) {
    return errorResponse(
      'Pedido demasiado grande',
      413,
    )
  }

  if (
    error instanceof
    InvalidJsonBodyError
  ) {
    return errorResponse(
      'JSON inválido',
      400,
    )
  }

  if (
    error instanceof
    AddressValidationError
  ) {
    return errorResponse(
      error.message,
      400,
    )
  }

  if (
    error instanceof
    AddressNotFoundError
  ) {
    return errorResponse(
      error.message,
      404,
    )
  }

  console.error(
    'Unexpected default address API error:',
    error,
  )

  return errorResponse(
    'Erro interno do servidor',
    500,
  )
}

export async function PATCH(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body =
      await readJsonBody(
        request,
        ADDRESSES_BODY_LIMIT_BYTES,
      )

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        400,
      )
    }

    const addressId =
      body.addressId

    if (
      typeof addressId !==
      'string'
    ) {
      return errorResponse(
        'Morada inválida',
        400,
      )
    }

    const address =
      await setDefaultUserAddress(
        userId,
        addressId,
      )

    return NextResponse.json({
      address,
    })
  } catch (error) {
    return handleAddressError(
      error,
    )
  }
}
