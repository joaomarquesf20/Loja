import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock(
  './product-vehicle-compatibility-editor',
  () => ({
    default: ({
      required,
    }: {
      required?: boolean
    }) => (
      <div>
        {required
          ? 'Aplicações de veículo — A suspensão precisa de pelo menos uma aplicação de veículo.'
          : 'Aplicações de veículo'}
      </div>
    ),
    createDraft: vi.fn(),
  }),
)

import ProductEditorClient from './product-editor-client'

const fetchMock = vi.fn()

const categories = [
  {
    id: 'category-wheels',
    name: 'Jantes',
    slug: 'jantes',
    description: null,
    parentId: null,
  },
  {
    id: 'category-suspension',
    name: 'Suspensão',
    slug: 'suspensao',
    description: null,
    parentId: null,
  },
  {
    id: 'category-exterior',
    name: 'Exterior',
    slug: 'exterior',
    description: null,
    parentId: null,
  },
]

function jsonResponse(data: unknown) {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

function installApiMock() {
  fetchMock.mockImplementation(
    async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url === '/api/admin/categories') {
        return jsonResponse(categories)
      }
      if (
        url === '/api/admin/product-brands'
      ) {
        return jsonResponse([
          {
            id: 'brand-bbs',
            name: 'BBS',
            slug: 'bbs',
          },
        ])
      }
      if (
        url === '/api/admin/images/upload'
      ) {
        return jsonResponse({
          images: [
            {
              url: '/uploads/test-wheel.jpg',
              originalName: 'test-wheel.jpg',
            },
            {
              url: '/uploads/test-wheel-2.jpg',
              originalName: 'test-wheel-2.jpg',
            },
          ],
          errors: [],
        })
      }

      throw new Error(
        `Pedido não mockado: ${url}`,
      )
    },
  )
}

async function chooseCategory(
  name: string,
) {
  render(<ProductEditorClient />)
  const category = await screen.findByRole(
    'button',
    {
      name: new RegExp(name),
    },
  )
  fireEvent.click(category)
}

