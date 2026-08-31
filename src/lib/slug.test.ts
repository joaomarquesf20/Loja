import { describe, expect, test } from 'vitest'
import { toSlug } from './slug'

describe('toSlug', () => {
  describe('Casos obrigatórios', () => {
    test('"  BMW Série 3  " -> "bmw-serie-3"', () => {
      expect(toSlug("  BMW Série 3  ")).toBe('bmw-serie-3')
    })

    test('"Óleo / Filtro" -> "oleo-filtro"', () => {
      expect(toSlug('Óleo / Filtro')).toBe('oleo-filtro')
    })

    test('"---Teste---" -> "teste"', () => {
      expect(toSlug('---Teste---')).toBe('teste')
    })

    test('"A  B" -> "a-b"', () => {
      expect(toSlug('A  B')).toBe('a-b')
    })
  })
})