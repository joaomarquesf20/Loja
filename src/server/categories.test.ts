import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
  type CategoryClient,
} from './categories'

const categoryRecord = {
  id: 'cat-1',
  name: 'Categoria Teste',
  slug: 'categoria-teste',
  description: null,
  parentId: null,
}

describe('categories service', () => {
  let client: CategoryClient

  beforeEach(() => {
    client = {
      category: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
    }
  })

  test('listCategories ordena por nome ascendente', async () => {
    vi.mocked(client.category.findMany).mockResolvedValue([categoryRecord])

    await listCategories(client)

    expect(client.category.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    })
  })

  test('getCategoryById rejeita id vazio', async () => {
    await expect(getCategoryById('', client)).rejects.toThrow(ValidationError)
  })

  test('getCategoryById rejeita categoria inexistente', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(null)

    await expect(getCategoryById('cat-1', client)).rejects.toThrow(NotFoundError)
  })

  test('getCategoryById devolve categoria existente', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(categoryRecord)

    await expect(getCategoryById('cat-1', client)).resolves.toEqual(categoryRecord)
  })

  test('createCategory rejeita input inválido', async () => {
    await expect(
      createCategory({ name: '', slug: 'teste' }, client),
    ).rejects.toThrow()
  })

  test('createCategory normaliza slug', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(null)
    vi.mocked(client.category.create).mockResolvedValue({
      ...categoryRecord,
      slug: 'categoria-teste',
    })

    await createCategory(
      {
        name: 'Categoria Teste',
        slug: 'Categoria Teste',
      },
      client,
    )

    expect(client.category.create).toHaveBeenCalledWith({
      data: {
        name: 'Categoria Teste',
        slug: 'categoria-teste',
      },
    })
  })

  test('createCategory rejeita slug duplicado', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(categoryRecord)

    await expect(
      createCategory(
        {
          name: 'Outra Categoria',
          slug: 'categoria-teste',
        },
        client,
      ),
    ).rejects.toThrow(ConflictError)
  })

  test('createCategory cria categoria válida', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(null)
    vi.mocked(client.category.create).mockResolvedValue(categoryRecord)

    await expect(
      createCategory(
        {
          name: 'Categoria Teste',
          slug: 'categoria-teste',
        },
        client,
      ),
    ).resolves.toEqual(categoryRecord)
  })

  test('updateCategory rejeita id vazio', async () => {
    await expect(
      updateCategory('', { name: 'Novo Nome' }, client),
    ).rejects.toThrow(ValidationError)
  })

  test('updateCategory rejeita categoria inexistente', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(null)

    await expect(
      updateCategory('cat-1', { name: 'Novo Nome' }, client),
    ).rejects.toThrow(NotFoundError)
  })

  test('updateCategory rejeita parentId igual ao próprio id', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(categoryRecord)

    await expect(
      updateCategory(
        'cat-1',
        { parentId: 'cat-1' },
        client,
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  test('updateCategory rejeita slug duplicado', async () => {
    vi.mocked(client.category.findUnique)
      .mockResolvedValueOnce(categoryRecord)
      .mockResolvedValueOnce({
        ...categoryRecord,
        id: 'cat-2',
        slug: 'slug-ocupado',
      })

    await expect(
      updateCategory(
        'cat-1',
        { slug: 'slug-ocupado' },
        client,
      ),
    ).rejects.toThrow(ConflictError)
  })

  test('updateCategory atualiza dados válidos', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(categoryRecord)
    vi.mocked(client.category.update).mockResolvedValue({
      ...categoryRecord,
      name: 'Novo Nome',
    })

    await updateCategory(
      'cat-1',
      { name: 'Novo Nome' },
      client,
    )

    expect(client.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { name: 'Novo Nome' },
    })
  })

  test('deleteCategory rejeita id vazio', async () => {
    await expect(deleteCategory('', client)).rejects.toThrow(ValidationError)
  })

  test('deleteCategory rejeita categoria inexistente', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(null)

    await expect(deleteCategory('cat-1', client)).rejects.toThrow(NotFoundError)
  })

  test('deleteCategory rejeita categoria com subcategorias', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(categoryRecord)
    vi.mocked(client.category.count).mockResolvedValue(1)

    await expect(deleteCategory('cat-1', client)).rejects.toThrow(ConflictError)

    expect(client.category.count).toHaveBeenCalledWith({
      where: { parentId: 'cat-1' },
    })
  })

  test('deleteCategory rejeita categoria com produtos', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(categoryRecord)
    vi.mocked(client.category.count).mockResolvedValue(0)
    vi.mocked(client.product.count).mockResolvedValue(1)

    await expect(deleteCategory('cat-1', client)).rejects.toThrow(ConflictError)

    expect(client.product.count).toHaveBeenCalledWith({
      where: { categoryId: 'cat-1' },
    })
  })

  test('deleteCategory apaga categoria sem relações', async () => {
    vi.mocked(client.category.findUnique).mockResolvedValue(categoryRecord)
    vi.mocked(client.category.count).mockResolvedValue(0)
    vi.mocked(client.product.count).mockResolvedValue(0)
    vi.mocked(client.category.delete).mockResolvedValue(categoryRecord)

    await expect(deleteCategory('cat-1', client)).resolves.toEqual(categoryRecord)

    expect(client.category.delete).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
    })
  })
})