describe('ProductEditorClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    installApiMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('escolhe primeiro o tipo e mostra apenas a tabela de jantes', async () => {
    await chooseCategory('Jantes')

    expect(
      screen.getByRole('heading', {
        name: 'Detalhes e variantes',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', {
        name: 'Diâmetro',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', {
        name: 'PCD',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', {
        name: 'CB',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Aplicações de veículo',
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        /Não são necessárias/,
      ),
    ).toBeInTheDocument()
  })

  test(
    'deriva grupos de acabamento e permite atribuir uma imagem carregada',
    async () => {
      await chooseCategory('Jantes')

      fireEvent.change(
        screen.getByLabelText(
          'Acabamento da variante 1',
        ),
        {
          target: {
            value: 'Bronze',
          },
        },
      )

      expect(
        screen.getByRole('heading', {
          name: 'Bronze',
        }),
      ).toBeInTheDocument()

      fireEvent.change(
        screen.getByLabelText(
          'Selecionar imagens',
        ),
        {
          target: {
            files: [
              new File(
                ['fake-image'],
                'wheel.jpg',
                {
                  type: 'image/jpeg',
                },
              ),
            ],
          },
        },
      )

      await waitFor(() => {
        expect(
          screen.getAllByRole('img', {
            name: 'Geral',
          }),
        ).toHaveLength(2)
      })

      fireEvent.change(
        screen.getByLabelText(
          'Grupo da imagem 1',
        ),
        {
          target: {
            value: 'Bronze',
          },
        },
      )

      expect(
        screen.getByRole('img', {
          name: 'Bronze',
        }),
      ).toBeInTheDocument()
    },
  )

  test(
    'permite reordenar, definir capa, editar texto alternativo e eliminar imagens',
    async () => {
      await chooseCategory('Exterior')

      fireEvent.change(
        screen.getByPlaceholderText(
          'Um URL ou caminho por linha',
        ),
        {
          target: {
            value: '/one.jpg\n/two.jpg',
          },
        },
      )
      const addButtons =
        screen.getAllByRole('button', {
          name: 'Adicionar',
        })
      fireEvent.click(
        addButtons[addButtons.length - 1],
      )

      const altInputs =
        screen.getAllByLabelText(
          /Texto alternativo da imagem/,
        )
      fireEvent.change(altInputs[0], {
        target: { value: 'one' },
      })
      fireEvent.change(altInputs[1], {
        target: { value: 'two' },
      })

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Definir capa',
        }),
      )
      expect(
        screen.getAllByText('Capa'),
      ).toHaveLength(1)

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Mover imagem 2 para cima',
        }),
      )
      expect(
        screen
          .getAllByLabelText(
            /Texto alternativo da imagem/,
          )
          .map((input) =>
            (input as HTMLInputElement).value,
          ),
      ).toEqual(['two', 'one'])

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Eliminar imagem 1',
        }),
      )
      expect(
        screen.getAllByLabelText(
          /Texto alternativo da imagem/,
        ),
      ).toHaveLength(1)
    },
  )

  test(
    'mostra erros de upload por ficheiro',
    async () => {
      fetchMock.mockImplementation(
        async (input: RequestInfo | URL) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url
          if (
            url === '/api/admin/categories'
          ) {
            return jsonResponse(categories)
          }
          if (
            url === '/api/admin/product-brands'
          ) {
            return jsonResponse([])
          }
          if (
            url === '/api/admin/images/upload'
          ) {
            return jsonResponse({
              images: [],
              errors: [
                {
                  fileName: 'bad.jpg',
                  message:
                    'O ficheiro excede 10 MB.',
                },
              ],
            })
          }
          throw new Error(`Pedido não mockado: ${url}`)
        },
      )

      await chooseCategory('Exterior')
      fireEvent.change(
        screen.getByLabelText(
          'Selecionar imagens',
        ),
        {
          target: {
            files: [
              new File(
                ['bad'],
                'bad.jpg',
                {
                  type: 'image/jpeg',
                },
              ),
            ],
          },
        },
      )

      expect(
        await screen.findByRole('alert'),
      ).toHaveTextContent(
        'bad.jpg: O ficheiro excede 10 MB.',
      )
    },
  )

  test('permite adicionar, duplicar e eliminar linhas de variante', async () => {
    await chooseCategory('Jantes')

    fireEvent.click(
      screen.getByRole('button', {
        name: '+ Adicionar variante',
      }),
    )
    expect(
      screen.getAllByLabelText(
        'SKU da variante 1',
      ),
    ).toHaveLength(1)
    expect(
      screen.getAllByLabelText(
        'SKU da variante 2',
      ),
    ).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Duplicar variante 1',
      }),
    )
    expect(
      screen.getAllByLabelText(
        'SKU da variante 2',
      ),
    ).toHaveLength(1)
    expect(
      screen.getAllByLabelText(
        'SKU da variante 3',
      ),
    ).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Eliminar variante 2',
      }),
    )
    expect(
      screen.queryByLabelText(
        'SKU da variante 3',
      ),
    ).not.toBeInTheDocument()
  })

  test('mostra rebaixamento e aplicações para suspensão', async () => {
    await chooseCategory('Suspensão')

    expect(
      screen.getByRole('columnheader', {
        name: 'Rebaixo dianteiro',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', {
        name: 'Rebaixo traseiro',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Aplicações de veículo/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /pelo menos uma aplicação de veículo/i,
      ),
    ).toBeInTheDocument()
  })

  test('avisa antes de sair depois de uma alteração', async () => {
    await chooseCategory('Exterior')

    const event = new Event(
      'beforeunload',
      { cancelable: true },
    )
    window.dispatchEvent(event)

    await waitFor(() => {
      expect(event.defaultPrevented).toBe(true)
    })
  })

  test(
    'mostra um resumo com o campo exato em falta e foca o primeiro campo inválido',
    async () => {
      await chooseCategory('Jantes')

      fireEvent.change(
        screen.getByLabelText('Nome'),
        {
          target: { value: 'Jante Teste' },
        },
      )

      // Variante 1: falta o acabamento e o preço.
      fireEvent.change(
        screen.getByLabelText(
          'Diâmetro da variante 1',
        ),
        { target: { value: '18"' } },
      )
      fireEvent.change(
        screen.getByLabelText(
          'Largura da variante 1',
        ),
        { target: { value: '8.5J' } },
      )
      fireEvent.change(
        screen.getByLabelText('PCD da variante 1'),
        { target: { value: '5x112' } },
      )
      fireEvent.change(
        screen.getByLabelText('ET da variante 1'),
        { target: { value: 'ET35' } },
      )
      fireEvent.change(
        screen.getByLabelText('CB da variante 1'),
        { target: { value: '66.6 mm' } },
      )

      fireEvent.click(
        screen
          .getAllByRole('button', {
            name: 'Criar e continuar',
          })
          .pop()!,
      )

      const summary = await screen.findByRole(
        'alert',
      )
      expect(summary).toHaveTextContent(
        'Variante 1 · Acabamento: Preenche esta especificação.',
      )
      expect(summary).toHaveTextContent(
        'Variante 1 · Preço: Indica um preço válido (ex.: 169,90).',
      )
      // SKU já não é exigido: não aparece no resumo.
      expect(
        summary.textContent,
      ).not.toContain('SKU')

      // O primeiro campo inválido (preço, na ordem de
      // validação) fica focado.
      expect(
        document.activeElement,
      ).toHaveAttribute(
        'aria-label',
        'Preço da variante 1',
      )
    },
  )

  test(
    'aceita preço com vírgula e envia valores normalizados para a API',
    async () => {
      let postedBody: unknown = null
      const postSpy = vi.fn(
        async (init?: RequestInit) => {
          postedBody = init?.body ?? null

          return jsonResponse({
            id: 'product-created',
            name: 'Jante Vírgula',
            slug: 'jante-virgula',
            sku: 'JV-1',
            description: null,
            price: '189.90',
            stockQuantity: 6,
            isActive: true,
            images: [],
            imageMetadata: [],
            defaultFinish: null,
            shippingClass: 'STANDARD',
            mainlandShippingCost: null,
            category: {
              id: 'category-wheels',
              name: 'Jantes',
              slug: 'jantes',
              parentId: null,
            },
            brand: null,
            variants: [],
            compatibilities: [],
          })
        },
      )

      await chooseCategory('Jantes')

      fireEvent.change(
        screen.getByLabelText('Nome'),
        {
          target: {
            value: 'Jante Vírgula',
          },
        },
      )

      const selections: Record<
        string,
        string
      > = {
        'Diâmetro da variante 1': '18',
        'Largura da variante 1': '8.5',
        'PCD da variante 1': '5x112',
        'ET da variante 1': '35',
        'CB da variante 1': '66,6',
        'Acabamento da variante 1':
          'Satin Black',
      }

      for (const [
        label,
        value,
      ] of Object.entries(selections)) {
        fireEvent.change(
          screen.getByLabelText(label),
          { target: { value } },
        )
      }

      fireEvent.change(
        screen.getByLabelText(
          'Preço da variante 1',
        ),
        { target: { value: '189,90' } },
      )
      fireEvent.change(
        screen.getByLabelText(
          'Stock da variante 1',
        ),
        { target: { value: '6' } },
      )

      fetchMock.mockImplementation(
        async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ) => {
          const url =
            typeof input === 'string'
              ? input
              : input.toString()

          if (
            init?.method === 'POST' &&
            url === '/api/admin/products/manage'
          ) {
            return postSpy(init)
          }

          return jsonResponse(categories)
        },
      )

      fireEvent.click(
        screen
          .getAllByRole('button', {
            name: 'Criar e continuar',
          })
          .pop()!,
      )

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalled()
      })
      expect(postedBody).toBeDefined()

      const body = JSON.parse(
        postedBody as string,
      ) as {
        variants: Array<{
          sku: string
          price: number
          selections: Record<string, string>
        }>
      }

      // Preço com vírgula foi convertido para número.
      expect(body.variants[0].price).toBe(
        189.9,
      )
      // Campos de especificação são enviados como
      // escritos; a normalização canónica acontece no
      // servidor.
      expect(
        body.variants[0].selections.diameter,
      ).toBe('18')
      // SKU em branco é permitido (gerado no servidor).
      expect(body.variants[0].sku).toBe('')
    },
  )

  test(
    'destaca ambas as linhas quando duas variantes repetem especificações e acabamento',
    async () => {
      await chooseCategory('Jantes')

      const fillVariant = async (
        variantNumber: number,
        finish: string,
      ) => {
        const inputs: Record<string, string> = {
          [`Diâmetro da variante ${variantNumber}`]:
            '19"',
          [`Largura da variante ${variantNumber}`]:
            '8.5J',
          [`PCD da variante ${variantNumber}`]:
            '5x120',
          [`ET da variante ${variantNumber}`]:
            'ET30',
          [`CB da variante ${variantNumber}`]:
            '66.6 mm',
          [`Acabamento da variante ${variantNumber}`]:
            finish,
        }

        for (const [
          label,
          value,
        ] of Object.entries(inputs)) {
          fireEvent.change(
            screen.getByLabelText(label),
            { target: { value } },
          )
        }

        fireEvent.change(
          screen.getByLabelText(
            `Preço da variante ${variantNumber}`,
          ),
          {
            target: { value: '199,90' },
          },
        )
        fireEvent.change(
          screen.getByLabelText(
            `Stock da variante ${variantNumber}`,
          ),
          { target: { value: '4' } },
        )
      }

      await fillVariant(1, 'Satin Black')

      // Segunda variante: mesmo conjunto de eixos,
      // acabamento diferente — é válida e não é
      // sinalizada como repetida.
      fireEvent.click(
        screen.getByRole('button', {
          name: '+ Adicionar variante',
        }),
      )
      await fillVariant(2, 'Silver Machined')

      // Terceira variante: repetição exata da primeira.
      fireEvent.click(
        screen.getByRole('button', {
          name: '+ Adicionar variante',
        }),
      )
      await fillVariant(3, 'Satin Black')

      fireEvent.click(
        screen
          .getAllByRole('button', {
            name: 'Criar e continuar',
          })
          .pop()!,
        )

      const alerts = await screen.findAllByRole(
        'alert',
      )
      const alertText = alerts
        .map((alert) => alert.textContent)
        .join(' ')

      // Ambas as linhas em conflito são nomeadas
      // nos avisos (resumo de erros + destaque na
      // tabela de variantes).
      expect(alertText).toContain(
        'Variante 3 · Especificações: Repete a combinação da variante 1',
      )
      expect(alertText).toContain(
        'Variante 1 · Especificações: Repete a combinação da variante 3',
      )

      // As duas linhas duplicadas ficam destacadas.
      const row1 = screen
        .getByLabelText(
          'Diâmetro da variante 1',
        )
        .closest('tr')!
      const row3 = screen
        .getByLabelText(
          'Diâmetro da variante 3',
        )
        .closest('tr')!
      const row2 = screen
        .getByLabelText(
          'Diâmetro da variante 2',
        )
        .closest('tr')!

      expect(row1.className).toContain(
        'bg-red-50',
      )
      expect(row3.className).toContain(
        'bg-red-50',
      )
      expect(row2.className).not.toContain(
        'bg-red-50',
      )
    },
  )
})
