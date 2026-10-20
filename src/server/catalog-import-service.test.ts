import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import type { PrismaClient } from '@prisma/client'

vi.mock('./db', () => ({
  prisma: {},
}))

import { commitCatalogImport } from './catalog-import-service'

/**
 * Cliente Prisma mockado no padrão dos testes do serviço de
 * produtos: delegates com mocks por defeito que os testes
 * ajustam (ex.: produto existente, falha simulada).
 */
function createClient() {
  const transaction = {
    product: {
      // Tipos folgados: os testes de reimport injetam
      // "produto existente"/"variante existente" por teste.
      findUnique: vi.fn(
        async (): Promise<unknown> => null,
      ),
      findFirst: vi.fn(
        async (): Promise<unknown> => null,
      ),
      create: vi.fn(async () => ({
        id: 'product-created',
      })),
      update: vi.fn(async () => ({
        id: 'product-1',
      })),
    },
    productImage: {
      count: vi.fn(async () => 0),
      // Dedupe de imagens: lê as linhas existentes do produto.
      findMany: vi.fn(
        async (): Promise<unknown[]> => [],
      ),
      create: vi.fn(async () => ({})),
    },
    productVariant: {
      findMany: vi.fn(
        async (): Promise<unknown[]> => [],
      ),
      // ensureUniqueSku consulta colisões de SKU.
      findFirst: vi.fn(
        async (): Promise<unknown> => null,
      ),
      create: vi.fn(async () => ({
        id: 'variant-created',
      })),
      update: vi.fn(async () => ({})),
      // Resumo de stock do produto pós-variantes.
      aggregate: vi.fn(async () => ({
        _sum: { stockQuantity: 0 },
      })),
    },
    productOption: {
      // Fluxo find→create/update (sem upsert).
      findUnique: vi.fn(
        async (): Promise<unknown> => null,
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { code: string }
        }) => ({
          id: `option-${data.code}`,
        }),
      ),
      update: vi.fn(async () => ({
        id: 'option-updated',
      })),
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
      findUnique: vi.fn(
        async (): Promise<unknown> => null,
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { value: string }
        }) => ({
          id: `value-${data.value}`,
        }),
      ),
      upsert: vi.fn(
        async ({
          create,
        }: {
          create: { value: string }
        }) => ({
          id: `value-${create.value}`,
        }),
      ),
    },
    productVariantOptionSelection: {
      create: vi.fn(async () => ({})),
    },
    productVariantSpecification: {
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    productVehicleCompatibility: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
    },
    productBrand: {
      findUnique: vi.fn(async () => ({
        id: 'brand-1',
      })),
      create: vi.fn(async () => ({
        id: 'brand-created',
      })),
    },
    category: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: 'category-created',
        slug: 'jantes',
      })),
    },
    // Delegates de veículo: os testes de compatibilidade
    // substituem-nos sempre (setupVehicleTree/árvore
    // case-insensitive), pelo que mocks soltos chegam.
    vehicleBrand: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    vehicleModel: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    vehicleGeneration: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    vehicleConfiguration: {
      findFirst: vi.fn(),
    },
  }

  const client = {
    ...transaction,
    productImport: {
      create: vi.fn(async () => ({
        id: 'import-1',
      })),
      update: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(
      async (
        callback: (
          tx: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    ),
  } as unknown as PrismaClient

  return { client, transaction }
}

const WHEELS_HEADERS =
  'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;Stock'

function wheelRow(
  product: string,
  sku: string,
  price: string,
  stock: string,
) {
  return `${product};Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;${sku};${price};${stock}`
}

const GLOSS_ROW =
  'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Gloss Black;;299,90;4'

/**
 * Linha representativa do ficheiro SIXNINE (jantes FF-ONE):
 * sem SKU no ficheiro (estratégia auto), stock inteiro, specs
 * completas e acabamento composto.
 */
const SIXNINE_HEADERS =
  'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;Stock'
const SIXNINE_ROW =
  'FF-ONE;SIXNINE;Jantes;20;8.5J;5x112;45;66.6;GlossyBlack;;349,90;6'

/** Mesma linha com stock ZERO — zero é válido e não pode virar null. */
const SIXNINE_ZERO_STOCK_ROW =
  'FF-ONE;SIXNINE;Jantes;20;8.5J;5x112;45;66.6;GlossyBlack;;349,90;0'

/** Colunas NOT NULL do modelo ProductVariant (schema real). */
const REQUIRED_VARIANT_COLUMNS = [
  'productId',
  'sku',
  'images',
  'optionKey',
  'price',
  'stockQuantity',
  'isActive',
  'position',
] as const

async function commit(
  client: PrismaClient,
  fileText: string,
  options?: {
    failureMode?: 'abort' | 'partial'
    skuStrategy?: 'auto' | 'supplier' | 'custom'
    skuOverrides?: Record<number, string>
    profile?: 'wheels' | 'suspension' | 'exterior' | 'generic'
  },
) {
  return commitCatalogImport({
    fileText,
    fileName: 'catalogo-fornecedor.csv',
    // Sem mapping explícito: o serviço deteta pelas colunas.
    profile: options?.profile ?? 'wheels',
    mode: 'create-update',
    failureMode: options?.failureMode,
    skuStrategy: options?.skuStrategy,
    skuOverrides: options?.skuOverrides,
    client,
  })
}

describe('commitCatalogImport — linha SIXNINE (FF-ONE)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('importa a linha FF-ONE: produto, variante, SKU automático, preço, stock, specs e sem campos NOT NULL em falta', async () => {
    const { client, transaction } =
      createClient()

    const result = await commit(
      client,
      [SIXNINE_HEADERS, SIXNINE_ROW].join('\n'),
    )

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }
    expect(result).toMatchObject({
      status: 'success',
      createdProducts: 1,
      createdVariants: 1,
      generatedSkus: 1,
      collisions: 0,
      errorCount: 0,
    })

    // Produto criado ANTES da variante, na MESMA transação.
    expect(
      transaction.product.create,
    ).toHaveBeenCalledTimes(1)
    const productArgs = (
      transaction.product.create.mock.calls as unknown as Array<[
        { data: { sku: string; images: string[] } }
      ]>
    )[0][0]
    expect(productArgs.data.sku).toBe('FF-ONE')
    expect(productArgs.data.images).toEqual([])

    const variantArgs = (
      transaction.productVariant.create.mock
        .calls as unknown as Array<[
        { data: Record<string, unknown> }
      ]>
    )[0][0]
    const data = variantArgs.data

    // NENHUM campo NOT NULL pode ficar indefinido — a mesma
    // verificação que o Prisma fazia em produção.
    for (const column of REQUIRED_VARIANT_COLUMNS) {
      expect(
        data,
        `campo obrigatório "${column}" em falta`,
      ).toHaveProperty(column)
      expect(data[column]).not.toBeNull()
      expect(data[column]).not.toBeUndefined()
    }

    // SKU automático: gerado, determinístico e estável.
    expect(data.sku).toBe(
      'FF-ONE-20-85-5X112-ET45-66.6MM-GLOSSYBLACK',
    )

    // Preço e stock populados; imagens da variante são []
    // (String[] NOT NULL sem default na BD).
    expect(data.price).toBe(349.9)
    expect(data.stockQuantity).toBe(6)
    expect(data.images).toEqual([])

    // Sem coluna de conjunto no ficheiro: priceSet fica null.
    expect(data.priceSet).toBeNull()

    // Specs gravadas como seleções de opções da variante.
    const selectionArgs = transaction
      .productVariantOptionSelection.create.mock
      .calls as unknown as Array<[
      {
        data: { optionId: string; optionValueId: string }
      }
    ]>
    const optionIds = selectionArgs.map(
      ([args]) => args.data.optionId,
    )
    expect(optionIds).toContain('option-diameter')
    expect(optionIds).toContain('option-finish')

    // Finish canónico nas opções do produto.
    const optionValues =
      transaction.productOptionValue.upsert.mock.calls.map(
        ([args]) =>
          (
            args as { create: { value: string } }
          ).create.value,
    )
    expect(optionValues).toContain('20"')
    expect(optionValues).toContain('8.5J')
    expect(optionValues).toContain('5x112')
    expect(optionValues).toContain('ET45')
    expect(optionValues).toContain('66.6 mm')
    expect(optionValues).toContain('GlossyBlack')

    // Relação com o produto pai na mesma transação.
    expect(data.productId).toBe('product-created')
  })

  test('stock = 0 é preservado (zero não vira null/omitido)', async () => {
    const { client, transaction } =
      createClient()

    const result = await commit(
      client,
      [
        SIXNINE_HEADERS,
        SIXNINE_ZERO_STOCK_ROW,
      ].join('\n'),
    )

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('success')
    expect(result.createdVariants).toBe(1)

    const createCalls =
      transaction.productVariant.create.mock
        .calls as unknown as Array<[
        {
          data: {
            stockQuantity: number
            price: number
          }
        }
      ]>

    expect(createCalls[0][0].data.stockQuantity).toBe(0)
    expect(createCalls[0][0].data.price).toBe(349.9)
  })
})

