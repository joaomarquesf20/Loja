import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import ProductVariantEditor, {
  createVariantDraft,
} from './product-variant-editor'

import type { AdminVariantDraft } from './product-variant-editor'

function getGeneratorInput(
  placeholder: string,
): HTMLInputElement {
  const input = screen.getByPlaceholderText(
    placeholder,
  ) as HTMLInputElement

  return input
}

describe('ProductVariantEditor — gerador de combinações', () => {
  test('gera o produto cartesiano como linhas novas', () => {
    const onChange = vi.fn()

    render(
      <ProductVariantEditor
        profile="wheels"
        variants={[]}
        onChange={onChange}
      />,
    )

    fireEvent.click(
      screen.getByText('⚙ Gerar combinações'),
    )

    fireEvent.change(
      getGeneratorInput('18, 19, 20'),
      { target: { value: '18, 19' } },
    )
    fireEvent.change(
      getGeneratorInput('8.5, 9.5'),
      { target: { value: '8.5, 9.5' } },
    )
    fireEvent.change(
      getGeneratorInput('Silver, Gloss Black'),
      { target: { value: 'Silver' } },
    )

    fireEvent.click(screen.getByText('Gerar linhas'))

    expect(onChange).toHaveBeenCalledTimes(1)

    const variants = onChange.mock
      .calls[0][0] as AdminVariantDraft[]

    expect(variants).toHaveLength(4)

    expect(variants[0].selections).toEqual({
      diameter: '18',
      width: '8.5',
      finish: 'Silver',
    })
    expect(variants[1].selections).toEqual({
      diameter: '18',
      width: '9.5',
      finish: 'Silver',
    })
    expect(variants[2].selections).toEqual({
      diameter: '19',
      width: '8.5',
      finish: 'Silver',
    })
    expect(variants[3].selections).toEqual({
      diameter: '19',
      width: '9.5',
      finish: 'Silver',
    })

    // Linhas prontas para o admin preencher SKU/preço/stock.
    expect(variants[0].sku).toBe('')
    expect(variants[0].price).toBe('')
    expect(variants[0].stockQuantity).toBe('0')
    expect(variants[0].isActive).toBe(true)
  })

  test('não duplica combinações que já existem na tabela', () => {
    const onChange = vi.fn()

    const existing = createVariantDraft({
      sku: 'EXIST-1',
      selections: {
        diameter: '18',
        width: '8.5',
        finish: 'Silver',
      },
    })

    render(
      <ProductVariantEditor
        profile="wheels"
        variants={[existing]}
        onChange={onChange}
      />,
    )

    fireEvent.click(
      screen.getByText('⚙ Gerar combinações'),
    )
    fireEvent.change(
      getGeneratorInput('18, 19, 20'),
      { target: { value: '18, 19' } },
    )
    fireEvent.change(
      getGeneratorInput('8.5, 9.5'),
      { target: { value: '8.5' } },
    )
    fireEvent.change(
      getGeneratorInput('Silver, Gloss Black'),
      { target: { value: 'Silver, Gloss Black' } },
    )
    fireEvent.click(screen.getByText('Gerar linhas'))

    const variants = onChange.mock
      .calls[0][0] as AdminVariantDraft[]

    // 1 existente + 3 novas (a combinação 18/8.5/Silver
    // já lá está e não é repetida).
    expect(variants).toHaveLength(4)
    expect(
      variants.filter(
        (variant) => variant.sku === 'EXIST-1',
      ),
    ).toHaveLength(1)
  })

  test('ignora maiúsculas e espaços ao detetar duplicados', () => {
    const onChange = vi.fn()

    const existing = createVariantDraft({
      sku: 'EXIST-1',
      selections: {
        diameter: '18',
        finish: ' gloss black ',
      },
    })

    render(
      <ProductVariantEditor
        profile="wheels"
        variants={[existing]}
        onChange={onChange}
      />,
    )

    fireEvent.click(
      screen.getByText('⚙ Gerar combinações'),
    )
    fireEvent.change(
      getGeneratorInput('18, 19, 20'),
      { target: { value: '18' } },
    )
    fireEvent.change(
      getGeneratorInput('Silver, Gloss Black'),
      { target: { value: 'Gloss Black' } },
    )
    fireEvent.click(screen.getByText('Gerar linhas'))

    const variants = onChange.mock
      .calls[0][0] as AdminVariantDraft[]

    expect(variants).toHaveLength(1)
  })

  test('eixos vazios são ignorados e o painel fecha', () => {
    const onChange = vi.fn()

    render(
      <ProductVariantEditor
        profile="wheels"
        variants={[]}
        onChange={onChange}
      />,
    )

    fireEvent.click(
      screen.getByText('⚙ Gerar combinações'),
    )
    fireEvent.change(
      getGeneratorInput('18, 19, 20'),
      { target: { value: '19' } },
    )
    fireEvent.click(screen.getByText('Gerar linhas'))

    const variants = onChange.mock
      .calls[0][0] as AdminVariantDraft[]

    expect(variants).toHaveLength(1)
    expect(variants[0].selections).toEqual({
      diameter: '19',
    })

    // Painel fechado e campos limpos depois de gerar.
    expect(
      screen.queryByText(
        'Gerar combinações de variantes',
      ),
    ).toBeNull()
  })
})
