import { NextResponse } from 'next/server'

import {
  AddressNotFoundError,
  AddressValidationError,
  createUserAddress,
  deleteUserAddress,
  listUserAddresses,
  updateUserAddress,
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

function getAddressInput(
  body: Record<
    string,
    unknown
  >,
) {
  return {
    name: body.name,
    addressLine1:
      body.addressLine1,
    addressLine2:
      body.addressLine2,
    city: body.city,
    postalCode:
      body.postalCode,
    country: body.country,
  }
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
    'Unexpected addresses API error:',
    error,
  )

  return errorResponse(
    'Erro interno do servidor',
    500,
  )
}

export async function GET() {
  try {
    const userId =
      await requireActiveUserId()

    const addresses =
      await listUserAddresses(
        userId,
      )

    return NextResponse.json({
      addresses,
    })
  } catch (error) {
    return handleAddressError(
      error,
    )
  }
}

export async function POST(
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

    const address =
      await createUserAddress(
        userId,
        getAddressInput(body),
      )

    return NextResponse.json(
      {
        address,
      },
      {
        status: 201,
      },
    )
  } catch (error) {
    return handleAddressError(
      error,
    )
  }
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
      await updateUserAddress(
        userId,
        addressId,
        getAddressInput(body),
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

export async function DELETE(
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

    await deleteUserAddress(
      userId,
      addressId,
    )

    return new Response(null, {
      status: 204,
    })
  } catch (error) {
    return handleAddressError(
      error,
    )
  }
}