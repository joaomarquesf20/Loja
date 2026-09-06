import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  CatalogClient,
  getCatalogCategoryPageBySlug,
  getCatalogProductBySlug,
  listCatalogCategories,
  listCatalogProducts,
} from './catalog'

function createClient(): CatalogClient {
  return {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  }
}

describe('Catalog', () => {
  describe('listCatalogProducts', () => {
    test('consulta apenas produtos ativos', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await listCatalogProducts(client)

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          stockQuantity: true,
          images: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })
    })

    test('transforma produto no modelo público', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: 'Descrição',
          price: '19.99',
          stockQuantity: 5,
          images: [
            '/products/produto-1.jpg',
          ],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: {
            id: 'brand-1',
            name: 'Marca 1',
            slug: 'marca-1',
          },
        },
      ])

      const result =
        await listCatalogProducts(client)

      expect(result).toEqual([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: 'Descrição',
          price: 19.99,
          inStock: true,
          images: [
            '/products/produto-1.jpg',
          ],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: {
            id: 'brand-1',
            name: 'Marca 1',
            slug: 'marca-1',
          },
        },
      ])
    })

    test('produto sem stock devolve inStock false', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: 10,
          stockQuantity: 0,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        },
      ])

      const result =
        await listCatalogProducts(client)

      expect(result[0]?.inStock).toBe(
        false,
      )
      expect(result[0]?.brand).toBeNull()
      expect(result[0]?.images).toEqual(
        [],
      )
    })

    test('não expõe stockQuantity no modelo público', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: 10,
          stockQuantity: 37,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        },
      ])

      const [product] =
        await listCatalogProducts(client)

      expect(product).not.toHaveProperty(
        'stockQuantity',
      )
      expect(product?.inStock).toBe(true)
    })
  })

  describe('getCatalogProductBySlug', () => {
    test('procura apenas produto ativo pelo slug', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue(null)

      await getCatalogProductBySlug(
        'produto-1',
        client,
      )

      expect(
        client.product.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          slug: 'produto-1',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          description: true,
          price: true,
          stockQuantity: true,
          images: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })
    })

    test('devolve detalhe público do produto', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue({
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        sku: 'SKU-001',
        description: 'Descrição',
        price: '49.90',
        stockQuantity: 2,
        images: [
          '/products/produto-1.jpg',
        ],
        category: {
          id: 'category-1',
          name: 'Categoria 1',
          slug: 'categoria-1',
        },
        brand: {
          id: 'brand-1',
          name: 'Marca 1',
          slug: 'marca-1',
        },
      })

      const result =
        await getCatalogProductBySlug(
          'produto-1',
          client,
        )

      expect(result).toEqual({
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        sku: 'SKU-001',
        description: 'Descrição',
        price: 49.9,
        inStock: true,
        images: [
          '/products/produto-1.jpg',
        ],
        category: {
          id: 'category-1',
          name: 'Categoria 1',
          slug: 'categoria-1',
        },
        brand: {
          id: 'brand-1',
          name: 'Marca 1',
          slug: 'marca-1',
        },
      })

      expect(result).not.toHaveProperty(
        'stockQuantity',
      )
    })

    test('devolve null quando produto não existe ou está inativo', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue(null)

      const result =
        await getCatalogProductBySlug(
          'produto-inexistente',
          client,
        )

      expect(result).toBeNull()
    })

    test('slug vazio devolve null sem consultar a base de dados', async () => {
      const client = createClient()

      const result =
        await getCatalogProductBySlug(
          '   ',
          client,
        )

      expect(result).toBeNull()

      expect(
        client.product.findFirst,
      ).not.toHaveBeenCalled()
    })
  })

  describe('getCatalogCategoryPageBySlug', () => {
    test('slug vazio devolve null sem consultar a base de dados', async () => {
      const client = createClient()

      const result =
        await getCatalogCategoryPageBySlug(
          '   ',
          client,
        )

      expect(result).toBeNull()

      expect(
        client.category.findMany,
      ).not.toHaveBeenCalled()

      expect(
        client.product.findMany,
      ).not.toHaveBeenCalled()
    })

    test('devolve null quando categoria não existe', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'inexistente',
          client,
        )

      expect(result).toBeNull()

      expect(
        client.product.findMany,
      ).not.toHaveBeenCalled()
    })

    test('inclui produtos das subcategorias', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: 'Categoria principal',
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'root',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'grandchild',
          parentId: 'child',
          name: 'Neta',
          slug: 'neta',
          description: null,
          _count: {
            products: 1,
          },
        },
        {
          id: 'other',
          parentId: null,
          name: 'Outra',
          slug: 'outra',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: '25.50',
          stockQuantity: 3,
          images: [],
          category: {
            id: 'grandchild',
            name: 'Neta',
            slug: 'neta',
          },
          brand: null,
        },
      ])

      const result =
        await getCatalogCategoryPageBySlug(
          'raiz',
          client,
        )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith({
        where: {
          isActive: true,
          categoryId: {
            in: [
              'root',
              'child',
              'grandchild',
            ],
          },
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          stockQuantity: true,
          images: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      expect(result).toEqual({
        category: {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: 'Categoria principal',
        },
        products: [
          {
            id: 'product-1',
            name: 'Produto 1',
            slug: 'produto-1',
            description: null,
            price: 25.5,
            inStock: true,
            images: [],
            category: {
              id: 'grandchild',
              name: 'Neta',
              slug: 'neta',
            },
            brand: null,
          },
        ],
      })
    })

    test('devolve null quando categoria não tem produtos ativos na árvore', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 0,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          client,
        )

      expect(result).toBeNull()
    })
  })

  describe('listCatalogCategories', () => {
    test('consulta contagem apenas de produtos ativos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([])

      await listCatalogCategories(client)

      expect(
        client.category.findMany,
      ).toHaveBeenCalledWith({
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          parentId: true,
          name: true,
          slug: true,
          description: true,
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
      })
    })

    test('devolve categoria com produto ativo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(result).toEqual([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
        },
      ])
    })

    test('esconde categoria sem produtos ativos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'empty-category',
          parentId: null,
          name: 'Vazia',
          slug: 'vazia',
          description: null,
          _count: {
            products: 0,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(result).toEqual([])
    })

    test('mantém categoria pai quando descendente tem produto ativo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'parent',
          parentId: null,
          name: 'Pai',
          slug: 'pai',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'parent',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(result).toEqual([
        {
          id: 'parent',
          parentId: null,
          name: 'Pai',
          slug: 'pai',
          description: null,
        },
        {
          id: 'child',
          parentId: 'parent',
          name: 'Filha',
          slug: 'filha',
          description: null,
        },
      ])
    })

    test('mantém todos os antepassados necessários', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'parent',
          parentId: 'root',
          name: 'Pai',
          slug: 'pai',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'parent',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 1,
          },
        },
        {
          id: 'empty',
          parentId: null,
          name: 'Vazia',
          slug: 'vazia',
          description: null,
          _count: {
            products: 0,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(
        result.map(
          (category) => category.id,
        ),
      ).toEqual([
        'root',
        'parent',
        'child',
      ])
    })
  })
})