describe('commitCatalogImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('ficheiro vazio não escreve nada e regista histórico failed', async () => {
    const { client, transaction } =
      createClient()

    const result = await commit(
      client,
      `${WHEELS_HEADERS}\n`,
    )

    expect(result).toEqual({
      error:
        'O ficheiro não contém linhas de dados.',
    })

    // Histórico documenta a tentativa rejeitada.
    expect(
      client.productImport.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileName: 'catalogo-fornecedor.csv',
        status: 'failed',
        errorCount: 0,
      }),
    })

    // Nenhum dado de loja foi tocado.
    expect(
      client.$transaction,
    ).not.toHaveBeenCalled()
    expect(
      transaction.product.create,
    ).not.toHaveBeenCalled()
  })

  test('linhas inválidas rejeitam o import sem escrever nada', async () => {
    const { client, transaction } =
      createClient()

    const fileText = [
      WHEELS_HEADERS,
      wheelRow('VMF-MFZ7', 'OK-1', '299,90', '4'),
      // Preço malformado — a linha inteira é rejeitada.
      wheelRow('VMF-MFZ7', 'BAD-1', 'caro', '4'),
    ].join('\n')

    const result = await commit(client, fileText)

    expect(result).toMatchObject({
      error: expect.stringContaining(
        'linha(s) inválida(s)',
      ),
    })

    expect(
      client.productImport.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'failed',
        errorCount: 1,
      }),
    })

    // Nada foi escrito: nem produto, nem transação.
    expect(
      client.$transaction,
    ).not.toHaveBeenCalled()
    expect(
      transaction.product.create,
    ).not.toHaveBeenCalled()
    expect(
      transaction.productVariant.create,
    ).not.toHaveBeenCalled()
  })

  test('um produto a falhar não impede os outros (partial)', async () => {
    const { client, transaction } =
      createClient()

    transaction.productVariant.create
      .mockImplementationOnce(async () => ({
        id: 'variant-1',
      }))
      .mockImplementationOnce(async () => {
        throw new Error('Falha simulada')
      })

    const fileText = [
      WHEELS_HEADERS,
      wheelRow('VMF-MFZ7', 'VMFZ7-001', '299,90', '4'),
      'VMF-JR11;Japan Racing;Jantes;18;8J;5x112;35;66.6;Bronze;JR11-001;199,90;2',
    ].join('\n')

    const result = await commit(client, fileText, {
      failureMode: 'partial',
    })

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('partial')
    expect(result.createdProducts).toBe(1)
    expect(result.createdVariants).toBe(1)
    expect(result.errorCount).toBe(1)
    expect(result.errors).toEqual([
      {
        row: 3,
        sku: 'JR11-001',
        message:
          'VMF-JR11 — variante 18" 8J 5x112 ET35 66.6 mm Bronze (linha 3): erro inesperado da base de dados ao criar a variante (ver logs do servidor).',
      },
    ])

    expect(
      client.productImport.update,
    ).toHaveBeenCalledWith({
      where: { id: 'import-1' },
      data: expect.objectContaining({
        status: 'partial',
        errorCount: 1,
      }),
    })
  })

  test('reimport atualiza preço e stock da variante existente', async () => {
    const { client, transaction } =
      createClient()

    // Produto e variante já existem (import anterior).
    transaction.product.findUnique.mockResolvedValueOnce(
      { id: 'product-1' },
    )
    transaction.productVariant.findMany.mockResolvedValueOnce(
      [
        {
          id: 'variant-1',
          sku: 'VMFZ7-001',
          optionKey: 'vmf-mfz7-vmfz7-001',
        },
      ],
    )

    const fileText = [
      WHEELS_HEADERS,
      wheelRow('VMF-MFZ7', 'VMFZ7-001', '319,90', '9'),
    ].join('\n')

    const result = await commit(client, fileText)

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('success')
    expect(result.createdProducts).toBe(0)
    expect(result.updatedProducts).toBe(1)
    expect(result.createdVariants).toBe(0)
    expect(result.updatedVariants).toBe(1)

    // Upsert por SKU: atualizou em vez de duplicar.
    expect(
      transaction.productVariant.update,
    ).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: expect.objectContaining({
        price: 319.9,
        stockQuantity: 9,
        isActive: true,
      }),
    })
    expect(
      transaction.productVariant.create,
    ).not.toHaveBeenCalled()

    expect(
      client.productImport.update,
    ).toHaveBeenCalledWith({
      where: { id: 'import-1' },
      data: expect.objectContaining({
        status: 'success',
        updatedProducts: 1,
        updatedVariants: 1,
      }),
    })
  })

  test('grava valores de jante no formato canónico da loja', async () => {
    const { client, transaction } =
      createClient()

    const fileText = [
      WHEELS_HEADERS,
      wheelRow('VMF-MFZ7', 'VMFZ7-001', '299,90', '4'),
    ].join('\n')

    const result = await commit(client, fileText)

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('success')

    // 19 / 8.5 / 30 / 66,6 entram em 19" / 8.5J / ET30 /
    // 66.6 mm — os mesmos valores que o editor manual grava.
    const optionValues =
      transaction.productOptionValue.upsert.mock.calls.map(
        ([args]) =>
          (
            args as {
              create: { value: string }
            }
          ).create.value,
      )

    expect(optionValues).toContain('19"')
    expect(optionValues).toContain('8.5J')
    expect(optionValues).toContain('ET30')
    expect(optionValues).toContain('66.6 mm')
    expect(optionValues).toContain('5x120')
    expect(optionValues).toContain('Silver')

    // O centro de furo chega como centreBore mas a opção
    // da loja chama-se centre_bore.
    const optionCodes =
      transaction.productOption.upsert.mock.calls.map(
        ([args]) =>
          (
            args as {
              where: {
                productId_code: { code: string }
              }
            }
          ).where.productId_code.code,
      )

    expect(optionCodes).toContain('centre_bore')

    // Cada seleção ficou ligada à variante criada.
    expect(
      transaction.productVariantOptionSelection.create,
    ).toHaveBeenCalledTimes(6)
  })

