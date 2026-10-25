import { z } from 'zod'
import { Prisma } from '@prisma/client'

import type {
  AdminOrderStatus,
  AdminPaymentStatus,
} from './admin-orders'
import { prisma } from './db'

export type AdminUserRole =
  | 'ADMIN'
  | 'SELLER'
  | 'BUYER'

type MoneyValue =
  | string
  | number
  | {
      toString(): string
    }

export class AdminUserNotFoundError extends Error {
  constructor(
    message = 'Utilizador não encontrado',
  ) {
    super(message)
    this.name = 'AdminUserNotFoundError'
  }
}

export class AdminUserSelfUpdateError extends Error {
  constructor(
    message = 'Não é possível alterar o seu próprio papel ou desativar a sua conta.',
  ) {
    super(message)
    this.name = 'AdminUserSelfUpdateError'
  }
}

export class AdminUserValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminUserValidationError'
  }
}

const userRoleSchema = z.enum(
  ['ADMIN', 'SELLER', 'BUYER'],
  {
    message:
      'Papel de utilizador inválido.',
  },
)

export const adminUserUpdateSchema = z
  .object({
    role: userRoleSchema.optional(),
    isActive:
      z.boolean({
        message:
          'Estado da conta inválido.',
      }).optional(),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.isActive !== undefined,
    {
      message:
        'Indica o novo papel ou o novo estado da conta.',
    },
  )

export type AdminUser = {
  id: string
  email: string
  name: string | null
  role: AdminUserRole
  isActive: boolean
  createdAt: Date
  ordersCount: number
}

export type AdminUserOrderSummary = {
  id: string
  orderNumber: string
  total: string
  status: AdminOrderStatus
  paymentStatus: AdminPaymentStatus
  createdAt: Date
}

export type AdminUserDetail =
  Omit<AdminUser, 'ordersCount'> & {
    ordersCount: number
    totalExpenditure: string
    orders: AdminUserOrderSummary[]
  }

export type AdminUserRecord = {
  id: string
  email: string
  name: string | null
  role: AdminUserRole
  isActive: boolean
  createdAt: Date
  _count: {
    orders: number
  }
}

export type AdminUserOrderRecord = {
  id: string
  orderNumber: string
  total: MoneyValue
  status: AdminOrderStatus
  paymentStatus: AdminPaymentStatus
  createdAt: Date
}

export type AdminUserDetailRecord =
  Omit<AdminUserRecord, '_count'> & {
    _count: {
      orders: number
    }
    orders: AdminUserOrderRecord[]
  }

const adminUserProfileSelect = {
  id: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect

const adminUserListSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  _count: {
    select: {
      orders: true,
    },
  },
} satisfies Prisma.UserSelect

const adminUserOrderSelect = {
  id: true,
  orderNumber: true,
  total: true,
  status: true,
  paymentStatus: true,
  createdAt: true,
} satisfies Prisma.OrderSelect

const adminUserDetailSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  _count: {
    select: {
      orders: true,
    },
  },
  orders: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    select:
      adminUserOrderSelect,
  },
} satisfies Prisma.UserSelect

export type AdminUserListSelect =
  typeof adminUserListSelect &
    Record<string, unknown>

export type AdminUserDetailSelect =
  typeof adminUserDetailSelect &
    Record<string, unknown>

type AdminUserUpdateData = {
  role?: AdminUserRole
  isActive?: boolean
}

export interface AdminUserTransactionClient {
  user: {
    findUnique(args: {
      where: {
        id: string
      }
      select: typeof adminUserProfileSelect &
        Record<string, unknown>
    }): Promise<{
      id: string
      role: AdminUserRole
      isActive: boolean
    } | null>
    update(args: {
      where: {
        id: string
      }
      data: AdminUserUpdateData
      select: AdminUserListSelect
    }): Promise<AdminUserRecord>
  }
}

