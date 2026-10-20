import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import type {
  CatalogProductDetail,
  CatalogVariant,
} from '@/server/catalog'
import ProductPurchasePanel from './product-purchase-panel'

const fetchMock = vi.fn()

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}

function createVariant(
  overrides: Partial<CatalogVariant> & {
    id: string
    sku: string
    price: number
  },
): CatalogVariant {
  return {
    inStock: true,
    priceSet: null,
    options: [],
    image: null,
    ...overrides,
  }
}

function createProduct(
  overrides?: Partial<CatalogProductDetail>,
): CatalogProductDetail {
  return {
    id: 'product-1',
    name: 'Jante JR11',
    slug: 'jante-jr11',
    description: null,
    price: 169.9,
    inStock: true,
    images: [],
    sku: 'JR11',
    category: {
      id: 'category-1',
      name: 'Jantes',
      slug: 'jantes',
    },
    brand: {
      id: 'brand-1',
      name: 'Japan Racing',
      slug: 'japan-racing',
    },
    variants: [],
    ...overrides,
  }
}

function getSelect(
  label: string,
) {
  return screen.getByLabelText(
    label,
  ) as HTMLSelectElement
}

function selectOption(
  label: string,
  value: string,
) {
  fireEvent.change(
    getSelect(label),
    { target: { value } },
  )
}

function getSelectValues(
  label: string,
) {
  return within(
    getSelect(label),
  )
    .getAllByRole('option')
    .map((option) =>
      option.textContent,
    )
}