test('priceSet do CSV é persistido na variante criada', async () => {
  const { client, transaction } = createClient()

  const result = await commit(
    client,
    [
      'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;PrecoConjunto4;Stock',
      'SIX-FF9;SIXNINE;Jantes;19;8.5J;5x112;45;66.6;GlossyBlack;FF9-A;479,99;1849,90;4',
    ].join('\n'),
  )

  if ('error' in result) {
    throw new Error(
      'o import devia correr: ' + result.error,
    )
  }

  expect(result.status).toBe('success')

  const createArgs = (
    transaction.productVariant.create.mock
      .calls as unknown as Array<[
    { data: Record<string, unknown> }
  ]>
  )[0][0]
  expect(createArgs.data.priceSet).toBe(1849.9)
})
})

describe('commitCatalogImport — segurança e SKUs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('modo abort: produto a falhar impede os seguintes e devolve failed', async () => {
    const { client, transaction } =
      createClient()

    // Primeiro produto falha na criação da variante.
    transaction.productVariant.create.mockImplementationOnce(
      async () => {
        throw new Error('Falha simulada')
      },
    )

    const fileText = [
      WHEELS_HEADERS,
      wheelRow('VMF-MFZ7', 'VMFZ7-001', '299,90', '4'),
      'VMF-JR11;Japan Racing;Jantes;18;8J;5x112;35;66.6;Bronze;JR11-001;199,90;2',
    ].join('\n')

    const result = await commit(client, fileText, {
      failureMode: 'abort',
    })

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('failed')
    expect(result.createdProducts).toBe(0)

    // O segundo produto nunca chegou a ser tentado: o loop
    // aborta ao primeiro erro (nada mais é escrito).
    expect(
      transaction.productVariant.create,
    ).toHaveBeenCalledTimes(1)

    expect(
      client.productImport.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'started',
          failureMode: 'abort',
        }),
      }),
    )

    expect(
      client.productImport.update,
    ).toHaveBeenCalledWith({
      where: { id: 'import-1' },
      data: expect.objectContaining({
        status: 'failed',
      }),
    })
  })

  test('rollback transacional: produto com falha não deixa dados a meio', async () => {
    const { client, transaction } =
      createClient()

    transaction.productVariant.create
      .mockImplementationOnce(async () => ({
        id: 'variant-ok',
      }))
      .mockImplementationOnce(async () => {
        throw new Error('Falha na 2a variante')
      })

    const fileText = [
      WHEELS_HEADERS,
      wheelRow('VMF-MFZ7', 'VMFZ7-001', '299,90', '4'),
      wheelRow('VMF-MFZ7', 'VMFZ7-002', '309,90', '6'),
    ].join('\n')

    const result = await commit(client, fileText, {
      failureMode: 'partial',
    })

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    // O produto falhou inteiro: nem criado nem atualizado.
    expect(result.status).toBe('failed')
    expect(result.createdProducts).toBe(0)
    expect(result.createdVariants).toBe(0)
    expect(result.errorCount).toBe(1)

    // Auditoria: nenhum change registado para o grupo falhado.
    expect(
      client.productImport.update,
    ).toHaveBeenCalledWith({
      where: { id: 'import-1' },
      data: expect.objectContaining({
        changes: [],
      }),
    })
  })

  test('SKU gerado automaticamente quando o ficheiro não traz referência', async () => {
    const { client, transaction } =
      createClient()

    const fileText = [
      WHEELS_HEADERS,
      GLOSS_ROW,
    ].join('\n')

    const result = await commit(client, fileText)

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('success')
    expect(result.generatedSkus).toBe(1)
    expect(result.collisions).toBe(0)

    const generateCalls =
      transaction.productVariant.create.mock
        .calls as unknown as Array<[
        {
          data: {
            sku: string
            supplierSku: unknown
          }
        }
      ]>

    expect(generateCalls[0][0].data.sku).toBe(
      'VMF-MFZ7-19-85-5X120-ET30-66.6MM-GB',
    )
    expect(
      generateCalls[0][0].data.supplierSku,
    ).toBeNull()
  })

  test('colisão real de SKU recebe sufixo único; nunca sobrescreve outra variante', async () => {
    const { client, transaction } =
      createClient()

    // O SKU gerado já existe na BD noutra variante.
    transaction.productVariant.findFirst.mockImplementation(
      async (...args: unknown[]) => {
        const call = args[0] as
          | {
              where: { sku: string }
            }
          | undefined

        const sku = call?.where.sku ?? ''

        return sku ===
          'VMF-MFZ7-19-85-5X120-ET30-66.6MM-GB'
          ? { id: 'other-variant' }
          : null
      },
    )

    const fileText = [
      WHEELS_HEADERS,
      GLOSS_ROW,
    ].join('\n')

    const result = await commit(client, fileText)

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.collisions).toBe(1)

    const createCalls =
      transaction.productVariant.create.mock
        .calls as unknown as Array<[
        { data: { sku: string } }
      ]>

    // SKU final = SKU gerado + sufixo determinístico único.
    expect(
      createCalls[0][0].data.sku.startsWith(
        'VMF-MFZ7-19-85',
      ),
    ).toBe(true)
    expect(
      createCalls[0][0].data.sku,
    ).not.toBe(
      'VMF-MFZ7-19-85-5X120-ET30-66.6MM-GB',
    )
  })

  test('override manual do SKU é respeitado; colisão manual falha sem sufixo', async () => {
    const { client, transaction } =
      createClient()

    // SKU manual já ocupado por outra variante.
    transaction.productVariant.findFirst.mockResolvedValueOnce(
      { id: 'other-variant' },
    )

    const fileText = [
      WHEELS_HEADERS,
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;;299,90;4',
    ].join('\n')

    const result = await commit(client, fileText, {
      skuStrategy: 'custom',
      skuOverrides: { 2: 'MEU-SKU' },
    })

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    // O import falhou (abort por defeito) e o SKU manual
    // não foi reescrito nem criado com sufixo.
    expect(result.status).toBe('failed')
    expect(result.errorCount).toBe(1)
    expect(result.errors[0].message).toContain(
      'MEU-SKU',
    )
    expect(
      transaction.productVariant.create,
    ).not.toHaveBeenCalled()
  })

  test('override manual válido cria a variante com o SKU indicado', async () => {
    const { client, transaction } =
      createClient()

    const fileText = [
      WHEELS_HEADERS,
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;;299,90;4',
    ].join('\n')

    const result = await commit(client, fileText, {
      skuStrategy: 'custom',
      skuOverrides: { 2: 'MEU-SKU-01' },
    })

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('success')
    expect(result.generatedSkus).toBe(0)

    const createCalls =
      transaction.productVariant.create.mock
        .calls as unknown as Array<[
        { data: { sku: string } }
      ]>

    expect(createCalls[0][0].data.sku).toBe(
      'MEU-SKU-01',
    )
  })

  test('erro técnico do Prisma na criação vira mensagem útil por linha e log no servidor', async () => {
    const { client, transaction } =
      createClient()

    // Simula exatamente o erro em produção: o Prisma rejeita
    // o create dentro da transação (ex.: constraint NOT NULL).
    transaction.productVariant.create.mockImplementationOnce(
      async () => {
        throw new Error(
          'Invalid transaction.productVariant.create() invocation\nNull constraint violation on the (not available)',
        )
      },
    )

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    try {
      const result = await commit(
        client,
        [
          WHEELS_HEADERS,
          SIXNINE_ROW,
        ].join('\n'),
      )

      if ('error' in result) {
        throw new Error(
          'o import devia correr: ' + result.error,
        )
      }

      expect(result.status).toBe('failed')
      expect(result.errorCount).toBe(1)

      // O admin recebe a variante exata, não o erro bruto.
      expect(result.errors[0].message).toBe(
        'FF-ONE — variante 20" 8.5J 5x112 ET45 66.6 mm GlossyBlack (linha 2): erro inesperado da base de dados ao criar a variante (ver logs do servidor).',
      )
      expect(result.errors[0].row).toBe(2)
      expect(result.errors[0].sku).toBe(
        'FF-ONE-20-85-5X112-ET45-66.6MM-GLOSSYBLACK',
      )

      // O erro técnico original ficou nos logs do servidor.
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          '[catalog-import] erro técnico ao criar variante',
        ),
        expect.any(Error),
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  test('barreira de produção: campo obrigatório não produzido falha antes do Prisma com mensagem por linha', async () => {
    const { client, transaction } =
      createClient()

    // Estratégia "supplier" com ficheiro SEM referências:
    // nenhum SKU interno consegue ser produzido.
    const result = await commit(
      client,
      [WHEELS_HEADERS, SIXNINE_ROW].join('\n'),
      { skuStrategy: 'supplier' },
    )

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('failed')
    expect(result.errorCount).toBe(1)
    expect(result.errors[0].message).toBe(
      'FF-ONE — variante 20" 8.5J 5x112 ET45 66.6 mm GlossyBlack (linha 2): campo obrigatório \'sku\' não foi produzido pelo importador.',
    )

    // Nada chegou ao Prisma: nem variantes, nem produto.
    expect(
      transaction.productVariant.create,
    ).not.toHaveBeenCalled()
    expect(
      transaction.productVariant.update,
    ).not.toHaveBeenCalled()
  })

  test('modo abort com rollback: falha numa linha posterior aborta o import inteiro', async () => {
    const { client, transaction } =
      createClient()

    // A primeira linha (FF-ONE) corre limpa; a SEGUNDA falha
    // dentro da sua transação — o produto JR11 fica SEM dados
    // a meio (rollback do $transaction por produto) e, em modo
    // abort, nenhum produto posterior é tentado.
    transaction.productVariant.create
      .mockImplementationOnce(async () => ({
        id: 'variant-ff-one',
      }))
      .mockImplementationOnce(async () => {
        throw new Error('Null constraint violation')
      })

    const fileText = [
      WHEELS_HEADERS,
      SIXNINE_ROW,
      'VMF-JR11;Japan Racing;Jantes;18;8J;5x112;35;66.6;Bronze;JR11-001;199,90;2',
    ].join('\n')

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    try {
      const result = await commit(client, fileText, {
        failureMode: 'abort',
      })

      if ('error' in result) {
        throw new Error(
          'o import devia correr: ' + result.error,
        )
      }

      // O primeiro produto (transação própria) ficou gravado;
      // o segundo falhou e, em modo abort, nada DEPOIS dele é
      // tentado. Auditoria só contém o produto que entrou.
      expect(result.status).toBe('partial')
      expect(result.createdProducts).toBe(1)
      expect(result.createdVariants).toBe(1)
      expect(result.errorCount).toBe(1)

      // Aborta após o PRIMEIRO produto: o segundo chega a
      // começar a sua transação (produto criado em memória da
      // transação) mas a variante falha e a transação inteira
      // do JR11 faz rollback — nada fica gravado dele.
      expect(
        transaction.productVariant.create,
      ).toHaveBeenCalledTimes(2)
      expect(
        transaction.product.create,
      ).toHaveBeenCalledTimes(2)

      expect(
        client.productImport.update,
      ).toHaveBeenCalledWith({
        where: { id: 'import-1' },
        data: expect.objectContaining({
          status: 'partial',
          changes: [
            expect.objectContaining({
              productCode: 'FF-ONE',
            }),
          ],
        }),
      })
    } finally {
      consoleError.mockRestore()
    }
  })

  test('reimport por supplierSku atualiza mantendo o SKU interno estável', async () => {
    const { client, transaction } =
      createClient()

    // Nem o SKU interno coincide: a referência do fornecedor
    // identifica a MESMA variante (reimport com nova ref).
    transaction.productVariant.findFirst.mockResolvedValueOnce(
      {
        id: 'variant-existing',
        sku: 'INTERNAL-STABLE-01',
        optionKey: 'vmf-mfz7-internal-stable-01',
      },
    )

    const fileText = [
      WHEELS_HEADERS,
      wheelRow('VMF-MFZ7', 'SUP-NEW-REF', '319,90', '9'),
    ].join('\n')

    const result = await commit(client, fileText)

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    expect(result.status).toBe('success')
    expect(result.updatedVariants).toBe(1)
    expect(result.createdVariants).toBe(0)

    const updateCalls =
      transaction.productVariant.update.mock
        .calls as unknown as Array<[
        {
          where: { id: string }
          data: {
            price: number
            supplierSku: string | null
          }
        }
      ]>

    expect(updateCalls[0][0].where.id).toBe(
      'variant-existing',
    )
    expect(updateCalls[0][0].data.price).toBe(319.9)
    expect(updateCalls[0][0].data.supplierSku).toBe(
      'SUP-NEW-REF',
    )

    // Auditoria: a variante atualizada mantém o SKU interno.
    expect(
      client.productImport.update,
    ).toHaveBeenCalledWith({
      where: { id: 'import-1' },
      data: expect.objectContaining({
        changes: [
          expect.objectContaining({
            updatedVariants: [
              { sku: 'INTERNAL-STABLE-01' },
            ],
          }),
        ],
      }),
    })
  })
})

