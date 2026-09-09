import { NextResponse } from 'next/server'
import {
  registerBuyer,
  RegistrationEmailConflictError,
  RegistrationValidationError,
} from '@/server/register'

type RegistrationErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'INVALID_NAME'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INTERNAL_ERROR'

function errorResponse(
  error: string,
  code: RegistrationErrorCode,
  status: number,
) {
  return NextResponse.json(
    {
      error,
      code,
    },
    {
      status,
    },
  )
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function getValidationCode(
  error: RegistrationValidationError,
): RegistrationErrorCode {
  switch (error.field) {
    case 'name':
      return 'INVALID_NAME'
    case 'email':
      return 'INVALID_EMAIL'
    case 'password':
      return 'INVALID_PASSWORD'
  }
}

export async function POST(
  request: Request,
) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      'JSON inválido',
      'INVALID_JSON',
      400,
    )
  }

  if (!isObject(body)) {
    return errorResponse(
      'Pedido inválido',
      'INVALID_REQUEST',
      400,
    )
  }

  try {
    const user = await registerBuyer({
      name: body.name,
      email: body.email,
      password: body.password,
    })

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      {
        status: 201,
      },
    )
  } catch (error) {
    if (
      error instanceof
      RegistrationValidationError
    ) {
      return errorResponse(
        error.message,
        getValidationCode(error),
        400,
      )
    }

    if (
      error instanceof
      RegistrationEmailConflictError
    ) {
      return errorResponse(
        error.message,
        'EMAIL_ALREADY_REGISTERED',
        409,
      )
    }

    console.error(
      'Unexpected registration API error:',
      error,
    )

    return errorResponse(
      'Erro interno do servidor',
      'INTERNAL_ERROR',
      500,
    )
  }
}
