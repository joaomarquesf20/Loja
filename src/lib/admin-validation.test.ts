import { describe, expect, test } from 'vitest'
import {
  categorySchema,
  categoryUpdateSchema,
  productBrandSchema,
  productBrandUpdateSchema,
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