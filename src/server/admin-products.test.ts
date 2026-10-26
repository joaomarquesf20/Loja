import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  type AdminProductClient,
  AdminProductConflictError,
  AdminProductValidationError,
  bulkAdminProductAction,
  createAdminProduct,
  deleteAdminProduct,
  getAdminProduct,
  updateAdminProduct,
  listAdminProducts,
} from './admin-products'

const decimal = (value: string) => ({
  toString: () => value,
})

function productRecord() {
  return {
    id: 'product-wheel',
    name: 'Japan Racing JR11',
    slug: 'japan-racing-jr11',
    sku: 'JR11-MODEL',
    description: null,
    price: decimal('169.90'),
    stockQuantity: 8,
    isActive: true,
    images: [],
    defaultFinish: null,
    imageMetadata: [],
    shippingClass: 'STANDARD',
    category: {
      id: 'category-wheels',
      name: 'Jantes',
      slug: 'jantes',
      parentId: null,
    },
    brand: {
      id: 'brand-jr',
      name: 'Japan Racing',
      slug: 'japan-racing',
    },
    shippingRates: [],
    variants: [
      {
        id: 'variant-wheel',
        sku: 'JR11-18',
        price: decimal('169.90'),
        stockQuantity: 8,
        isActive: true,
        position: 0,
        optionKey: 'jr11-18',
        selections: [
          {
            optionValue: {
              value: '18"',
              option: {
                code: 'diameter',
                name: 'Diâmetro',
              },
            },
          },
          {
            optionValue: {
              value: '5x112',
              option: {
                code: 'pcd',
                name: 'Padrão de parafusos',
              },
            },
          },
        ],
        specifications: [],
      },
    ],
    compatibilities: [],
  }
}

function wheelInput(
  overrides: Record<string, unknown> = {},
) {
  return {
    name: 'Japan Racing JR11',
    categoryId: 'category-wheels',
    productBrandId: 'brand-jr',
    description: null,
    images: [],
    shippingClass: 'STANDARD',
    mainlandShippingCost: null,
    isActive: true,
    variants: [
      {
        sku: 'JR11-18',
        price: 169.9,
        stockQuantity: 8,
        isActive: true,
        selections: {
          diameter: '18"',
          width: '8J',
          pcd: '5x112',
          offset: 'ET40',
          centre_bore: '66.6 mm',
          finish: 'Satin Black',
        },
        specifications: [],
      },
    ],
    compatibilities: [],
    ...overrides,
  }
}