describe(
  'commitCatalogImport — imagens importadas (SIXNINE)',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    const IMAGE_HEADERS =
      'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;Stock;ImageGeralURL;ImageAcabamentoURL'

    const HYPER_ROW =
      'FF-TWO;SIXNINE;Jantes;21;10J;5x112;35;66.6;HyperSilver;;399,90;2;https://sixnine-wheels.com/ff-two.jpg;https://sixnine-wheels.com/ff-two-hypersilver.jpg'

    const GLOSS_ROW_WITH_IMAGE =
      'FF-TWO;SIXNINE;Jantes;21;10J;5x112;35;66.6;GlossyBlack;;399,90;2;;https://sixnine-wheels.com/ff-two-glossyblack.jpg'

    test(
      'URLs de acabamento viram ProductImage por produto com finishValueId e isPrimary correto',
      async () => {
        const { client, transaction } =
          createClient()

        const result = await commit(client, [
          IMAGE_HEADERS,
          HYPER_ROW,
        ].join('\n'))

        if ('error' in result) {
          throw new Error(
            'o import devia correr: ' +
              result.error,
          )
        }

        expect(result.status).toBe('success')
        expect(result.createdVariants).toBe(1)

        const createCalls =
          transaction.productImage.create.mock
            .calls as unknown as Array<[
          {
            data: {
              productId: string
              url: string
              finishValueId: string | null
              isPrimary: boolean
              sortOrder: number
            }
          }
        ]>

        // Duas imagens: geral (sem cor) + HyperSilver.
        expect(createCalls).toHaveLength(2)

        const [general, hyper] = createCalls.map(
          ([call]) => call.data,
        )

        // Ambas pertencem a ESTE produto (nunca globais).
        expect(general.productId).toBe(
          'product-created',
        )
        expect(hyper.productId).toBe(
          'product-created',
        )

        // URL persistido exatamente como veio do CSV.
        expect(general.url).toBe(
          'https://sixnine-wheels.com/ff-two.jpg',
        )
        expect(hyper.url).toBe(
          'https://sixnine-wheels.com/ff-two-hypersilver.jpg',
        )

        // Geral sem cor; acabamento ligado ao ProductOptionValue
        // da cor desta linha.
        expect(general.finishValueId).toBeNull()
        expect(hyper.finishValueId).toBe(
          'value-HyperSilver',
        )

        // Primeira imagem é a primária; sortOrder sequencial.
        expect(general.isPrimary).toBe(true)
        expect(general.sortOrder).toBe(0)
        expect(hyper.isPrimary).toBe(false)
        expect(hyper.sortOrder).toBe(1)
      },
    )

    test(
      'várias linhas do mesmo produto acumulam imagens por acabamento, sem duplicar URLs',
      async () => {
        const { client, transaction } =
          createClient()

        const result = await commit(client, [
          IMAGE_HEADERS,
          HYPER_ROW,
          // Repetição da MESMA variante/acabamento com os MESMOS
          // URLs — dedupe não pode criar imagens extra.
          HYPER_ROW,
          // Linha de outro acabamento apenas com a imagem dele:
          // o URL de acabamento NÃO precisa de estar em todas as
          // linhas — uma imagem por Produto+Acabamento chega.
          GLOSS_ROW_WITH_IMAGE,
        ].join('\n'))

        if ('error' in result) {
          throw new Error(
            'o import devia correr: ' +
              result.error,
          )
        }

        expect(result.status).toBe('success')
        // A linha repetida cria também variante repetida (a
        // deduplicação de variantes é garantida por constraint
        // única na BD) — o que interessa aqui são as IMAGENS.
        expect(result.createdVariants).toBe(3)

        const urls =
          transaction.productImage.create.mock
            .calls as unknown as Array<[
          {
            data: {
              url: string
              finishValueId: string | null
              sortOrder: number
              isPrimary: boolean
            }
          }
        ]>

        const images = urls.map(([call]) => call.data)

        // Geral + HyperSilver + GlossyBlack — a linha repetida
        // de HyperSilver não criou duplicados.
        expect(images.map((image) => image.url)).toEqual(
          [
            'https://sixnine-wheels.com/ff-two.jpg',
            'https://sixnine-wheels.com/ff-two-hypersilver.jpg',
            'https://sixnine-wheels.com/ff-two-glossyblack.jpg',
          ],
        )

        // Cada acabamento ligado ao SEU ProductOptionValue.
        expect(
          images.map(
            (image) => image.finishValueId,
          ),
        ).toEqual([
          null,
          'value-HyperSilver',
          'value-GlossyBlack',
        ])

        // Primária única: a primeira (geral) — as restantes
        // ficam por acabamento, como o card precisa.
        expect(
          images.filter((image) => image.isPrimary),
        ).toHaveLength(1)
        expect(
          images.map((image) => image.sortOrder),
        ).toEqual([0, 1, 2])
      },
    )

    test(
      'reimport não duplica imagens já existentes do produto',
      async () => {
        const { client, transaction } =
          createClient()

        // Produto já tem imagens de um import anterior:
        // geral + HyperSilver com os MESMOS URLs do CSV.
        transaction.productImage.findMany.mockResolvedValueOnce(
          [
            {
              id: 'img-1',
              url: 'https://sixnine-wheels.com/ff-two.jpg',
              finishValueId: null,
            },
            {
              id: 'img-2',
              url: 'https://sixnine-wheels.com/ff-two-hypersilver.jpg',
              finishValueId: 'value-HyperSilver',
            },
          ],
        )

        const result = await commit(client, [
          IMAGE_HEADERS,
          HYPER_ROW,
        ].join('\n'))

        if ('error' in result) {
          throw new Error(
            'o import devia correr: ' +
              result.error,
          )
        }

        expect(result.status).toBe('success')

        // Política de não-destruição + dedupe: ambas as
        // imagens já existem, nada é criado.
        expect(
          transaction.productImage.create,
        ).not.toHaveBeenCalled()
        expect(result.matchedImages).toBe(2)
        expect(result.createdImages).toBe(0)
      },
    )

    test(
      'produto EXISTENTE em modo update recebe apenas as imagens em falta',
      async () => {
        const { client, transaction } =
          createClient()

        // Produto já existe (resolvido por ProductCode via SKU).
        transaction.product.findUnique.mockResolvedValueOnce(
          {
            id: 'product-existing',
          },
        )

        // E já tem a imagem geral de um import anterior.
        transaction.productImage.findMany.mockResolvedValueOnce(
          [
            {
              id: 'img-1',
              url: 'https://sixnine-wheels.com/ff-two.jpg',
              finishValueId: null,
            },
          ],
        )

        const result = await commit(client, [
          IMAGE_HEADERS,
          HYPER_ROW,
        ].join('\n'))

        if ('error' in result) {
          throw new Error(
            'o import devia correr: ' +
              result.error,
          )
        }

        expect(result.status).toBe('success')

        const createCalls =
          transaction.productImage.create.mock
            .calls as unknown as Array<[
          {
            data: {
              productId: string
              url: string
              isPrimary: boolean
              sortOrder: number
              finishValueId: string | null
            }
          }
        ]>

        // Só a imagem de acabamento EM FALTA é criada.
        expect(createCalls).toHaveLength(1)
        expect(createCalls[0][0].data).toMatchObject(
          {
            // O produto existente (via product.update).
            productId: 'product-1',
            url: 'https://sixnine-wheels.com/ff-two-hypersilver.jpg',
            finishValueId: 'value-HyperSilver',
            // A geral existente mantém-se primária;
            // a nova entra a seguir.
            isPrimary: false,
            sortOrder: 1,
          },
        )
        expect(result.createdImages).toBe(1)
        expect(result.matchedImages).toBe(1)
      },
    )

    test(
      'mesmo acabamento em dois produtos não partilha imagens',
      async () => {
        const { client, transaction } =
          createClient()

        // IDs distintos por produto criado.
        let productCounter = 0
        transaction.product.create.mockImplementation(
          async () => {
            productCounter += 1
            return {
              id: `product-${productCounter}`,
            }
          },
        )

        const result = await commit(client, [
          IMAGE_HEADERS,
          // FF-ONE GlossyBlack com o URL DELE.
          'FF-ONE;SIXNINE;Jantes;20;8.5J;5x112;45;66.6;GlossyBlack;;349,90;6;;https://sixnine-wheels.com/ff-one-glossyblack.jpg',
          // FF-TWO GlossyBlack com OUTRO URL.
          'FF-TWO;SIXNINE;Jantes;21;10J;5x112;35;66.6;GlossyBlack;;399,90;2;;https://sixnine-wheels.com/ff-two-glossyblack.jpg',
        ].join('\n'))

        if ('error' in result) {
          throw new Error(
            'o import devia correr: ' +
              result.error,
          )
        }

        expect(result.status).toBe('success')
        expect(result.createdProducts).toBe(2)

        const createCalls =
          transaction.productImage.create.mock
            .calls as unknown as Array<[
          {
            data: {
              productId: string
              url: string
            }
          }
        ]>

        const images = createCalls.map(
          ([call]) => call.data,
        )

        // Cada imagem pertence ao SEU produto — mesmo com
        // o acabamento com nome igual nos dois.
        expect(images).toContainEqual(
          expect.objectContaining({
            productId: 'product-1',
            url: 'https://sixnine-wheels.com/ff-one-glossyblack.jpg',
          }),
        )
        expect(images).toContainEqual(
          expect.objectContaining({
            productId: 'product-2',
            url: 'https://sixnine-wheels.com/ff-two-glossyblack.jpg',
          }),
        )

        // Nenhum URL cruzou de produto.
        expect(
          images.find(
            (image) =>
              image.productId === 'product-1',
          )?.url,
        ).not.toContain('ff-two')
        expect(
          images.find(
            (image) =>
              image.productId === 'product-2',
          )?.url,
        ).not.toContain('ff-one')
      },
    )

    test(
      'falha ao gravar imagem em modo abort reverte o produto inteiro',
      async () => {
        const { client, transaction } =
          createClient()

        // A persistência de imagem faz parte da MESMA
        // transação do produto: falhar aqui reverte tudo.
        transaction.productImage.create.mockRejectedValueOnce(
          new Error('BD indisponível'),
        )

        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        try {
          const result = await commit(client, [
            IMAGE_HEADERS,
            HYPER_ROW,
          ].join('\n'))

          if ('error' in result) {
            throw new Error(
              'o import devia correr: ' +
                result.error,
            )
          }

          // Nada ficou a meio: o produto falhou como um todo.
          expect(result.status).toBe('failed')
          expect(result.createdProducts).toBe(0)
          expect(result.createdVariants).toBe(0)
          expect(result.createdImages).toBe(0)
          expect(result.errors[0].message).toContain(
            'BD indisponível',
          )
        } finally {
          consoleError.mockRestore()
        }
      },
    )

    test(
      'imagem de acabamento órfã (linha sem cor) é ignorada com aviso visível no resultado',
      async () => {
        const { client, transaction } =
          createClient()

        // Perfil genérico: não exige acabamento, por isso a
        // imagem de acabamento fica órfã e cai com aviso.
        const result = await commit(
          client,
          [
            'Product;Price;ImageAcabamentoURL',
            'BOT-1;12,00;https://sixnine-wheels.com/bot-1-sem-cor.jpg',
          ].join('\n'),
          { profile: 'generic' },
        )

        if ('error' in result) {
          throw new Error(
            'o import devia correr: ' + result.error,
          )
        }

    expect(result.status).toBe('success')

    // Nenhuma ProductImage foi criada…
    expect(
      transaction.productImage.create,
    ).not.toHaveBeenCalled()

    // …mas o aviso chega ao admin (resultado + histórico).
    expect(result.warnings).toHaveLength(1)
        expect(
          result.warnings[0].message,
        ).toContain(
          'https://sixnine-wheels.com/bot-1-sem-cor.jpg',
        )

        expect(
          client.productImport.update,
        ).toHaveBeenCalledWith({
          where: { id: 'import-1' },
          data: expect.objectContaining({
            warnings: [
              expect.objectContaining({
                message: expect.stringContaining(
                  'não indica acabamento',
                ),
              }),
            ],
          }),
        })
      },
    )
  },
)

