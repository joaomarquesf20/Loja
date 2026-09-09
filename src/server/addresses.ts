import { prisma } from './db'

export type AddressField =
  | 'userId'
  | 'addressId'
  | 'name'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'postalCode'
  | 'country'

export type AddressInput = {
  name: unknown
  addressLine1: unknown
  addressLine2?: unknown
  city: unknown
  postalCode: unknown
  country: unknown
}

export type UserAddress = {
  id: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: string
}

type AddressRecord = UserAddress

type AddressSelect = {
  id: true
  name: true
  addressLine1: true
  addressLine2: true
  city: true
  postalCode: true
  country: true
}

export class AddressValidationError
  extends Error {
  constructor(
    public readonly field:
      AddressField,
    message: string,
  ) {
    super(message)
    this.name =
      'AddressValidationError'
  }
}

export class AddressNotFoundError
  extends Error {
  constructor(
    message = 'Morada não encontrada',
  ) {
    super(message)
    this.name =
      'AddressNotFoundError'
  }
}

export interface AddressClient {
  address: {
    findMany(args: {
      where: {
        userId: string
      }
      orderBy: {
        id: 'asc'
      }
      select: AddressSelect
    }): Promise<AddressRecord[]>

    findFirst(args: {
      where: {
        id: string
        userId: string
      }
      select: AddressSelect
    }): Promise<AddressRecord | null>

    create(args: {
      data: {
        userId: string
        name: string
        addressLine1: string
        addressLine2: string | null
        city: string
        postalCode: string
        country: string
      }
      select: AddressSelect
    }): Promise<AddressRecord>

    updateMany(args: {
      where: {
        id: string
        userId: string
      }
      data: {
        name: string
        addressLine1: string
        addressLine2: string | null
        city: string
        postalCode: string
        country: string
      }
    }): Promise<{
      count: number
    }>

    deleteMany(args: {
      where: {
        id: string
        userId: string
      }
    }): Promise<{
      count: number
    }>
  }
}

const addressSelect:
  AddressSelect = {
  id: true,
  name: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  postalCode: true,
  country: true,
}

function getClient(
  client?: AddressClient,
): AddressClient {
  return (
    client ??
    (prisma as unknown as AddressClient)
  )
}

function normalizeId(
  value: unknown,
  field: 'userId' | 'addressId',
  label: string,
) {
  if (typeof value !== 'string') {
    throw new AddressValidationError(
      field,
      `${label} inválido`,
    )
  }

  const normalizedValue =
    value.trim()

  if (!normalizedValue) {
    throw new AddressValidationError(
      field,
      `${label} é obrigatório`,
    )
  }

  return normalizedValue
}

function normalizeRequiredText(
  value: unknown,
  field: AddressField,
  label: string,
  maxLength: number,
) {
  if (typeof value !== 'string') {
    throw new AddressValidationError(
      field,
      `${label} inválido`,
    )
  }

  const normalizedValue =
    value.trim()

  if (!normalizedValue) {
    throw new AddressValidationError(
      field,
      `${label} é obrigatório`,
    )
  }

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new AddressValidationError(
      field,
      `${label} é demasiado longo`,
    )
  }

  return normalizedValue
}

function normalizeOptionalText(
  value: unknown,
  field: AddressField,
  label: string,
  maxLength: number,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  if (typeof value !== 'string') {
    throw new AddressValidationError(
      field,
      `${label} inválido`,
    )
  }

  const normalizedValue =
    value.trim()

  if (!normalizedValue) {
    return null
  }

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new AddressValidationError(
      field,
      `${label} é demasiado longo`,
    )
  }

  return normalizedValue
}

function normalizeAddressInput(
  input: AddressInput,
) {
  return {
    name: normalizeRequiredText(
      input.name,
      'name',
      'Nome',
      120,
    ),
    addressLine1:
      normalizeRequiredText(
        input.addressLine1,
        'addressLine1',
        'Morada',
        200,
      ),
    addressLine2:
      normalizeOptionalText(
        input.addressLine2,
        'addressLine2',
        'Complemento da morada',
        200,
      ),
    city: normalizeRequiredText(
      input.city,
      'city',
      'Localidade',
      100,
    ),
    postalCode:
      normalizeRequiredText(
        input.postalCode,
        'postalCode',
        'Código postal',
        20,
      ),
    country: normalizeRequiredText(
      input.country,
      'country',
      'País',
      100,
    ),
  }
}

export async function listUserAddresses(
  userId: string,
  client?: AddressClient,
): Promise<UserAddress[]> {
  const normalizedUserId =
    normalizeId(
      userId,
      'userId',
      'Utilizador',
    )

  const db = getClient(client)

  return db.address.findMany({
    where: {
      userId: normalizedUserId,
    },
    orderBy: {
      id: 'asc',
    },
    select: addressSelect,
  })
}

export async function createUserAddress(
  userId: string,
  input: AddressInput,
  client?: AddressClient,
): Promise<UserAddress> {
  const normalizedUserId =
    normalizeId(
      userId,
      'userId',
      'Utilizador',
    )

  const address =
    normalizeAddressInput(input)

  const db = getClient(client)

  return db.address.create({
    data: {
      userId: normalizedUserId,
      ...address,
    },
    select: addressSelect,
  })
}

export async function updateUserAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
  client?: AddressClient,
): Promise<UserAddress> {
  const normalizedUserId =
    normalizeId(
      userId,
      'userId',
      'Utilizador',
    )

  const normalizedAddressId =
    normalizeId(
      addressId,
      'addressId',
      'Morada',
    )

  const address =
    normalizeAddressInput(input)

  const db = getClient(client)

  const updateResult =
    await db.address.updateMany({
      where: {
        id: normalizedAddressId,
        userId: normalizedUserId,
      },
      data: address,
    })

  if (updateResult.count !== 1) {
    throw new AddressNotFoundError()
  }

  const updatedAddress =
    await db.address.findFirst({
      where: {
        id: normalizedAddressId,
        userId: normalizedUserId,
      },
      select: addressSelect,
    })

  if (!updatedAddress) {
    throw new AddressNotFoundError()
  }

  return updatedAddress
}

export async function deleteUserAddress(
  userId: string,
  addressId: string,
  client?: AddressClient,
): Promise<void> {
  const normalizedUserId =
    normalizeId(
      userId,
      'userId',
      'Utilizador',
    )

  const normalizedAddressId =
    normalizeId(
      addressId,
      'addressId',
      'Morada',
    )

  const db = getClient(client)

  const deleteResult =
    await db.address.deleteMany({
      where: {
        id: normalizedAddressId,
        userId: normalizedUserId,
      },
    })

  if (deleteResult.count !== 1) {
    throw new AddressNotFoundError()
  }
}
