import {
  describe,
  expect,
  test,
} from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  getProductGalleryImages,
  getFinishProductImages,
  getGeneralProductImages,
  type ProductImageMetadata,
} from '@/lib/product-images'

/**
 * Verificação manual, só de leitura, contra a base de dados DEV real.
 * Prova que a galeria de cada acabamento contém só os registos
 * associados a esse acabamento, que acabamentos sem imagens próprias
 * caem nas gerais, e que nenhum URL pertence a dois produtos.
 * Não escreve na BD. Não corre no CI: precisa de DATABASE_URL do dev
 * e é saltado automaticamente quando a BD não está acessível.
 */
const canRun =
  process.env.DATABASE_URL?.includes('pfautoparts') ?? false

const d = describe.skipIf(!canRun)

d('galeria por acabamento (dados reais DEV, só leitura)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    }),
  })

  async function getMetadata(
    productId: string,
  ): Promise<ProductImageMetadata[]> {
    const records = await prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        finishValueId: true,
        finishValue: {
          select: {
            value: true,
            option: { select: { code: true } },
          },
        },
      },
    })

    return records.map((record) => ({
      id: record.id,
      url: record.url,
      altText: record.altText,
      sortOrder: record.sortOrder,
      isPrimary: record.isPrimary,
      finish:
        record.finishValue?.option.code === 'finish'
          ? record.finishValue.value
          : null,
      finishValueId:
        record.finishValue?.option.code === 'finish'
          ? record.finishValueId
          : null,
    }))
  }

  // Produtos da BD de dev que têm pelo menos uma imagem associada
  // a um acabamento. Descobertos em tempo de execução para não
  // depender de slugs fixos.
  async function productsWithFinishImages() {
    const rows = await prisma.productImage.findMany({
      where: {
        finishValueId: { not: null },
        finishValue: { option: { code: 'finish' } },
      },
      distinct: ['productId'],
      select: { productId: true },
    })
    return rows.map((row) => row.productId)
  }

  test(
    'cada acabamento com imagens próprias mostra só os seus registos',
    async () => {
      const productIds = await productsWithFinishImages()
      expect(productIds.length).toBeGreaterThan(0)

      let checked = 0
      for (const productId of productIds) {
        const metadata = await getMetadata(productId)
        const finishes = [
          ...new Set(
            metadata
              .map((image) => image.finish)
              .filter((finish): finish is string => !!finish),
          ),
        ]

        for (const finish of finishes) {
          const gallery = getProductGalleryImages(
            { images: [], imageMetadata: metadata },
            finish,
          )
          const ownRecords = getFinishProductImages(
            { images: [], imageMetadata: metadata },
            finish,
          )

          expect(ownRecords.length).toBeGreaterThan(0)
          expect(gallery.map((image) => image.id)).toEqual(
            ownRecords.map((image) => image.id),
          )

          for (const image of gallery) {
            expect(
              image.finish?.toLocaleLowerCase('pt-PT'),
            ).toBe(finish.toLocaleLowerCase('pt-PT'))
          }

          // A seleção do cliente pode chegar com outra capitalização.
          const upper = getProductGalleryImages(
            { images: [], imageMetadata: metadata },
            finish.toLocaleUpperCase('pt-PT'),
          )
          expect(upper.map((image) => image.id)).toEqual(
            gallery.map((image) => image.id),
          )
          checked++
        }
      }

      expect(checked).toBeGreaterThan(0)
    },
    20_000,
  )

  test(
    'acabamento sem imagens próprias cai nas gerais, nunca noutras cores',
    async () => {
      const productIds = await productsWithFinishImages()
      expect(productIds.length).toBeGreaterThan(0)

      let checked = 0
      for (const productId of productIds) {
        const metadata = await getMetadata(productId)
        const general = getGeneralProductImages({
          images: [],
          imageMetadata: metadata,
        })

        // 'Gunmetal' não existe como acabamento destes produtos.
        const gallery = getProductGalleryImages(
          { images: [], imageMetadata: metadata },
          'Gunmetal',
        )

        expect(gallery.map((image) => image.id)).toEqual(
          general.map((image) => image.id),
        )
        for (const image of gallery) {
          expect(image.finish).toBeNull()
        }
        checked++
      }

      expect(checked).toBeGreaterThan(0)
    },
    20_000,
  )

  test(
    'nenhum URL de imagem pertence a dois produtos diferentes',
    async () => {
      const productIds = await productsWithFinishImages()
      const metadataByProduct = new Map<
        string,
        ProductImageMetadata[]
      >()
      for (const productId of productIds) {
        metadataByProduct.set(
          productId,
          await getMetadata(productId),
        )
      }

      for (const [productId, metadata] of metadataByProduct) {
        for (const [otherId, otherMetadata] of metadataByProduct) {
          if (productId === otherId) {
            continue
          }
          const otherUrls = new Set(
            otherMetadata.map((image) => image.url),
          )
          for (const image of metadata) {
            expect(otherUrls.has(image.url)).toBe(false)
          }
        }
      }
    },
    20_000,
  )
})
