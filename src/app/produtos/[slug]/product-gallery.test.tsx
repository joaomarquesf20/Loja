import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest'
import type {
  CatalogProductDetail,
  CatalogVariant,
} from '@/server/catalog'
import ProductGallery from './product-gallery'
import {
  ProductImageSelectionProvider,
} from './product-image-selection'
import ProductPurchasePanel from './product-purchase-panel'

function createVariant(
  id: string,
  finish: string,
  diameter: string,
  price: number,
): CatalogVariant {
  return {
    id,
    sku: `MF-Z7-${finish}-${diameter}`,
    price,
    priceSet: null,
    inStock: true,
    image: null,
    options: [
      {
        code: 'finish',
        name: 'Acabamento',
        value: finish,
      },
      {
        code: 'diameter',
        name: 'Diâmetro',
        value: diameter,
      },
    ],
  }
}

function createProduct(): CatalogProductDetail {
  return {
    id: 'product-mf-z7',
    name: 'Veemann MF-Z7',
    slug: 'veemann-mf-z7',
    sku: 'MF-Z7',
    description: null,
    price: 100,
    inStock: true,
    images: ['/general.jpg'],
    imageMetadata: [
      {
        id: 'general-primary',
        url: '/general.jpg',
        altText: 'Vista geral da MF-Z7',
        isPrimary: true,
        finish: null,
      },
      {
        id: 'black-primary',
        url: '/black.jpg',
        altText: 'MF-Z7 Satin Black',
        isPrimary: true,
        finish: 'Satin Black',
      },
      {
        id: 'bronze-primary',
        url: '/bronze.jpg',
        altText: 'MF-Z7 Bronze',
        isPrimary: true,
        finish: 'Bronze',
      },
    ],
    category: {
      id: 'category-wheels',
      name: 'Jantes',
      slug: 'jantes',
    },
    brand: {
      id: 'brand-veemann',
      name: 'Veemann',
      slug: 'veemann',
    },
    variants: [
      createVariant(
        'variant-black',
        'Satin Black',
        '18"',
        100,
      ),
      createVariant(
        'variant-bronze',
        'Bronze',
        '19"',
        220,
      ),
      createVariant(
        'variant-gunmetal',
        'Gunmetal',
        '20"',
        240,
      ),
    ],
  }
}

function renderExperience() {
  const product = createProduct()
  render(
    <ProductImageSelectionProvider>
      <ProductGallery
        name={product.name}
        images={product.images}
        imageMetadata={product.imageMetadata}
      />
      <ProductPurchasePanel product={product} />
    </ProductImageSelectionProvider>,
  )
  return product
}

