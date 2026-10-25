import { ZodError } from 'zod'
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  './db',
  () => ({
    prisma: {},
  }),
)

import {
  AdminUserNotFoundError,
  AdminUserSelfUpdateError,
  AdminUserValidationError,
  getAdminUserById,
  listAdminUsers,
  updateAdminUser,
  type AdminUserClient,
  type AdminUserRecord,
} from './admin-users'

function createUserRecord(
  overrides:
    Partial<AdminUserRecord> = {},
): AdminUserRecord {
  return {
    id: 'user-1',
    email:
      'cliente@example.com',
    name: 'Cliente Teste',
    role: 'BUYER',
    isActive: true,
    createdAt: new Date(
      '2026-08-01T00:00:00.000Z',
    ),
    _count: {
      orders: 3,
    },
    ...overrides,
  } as AdminUserRecord
}

function createClient() {
  const findMany =
    vi.fn()
  const findUnique =
    vi.fn()
  const update = vi.fn()
  const aggregate =
    vi.fn()

  const $transaction =
    vi.fn(
      (
        callback: (
          transaction: {
            user: {
              findUnique:
                typeof findUnique
              update: typeof update
            }
          },
        ) => Promise<unknown>,
      ) =>
        callback({
          user: {
            findUnique,
            update,
          },
        }),
    )

  return {
    client: {
      user: {
        findMany,
        findUnique,
        update,
      },
      order: {
        aggregate,
      },
      $transaction,
    } as unknown as AdminUserClient,
    findMany,
    findUnique,
    update,
    aggregate,
    $transaction,
  }
}

