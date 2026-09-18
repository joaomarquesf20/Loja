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
  isDefault: boolean
}

type AddressRecord = Omit<
  UserAddress,
  'isDefault'
>

type UserDefaultAddressRecord = {
  defaultAddressId: string | null
}

type UserDefaultAddressSelect = {
  defaultAddressId: true
}

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
        userId: string
        id?: string
      }
      orderBy?: {
        id: 'asc'
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

  user: {
    findUnique(args: {
      where: {
        id: string
      }
      select: UserDefaultAddressSelect
    }): Promise<
      UserDefaultAddressRecord | null
    >

    updateMany(args: {
      where: {
        id: string
        defaultAddressId?: string | null
      }
      data: {
        defaultAddressId:
          string | null
      }
    }): Promise<{
      count: number
    }>
  }

  $transaction?<T>(
    callback: (
      transaction: AddressClient,
    ) => Promise<T>,
  ): Promise<T>
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


function toUserAddress(
  record: AddressRecord,
  defaultAddressId:
    string | null,
): UserAddress {
  return {
    ...record,
    isDefault:
      record.id ===
      defaultAddressId,
  }
}

function sortUserAddresses(
  addresses: UserAddress[],
) {
  return [...addresses].sort(
    (first, second) => {
      if (
        first.isDefault !==
        second.isDefault
      ) {
        return first.isDefault
          ? -1
          : 1
      }

      return first.id.localeCompare(
        second.id,
      )
    },
  )
}

async function runInTransaction<T>(
  db: AddressClient,
  action: (
    transaction: AddressClient,
  ) => Promise<T>,
) {
  if (db.$transaction) {
    return db.$transaction(action)
  }

  return action(db)
}

async function getDefaultAddressId(
  userId: string,
  db: AddressClient,
) {
  const user =
    await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        defaultAddressId: true,
      },
    })

  return (
    user?.defaultAddressId ??
    null
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

  const defaultAddressId =
    await getDefaultAddressId(
      normalizedUserId,
      db,
    )

  const addresses =
    await db.address.findMany({
      where: {
        userId: normalizedUserId,
      },
      orderBy: {
        id: 'asc',
      },
      select: addressSelect,
    })

  return sortUserAddresses(
    addresses.map((address) =>
      toUserAddress(
        address,
        defaultAddressId,
      ),
    ),
  )
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

  return runInTransaction(
    db,
    async (transaction) => {
      const createdAddress =
        await transaction.address.create({
          data: {
            userId: normalizedUserId,
            ...address,
          },
          select: addressSelect,
        })

      const defaultUpdate =
        await transaction.user.updateMany({
          where: {
            id: normalizedUserId,
            defaultAddressId: null,
          },
          data: {
            defaultAddressId:
              createdAddress.id,
          },
        })

      return toUserAddress(
        createdAddress,
        defaultUpdate.count === 1
          ? createdAddress.id
          : null,
      )
    },
  )
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

  const defaultAddressId =
    await getDefaultAddressId(
      normalizedUserId,
      db,
    )

  return toUserAddress(
    updatedAddress,
    defaultAddressId,
  )
}

export async function setDefaultUserAddress(
  userId: string,
  addressId: string,
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

  const db = getClient(client)

  return runInTransaction(
    db,
    async (transaction) => {
      const address =
        await transaction.address.findFirst({
          where: {
            id: normalizedAddressId,
            userId: normalizedUserId,
          },
          select: addressSelect,
        })

      if (!address) {
        throw new AddressNotFoundError()
      }

      const updateResult =
        await transaction.user.updateMany({
          where: {
            id: normalizedUserId,
          },
          data: {
            defaultAddressId:
              normalizedAddressId,
          },
        })

      if (updateResult.count !== 1) {
        throw new AddressNotFoundError()
      }

      return toUserAddress(
        address,
        normalizedAddressId,
      )
    },
  )
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

  await runInTransaction(
    db,
    async (transaction) => {
      const address =
        await transaction.address.findFirst({
          where: {
            id: normalizedAddressId,
            userId: normalizedUserId,
          },
          select: addressSelect,
        })

      if (!address) {
        throw new AddressNotFoundError()
      }

      const defaultAddressId =
        await getDefaultAddressId(
          normalizedUserId,
          transaction,
        )

      const deleteResult =
        await transaction.address.deleteMany({
          where: {
            id: normalizedAddressId,
            userId: normalizedUserId,
          },
        })

      if (deleteResult.count !== 1) {
        throw new AddressNotFoundError()
      }

      if (
        defaultAddressId !==
        normalizedAddressId
      ) {
        return
      }

      const replacement =
        await transaction.address.findFirst({
          where: {
            userId: normalizedUserId,
          },
          orderBy: {
            id: 'asc',
          },
          select: addressSelect,
        })

      const promotionResult =
        await transaction.user.updateMany({
          where: {
            id: normalizedUserId,
          },
          data: {
            defaultAddressId:
              replacement?.id ??
              null,
          },
        })

      if (promotionResult.count !== 1) {
        throw new AddressNotFoundError()
      }
    },
  )
}
