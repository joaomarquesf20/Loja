import { beforeEach, describe, expect, test, vi } from 'vitest'

import { type ProductBrandClient } from './product-brands'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createProductBrand,
  deleteProductBrand,
  getProductBrandById,
  listProductBrands,
  updateProductBrand,
} from './product-brands'

const productBrandRecord = {
  id: 'brand-1',
  name: 'Marca Teste',
  slug: 'marca-teste',
}

describe('product brands service', () => {
  let client: ProductBrandClient

  beforeEach(() => {
    client = {
      productBrand: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
    }
  })

  test('listProductBrands ordena por nome ascendente', async () => {
    vi.mocked(client.productBrand.findMany).mockResolvedValue([productBrandRecord])

    await listProductBrands(client)

    expect(client.productBrand.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    })
  })

  test('getProductBrandById rejeita id vazio', async () => {
    await expect(getProductBrandById('', client)).rejects.toThrow(ValidationError)
  })

  test('getProductBrandById rejeita marca inexistente', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(null)

    await expect(getProductBrandById('brand-1', client)).rejects.toThrow(NotFoundError)
  })

  test('getProductBrandById devolve marca existente', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(productBrandRecord)

    await expect(getProductBrandById('brand-1', client)).resolves.toEqual(productBrandRecord)
  })

  test('createProductBrand rejeita input inválido', async () => {
    await expect(
      createProductBrand({ name: '', slug: 'teste' }, client),
    ).rejects.toThrow()
  })

  test('createProductBrand normaliza slug', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(null)
    vi.mocked(client.productBrand.create).mockResolvedValue({
      ...productBrandRecord,
      slug: 'marca-teste',
    })

    await createProductBrand(
      {
        name: 'Marca Teste',
        slug: 'Marca Teste',
      },
      client,
    )

    expect(client.productBrand.create).toHaveBeenCalledWith({
      data: {
        name: 'Marca Teste',
        slug: 'marca-teste',
      },
    })
  })

  test('createProductBrand rejeita slug duplicado', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(productBrandRecord)

    await expect(
      createProductBrand(
        {
          name: 'Outra Marca',
          slug: 'marca-teste',
        },
        client,
      ),
    ).rejects.toThrow(ConflictError)
  })

  test('createProductBrand cria marca válida', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(null)
    vi.mocked(client.productBrand.create).mockResolvedValue(productBrandRecord)

    await expect(
      createProductBrand(
        {
          name: 'Marca Teste',
          slug: 'marca-teste',
        },
        client,
      ),
    ).resolves.toEqual(productBrandRecord)
  })

  test('updateProductBrand rejeita id vazio', async () => {
    await expect(
      updateProductBrand('', { name: 'Novo Nome' }, client),
    ).rejects.toThrow(ValidationError)
  })

  test('updateProductBrand rejeita marca inexistente', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(null)

    await expect(updateProductBrand('brand-1', { name: 'Novo Nome' }, client)).rejects.toThrow(NotFoundError)
  })

  test('updateProductBrand rejeita slug duplicado', async () => {
    vi.mocked(client.productBrand.findUnique)
      .mockResolvedValueOnce(productBrandRecord)
      .mockResolvedValueOnce({
        ...productBrandRecord,
        id: 'brand-2',
        slug: 'slug-ocupado',
      })

    await expect(
      updateProductBrand('brand-1', { slug: 'slug-ocupado' }, client),
    ).rejects.toThrow(ConflictError)
  })

  test('updateProductBrand atualiza dados válidos', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(productBrandRecord)
    vi.mocked(client.productBrand.update).mockResolvedValue({
      ...productBrandRecord,
      name: 'Novo Nome',
    })

    await updateProductBrand(
      'brand-1',
      { name: 'Novo Nome' },
      client,
    )

    expect(client.productBrand.update).toHaveBeenCalledWith({
      where: { id: 'brand-1' },
      data: { name: 'Novo Nome' },
    })
  })

  test('deleteProductBrand rejeita id vazio', async () => {
    await expect(deleteProductBrand('', client)).rejects.toThrow(ValidationError)
  })

  test('deleteProductBrand rejeita marca inexistente', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(null)

    await expect(deleteProductBrand('brand-1', client)).rejects.toThrow(NotFoundError)
  })

  test('deleteProductBrand rejeita marca com produtos', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(productBrandRecord)
    vi.mocked(client.product.count).mockResolvedValue(1)

    await expect(deleteProductBrand('brand-1', client)).rejects.toThrow(ConflictError)

    expect(client.product.count).toHaveBeenCalledWith({
      where: { productBrandId: 'brand-1' },
    })
  })

  test('deleteProductBrand apaga marca sem produtos', async () => {
    vi.mocked(client.productBrand.findUnique).mockResolvedValue(productBrandRecord)
    vi.mocked(client.product.count).mockResolvedValue(0)
    vi.mocked(client.productBrand.delete).mockResolvedValue(productBrandRecord)

    await expect(deleteProductBrand('brand-1', client)).resolves.toEqual(productBrandRecord)

    expect(client.productBrand.delete).toHaveBeenCalledWith({
      where: { id: 'brand-1' },
    })
  })
})