describe(
  'Admin Users',
  () => {
    test(
      'lista utilizadores ordenados por registo mais recente',
      async () => {
        const { client, findMany } =
          createClient()

        const record =
          createUserRecord()

        findMany.mockResolvedValue(
          [record],
        )

        const users =
          await listAdminUsers(
            client,
          )

        expect(findMany).toHaveBeenCalledWith(
          {
            orderBy: {
              createdAt:
                'desc',
            },
            select: expect.objectContaining(
              {
                email: true,
                _count: {
                  select: {
                    orders: true,
                  },
                },
              },
            ),
          },
        )

        expect(
          users,
        ).toStrictEqual([
          {
            id: 'user-1',
            email:
              'cliente@example.com',
            name: 'Cliente Teste',
            role: 'BUYER',
            isActive: true,
            createdAt:
              record.createdAt,
            ordersCount: 3,
          },
        ])
      },
    )

    test(
      'detalhe apresenta resumo de encomendas e despesa paga',
      async () => {
        const { client, findUnique, aggregate } =
          createClient()

        findUnique.mockResolvedValueOnce(
          {
            id: 'user-1',
            email:
              'cliente@example.com',
            name: 'Cliente Teste',
            role: 'BUYER',
            isActive: true,
            createdAt: new Date(
              '2026-08-01T00:00:00.000Z',
            ),
            _count: {
              orders: 4,
            },
            orders: [
              {
                id: 'order-1',
                orderNumber:
                  'PFA-ABC123',
                total: {
                  toString: () =>
                    '128.00',
                },
                status:
                  'PAID' as never,
                paymentStatus:
                  'PAID' as never,
                createdAt:
                  new Date(
                    '2026-09-14T00:00:00.000Z',
                  ),
              },
            ],
          },
        )

        aggregate.mockResolvedValueOnce(
          {
            _sum: {
              total: {
                toString: () =>
                  '356.40',
              },
            },
          },
        )

        const user =
          await getAdminUserById(
            ' user-1 ',
            client,
          )

        expect(findUnique).toHaveBeenCalledWith(
          {
            where: { id: 'user-1' },
            select: expect.objectContaining(
              {
                orders:
                  expect.objectContaining(
                    {
                      take: 10,
                    },
                  ),
              },
            ),
          },
        )

        expect(
          aggregate,
        ).toHaveBeenCalledWith({
          where: {
            userId: 'user-1',
            paymentStatus:
              'PAID',
          },
          _sum: { total: true },
        })

        expect(user).toMatchObject(
          {
            id: 'user-1',
            ordersCount: 4,
            totalExpenditure:
              '356.40',
            orders: [
              expect.objectContaining(
                {
                  orderNumber:
                    'PFA-ABC123',
                  total:
                    '128.00',
                },
              ),
            ],
          },
        )
      },
    )

    test(
      'detalhe sem despesa devolve zero e id desconhecido devolve null',
      async () => {
        const { client, findUnique } =
          createClient()

        findUnique.mockResolvedValueOnce(
          null,
        )

        expect(
          await getAdminUserById(
            'user-404',
            client,
          ),
        ).toBeNull()

        const populated =
          createClient()

        populated.findUnique.mockResolvedValueOnce(
          {
            ...createUserRecord(),
            orders: [],
          } as never,
        )

        populated.aggregate.mockResolvedValueOnce(
          {
            _sum: { total: null },
          },
        )

        const user =
          await getAdminUserById(
            'user-1',
            populated.client,
          )

        expect(
          user,
        ).toMatchObject({
          totalExpenditure:
            '0.00',
        })

        expect(
          await getAdminUserById(
            '   ',
            populated.client,
          ),
        ).toBeNull()
      },
    )

    test(
      'update aplica papel e estado ativo de forma atómica dentro da transação',
      async () => {
        const { client, update, $transaction } =
          createClient()

        $transaction.mockImplementationOnce(
          async (callback) =>
            callback({
              user: {
                findUnique:
                  vi
                    .fn()
                    .mockResolvedValueOnce(
                      {
                        id: 'user-2',
                        role: 'BUYER',
                        isActive:
                          true,
                      },
                    ),
                update: update,
              },
            }),
        )

        update.mockResolvedValueOnce(
          createUserRecord({
            id: 'user-2',
            role: 'SELLER',
            isActive: false,
          }),
        )

        const user =
          await updateAdminUser(
            'user-2',
            {
              role: 'SELLER',
              isActive: false,
            },
            'admin-1',
            client,
          )

        expect(update).toHaveBeenCalledWith(
          {
            where: {
              id: 'user-2',
            },
            data: {
              role: 'SELLER',
              isActive: false,
            },
            select: expect.objectContaining(
              {
                email: true,
              },
            ),
          },
        )

        expect(
          user,
        ).toMatchObject({
          id: 'user-2',
          role: 'SELLER',
          isActive: false,
          ordersCount: 3,
        })
      },
    )

    test(
      'update rejeita corpo inválido com ZodError',
      async () => {
        const { client, update } =
          createClient()

        await expect(
          updateAdminUser(
            'user-1',
            { role: 'MANAGER' },
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          ZodError,
        )

        await expect(
          updateAdminUser(
            'user-1',
            {},
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          ZodError,
        )

        await expect(
          updateAdminUser(
            'user-1',
            { isActive: 'sim' },
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          ZodError,
        )

        expect(
          update,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'update devolve 404 para utilizador desconhecido',
      async () => {
        const { client, update } =
          createClient()

        update.mockResolvedValueOnce(
          createUserRecord(),
        )

        await expect(
          updateAdminUser(
            'user-404',
            { isActive: false },
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          AdminUserNotFoundError,
        )

        expect(
          update,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'update impede que um administrador se remova o próprio acesso',
      async () => {
        const { client, update, findUnique } =
          createClient()

        findUnique.mockResolvedValue(
          {
            id: 'admin-1',
            role: 'ADMIN',
            isActive: true,
          },
        )

        await expect(
          updateAdminUser(
            'admin-1',
            { role: 'BUYER' },
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          AdminUserSelfUpdateError,
        )

        await expect(
          updateAdminUser(
            'admin-1',
            { role: 'SELLER' },
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          AdminUserSelfUpdateError,
        )

        await expect(
          updateAdminUser(
            'admin-1',
            { isActive: false },
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          AdminUserSelfUpdateError,
        )

        expect(
          update,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'update permite ao próprio manter ADMIN e ativo',
      async () => {
        const { client, update, findUnique } =
          createClient()

        findUnique.mockResolvedValue(
          {
            id: 'admin-1',
            role: 'ADMIN',
            isActive: true,
          },
        )

        update.mockResolvedValueOnce(
          createUserRecord({
            id: 'admin-1',
            role: 'ADMIN',
            name: 'Admin Teste',
          }),
        )

        const user =
          await updateAdminUser(
            'admin-1',
            { isActive: true },
            'admin-1',
            client,
          )

        expect(update).toHaveBeenCalledWith(
          {
            where: {
              id: 'admin-1',
            },
            data: {
              isActive: true,
            },
            select: expect.objectContaining(
              {
                email: true,
              },
            ),
          },
        )

        expect(
          user,
        ).toMatchObject({
          id: 'admin-1',
          role: 'ADMIN',
          isActive: true,
        })
      },
    )

    test(
      'update recusa identificadores vazios',
      async () => {
        const { client, update } =
          createClient()

        await expect(
          updateAdminUser(
            '   ',
            { role: 'SELLER' },
            'admin-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          AdminUserValidationError,
        )

        expect(
          update,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