describe('commitCatalogImport — compatibilidades de veículo e resumo de stock', () => {
  const EXTERIOR_CSV = [
    'ProductCode;NomeProduto;Fabricante;Categoria;MarcaVeiculo;ModeloVeiculo;GeracaoChassis;TipoProduto;Preco;Stock_Teste;Ativo',
    'BM-1;Splitter Frontal G22;Maxton Design;Exterior;BMW;Série 4;G22/G23;Splitter frontal;199.0;6;True',
  ].join('\n')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function setupVehicleTree() {
    const { client, transaction } = createClient()

    // Árvore de veículos vazia: TUDO é criado pelo importador.
    transaction.vehicleBrand = {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => ({
        id: `vbrand-${data.slug}`,
      })),
    }
    transaction.vehicleModel = {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => ({
        id: `vmodel-${toSlugKey(data.name)}`,
      })),
    }
    transaction.vehicleGeneration = {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => ({
        id: `vgen-${toSlugKey(data.name)}`,
      })),
    }
    transaction.vehicleConfiguration = {
      findFirst: vi.fn(async () => null),
    }

    return { client, transaction }
  }

  function toSlugKey(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  test('cria VehicleBrand/Model/Generation quando não existem e grava uma compatibilidade por geração', async () => {
    const { client, transaction } =
      setupVehicleTree()

    const result = await commit(
      client,
      EXTERIOR_CSV,
      { profile: 'exterior' },
    )

    if ('error' in result) {
      throw new Error(
        'o import devia correr: ' + result.error,
      )
    }

    // "G22/G23" → DUAS gerações, nunca uma string falsa.
    expect(
      transaction.vehicleGeneration.create,
    ).toHaveBeenCalledTimes(2)
    expect(
      transaction.vehicleGeneration.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'G22' }),
      }),
    )
    expect(
      transaction.vehicleGeneration.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'G23' }),
      }),
    )

    // Uma compatibilidade por geração.
    expect(
      transaction.productVehicleCompatibility.create,
    ).toHaveBeenCalledTimes(2)
    expect(
      transaction.productVehicleCompatibility.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vehicleBrandId: 'vbrand-bmw',
          vehicleGenerationId: 'vgen-g22',
        }),
      }),
    )

    // O eixo productType foi criado como opção.
    expect(
      transaction.productOption.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'productType',
        }),
      }),
    )
  })

  test('reutiliza entidades existentes (case-insensitive) sem duplicar', async () => {
    const { client, transaction } = createClient()

    transaction.vehicleBrand = {
      findFirst: vi.fn(async () => ({ id: 'brand-bmw' })),
      create: vi.fn(),
    }
    transaction.vehicleModel = {
      findFirst: vi.fn(async () => ({ id: 'model-s4' })),
      create: vi.fn(),
    }
    transaction.vehicleGeneration = {
      findFirst: vi.fn(async ({ where }) =>
        where.name.equals === 'G22'
          ? { id: 'gen-g22' }
          : null,
      ),
      create: vi.fn(async ({ data }) => ({
        id: `gen-${toSlugKey(data.name)}`,
      })),
    }
    transaction.vehicleConfiguration = {
      findFirst: vi.fn(async () => null),
    }

    await commit(client, EXTERIOR_CSV, {
      profile: 'exterior',
    })

    expect(transaction.vehicleBrand.create).not
      .toHaveBeenCalled()
    expect(transaction.vehicleModel.create).not
      .toHaveBeenCalled()
    // Só G23 é nova.
    expect(
      transaction.vehicleGeneration.create,
    ).toHaveBeenCalledTimes(1)
  })

  test('stock do produto é sincronizado com a soma das variantes (create e update)', async () => {
    const { client, transaction } =
      setupVehicleTree()

    transaction.productVariant.aggregate.mockResolvedValue(
      { _sum: { stockQuantity: 6 } },
    )

    await commit(
      client,
      EXTERIOR_CSV,
      { profile: 'exterior' },
    )

    // Create path: o resumo é escrito a partir do aggregate.
    const productCreateCalls =
      transaction.product.create
        .mock
        .calls as unknown as Array<[
      { data?: { stockQuantity?: number } },
    ]>

    const createCall = productCreateCalls.find(
      ([call]) =>
        call?.data?.stockQuantity !== undefined,
    )

    expect(createCall).toBeDefined()

    const syncUpdate = (
      transaction.product.update
        .mock
        .calls as unknown as Array<[
      { data?: { stockQuantity?: number } },
    ]>
    ).filter(
      ([call]) => call?.data?.stockQuantity === 6,
    )

    expect(syncUpdate.length).toBeGreaterThan(0)
  })
})
