import { describe, expect, test } from 'vitest'
import {
  categorySchema,
  categoryUpdateSchema,
  productBrandSchema,
  productBrandUpdateSchema,
  productSchema,
  productUpdateSchema,
} from './admin-validation'

describe('categorySchema', () => {
  test('rejeita name vazio', () => {
    const result = categorySchema.safeParse({
      name: '',
      slug: 'teste',
    })

    expect(result.success).toBe(false)
  })

  test('aplica trim ao name', () => {
    const result = categorySchema.parse({
      name: '  Categoria Teste  ',
      slug: 'categoria-teste',
    })

    expect(result.name).toBe('Categoria Teste')
  })

  test('normaliza slug em maiúsculas', () => {
    const result = categorySchema.parse({
      name: 'Categoria Teste',
      slug: 'Categoria Teste',
    })

    expect(result.slug).toBe('categoria-teste')
  })

  test('normaliza acentos no slug', () => {
    const result = categorySchema.parse({
      name: 'Categoria Especial',
      slug: 'Café Élite',
    })

    expect(result.slug).toBe('cafe-elite')
  })

  test('rejeita slug que fique vazio após normalização', () => {
    const result = categorySchema.safeParse({
      name: 'Categoria Teste',
      slug: '!!!',
    })

    expect(result.success).toBe(false)
  })

  test('aceita parentId null', () => {
    const result = categorySchema.parse({
      name: 'Categoria Teste',
      slug: 'categoria-teste',
      parentId: null,
    })

    expect(result.parentId).toBeNull()
  })

  test('aceita parentId string não vazia', () => {
    const result = categorySchema.parse({
      name: 'Categoria Teste',
      slug: 'categoria-teste',
      parentId: 'parent-123',
    })

    expect(result.parentId).toBe('parent-123')
  })

  test('rejeita parentId vazio', () => {
    const result = categorySchema.safeParse({
      name: 'Categoria Teste',
      slug: 'categoria-teste',
      parentId: '',
    })

    expect(result.success).toBe(false)
  })

  test('rejeita parentId só com espaços', () => {
    const result = categorySchema.safeParse({
      name: 'Categoria Teste',
      slug: 'categoria-teste',
      parentId: '   ',
    })

    expect(result.success).toBe(false)
  })
})

describe('categoryUpdateSchema', () => {
  test('aceita objeto parcial', () => {
    const result = categoryUpdateSchema.parse({
      name: 'Nova Categoria',
    })

    expect(result.name).toBe('Nova Categoria')
  })

  test('aceita objeto vazio', () => {
    const result = categoryUpdateSchema.safeParse({})

    expect(result.success).toBe(true)
  })

  test('normaliza slug no update', () => {
    const result = categoryUpdateSchema.parse({
      slug: 'Meu Slug!',
    })

    expect(result.slug).toBe('meu-slug')
  })
})

describe('productBrandSchema', () => {
  test('rejeita name vazio', () => {
    const result = productBrandSchema.safeParse({
      name: '',
      slug: 'marca-teste',
    })

    expect(result.success).toBe(false)
  })

  test('aplica trim ao name', () => {
    const result = productBrandSchema.parse({
      name: '  Marca Teste  ',
      slug: 'marca-teste',
    })

    expect(result.name).toBe('Marca Teste')
  })

  test('normaliza slug', () => {
    const result = productBrandSchema.parse({
      name: 'Marca Teste',
      slug: 'Marca Teste',
    })

    expect(result.slug).toBe('marca-teste')
  })

  test('normaliza acentos no slug', () => {
    const result = productBrandSchema.parse({
      name: 'Marca Especial',
      slug: 'Marçá Éspecial',
    })

    expect(result.slug).toBe('marca-especial')
  })

  test('rejeita slug que fique vazio após normalização', () => {
    const result = productBrandSchema.safeParse({
      name: 'Marca Teste',
      slug: '!!!',
    })

    expect(result.success).toBe(false)
  })
})

describe('productBrandUpdateSchema', () => {
  test('aceita objeto parcial', () => {
    const result = productBrandUpdateSchema.parse({
      name: 'Nova Marca',
    })

    expect(result.name).toBe('Nova Marca')
  })

  test('aceita objeto vazio', () => {
    const result = productBrandUpdateSchema.safeParse({})

    expect(result.success).toBe(true)
  })

  test('normaliza slug no update', () => {
    const result = productBrandUpdateSchema.parse({
      slug: 'Super Marca!',
    })

    expect(result.slug).toBe('super-marca')
  })
})