describe('finish-aware product gallery', () => {
  afterEach(() => {
    cleanup()
  })

  test(
    'muda a galeria e mantém a resolução normal da variante ao escolher o acabamento',
    async () => {
      renderExperience()

      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'MF-Z7 Satin Black',
          }),
        ).toHaveAttribute(
          'src',
          '/black.jpg',
        )
      })

      fireEvent.change(
        screen.getByLabelText('Cor'),
        {
          target: {
            value: 'Bronze',
          },
        },
      )

      // A galeria muda imediatamente para o
      // acabamento escolhido.
      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'MF-Z7 Bronze',
          }),
        ).toHaveAttribute(
          'src',
          '/bronze.jpg',
        )
      })

      // O 18" não existe em Bronze: a seleção
      // incompatível foi limpa e o cliente
      // escolhe explicitamente o diâmetro que
      // completa a variante.
      fireEvent.change(
        screen.getByLabelText('Diâmetro'),
        {
          target: {
            value: '19"',
          },
        },
      )

      await waitFor(() => {
        expect(
          screen.getByText('220,00 €'),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'MF-Z7-Bronze-19"',
          ),
        ).toBeInTheDocument()
      })
    },
  )

  test(
    'volta às imagens gerais quando o acabamento não tem imagens próprias',
    async () => {
      renderExperience()

      fireEvent.change(
        screen.getByLabelText('Cor'),
        {
          target: {
            value: 'Gunmetal',
          },
        },
      )

      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'Vista geral da MF-Z7',
          }),
        ).toHaveAttribute(
          'src',
          '/general.jpg',
        )
      })
    },
  )

  test(
    'nunca mistura imagens de outros acabamentos na galeria ativa',
    async () => {
      const product = createProduct()
      render(
        <ProductImageSelectionProvider>
          <ProductGallery
            name={product.name}
            images={product.images}
            imageMetadata={[
              ...(product.imageMetadata ?? []),
              {
                id: 'silver-detail',
                url: '/silver-detail.jpg',
                altText: 'MF-Z7 Silver Machined detalhe',
                isPrimary: false,
                finish: 'Silver Machined',
              },
            ]}
          />
          <ProductPurchasePanel product={product} />
        </ProductImageSelectionProvider>,
      )

      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'MF-Z7 Satin Black',
          }),
        ).toHaveAttribute('src', '/black.jpg')
      })

      // A galeria ativa (Satin Black) não mostra a imagem
      // de Silver Machined nem a de Bronze.
      expect(
        screen.queryByRole('img', {
          name: 'MF-Z7 Silver Machined detalhe',
        }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('img', {
          name: 'MF-Z7 Bronze',
        }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('img', {
          name: 'Vista geral da MF-Z7',
        }),
      ).not.toBeInTheDocument()

      fireEvent.change(
        screen.getByLabelText('Cor'),
        {
          target: {
            value: 'Bronze',
          },
        },
      )

      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'MF-Z7 Bronze',
          }),
        ).toHaveAttribute('src', '/bronze.jpg')
      })

      expect(
        screen.queryByRole('img', {
          name: 'MF-Z7 Satin Black',
        }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('img', {
          name: 'MF-Z7 Silver Machined detalhe',
        }),
      ).not.toBeInTheDocument()
    },
  )

  test(
    'acabamento sem imagens próprias nem gerais renderiza a galeria vazia em vez de mostrar outras cores',
    async () => {
      const product = createProduct()
      render(
        <ProductImageSelectionProvider>
          <ProductGallery
            name={product.name}
            images={[]}
            imageMetadata={[
              {
                id: 'black-primary',
                url: '/black.jpg',
                altText: 'MF-Z7 Satin Black',
                isPrimary: true,
                finish: 'Satin Black',
              },
            ]}
          />
          <ProductPurchasePanel product={product} />
        </ProductImageSelectionProvider>,
      )

      fireEvent.change(
        screen.getByLabelText('Cor'),
        {
          target: {
            value: 'Gunmetal',
          },
        },
      )

      await waitFor(() => {
        expect(
          screen.getByText('Imagem em breve'),
        ).toBeInTheDocument()
      })

      // Nenhuma imagem de Satin Black aparece na galeria
      // de Gunmetal.
      expect(
        screen.queryByRole('img', {
          name: 'MF-Z7 Satin Black',
        }),
      ).not.toBeInTheDocument()
    },
  )

  test(
    'mudar o acabamento atualiza a imagem principal imediatamente',
    async () => {
      renderExperience()

      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'MF-Z7 Satin Black',
          }),
        ).toHaveAttribute('src', '/black.jpg')
      })

      fireEvent.change(
        screen.getByLabelText('Cor'),
        {
          target: {
            value: 'Bronze',
          },
        },
      )

      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'MF-Z7 Bronze',
          }),
        ).toHaveAttribute('src', '/bronze.jpg')
      })

      fireEvent.change(
        screen.getByLabelText('Cor'),
        {
          target: {
            value: 'Satin Black',
          },
        },
      )

      await waitFor(() => {
        expect(
          screen.getByRole('img', {
            name: 'MF-Z7 Satin Black',
          }),
        ).toHaveAttribute('src', '/black.jpg')
      })
    },
  )
})
