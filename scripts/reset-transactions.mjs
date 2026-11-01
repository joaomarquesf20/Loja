/**
 * Reset "clean slate" do template white-label: apaga TODO o catálogo e
 * os dados transacionais numa única transação, preservando as tabelas
 * estruturais:
 *
 *   - VehicleMake / VehicleModel / VehicleSpec  (Épico 8 — fitment)
 *   - StoreSettings                             (identidade da loja)
 *   - CheckoutRegionRule / ShippingRule         (definições comerciais)
 *   - User / Address                            (contas, incluindo admin)
 *
 * O que é apagado: produtos (e variantes, imagens, opções, especificações,
 * compatibilidades, taxas de envio por produto), movimentos de stock,
 * encomendas (com itens e eventos), cupões, carrinhos, fusões de carrinho
 * de convidado, importações, categorias e marcas de produto.
 *
 * Uso (confirmação obrigatória para não limpar sem intenção):
 *
 *   node --env-file=.env scripts/reset-transactions.mjs          # simulação
 *   node --env-file=.env scripts/reset-transactions.mjs --yes    # executa
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString =
  process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL não definida (usa --env-file=.env)',
  )
}

const confirm = process.argv.includes('--yes')

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
  }),
})

/**
 * Ordem de eliminação respeita as FK: primeiro os descendentes
 * (variantes → imagens/opções/compatibilidades), depois os produtos,
 * depois as tabelas só de encomenda.
 */
const steps = [
  {
    label: 'Seleções de variantes (opções)',
    run: () =>
      prisma.productVariantOptionSelection.deleteMany(
        {},
      ),
  },
  {
    label: 'Especificações de variantes',
    run: () =>
      prisma.productVariantSpecification.deleteMany(
        {},
      ),
  },
  {
    label: 'Compatibilidade produto↔veículo',
    run: () =>
      prisma.productCompatibility.deleteMany(
        {},
      ),
  },
  {
    label: 'Imagens de produto',
    run: () =>
      prisma.productImage.deleteMany({}),
  },
  {
    label: 'Valores das opções de produto',
    run: () =>
      prisma.productOptionValue.deleteMany(
        {},
      ),
  },
  {
    label: 'Opções de produto',
    run: () =>
      prisma.productOption.deleteMany({}),
  },
  {
    label: 'Movimentos de stock',
    run: () =>
      prisma.stockMovement.deleteMany({}),
  },
  {
    label: 'Taxas de envio por produto',
    run: () =>
      prisma.productShippingRate.deleteMany(
        {},
      ),
  },
  {
    label: 'Variantes de produto',
    run: () =>
      prisma.productVariant.deleteMany({}),
  },
  {
    label: 'Itens de encomenda',
    run: () =>
      prisma.orderItem.deleteMany({}),
  },
  {
    label: 'Eventos de encomenda',
    run: () =>
      prisma.orderEvent.deleteMany({}),
  },
  {
    label: 'Encomendas',
    run: () => prisma.order.deleteMany({}),
  },
  {
    label: 'Carrinhos de cliente',
    run: () => prisma.cartItem.deleteMany({}),
  },
  {
    label: 'Fusões de carrinho de convidado',
    run: () =>
      prisma.guestCartMerge.deleteMany({}),
  },
  {
    label: 'Importações de catálogo',
    run: () =>
      prisma.productImport.deleteMany({}),
  },
  {
    label: 'Cupões',
    run: () => prisma.coupon.deleteMany({}),
  },
  {
    label: 'Produtos',
    run: () => prisma.product.deleteMany({}),
  },
  {
    label: 'Subcategorias',
    run: () =>
      prisma.category.deleteMany({
        where: {
          NOT: { parentId: null },
        },
      }),
  },
  {
    label: 'Categorias de topo',
    run: () => prisma.category.deleteMany({}),
  },
  {
    label: 'Marcas de produto',
    run: () =>
      prisma.productBrand.deleteMany({}),
  },
]

const fitmentCounts =
  await Promise.all([
    prisma.vehicleMake.count(),
    prisma.vehicleModel.count(),
    prisma.vehicleSpec.count(),
  ])

console.log(
  'Planos de eliminação (app reset):',
)

let plannedTotal = 0

for (const step of steps) {
  const count = await step.run()

  plannedTotal += count.count

  console.log(
    `  - ${step.label}: ${count.count}`,
  )
}

console.log(
  `Tabelas preservadas: VehicleMake ${fitmentCounts[0]}, VehicleModel ${fitmentCounts[1]}, VehicleSpec ${fitmentCounts[2]} (estruturais).`,
)

if (!confirm) {
  console.log(
    'Simulação concluída — nada foi apagado. Para apagar de verdade: node --env-file=.env scripts/reset-transactions.mjs --yes',
  )

  await prisma.$disconnect()

  process.exit(0)
}

await prisma.$transaction(
  steps.map(
    (step) => step.run(),
  ),
)

console.log(
  `Clean slate aplicado (${plannedTotal} registos removidos). Catálogo de veículos (fitment), contas, configurações da loja e definições comerciais preservados.`,
)

await prisma.$disconnect()