describe(
  'ProductPurchasePanel',
  () => {
    beforeEach(() => {
      fetchMock.mockReset()

      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      cleanup()
      vi.unstubAllGlobals()
    })

    test(
      'produto sem variantes mostra preço do produto e adiciona sem productVariantId',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            item: {},
          }),
        )

        render(
          <ProductPurchasePanel
            product={createProduct()}
          />,
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Adicionar ao carrinho',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({
              body: JSON.stringify({
                productId:
                  'product-1',
                quantity: 1,
              }),
            }),
          )
        })
      },
    )

    test(
      'jantes usam dropdowns em cascata e resolvem a variante escolhida',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            item: {},
          }),
        )

        const product =
          createProduct({
            price: 169.9,
            variants: [
              createVariant({
                id: 'variant-17',
                sku: 'JR11-17-ET35',
                price: 169.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '17"',
                  },
                ],
              }),
              createVariant({
                id: 'variant-19',
                sku: 'JR11-19-ET35',
                price: 199.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        expect(
          screen.getByText(
            '169,90 €',
          ),
        ).toBeInTheDocument()

        const diameter =
          getSelect('Diâmetro')

        expect(diameter.value).toBe(
          '17"',
        )

        selectOption(
          'Diâmetro',
          '19"',
        )

        expect(
          screen.getByText(
            '199,90 €',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'JR11-19-ET35',
          ),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Adicionar ao carrinho',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({
              body: JSON.stringify({
                productId:
                  'product-1',
                productVariantId:
                  'variant-19',
                quantity: 1,
              }),
            }),
          )
        })
      },
    )

    test(
      'mostra preço "Desde" e badge de sem stock conforme a variante selecionada',
      () => {
        const product =
          createProduct({
            price: 169.9,
            variants: [
              createVariant({
                id: 'variant-17',
                sku: 'JR11-17-ET35',
                price: 169.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '17"',
                  },
                ],
              }),
              createVariant({
                id: 'variant-19',
                sku: 'JR11-19-ET35',
                price: 199.9,
                inStock: false,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        expect(
          screen.queryByText('Desde'),
        ).not.toBeInTheDocument()

        selectOption(
          'Diâmetro',
          '19"',
        )

        expect(
          screen.getByText('Desde'),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '199,90 €',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getAllByText(
            'Sem stock',
          ).length,
        ).toBeGreaterThan(0)

        expect(
          document.querySelector(
            '.text-danger',
          ),
        ).not.toBeNull()

        const addButton =
          screen.getByRole(
            'button',
            {
              name:
                'Produto sem stock',
            },
          )

        expect(
          addButton,
        ).toBeDisabled()
      },
    )

    test(
      'mostra dropdowns para diâmetro, furação e ET nas jantes',
      () => {
        const product =
          createProduct({
            variants: [
              createVariant({
                id: 'variant-1',
                sku: 'JR11-A',
                price: 169.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '17"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x112',
                  },
                  {
                    code: 'offset',
                    name: 'ET',
                    value: 'ET35',
                  },
                ],
              }),
              createVariant({
                id: 'variant-2',
                sku: 'JR11-B',
                price: 189.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x108',
                  },
                  {
                    code: 'offset',
                    name: 'ET',
                    value: 'ET40',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        expect(
          getSelect('Diâmetro'),
        ).toBeInTheDocument()

        expect(
          getSelect('Furação'),
        ).toBeInTheDocument()

        expect(
          getSelect('Offset (ET)'),
        ).toBeInTheDocument()

        // O furo central nunca é um seletor
        // do cliente.
        expect(
          screen.queryByLabelText(
            'Furo central',
          ),
        ).not.toBeInTheDocument()

        expect(
          getSelectValues('Diâmetro'),
        ).toEqual([
          'Selecione uma opção',
          '17"',
          '18"',
        ])
      },
    )

    test(
      'só lista valores compatíveis com a seleção parcial e continua reversível',
      () => {
        const product =
          createProduct({
            price: 169.9,
            variants: [
              createVariant({
                id: 'variant-17',
                sku: 'JR11-17-100-35',
                price: 169.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '17"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x100',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET35',
                  },
                ],
              }),
              createVariant({
                id: 'variant-19',
                sku: 'JR11-19-120-45',
                price: 219.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET45',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />,
        )

        expect(
          screen.getByText(
            'JR11-17-100-35',
          ),
        ).toBeInTheDocument()

        // 19" nunca existiu com 5x100/ET35:
        // limpa os valores incompatíveis em vez
        // de saltar para outra variante.
        selectOption(
          'Diâmetro',
          '19"',
        )

        expect(
          getSelect('Furação').value,
        ).toBe('')

        expect(
          getSelect(
            'Offset (ET)',
          ).value,
        ).toBe('')

        expect(
          getSelectValues('Furação'),
        ).toEqual([
          'Selecione uma opção',
          '5x120',
        ])

        expect(
          getSelectValues('Offset (ET)'),
        ).toEqual([
          'Selecione uma opção',
          'ET45',
        ])

        expect(
          getSelect('Furação'),
        ).toBeEnabled()

        expect(
          screen.getByRole('button', {
            name:
              'Selecione uma opção',
          }),
        ).toBeDisabled()

        selectOption(
          'Furação',
          '5x120',
        )
        selectOption(
          'Offset (ET)',
          'ET45',
        )

        expect(
          screen.getByText(
            '219,90 €',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'JR11-19-120-45',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Adicionar ao carrinho',
            },
          ),
        ).toBeEnabled()

        // Reversível: voltar ao 17" limpa
        // furação e ET, nunca bloqueia.
        selectOption(
          'Diâmetro',
          '17"',
        )

        expect(
          getSelect('Furação').value,
        ).toBe('')

        expect(
          getSelectValues('Furação'),
        ).toEqual([
          'Selecione uma opção',
          '5x100',
        ])

        selectOption(
          'Furação',
          '5x100',
        )
        selectOption(
          'Offset (ET)',
          'ET35',
        )

        expect(
          screen.getByText(
            'JR11-17-100-35',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mudar a largura e voltar atrás nunca prende o cliente',
      () => {
        const product =
          createProduct({
            price: 199.9,
            variants: [
              createVariant({
                id: 'variant-85',
                sku: 'JR11-19-85-ET30',
                price: 199.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'width',
                    name: 'Largura',
                    value: '8.5J',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET30',
                  },
                  {
                    code: 'finish',
                    name:
                      'Acabamento',
                    value:
                      'Silver Machined',
                  },
                ],
              }),
              createVariant({
                id: 'variant-95',
                sku: 'JR11-19-95-ET40',
                price: 219.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'width',
                    name: 'Largura',
                    value: '9.5J',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET40',
                  },
                  {
                    code: 'finish',
                    name:
                      'Acabamento',
                    value:
                      'Gloss Black',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />,
        )

        expect(
          screen.getByText(
            'JR11-19-85-ET30',
          ),
        ).toBeInTheDocument()

        // Largura 9.5J já não existe com
        // ET30: o ET é limpo, a largura fica.
        selectOption(
          'Largura',
          '9.5J',
        )

        expect(
          getSelect('Largura').value,
        ).toBe('9.5J')

        expect(
          getSelect(
            'Offset (ET)',
          ).value,
        ).toBe('')

        expect(
          getSelectValues('Offset (ET)'),
        ).toEqual([
          'Selecione uma opção',
          'ET40',
        ])

        selectOption(
          'Offset (ET)',
          'ET40',
        )

        // O acabamento foi limpo junto com o ET
        // (Silver não existe em 9.5J): o cliente
        // escolhe explicitamente Gloss Black.
        selectOption(
          'Cor',
          'Gloss Black',
        )

        expect(
          screen.getByText(
            'JR11-19-95-ET40',
          ),
        ).toBeInTheDocument()

        // De volta a 8.5J: os valores
        // incompatíveis (ET40 e Gloss Black) são
        // limpos e as listas mostram só o que
        // existe para 8.5J.
        selectOption(
          'Largura',
          '8.5J',
        )

        expect(
          getSelect(
            'Offset (ET)',
          ).value,
        ).toBe('')

        expect(
          getSelectValues('Offset (ET)'),
        ).toEqual([
          'Selecione uma opção',
          'ET30',
        ])

        expect(
          getSelect('Cor').value,
        ).toBe('')

        expect(
          getSelectValues('Cor'),
        ).toEqual([
          'Selecione uma opção',
          'Silver Machined',
        ])

        selectOption(
          'Offset (ET)',
          'ET30',
        )
        selectOption(
          'Cor',
          'Silver Machined',
        )

        expect(
          screen.getByText(
            'JR11-19-85-ET30',
          ),
        ).toBeInTheDocument()

        // Nenhum seletor fica desativado (diâmetro e furação
        // são constantes neste produto e aparecem como
        // especificação).
        for (const label of [
          'Largura',
          'Offset (ET)',
          'Cor',
        ]) {
          expect(
            getSelect(label),
          ).toBeEnabled()
        }
      },
    )

    test(
      'mudar o ET e depois a largura mantém tudo reversível',
      () => {
        const product =
          createProduct({
            price: 199.9,
            variants: [
              createVariant({
                id: 'variant-85',
                sku: 'JR11-19-85-ET30',
                price: 199.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'width',
                    name: 'Largura',
                    value: '8.5J',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET30',
                  },
                ],
              }),
              createVariant({
                id: 'variant-95',
                sku: 'JR11-19-95-ET40',
                price: 219.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'width',
                    name: 'Largura',
                    value: '9.5J',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET40',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />,
        )

        // ET40 só existe com 9.5J: a largura
        // inválida é limpa, o ET fica.
        selectOption(
          'Offset (ET)',
          'ET40',
        )

        expect(
          getSelect(
            'Offset (ET)',
          ).value,
        ).toBe('ET40')

        expect(
          getSelect('Largura').value,
        ).toBe('')

        expect(
          getSelectValues('Largura'),
        ).toEqual([
          'Selecione uma opção',
          '9.5J',
        ])

        selectOption(
          'Largura',
          '9.5J',
        )

        expect(
          screen.getByText(
            'JR11-19-95-ET40',
          ),
        ).toBeInTheDocument()

        // ET30 de novo: a largura incompatível é
        // limpa e a lista mostra só 8.5J.
        selectOption(
          'Offset (ET)',
          'ET30',
        )

        expect(
          getSelect('Largura').value,
        ).toBe('')

        expect(
          getSelectValues('Largura'),
        ).toEqual([
          'Selecione uma opção',
          '8.5J',
        ])

        selectOption(
          'Largura',
          '8.5J',
        )

        expect(
          screen.getByText(
            'JR11-19-85-ET30',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mudar a furação e regressa à anterior sem bloquear',
      () => {
        const product =
          createProduct({
            price: 169.9,
            variants: [
              createVariant({
                id: 'variant-100',
                sku: 'JR11-18-100',
                price: 169.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x100',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET35',
                  },
                ],
              }),
              createVariant({
                id: 'variant-120',
                sku: 'JR11-19-120',
                price: 219.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET45',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />,
        )

        selectOption(
          'Furação',
          '5x120',
        )

        expect(
          getSelect('Furação').value,
        ).toBe('5x120')

        expect(
          getSelect('Diâmetro').value,
        ).toBe('')

        expect(
          getSelectValues('Diâmetro'),
        ).toEqual([
          'Selecione uma opção',
          '19"',
        ])

        selectOption(
          'Diâmetro',
          '19"',
        )

        // O ET compatível é único e fica
        // selecionável de novo.
        expect(
          getSelectValues('Offset (ET)'),
        ).toEqual([
          'Selecione uma opção',
          'ET45',
        ])

        selectOption(
          'Offset (ET)',
          'ET45',
        )

        expect(
          screen.getByText(
            'JR11-19-120',
          ),
        ).toBeInTheDocument()

        selectOption(
          'Furação',
          '5x100',
        )

        expect(
          getSelectValues('Diâmetro'),
        ).toEqual([
          'Selecione uma opção',
          '18"',
        ])

        selectOption(
          'Diâmetro',
          '18"',
        )
        selectOption(
          'Offset (ET)',
          'ET35',
        )

        expect(
          screen.getByText(
            'JR11-18-100',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'o furo central é especificação técnica e acompanha a configuração resolvida',
      () => {
        const product =
          createProduct({
            price: 199.9,
            variants: [
              createVariant({
                id: 'variant-85',
                sku: 'JR11-19-85',
                price: 199.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'width',
                    name: 'Largura',
                    value: '8.5J',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET30',
                  },
                  {
                    code: 'centre_bore',
                    name:
                      'Furo central',
                    value:
                      '66.6 mm',
                  },
                ],
              }),
              createVariant({
                id: 'variant-95',
                sku: 'JR11-19-95',
                price: 219.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'width',
                    name: 'Largura',
                    value: '9.5J',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x120',
                  },
                  {
                    code: 'offset',
                    name:
                      'Offset (ET)',
                    value: 'ET40',
                  },
                  {
                    code: 'centre_bore',
                    name:
                      'Furo central',
                    value:
                      '72.6 mm',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        // Nunca é um seletor do cliente.
        expect(
          screen.queryByLabelText(
            'Furo central',
          ),
        ).not.toBeInTheDocument()

        // CB da configuração inicial.
        expect(
          screen.getByText(
            '66.6 mm',
          ),
        ).toBeInTheDocument()

        selectOption(
          'Largura',
          '9.5J',
        )
        selectOption(
          'Offset (ET)',
          'ET40',
        )

        // O CB técnico acompanha a variante
        // resolvida.
        expect(
          screen.getByText(
            '72.6 mm',
          ),
        ).toBeInTheDocument()
        expect(
          screen.queryByText(
            '66.6 mm',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'eixo com um único valor no produto aparece como especificação e não como dropdown',
      () => {
        const product =
          createProduct({
            price: 169.9,
            variants: [
              createVariant({
                id: 'variant-17',
                sku: 'JR11-17',
                price: 169.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '17"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x112',
                  },
                ],
              }),
              createVariant({
                id: 'variant-18',
                sku: 'JR11-18',
                price: 189.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                  {
                    code: 'pcd',
                    name: 'PCD',
                    value: '5x112',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        expect(
          getSelect('Diâmetro'),
        ).toBeInTheDocument()

        expect(
          screen.queryByLabelText(
            'Furação',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByText(
            '5x112',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mudar o acabamento entre variantes de dimensões iguais atualiza preço, referência, stock e carrinho',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            item: {},
          }),
        )

        const product = createProduct({
          price: 179.9,
          variants: [
            createVariant({
              id: 'variant-18-black',
              sku: 'JR11-18-SATIN',
              price: 179.9,
              inStock: true,
              options: [
                {
                  code: 'diameter',
                  name: 'Diâmetro',
                  value: '18"',
                },
                {
                  code: 'width',
                  name: 'Largura',
                  value: '8.5J',
                },
                {
                  code: 'pcd',
                  name: 'PCD',
                  value: '5x120',
                },
                {
                  code: 'offset',
                  name: 'ET',
                  value: 'ET30',
                },
                {
                  code: 'centre_bore',
                  name: 'CB',
                  value: '66.6 mm',
                },
                {
                  code: 'finish',
                  name: 'Acabamento',
                  value: 'Satin Black',
                },
              ],
            }),
            createVariant({
              id: 'variant-18-silver',
              sku: 'JR11-18-PRATA',
              price: 184.9,
              inStock: false,
              options: [
                {
                  code: 'diameter',
                  name: 'Diâmetro',
                  value: '18"',
                },
                {
                  code: 'width',
                  name: 'Largura',
                  value: '8.5J',
                },
                {
                  code: 'pcd',
                  name: 'PCD',
                  value: '5x120',
                },
                {
                  code: 'offset',
                  name: 'ET',
                  value: 'ET30',
                },
                {
                  code: 'centre_bore',
                  name: 'CB',
                  value: '66.6 mm',
                },
                {
                  code: 'finish',
                  name: 'Acabamento',
                  value:
                    'Silver Machined',
                },
              ],
            }),
          ],
        })

        render(
          <ProductPurchasePanel
            product={product}
          />,
        )

        expect(
          screen.getByText('179,90 €'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('JR11-18-SATIN'),
        ).toBeInTheDocument()

        // Mesmo conjunto de eixos, acabamento
        // diferente: a troca resolve a outra
        // variante real sem recarregar a página.
        selectOption(
          'Cor',
          'Silver Machined',
        )

        expect(
          getSelect('Cor').value,
        ).toBe('Silver Machined')

        // Diâmetro é constante neste produto:
        // aparece como especificação, não como
        // seletor.
        expect(
          screen.queryByLabelText(
            'Diâmetro',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByText('184,90 €'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('JR11-18-PRATA'),
        ).toBeInTheDocument()
        expect(
          screen.getAllByText('Sem stock').length,
        ).toBeGreaterThan(0)

        const addButton = screen.getByRole(
          'button',
          {
            name: 'Produto sem stock',
          },
        )
        expect(addButton).toBeDisabled()

        // De volta ao acabamento com stock: o
        // botão volta a estar ativo e envia a
        // variante certa.
        selectOption(
          'Cor',
          'Satin Black',
        )

        expect(
          screen.getByText('179,90 €'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('JR11-18-SATIN'),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole('button', {
            name: 'Adicionar ao carrinho',
          }),
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({
              body: JSON.stringify({
                productId: 'product-1',
                productVariantId:
                  'variant-18-black',
                quantity: 1,
              }),
            }),
          )
        })
      },
    )

    test(
      'mudar o acabamento mantém o diâmetro quando existe uma variante com tudo',
      () => {
        const product =
          createProduct({
            price: 179.9,
            variants: [
              createVariant({
                id: 'variant-18-sb',
                sku: 'JR11-18-SATIN',
                price: 179.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                  {
                    code: 'finish',
                    name: 'Acabamento',
                    value: 'Satin Black',
                  },
                ],
              }),
              createVariant({
                id: 'variant-18-bronze',
                sku: 'JR11-18-BRONZE',
                price: 184.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                  {
                    code: 'finish',
                    name: 'Acabamento',
                    value: 'Bronze',
                  },
                ],
              }),
              createVariant({
                id: 'variant-19-bronze',
                sku: 'JR11-19-BRONZE',
                price: 219.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                  {
                    code: 'finish',
                    name: 'Acabamento',
                    value: 'Bronze',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        expect(
          screen.getByText(
            'JR11-18-SATIN',
          ),
        ).toBeInTheDocument()

        selectOption(
          'Cor',
          'Bronze',
        )

        // O diâmetro 18" continua selecionado
        // porque existe uma variante Bronze com 18".
        expect(
          getSelect('Diâmetro').value,
        ).toBe('18"')

        expect(
          screen.getByText(
            '184,90 €',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'JR11-18-BRONZE',
          ),
        ).toBeInTheDocument()

        selectOption(
          'Diâmetro',
          '19"',
        )

        expect(
          screen.getByText(
            '219,90 €',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'JR11-19-BRONZE',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'o preço "Desde" usa o mínimo das variantes ativas, nunca o preço genérico do produto',
      () => {
        const product =
          createProduct({
            // Preço de catálogo genérico, sem
            // correspondência com nenhuma variante.
            price: 249.9,
            variants: [
              createVariant({
                id: 'variant-18',
                sku: 'JR11-18',
                price: 179.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                ],
              }),
              createVariant({
                id: 'variant-19',
                sku: 'JR11-19',
                price: 219.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '19"',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        expect(
          screen.queryByText('249,90 €'),
        ).not.toBeInTheDocument()

        selectOption(
          'Diâmetro',
          '19"',
        )

        expect(
          screen.getByText('Desde'),
        ).toBeInTheDocument()

        expect(
          screen.getByText('179,90 €'),
        ).toBeInTheDocument()

        expect(
          screen.getByText('219,90 €'),
        ).toBeInTheDocument()
      },
    )

    test(
      'a seleção inicial usa o acabamento por omissão do produto',
      () => {
        const product =
          createProduct({
            price: 179.9,
            defaultFinish: 'Bronze',
            variants: [
              createVariant({
                id: 'variant-18-sb',
                sku: 'JR11-18-SATIN',
                price: 179.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                  {
                    code: 'finish',
                    name: 'Acabamento',
                    value: 'Satin Black',
                  },
                ],
              }),
              createVariant({
                id: 'variant-18-bronze',
                sku: 'JR11-18-BRONZE',
                price: 184.9,
                options: [
                  {
                    code: 'diameter',
                    name: 'Diâmetro',
                    value: '18"',
                  },
                  {
                    code: 'finish',
                    name: 'Acabamento',
                    value: 'Bronze',
                  },
                ],
              }),
            ],
          })

        render(
          <ProductPurchasePanel
            product={product}
          />
        )

        // Sem interação: já arranca na variante
        // Bronze (defaultFinish).
        expect(
          screen.getByText(
            'JR11-18-BRONZE',
          ),
        ).toBeInTheDocument()

        expect(
          getSelect('Cor').value,
        ).toBe('Bronze')

        expect(
          screen.getByText(
            '184,90 €',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'jantes: eixo com valor único é especificação fixa e o resto são dropdowns (regra dos 2 valores)',
      () => {
        render(
          <ProductPurchasePanel
            product={createProduct({
              price: 419.99,
              variants: [
                createVariant({
                  id: 'ff2-hs',
                  sku: 'FF-TWO-21-HS',
                  price: 419.99,
                  priceSet: 1599.99,
                  options: [
                    {
                      code: 'diameter',
                      name: 'Diâmetro',
                      value: '21"',
                    },
                    {
                      code: 'width',
                      name: 'Largura',
                      value: '10J',
                    },
                    {
                      code: 'pcd',
                      name: 'Furação',
                      value: '5x112',
                    },
                    {
                      code: 'offset',
                      name: 'Offset (ET)',
                      value: 'ET35',
                    },
                    {
                      code: 'centre_bore',
                      name: 'Furo central',
                      value: '66.6 mm',
                    },
                    {
                      code: 'finish',
                      name: 'Cor',
                      value: 'HyperSilver',
                    },
                  ],
                }),
                createVariant({
                  id: 'ff2-gb',
                  sku: 'FF-TWO-21-GB',
                  price: 439.99,
                  priceSet: null,
                  options: [
                    {
                      code: 'diameter',
                      name: 'Diâmetro',
                      value: '21"',
                    },
                    {
                      code: 'width',
                      name: 'Largura',
                      value: '10J',
                    },
                    {
                      code: 'pcd',
                      name: 'Furação',
                      value: '5x112',
                    },
                    {
                      code: 'offset',
                      name: 'Offset (ET)',
                      value: 'ET35',
                    },
                    {
                      code: 'centre_bore',
                      name: 'Furo central',
                      value: '66.6 mm',
                    },
                    {
                      code: 'finish',
                      name: 'Cor',
                      value: 'GlossyBlack',
                    },
                  ],
                }),
              ],
            })}
          />,
        )

        // Eixos de valor único NUNCA são dropdowns.
        expect(
          screen.queryByLabelText('Diâmetro'),
        ).toBeNull()
        expect(
          screen.queryByLabelText('Furação'),
        ).toBeNull()
        expect(
          screen.queryByLabelText('Largura'),
        ).toBeNull()
        expect(
          screen.queryByLabelText('Offset (ET)'),
        ).toBeNull()

        // São especificações fixas visíveis.
        expect(
          screen.getByText('21"'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('5x112'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('10J'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('ET35'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('66.6 mm'),
        ).toBeInTheDocument()

        // Cor tem 2 valores → dropdown.
        expect(
          getSelect('Cor').value,
        ).toBe('HyperSilver')

        // Identificação do acabamento atual.
        expect(
          screen.getByText('Acabamento atual'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('Acabamento atual')
            .nextElementSibling?.textContent,
        ).toBe('HyperSilver')

        // Preço por jante e conjunto de 4.
        expect(
          screen.getByText('€/jante'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('Conjunto de 4'),
        ).toBeInTheDocument()
        expect(
          screen
            .getAllByText(
              (_, element) =>
                element?.textContent ===
                new Intl.NumberFormat('pt-PT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(1599.99),
            )
            .length,
        ).toBeGreaterThan(0)
      },
    )

    test(
      'jantes: mudar a cor troca o preço e o conjunto de 4 da variante resolvida',
      () => {
        render(
          <ProductPurchasePanel
            product={createProduct({
              price: 419.99,
              variants: [
                createVariant({
                  id: 'ff3-hs',
                  sku: 'FF-THREE-19-HS',
                  price: 569.99,
                  priceSet: 2199.99,
                  options: [
                    {
                      code: 'finish',
                      name: 'Cor',
                      value: 'HyperSilver',
                    },
                  ],
                }),
                createVariant({
                  id: 'ff3-gb',
                  sku: 'FF-THREE-19-GB',
                  price: 589.99,
                  priceSet: 2299.99,
                  options: [
                    {
                      code: 'finish',
                      name: 'Cor',
                      value: 'GlossyBlack',
                    },
                  ],
                }),
              ],
            })}
          />,
        )

        expect(
          screen.getByText('569,99 €'),
        ).toBeInTheDocument()
        expect(
          screen
            .getAllByText(
              (_, element) =>
                element?.textContent ===
                new Intl.NumberFormat('pt-PT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(2199.99),
            )
            .length,
        ).toBeGreaterThan(0)

        selectOption('Cor', 'GlossyBlack')

        expect(
          screen.getByText('589,99 €'),
        ).toBeInTheDocument()
        expect(
          screen
            .getAllByText(
              (_, element) =>
                element?.textContent ===
                new Intl.NumberFormat('pt-PT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(2299.99),
            )
            .length,
        ).toBeGreaterThan(0)
        expect(
          screen.getByText('Acabamento atual')
            .nextElementSibling?.textContent,
        ).toBe('GlossyBlack')
      },
    )
  },
)