export interface AdminUserClient {
  user: {
    findMany(args: {
      orderBy: {
        createdAt: 'desc'
      }
      select: AdminUserListSelect
    }): Promise<AdminUserRecord[]>
    findUnique(args: {
      where: {
        id: string
      }
      select: AdminUserDetailSelect
    }): Promise<
      AdminUserDetailRecord | null
    >
  }
  order: {
    aggregate(args: {
      where: {
        userId: string
        paymentStatus: 'PAID'
      }
      _sum: {
        total: true
      }
    }): Promise<{
      _sum: {
        total: MoneyValue | null
      }
    }>
  }
  $transaction<T>(
    callback: (
      transaction: AdminUserTransactionClient,
    ) => Promise<T>,
  ): Promise<T>
}

function getClient(
  client?: AdminUserClient,
): AdminUserClient {
  return (
    client ??
    (prisma as unknown as
      AdminUserClient)
  )
}

function moneyToString(
  value: MoneyValue,
): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return value.toString()
}

function mapUser(
  user: AdminUserRecord,
): AdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive:
      user.isActive,
    createdAt:
      user.createdAt,
    ordersCount:
      user._count.orders,
  }
}

function mapUserOrder(
  order: AdminUserOrderRecord,
): AdminUserOrderSummary {
  return {
    id: order.id,
    orderNumber:
      order.orderNumber,
    total: moneyToString(
      order.total,
    ),
    status: order.status,
    paymentStatus:
      order.paymentStatus,
    createdAt:
      order.createdAt,
  }
}

export async function listAdminUsers(
  client?: AdminUserClient,
): Promise<AdminUser[]> {
  const db =
    getClient(client)

  const users =
    await db.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select:
        adminUserListSelect,
    })

  return users.map(
    mapUser,
  )
}

export async function getAdminUserById(
  userIdInput: string,
  client?: AdminUserClient,
): Promise<AdminUserDetail | null> {
  const userId =
    userIdInput.trim()

  if (!userId) {
    return null
  }

  const db =
    getClient(client)

  const user =
    await db.user.findUnique({
      where: {
        id: userId,
      },
      select:
        adminUserDetailSelect,
    })

  if (!user) {
    return null
  }

  const expenditure =
    await db.order.aggregate({
      where: {
        userId,
        paymentStatus:
          'PAID',
      },
      _sum: {
        total: true,
      },
    })

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive:
      user.isActive,
    createdAt:
      user.createdAt,
    ordersCount:
      user._count.orders,
    totalExpenditure:
      moneyToString(
        expenditure._sum
          .total ?? '0.00',
      ),
    orders:
      user.orders.map(
        mapUserOrder,
      ),
  }
}

export async function updateAdminUser(
  userIdInput: string,
  body: unknown,
  actingUserId:
    | string
    | null = null,
  client?: AdminUserClient,
): Promise<AdminUser> {
  const userId =
    userIdInput.trim()

  if (!userId) {
    throw new AdminUserValidationError(
      'Identificador de utilizador inválido.',
    )
  }

  const parsed =
    adminUserUpdateSchema.parse(
      body,
    )

  const data: AdminUserUpdateData =
    {}

  if (
    parsed.role !==
    undefined
  ) {
    data.role =
      parsed.role
  }

  if (
    parsed.isActive !==
    undefined
  ) {
    data.isActive =
      parsed.isActive
  }

  const db =
    getClient(client)

  return db.$transaction(
    async (
      transaction,
    ) => {
      const current =
        await transaction.user.findUnique(
          {
            where: {
              id: userId,
            },
            select:
              adminUserProfileSelect,
          },
        )

      if (!current) {
        throw new AdminUserNotFoundError()
      }

      if (
        current.id ===
        actingUserId
      ) {
        const removesAdminAccess =
          data.role !==
            undefined &&
          data.role !==
            'ADMIN'
        const deactivatesAccount =
          data.isActive ===
          false

        if (
          removesAdminAccess ||
          deactivatesAccount
        ) {
          throw new AdminUserSelfUpdateError()
        }
      }

      const updated =
        await transaction.user.update(
          {
            where: {
              id: userId,
            },
            data,
            select:
              adminUserListSelect,
          },
        )

      return mapUser(
        updated,
      )
    },
  )
}
