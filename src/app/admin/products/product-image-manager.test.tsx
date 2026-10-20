import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import ProductImageManager from './product-image-manager'

import type { AdminProductImage } from '@/server/admin-products'

type ImageDraft = AdminProductImage

function draftImage(overrides: Partial<ImageDraft>): ImageDraft {
  return {
    id: `image-${Math.random().toString(36).slice(2)}`,
    url: '/img/produto.jpg',
    altText: null,
    sortOrder: 0,
    isPrimary: false,
    finish: null,
    finishValueId: null,
    ...overrides,
  }
}

describe('ProductImageManager', () => {
  test('agrupa imagens por acabamento, incluindo grupos desconhecidos', () => {
    render(
      <ProductImageManager
        images={[
          draftImage({ id: 'g1', finish: null }),
          draftImage({ id: 's1', finish: 'Schwarz' }),
          draftImage({ id: 'd1', finish: 'Dourado Mate' }),
          draftImage({ id: 's2', finish: 'schwarz' }),
        ]}
        finishes={['Schwarz']}
        onChange={vi.fn()}
      />,
    )

    const generalHeading = screen.getByRole('heading', {
      name: 'Geral',
    })
    const generalGroup = generalHeading.closest('div')!.parentElement!
    expect(
      within(generalGroup).getByText('1 imagem'),
    ).toBeInTheDocument()

    const schwarzHeading = screen.getByRole('heading', {
      name: 'Schwarz',
    })
    const schwarzGroup = schwarzHeading.closest('div')!.parentElement!
    expect(
      within(schwarzGroup).getByText('2 imagens'),
    ).toBeInTheDocument()

    const douradoHeading = screen.getByRole('heading', {
      name: 'Dourado Mate',
    })
    const douradoGroup = douradoHeading.closest('div')!.parentElement!
    expect(
      within(douradoGroup).getByText('1 imagem'),
    ).toBeInTheDocument()
  })

  test(
    'cada imagem mostra o grupo a que pertence, sem duplicação por variante',
    () => {
      render(
        <ProductImageManager
          images={[
            draftImage({ id: 'g1', finish: null }),
            draftImage({
              id: 's1',
              finish: 'Silver Machined',
            }),
            draftImage({ id: 'b1', finish: 'Satin Black' }),
          ]}
          finishes={[
            'Silver Machined',
            'Satin Black',
          ]}
          onChange={vi.fn()}
        />,
      )

      // Cada imagem mostra o grupo a que pertence.
      const findGroupBadge = (
        label: string,
      ) =>
        screen.getByText(
          (_, element) =>
            element?.tagName === 'P' &&
            element.textContent ===
              `Grupo: ${label}`,
        )

      expect(
        findGroupBadge('Geral'),
      ).toBeInTheDocument()
      expect(
        findGroupBadge('Silver Machined'),
      ).toBeInTheDocument()
      expect(
        findGroupBadge('Satin Black'),
      ).toBeInTheDocument()

      // Os grupos derivam dos acabamentos das variantes,
      // não de cada tamanho/PCD/ET: um único cabeçalho
      // por acabamento.
      expect(
        screen.getAllByRole('heading', {
          name: 'Silver Machined',
        }),
      ).toHaveLength(1)
      expect(
        screen.getAllByRole('heading', {
          name: 'Satin Black',
        }),
      ).toHaveLength(1)
    },
  )
})
