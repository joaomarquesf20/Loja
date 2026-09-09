import { hash } from 'bcryptjs'
import {
  emailSchema,
  passwordSchema,
} from '@/lib/validation'
import { prisma } from './db'

const PASSWORD_HASH_ROUNDS = 12

export type RegistrationField =
  | 'name'
  | 'email'
  | 'password'

export type RegisterBuyerInput = {
  name: unknown
  email: unknown
  password: unknown
}

export class RegistrationValidationError
  extends Error {
  constructor(
    public readonly field:
      RegistrationField,
    message: string,
  ) {
    super(message)
    this.name =
      'RegistrationValidationError'
  }
}

export class RegistrationEmailConflictError
  extends Error {
  constructor(
    message =
      'Já existe uma conta com este email',
  ) {
    super(message)
    this.name =
      'RegistrationEmailConflictError'
  }
}

function validateName(
  value: unknown,
) {
  if (typeof value !== 'string') {
    throw new RegistrationValidationError(
      'name',
      'Nome inválido',
    )
  }

  const name = value.trim()

  if (name.length === 0) {
    throw new RegistrationValidationError(
      'name',
      'Nome inválido',
    )
  }

  return name
}

function validateEmail(
  value: unknown,
) {
  const result =
    emailSchema.safeParse(value)

  if (!result.success) {
    throw new RegistrationValidationError(
      'email',
      'Email inválido',
    )
  }

  return result.data
}

function validatePassword(
  value: unknown,
) {
  const result =
    passwordSchema.safeParse(value)

  if (!result.success) {
    throw new RegistrationValidationError(
      'password',
      'A palavra-passe deve ter pelo menos 8 caracteres',
    )
  }

  return result.data
}

function isUniqueConstraintError(
  error: unknown,
) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error)
  ) {
    return false
  }

  return (
    (error as { code?: unknown })
      .code === 'P2002'
  )
}

export async function registerBuyer(
  input: RegisterBuyerInput,
) {
  const name = validateName(
    input.name,
  )

  const email = validateEmail(
    input.email,
  )

  const password =
    validatePassword(
      input.password,
    )

  const passwordHash =
    await hash(
      password,
      PASSWORD_HASH_ROUNDS,
    )

  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'BUYER',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    })
  } catch (error) {
    if (
      isUniqueConstraintError(error)
    ) {
      throw new RegistrationEmailConflictError()
    }

    throw error
  }
}