describe('productSchema', () => {
  const validProduct = {
  name: 'Produto Teste',
  slug: 'produto-teste',
  sku: 'SKU-TESTE-001',
  price: 0,
  stockQuantity: 0,
  categoryId: 'category-test',
  shippingClass: 'STANDARD',
}

  test('aceita objeto mínimo válido', () => {
    const result = productSchema.parse(validProduct)
    expect(result).toEqual(validProduct)
  })

  test('rejeita name vazio', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        name: '',
      }).success,
    ).toBe(false)
  })

  test('aplica trim ao name', () => {
    const result = productSchema.parse({
      ...validProduct,
      name: '  Produto Teste  ',
    })

    expect(result.name).toBe('Produto Teste')
  })

  test('normaliza slug com maiúsculas e acentos', () => {
    const result = productSchema.parse({
      ...validProduct,
      slug: '  Peças Áudio  ',
    })

    expect(result.slug).toBe('pecas-audio')
  })

  test('rejeita slug apenas com pontuação', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        slug: '!!!',
      }).success,
    ).toBe(false)
  })

  test('rejeita sku vazio', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        sku: '',
      }).success,
    ).toBe(false)
  })

  test('aplica trim ao sku', () => {
    const result = productSchema.parse({
      ...validProduct,
      sku: '  SKU-TESTE-001  ',
    })

    expect(result.sku).toBe('SKU-TESTE-001')
  })

  test('aceita price zero', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        price: 0,
      }).success,
    ).toBe(true)
  })

  test('aceita price positivo', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        price: 19.99,
      }).success,
    ).toBe(true)
  })

  test('rejeita price negativo', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        price: -1,
      }).success,
    ).toBe(false)
  })

  test('rejeita price NaN', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        price: Number.NaN,
      }).success,
    ).toBe(false)
  })

  test('rejeita price Infinity', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        price: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false)
  })

  test('aceita stockQuantity zero', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        stockQuantity: 0,
      }).success,
    ).toBe(true)
  })

  test('aceita stockQuantity inteiro positivo', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        stockQuantity: 10,
      }).success,
    ).toBe(true)
  })

  test('rejeita stockQuantity negativo', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        stockQuantity: -1,
      }).success,
    ).toBe(false)
  })

  test('rejeita stockQuantity decimal', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        stockQuantity: 1.5,
      }).success,
    ).toBe(false)
  })

  test('rejeita categoryId vazio', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        categoryId: '',
      }).success,
    ).toBe(false)
  })

  test('aplica trim ao categoryId', () => {
    const result = productSchema.parse({
      ...validProduct,
      categoryId: '  category-test  ',
    })

    expect(result.categoryId).toBe('category-test')
  })

  test('aceita productBrandId null', () => {
    const result = productSchema.parse({
      ...validProduct,
      productBrandId: null,
    })

    expect(result.productBrandId).toBeNull()
  })

  test('aceita productBrandId não vazio', () => {
    const result = productSchema.parse({
      ...validProduct,
      productBrandId: 'brand-test',
    })

    expect(result.productBrandId).toBe('brand-test')
  })

  test('rejeita productBrandId vazio', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        productBrandId: '',
      }).success,
    ).toBe(false)
  })

  test('aplica trim ao productBrandId', () => {
    const result = productSchema.parse({
      ...validProduct,
      productBrandId: '  brand-test  ',
    })

    expect(result.productBrandId).toBe('brand-test')
  })

  test('aceita isActive true', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        isActive: true,
      }).success,
    ).toBe(true)
  })

  test('aceita isActive false', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        isActive: false,
      }).success,
    ).toBe(true)
  })

  test('rejeita isActive não boolean', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        isActive: 'true',
      }).success,
    ).toBe(false)
  })

  test('aceita lista vazia de imagens', () => {
    const result = productSchema.parse({
      ...validProduct,
      images: [],
    })

    expect(result.images).toEqual([])
  })

  test('aceita URL HTTPS de imagem', () => {
    const result = productSchema.parse({
      ...validProduct,
      images: [
        'https://example.com/products/produto.jpg',
      ],
    })

    expect(result.images).toEqual([
      'https://example.com/products/produto.jpg',
    ])
  })

  test('aceita caminho relativo de imagem', () => {
    const result = productSchema.parse({
      ...validProduct,
      images: [
        '  /products/produto.jpg  ',
      ],
    })

    expect(result.images).toEqual([
      '/products/produto.jpg',
    ])
  })

  test('rejeita imagem vazia', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        images: [''],
      }).success,
    ).toBe(false)
  })

  test('rejeita protocolo de imagem não permitido', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        images: [
          'javascript:alert(1)',
        ],
      }).success,
    ).toBe(false)
  })

  test('rejeita mais de 20 imagens', () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        images: Array.from(
          { length: 21 },
          (_, index) =>
            `/products/image-${index}.jpg`,
        ),
      }).success,
    ).toBe(false)
  })
})

describe('productUpdateSchema', () => {
  test('aceita objeto vazio', () => {
    expect(productUpdateSchema.safeParse({}).success).toBe(true)
  })

  test('aceita atualização parcial de name', () => {
    const result = productUpdateSchema.parse({
      name: '  Produto Atualizado  ',
    })

    expect(result.name).toBe('Produto Atualizado')
  })

  test('aceita atualização parcial de price', () => {
    const result = productUpdateSchema.parse({
      price: 24.99,
    })

    expect(result.price).toBe(24.99)
  })

  test('rejeita price negativo numa atualização', () => {
    expect(
      productUpdateSchema.safeParse({
        price: -1,
      }).success,
    ).toBe(false)
  })

  test('rejeita stockQuantity decimal numa atualização', () => {
    expect(
      productUpdateSchema.safeParse({
        stockQuantity: 1.5,
      }).success,
    ).toBe(false)
  })

  test('rejeita slug só com pontuação numa atualização', () => {
    expect(
      productUpdateSchema.safeParse({
        slug: '!!!',
      }).success,
    ).toBe(false)
  })

  test('aceita atualização parcial de images', () => {
    const result = productUpdateSchema.parse({
      images: [
        '/products/novo-1.jpg',
        'https://example.com/novo-2.jpg',
      ],
    })

    expect(result.images).toEqual([
      '/products/novo-1.jpg',
      'https://example.com/novo-2.jpg',
    ])
  })

  test('rejeita images inválidas numa atualização', () => {
    expect(
      productUpdateSchema.safeParse({
        images: [
          'ftp://example.com/image.jpg',
        ],
      }).success,
    ).toBe(false)
  })
})
