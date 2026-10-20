import {
  describe,
  expect,
  test,
} from 'vitest'
import {
  getPrimaryProductImage,
  getProductGalleryImages,
} from './product-images'

describe('product image helpers', () => {
  test(
    'usa a imagem primária do acabamento configurado no cartão',
    () => {
      const image =
        getPrimaryProductImage({
          defaultFinish: 'Satin Black',
          images: ['/general.jpg'],
          imageMetadata: [
            {
              id: 'general',
              url: '/general.jpg',
              isPrimary: true,
              finish: null,
            },
            {
              id: 'black-primary',
              url: '/black-primary.jpg',
              isPrimary: true,
              finish: 'Satin Black',
            },
            {
              id: 'black-detail',
              url: '/black-detail.jpg',
              finish: 'Satin Black',
            },
          ],
        })

      expect(image?.url).toBe(
        '/black-primary.jpg',
      )
    },
  )

  test(
    'usa imagens gerais quando o acabamento não tem galeria',
    () => {
      const images = getProductGalleryImages(
        {
          images: ['/legacy-general.jpg'],
          imageMetadata: [
            {
              id: 'general',
              url: '/general.jpg',
              finish: null,
            },
            {
              id: 'black',
              url: '/black.jpg',
              finish: 'Satin Black',
            },
          ],
        },
        'Bronze',
      )

      expect(
        images.map((image) => image.url),
      ).toEqual(['/general.jpg'])
    },
  )

  test(
    'mantém o fallback para arrays legacy',
    () => {
      expect(
        getProductGalleryImages(
          {
            images: [
              '/one.jpg',
              '/two.jpg',
            ],
          },
          'Bronze',
        ).map((image) => image.url),
      ).toEqual([
        '/one.jpg',
        '/two.jpg',
      ])
    },
  )

  test(
    'mostra apenas as imagens do acabamento selecionado na galeria ativa',
    () => {
      const images =
        getProductGalleryImages(
          {
            images: [],
            imageMetadata: [
              {
                id: 'silver-1',
                url: '/silver-1.jpg',
                finish: 'Silver Machined',
              },
              {
                id: 'silver-2',
                url: '/silver-2.jpg',
                finish: 'Silver Machined',
              },
              {
                id: 'black-1',
                url: '/black-1.jpg',
                finish: 'Satin Black',
              },
              {
                id: 'bronze-1',
                url: '/bronze-1.jpg',
                finish: 'Bronze',
              },
            ],
          },
          'Silver Machined',
        )

      expect(images.map((image) => image.url)).toEqual(
        ['/silver-1.jpg', '/silver-2.jpg'],
      )
    },
  )

  test(
    'nunca mistura imagens de outros acabamentos quando o acabamento não tem galeria nem há imagens gerais',
    () => {
      const images =
        getProductGalleryImages(
          {
            images: [],
            imageMetadata: [
              {
                id: 'silver-1',
                url: '/silver-1.jpg',
                finish: 'Silver Machined',
              },
              {
                id: 'black-1',
                url: '/black-1.jpg',
                finish: 'Satin Black',
              },
            ],
          },
          'Gunmetal',
        )

      expect(images).toEqual([])
    },
  )

  test(
    'ignora diferenças de maiúsculas e espaços no acabamento',
    () => {
      const images =
        getProductGalleryImages(
          {
            images: [],
            imageMetadata: [
              {
                id: 'silver-1',
                url: '/silver-1.jpg',
                finish: 'silver machined',
              },
            ],
          },
          '  Silver Machined ',
        )

      expect(images.map((image) => image.url)).toEqual(
        ['/silver-1.jpg'],
      )
    },
  )

  test(
    'sem acabamento selecionado mostra apenas imagens gerais',
    () => {
      const images =
        getProductGalleryImages(
          {
            images: [],
            imageMetadata: [
              {
                id: 'general-1',
                url: '/general-1.jpg',
                finish: null,
              },
              {
                id: 'black-1',
                url: '/black-1.jpg',
                finish: 'Satin Black',
              },
            ],
          },
          null,
        )

      expect(images.map((image) => image.url)).toEqual(
        ['/general-1.jpg'],
      )
    },
  )

  test(
    'registos da galeria pertencem ao acabamento Gloss Black selecionado (prova)',
    () => {
      const metadata = [
        {
          id: 'img-silver-1',
          url: '/silver-1.jpg',
          finishValueId: 'value-silver',
          finish: 'Silver Machined',
        },
        {
          id: 'img-gloss-1',
          url: '/gloss-1.jpg',
          finishValueId: 'value-gloss',
          finish: 'Gloss Black',
        },
        {
          id: 'img-gloss-2',
          url: '/gloss-2.jpg',
          finishValueId: 'value-gloss',
          finish: 'GLOSS BLACK',
        },
        {
          id: 'img-general',
          url: '/general.jpg',
          finishValueId: null,
          finish: null,
        },
      ]

      const gallery = getProductGalleryImages(
        { images: [], imageMetadata: metadata },
        'Gloss Black',
      )

      // Todos os registos pertencem a Gloss Black.
      expect(gallery.length).toBeGreaterThan(0)

      for (const image of gallery) {
        expect(image.finishValueId).toBe(
          'value-gloss',
        )
      }

      // Nenhum registo de Silver Machined ou geral
      // permanece na galeria ativa.
      expect(
        gallery.some(
          (image) =>
            image.id === 'img-silver-1' ||
            image.id === 'img-general',
        ),
      ).toBe(false)
    },
  )

  test(
    'registos da galeria pertencem ao acabamento Silver Machined selecionado (prova)',
    () => {
      const metadata = [
        {
          id: 'img-silver-1',
          url: '/silver-1.jpg',
          finishValueId: 'value-silver',
          finish: 'Silver Machined',
        },
        {
          id: 'img-silver-2',
          url: '/silver-2.jpg',
          finishValueId: 'value-silver',
          finish: 'SILVER MACHINED',
        },
        {
          id: 'img-gloss-1',
          url: '/gloss-1.jpg',
          finishValueId: 'value-gloss',
          finish: 'Gloss Black',
        },
        {
          id: 'img-general',
          url: '/general.jpg',
          finishValueId: null,
          finish: null,
        },
      ]

      const gallery = getProductGalleryImages(
        { images: [], imageMetadata: metadata },
        'Silver Machined',
      )

      expect(gallery.length).toBeGreaterThan(0)

      for (const image of gallery) {
        expect(image.finishValueId).toBe(
          'value-silver',
        )
      }

      expect(
        gallery.some(
          (image) =>
            image.id === 'img-gloss-1' ||
            image.id === 'img-general',
        ),
      ).toBe(false)
    },
  )

  test(
    '"Gloss Black", "GLOSS BLACK" e "gloss-black" são o mesmo acabamento',
    () => {
      const metadata = [
        {
          id: 'img-1',
          url: '/gloss-display.jpg',
          finish: 'GLOSS BLACK',
        },
        {
          id: 'img-2',
          url: '/gloss-dash.jpg',
          finish: 'gloss-black',
        },
        {
          id: 'img-3',
          url: '/gloss-title.jpg',
          finish: 'Gloss Black',
        },
      ]

      const gallery = getProductGalleryImages(
        { images: [], imageMetadata: metadata },
        'Gloss Black',
      )

      expect(gallery.map((image) => image.url)).toEqual([
        '/gloss-display.jpg',
        '/gloss-dash.jpg',
        '/gloss-title.jpg',
      ])
    },
  )

  test(
    'acabamentos diferentes não se cruzam mesmo com palavras semelhantes',
    () => {
      const metadata = [
        {
          id: 'img-hyper',
          url: '/hyper.jpg',
          finishValueId: 'value-hyper',
          finish: 'Hyper Silver',
        },
        {
          id: 'img-silver',
          url: '/silver.jpg',
          finishValueId: 'value-silver',
          finish: 'Silver Machined',
        },
      ]

      // "Hyper Silver" não entra na galeria de
      // "Silver Machined" (e vice-versa).
      const gallery = getProductGalleryImages(
        { images: [], imageMetadata: metadata },
        'Silver Machined',
      )

      expect(gallery.map((image) => image.url)).toEqual([
        '/silver.jpg',
      ])
    },
  )

  test(
    'o mesmo nome de acabamento em dois produtos não partilha imagens',
    () => {
      // Dois produtos com o acabamento "Gloss Black" — cada array
      // só contém as imagens do próprio produto (é assim que o
      // servidor entrega os dados, por productId).
      const veemann = {
        images: [],
        imageMetadata: [
          {
            id: 'veemann-gloss',
            url: '/veemann-gloss.jpg',
            finishValueId: 'veemann-value-gloss',
            finish: 'Gloss Black',
          },
        ],
      }
      const bbs = {
        images: [],
        imageMetadata: [
          {
            id: 'bbs-gloss',
            url: '/bbs-gloss.jpg',
            finishValueId: 'bbs-value-gloss',
            finish: 'GLOSS BLACK',
          },
        ],
      }

      const veemannGallery = getProductGalleryImages(
        veemann,
        'Gloss Black',
      )
      const bbsGallery = getProductGalleryImages(
        bbs,
        'Gloss Black',
      )

      expect(veemannGallery.map((image) => image.url)).toEqual(
        ['/veemann-gloss.jpg'],
      )
      expect(bbsGallery.map((image) => image.url)).toEqual([
        '/bbs-gloss.jpg',
      ])

      // Nenhum URL de um produto aparece no outro.
      for (const image of bbsGallery) {
        expect(
          veemannGallery.some(
            (candidate) =>
              candidate.url === image.url,
          ),
        ).toBe(false)
      }
    },
  )

  test(
    'o cartão de catálogo usa apenas imagens do próprio produto',
    () => {
      // Catálogo: cada produto recebe só os seus metadados; o
      // cartão do BBS nunca vê as imagens da Veemann.
      const bbsCard = getPrimaryProductImage({
        images: [],
        imageMetadata: [
          {
            id: 'bbs-primary',
            url: '/bbs-primary.jpg',
            isPrimary: true,
            finish: null,
          },
        ],
      })

      expect(bbsCard?.url).toBe('/bbs-primary.jpg')

      // O mesmo com acabamento por omissão do produto.
      const veemannCard = getPrimaryProductImage({
        defaultFinish: 'Silver Machined',
        images: [],
        imageMetadata: [
          {
            id: 'veemann-silver',
            url: '/veemann-silver.jpg',
            isPrimary: true,
            finish: 'Silver Machined',
          },
          {
            id: 'veemann-general',
            url: '/veemann-general.jpg',
            finish: null,
          },
        ],
      })

      expect(veemannCard?.url).toBe(
        '/veemann-silver.jpg',
      )
    },
  )

  test(
    'produto sem imagens não herda imagens de outro produto (placeholder)',
    () => {
      // OZ Racing não tem ProductImage rows: os metadados chegam
      // vazios ao cartão, que mostra o placeholder — nunca as
      // imagens de outro produto.
      const emptyProduct = {
        images: [],
        imageMetadata: [],
      }

      expect(getPrimaryProductImage(emptyProduct)).toBeNull()
      expect(
        getProductGalleryImages(emptyProduct, 'Gloss Black'),
      ).toEqual([])
    },
  )
})