function createClient() {
  // Épico 6 — histórico de movimentos de stock.
  const stockMovementCreate =
    vi.fn(async () => ({
      id: 'movement-1',
    }))

  const transaction = {
    product: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [productRecord()]),
      findUnique: vi.fn(async () => productRecord()),
      create: vi.fn(async () => ({
        id: 'product-wheel',
      })),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({
        id: 'product-wheel',
      })),
    },
    productImage: {
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
      create: vi.fn(async () => ({})),
    },
    productVariant: {
      findFirst: vi.fn(async () => null),
      // Array tipado; caso contrário vi.fn(async () => [])
      // infere never[] e rejeita as variantes de fixture
      // usadas em mockResolvedValueOnce.
      findMany:
        vi.fn(async () =>
          [] as Array<Record<string, unknown>>,
        ),
      update: vi.fn(async () => ({
        id: 'variant-wheel',
      })),
      create: vi.fn(async () => ({
        id: 'variant-created',
      })),
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
    },
    productOption: {
      findMany: vi.fn(async () => []),
      upsert: vi.fn(
        async ({
          where,
        }: {
          where: {
            productId_code: {
              productId: string
              code: string
            }
          }
        }) => ({
          id: `option-${where.productId_code.code}`,
        }),
      ),
    },
    productOptionValue: {
      upsert: vi.fn(async () => ({
        id: 'value-created',
      })),
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
    },
    productVariantOptionSelection: {
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
      create: vi.fn(async () => ({})),
    },
    productVariantSpecification: {
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
      create: vi.fn(async () => ({})),
    },
    productVehicleCompatibility: {
      count: vi.fn(async () => 0),
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
      create: vi.fn(async () => ({})),
    },
    productBrand: {
      findUnique: vi.fn(async () => ({
        id: 'brand-jr',
      })),
    },
    category: {
      findUnique: vi.fn(async () => ({
        id: 'category-wheels',
        name: 'Jantes',
        slug: 'jantes',
      })),
    },
    vehicleModel: {
      findUnique: vi.fn(async () => null),
    },
    cartItem: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
    },
    orderItem: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({
        count: 0,
      })),
    },
    // Épico 6 — histórico de movimentos de stock na transação de
    // gravação de produtos.
    stockMovement: {
      create: stockMovementCreate,
    },
  }
  const client = {
    ...transaction,
    $transaction: vi.fn(
      async (
        callback: (
          tx: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    ),
  } as unknown as AdminProductClient

  return { client, transaction, stockMovementCreate }
}

describe('admin products service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('devolve nome de categoria, fabricante e variantes com stock', async () => {
    const { client } = createClient()

    const result = await listAdminProducts(
      client,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'Japan Racing JR11',
      category: { name: 'Jantes' },
      brand: { name: 'Japan Racing' },
      variants: [
        {
          sku: 'JR11-18',
          price: '169.90',
          stockQuantity: 8,
          options: expect.arrayContaining([
            expect.objectContaining({
              code: 'diameter',
              value: '18"',
            }),
            expect.objectContaining({
              code: 'pcd',
              value: '5x112',
            }),
          ]),
        },
      ],
    })
  })

  test('rejeita produto inexistente', async () => {
    const { client } = createClient()
    vi.mocked(
      client.product.findUnique,
    ).mockResolvedValueOnce(null)

    await expect(
      getAdminProduct('missing', client),
    ).rejects.toThrow(
      'Produto não encontrado',
    )
  })

  test('impede compatibilidade manual em jantes', async () => {
    const { client } = createClient()

    await expect(
      createAdminProduct(
        wheelInput({
          compatibilities: [
            {
              vehicleBrandId: 'vw',
              vehicleModelId: 'golf',
              vehicleGenerationId: null,
              vehicleConfigurationId: null,
              yearMin: null,
              yearMax: null,
            },
          ],
        }),
        client,
      ),
    ).rejects.toBeInstanceOf(
      AdminProductValidationError,
    )
  })

  test(
    'permite duas variantes com o mesmo conjunto de eixos e acabamentos diferentes',
    async () => {
      const { client, transaction } =
        createClient()
      const input = wheelInput()
      const silverVariant = {
        ...input.variants[0],
        sku: 'JR11-18-PRATA',
        price: 171.5,
        selections: {
          ...input.variants[0].selections,
          finish: 'Silver Machined',
        },
      }

      await createAdminProduct(
        {
          ...input,
          variants: [
            input.variants[0],
            silverVariant,
          ],
        },
        client,
      )

      expect(
        client.$transaction,
      ).toHaveBeenCalled()
      expect(
        transaction.productVariant.create,
      ).toHaveBeenCalledTimes(2)
    },
  )

  test(
    'recusa duas variantes com as mesmas especificações e o mesmo acabamento, nomeando as linhas em conflito',
    async () => {
      const { client } = createClient()
      const input = wheelInput()
      const duplicate = {
        ...input.variants[0],
        sku: 'JR11-18-COPIA',
      }

      await expect(
        createAdminProduct(
          {
            ...input,
            variants: [
              input.variants[0],
              duplicate,
            ],
          },
          client,
        ),
      ).rejects.toThrow(
        'A variante 2 repete a combinação da variante 1',
      )

      expect(
        client.$transaction,
      ).not.toHaveBeenCalled()
    },
  )

  test('cria um Product e configura a jante como Variant', async () => {
    const { client, transaction } =
      createClient()

    const result = await createAdminProduct(
      wheelInput(),
      client,
    )

    expect(
      transaction.product.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Japan Racing JR11',
          categoryId: 'category-wheels',
          productBrandId: 'brand-jr',
          isActive: true,
        }),
      }),
    )
    expect(
      transaction.productVariant.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 'product-wheel',
          sku: 'JR11-18',
          price: 169.9,
          stockQuantity: 8,
          isActive: true,
        }),
      }),
    )
    expect(
      transaction.productOption.upsert,
    ).toHaveBeenCalledTimes(6)
    expect(
      transaction.productVehicleCompatibility.create,
    ).not.toHaveBeenCalled()
    expect(result.variants[0].sku).toBe(
      'JR11-18',
    )
  })

  test(
    'persiste uma única galeria de acabamento partilhada pelas variantes',
    async () => {
      const { client, transaction } =
        createClient()
      const input = wheelInput({
        variants: [
          {
            ...wheelInput().variants[0],
            sku: 'JR11-18-BLACK',
          },
          {
            ...wheelInput().variants[0],
            sku: 'JR11-19-BLACK',
            selections: {
              ...wheelInput().variants[0]
                .selections,
              diameter: '19"',
            },
          },
        ],
        imageMetadata: [
          {
            url: '/general.jpg',
            isPrimary: true,
          },
          {
            url: '/black.jpg',
            finish: 'Satin Black',
            isPrimary: true,
          },
        ],
      })

      await createAdminProduct(input, client)

      expect(
        transaction.productImage.create,
      ).toHaveBeenCalledTimes(2)
      expect(
        transaction.productImage.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          url: '/black.jpg',
          finishValueId: 'value-created',
        }),
      })
      expect(
        transaction.product.update,
      ).toHaveBeenCalledWith({
        where: { id: 'product-wheel' },
        data: {
          images: ['/general.jpg'],
        },
      })
    },
  )

  test(
    'atualiza a galeria e remove imagens que já não são enviadas',
    async () => {
      const { client, transaction } =
        createClient()
      const input = wheelInput({
        productSku: 'JR11-MODEL',
        defaultFinish: null,
        images: ['/general-new.jpg'],
        imageMetadata: [
          {
            url: '/general-new.jpg',
            altText: 'Nova imagem geral',
            isPrimary: true,
          },
        ],
      })

      await updateAdminProduct(
        'product-wheel',
        input,
        client,
      )

      expect(
        transaction.productImage.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          productId: 'product-wheel',
        },
      })
      expect(
        transaction.productImage.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          url: '/general-new.jpg',
          altText: 'Nova imagem geral',
          isPrimary: true,
        }),
      })
      expect(
        transaction.product.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'product-wheel',
          },
          data: expect.objectContaining({
            images: ['/general-new.jpg'],
            defaultFinish: null,
          }),
        }),
      )
    },
  )

  test('mantém conflito explícito para SKU de variante', async () => {
    const { client, transaction } =
      createClient()
    vi.mocked(
      transaction.productVariant.findFirst,
    ).mockResolvedValueOnce({
      id: 'other-variant',
    } as never)

    await expect(
      createAdminProduct(
        wheelInput(),
        client,
      ),
    ).rejects.toBeInstanceOf(
      AdminProductConflictError,
    )
  })

  test(
    'registra movimento RESTOCK quando a criação de variante arranca com stock',
    async () => {
      const {
        client,
        stockMovementCreate,
      } = createClient()

      await createAdminProduct(
        wheelInput(),
        client,
      )

      expect(
        stockMovementCreate,
      ).toHaveBeenCalledTimes(
        1,
      )

      expect(
        stockMovementCreate,
      ).toHaveBeenCalledWith({
        data: {
          variantId:
            'variant-created',
          type: 'RESTOCK',
          quantityChange: 8,
          previousStock: 0,
          newStock: 8,
          actorUserId: null,
        },
      })
    },
  )

  test(
    'não registra movimento para variante nova sem stock inicial',
    async () => {
      const {
        client,
        stockMovementCreate,
      } = createClient()

      await createAdminProduct(
        wheelInput({
          variants: [
            {
              ...wheelInput()
                .variants[0],
              stockQuantity: 0,
            },
          ],
        }),
        client,
      )

      expect(
        stockMovementCreate,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'registra movimento RESTOCK na atualização de variante com aumento de stock',
    async () => {
      const {
        client,
        transaction,
        stockMovementCreate,
      } = createClient()

      const existingVariant = {
        id: 'variant-wheel',
        sku: 'JR11-18',
        stockQuantity: 8,
        optionKey: 'jr11-18',
        selections: [],
        specifications: [],
      }

      // 1.ª chamada: variantes existentes; 2.ª: variantes a eliminar.
      transaction.productVariant.findMany
        .mockResolvedValueOnce([
          existingVariant,
        ])
        .mockResolvedValueOnce([])

      await updateAdminProduct(
        'product-wheel',
        wheelInput({
          productSku: 'JR11-MODEL',
          variants: [
            {
              id: 'variant-wheel',
              ...wheelInput()
                .variants[0],
              stockQuantity: 12,
            },
          ],
        }),
        client,
      )

      expect(
        stockMovementCreate,
      ).toHaveBeenCalledTimes(
        1,
      )

      expect(
        stockMovementCreate,
      ).toHaveBeenCalledWith({
        data: {
          variantId:
            'variant-wheel',
          type: 'RESTOCK',
          quantityChange: 4,
          previousStock: 8,
          newStock: 12,
          actorUserId: null,
        },
      })
    },
  )

  test(
    'registra movimento MANUAL_ADJUSTMENT na atualização de variante com redução de stock',
    async () => {
      const {
        client,
        transaction,
        stockMovementCreate,
      } = createClient()

      const existingVariant = {
        id: 'variant-wheel',
        sku: 'JR11-18',
        stockQuantity: 8,
        optionKey: 'jr11-18',
        selections: [],
        specifications: [],
      }

      transaction.productVariant.findMany
        .mockResolvedValueOnce([
          existingVariant,
        ])
        .mockResolvedValueOnce([])

      await updateAdminProduct(
        'product-wheel',
        wheelInput({
          productSku: 'JR11-MODEL',
          variants: [
            {
              id: 'variant-wheel',
              ...wheelInput()
                .variants[0],
              stockQuantity: 5,
            },
          ],
        }),
        client,
      )

      expect(
        stockMovementCreate,
      ).toHaveBeenCalledWith({
        data: {
          variantId:
            'variant-wheel',
          type: 'MANUAL_ADJUSTMENT',
          quantityChange: -3,
          previousStock: 8,
          newStock: 5,
          actorUserId: null,
        },
      })
    },
  )

  test('elimina um produto sem referências e deixa os cascadesao para o esquema', async () => {
    const { client, transaction } =
      createClient()
    vi.mocked(
      transaction.product.findUnique,
    ).mockResolvedValue({
      id: 'product-wheel',
      name: 'Japan Racing JR11',
      isActive: true,
    } as never)

    const result =
      await deleteAdminProduct(
        'product-wheel',
        client,
      )

    expect(result).toMatchObject({
      id: 'product-wheel',
      status: 'deleted',
      references: {
        orderItems: 0,
        cartItems: 0,
      },
    })
    expect(
      transaction.product.delete,
    ).toHaveBeenCalledWith({
      where: { id: 'product-wheel' },
    })
    expect(
      transaction.orderItem.deleteMany,
    ).not.toHaveBeenCalled()
  })

  test('elimina um produto com variantes quando não há referências', async () => {
    const { client, transaction } =
      createClient()
    vi.mocked(
      transaction.product.findUnique,
    ).mockResolvedValue({
      id: 'product-wheel',
      name: 'Japan Racing JR11',
      isActive: false,
    } as never)
    vi.mocked(
      transaction.productVariant.findMany,
    ).mockResolvedValue([
      { id: 'variant-wheel' },
    ] as never)

    const result =
      await deleteAdminProduct(
        'product-wheel',
        client,
      )

    expect(result.status).toBe('deleted')
    expect(
      transaction.product.delete,
    ).toHaveBeenCalled()
    expect(
      transaction.product.update,
    ).not.toHaveBeenCalledWith({
        where: { id: 'product-wheel' },
        data: { isActive: false },
      })
  })

  test('arquiva em vez de eliminar um produto com histórico de encomendas', async () => {
    const { client, transaction } =
      createClient()
    vi.mocked(
      transaction.product.findUnique,
    ).mockResolvedValue({
      id: 'product-history',
      name: 'Produto histórico',
      isActive: true,
    } as never)
    vi.mocked(
      transaction.productVariant.findMany,
    ).mockResolvedValue([
      { id: 'variant-history' },
    ] as never)
    vi.mocked(
      transaction.orderItem.findMany,
    )
      .mockResolvedValueOnce([
        {
          order: {
            orderNumber: 'PFA-AAAA1111',
          },
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
    vi.mocked(
      transaction.cartItem.count,
    ).mockResolvedValue(0)

    const result =
      await deleteAdminProduct(
        'product-history',
        client,
      )

    expect(result).toMatchObject({
      status: 'archived',
      reason: 'order_history',
      orderNumbers: ['PFA-AAAA1111'],
      references: {
        orderItems: 1,
        cartItems: 0,
      },
    })
    expect(result.message).toContain(
      'PFA-AAAA1111',
    )
    expect(result.message).toContain(
      'arquivado',
    )
    expect(
      transaction.product.update,
    ).toHaveBeenCalledWith({
      where: { id: 'product-history' },
      data: { isActive: false },
    })
    expect(
      transaction.product.delete,
    ).not.toHaveBeenCalled()
  })

  test('considera uma referência da variante mesmo sem referência direta do produto', async () => {
    const { client, transaction } =
      createClient()
    vi.mocked(
      transaction.product.findUnique,
    ).mockResolvedValue({
      id: 'product-variant-history',
      name: 'Produto com histórico da variante',
      isActive: true,
    } as never)
    vi.mocked(
      transaction.productVariant.findMany,
    ).mockResolvedValue([
      { id: 'variant-history' },
    ] as never)
    vi.mocked(
      transaction.orderItem.findMany,
    )
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          order: {
            orderNumber: 'PFA-BBBB2222',
          },
        },
      ] as never)
    vi.mocked(
      transaction.cartItem.count,
    ).mockResolvedValue(0)

    const result =
      await deleteAdminProduct(
        'product-variant-history',
        client,
      )

    expect(result.status).toBe('archived')
    expect(result.orderNumbers).toEqual([
      'PFA-BBBB2222',
    ])
    expect(
      transaction.product.delete,
    ).not.toHaveBeenCalled()
  })

  test('atualiza vários produtos em ações em massa', async () => {
    const { client, transaction } =
      createClient()

    const result =
      await bulkAdminProductAction(
        {
          ids: ['product-wheel', 'product-two'],
          action: 'deactivate',
        },
        client,
      )

    expect(result.counts).toEqual({
      requested: 2,
      updated: 2,
      deleted: 0,
      archived: 0,
      failed: 0,
    })
    expect(
      transaction.product.update,
    ).toHaveBeenNthCalledWith(
      1,
      {
        where: { id: 'product-wheel' },
        data: { isActive: false },
      },
    )
    expect(
      transaction.product.update,
    ).toHaveBeenNthCalledWith(
      2,
      {
        where: { id: 'product-two' },
        data: { isActive: false },
      },
    )
  })

  test('ativa vários produtos em massa', async () => {
    const { client, transaction } =
      createClient()

    const result =
      await bulkAdminProductAction(
        {
          ids: ['product-one', 'product-two'],
          action: 'activate',
        },
        client,
      )

    expect(result.updated).toHaveLength(2)
    expect(
      transaction.product.update,
    ).toHaveBeenNthCalledWith(
      1,
      {
        where: { id: 'product-one' },
        data: { isActive: true },
      },
    )
    expect(
      transaction.product.update,
    ).toHaveBeenNthCalledWith(
      2,
      {
        where: { id: 'product-two' },
        data: { isActive: true },
      },
    )
  })

  test('devolve partial success ao misturar eliminação, arquivo e IDs inválidos', async () => {
    const { client, transaction } =
      createClient()
    vi.mocked(
      transaction.product.findUnique,
    ).mockImplementation(
      (async ({ where }: { where: { id: string } }) => {
        if (where.id === 'missing') {
          return null
        }

        return {
          id: where.id,
          name:
            where.id === 'history'
              ? 'Produto com encomenda'
              : 'Produto descartável',
          isActive: true,
        } as never
      }) as never,
    )
    vi.mocked(
      transaction.orderItem.findMany,
    ).mockImplementation(
      (async ({ where }: { where: { productId?: string } }) =>
        where.productId === 'history'
          ? [
              {
                order: {
                  orderNumber: 'PFA-CCCC3333',
                },
              },
            ]
          : []) as never,
    )

    const result =
      await bulkAdminProductAction(
        {
          ids: ['discardable', 'history', 'missing'],
          action: 'delete',
        },
        client,
      )

    expect(result.counts).toEqual({
      requested: 3,
      updated: 0,
      deleted: 1,
      archived: 1,
      failed: 1,
    })
    expect(result.failed[0]).toEqual({
      id: 'missing',
      error: 'Produto não encontrado',
    })
    expect(result.archived[0].reason).toBe(
      'order_history',
    )
    expect(result.archived[0].message).toContain(
      'PFA-CCCC3333',
    )
    expect(
      transaction.product.delete,
    ).toHaveBeenCalledWith({
      where: { id: 'discardable' },
    })
    expect(
      transaction.product.delete,
    ).not.toHaveBeenCalledWith({
      where: { id: 'history' },
    })
  })

  test(
    'elimina permanentemente um produto só referenciado por carrinhos e remove essas linhas',
    async () => {
      const { client, transaction } =
        createClient()
      vi.mocked(
        transaction.product.findUnique,
      ).mockResolvedValue({
        id: 'product-cart-only',
        name: 'Bicos de teste',
        isActive: true,
      } as never)
      vi.mocked(
        transaction.productVariant.findMany,
      ).mockResolvedValue([
        { id: 'variant-cart' },
      ] as never)
      vi.mocked(
        transaction.cartItem.count,
      ).mockResolvedValue(2)

      const result =
        await deleteAdminProduct(
          'product-cart-only',
          client,
        )

      expect(result.status).toBe('deleted')
      expect(result.reason).toBeUndefined()
      expect(result.references.cartItems).toBe(
        2,
      )
      expect(result.message).toContain(
        '2 linhas de carrinho',
      )
      expect(
        transaction.cartItem.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          OR: [
            { productId: 'product-cart-only' },
            {
              productVariantId: {
                in: ['variant-cart'],
              },
            },
          ],
        },
      })
      expect(
        transaction.product.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'product-cart-only' },
      })
    },
  )

  test(
    'arquiva com a encomenda exata quando há histórico real',
    async () => {
      const { client, transaction } =
        createClient()
      vi.mocked(
        transaction.product.findUnique,
      ).mockResolvedValue({
        id: 'product-real-history',
        name: 'BBS CH-R II',
        isActive: true,
      } as never)
      vi.mocked(
        transaction.orderItem.findMany,
      )
        .mockResolvedValueOnce([
          {
            order: {
              orderNumber: 'PFA-1234',
            },
          },
          {
            order: {
              orderNumber: 'PFA-5678',
            },
          },
        ] as never)
        .mockResolvedValueOnce([] as never)

      const result =
        await deleteAdminProduct(
          'product-real-history',
          client,
        )

      expect(result.status).toBe('archived')
      expect(result.orderNumbers).toEqual([
        'PFA-1234',
        'PFA-5678',
      ])
      expect(result.message).toBe(
        'Não foi possível eliminar BBS CH-R II porque está associado às encomendas (PFA-1234, PFA-5678). O produto foi arquivado para preservar o histórico de encomendas.',
      )
    },
  )

  test(
    'aceita preço com vírgula decimal e normaliza ET/CB/diâmetro/largura',
    async () => {
      const { client, transaction } =
        createClient()

      await createAdminProduct(
        wheelInput({
          variants: [
            {
              sku: '',
              price: '189,90' as unknown as number,
              stockQuantity:
                '6' as unknown as number,
              isActive: true,
              selections: {
                diameter: '18',
                width: '8.5',
                pcd: '5x112',
                offset: '35',
                centre_bore: '66,6',
                finish: 'Satin Black',
              },
              specifications: [],
            },
          ],
        }),
        client,
      )

      expect(
        transaction.productVariant.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            price: 189.9,
            stockQuantity: 6,
          }),
        }),
      )
      expect(
        transaction.productOptionValue.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            optionId_value: {
              optionId: 'option-offset',
              value: 'ET35',
            },
          },
        }),
      )
      expect(
        transaction.productOptionValue.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            optionId_value: {
              optionId: 'option-centre_bore',
              value: '66.6 mm',
            },
          },
        }),
      )
      expect(
        transaction.productOptionValue.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            optionId_value: {
              optionId: 'option-diameter',
              value: '18"',
            },
          },
        }),
      )
      expect(
        transaction.productOptionValue.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            optionId_value: {
              optionId: 'option-width',
              value: '8.5J',
            },
          },
        }),
      )
    },
  )

  test(
    'gera SKU automaticamente para variantes sem SKU',
    async () => {
      const { client, transaction } =
        createClient()

      await createAdminProduct(
        wheelInput({
          name: 'Japan Racing JR11',
          variants: [
            {
              sku: '',
              price: 189.9,
              stockQuantity: 6,
              isActive: true,
              selections: {
                diameter: '18"',
                width: '8.5J',
                pcd: '5x112',
                offset: 'ET35',
                centre_bore: '66.6 mm',
                finish: 'Satin Black',
              },
              specifications: [],
            },
          ],
        }),
        client,
      )

      expect(
        transaction.productVariant.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sku: expect.stringMatching(
              /^JAPAN-RACING-/,
            ),
          }),
        }),
      )
    },
  )
})
