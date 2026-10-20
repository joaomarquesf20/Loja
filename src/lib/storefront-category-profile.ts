/**
 * Perfil de filtros por categoria. Um catálogo de
 * performance não pode mostrar os mesmos filtros em todas
 * as categorias: uma jante filtra por medida, uma
 * suspensão por veículo e rebaixamento, um acessório
 * exterior por veículo.
 */
export type CatalogFilterProfile =
  | 'wheels'
  | 'suspension'
  | 'exterior'
  | 'generic'

/**
 * Forma mínima de uma faceta de opção de variante. É
 * declarada aqui (e não importada do servidor) para que
 * este módulo possa ser usado tanto pelas páginas como
 * pelos módulos de servidor.
 */
export type VariantFacet = {
  code: string
  name: string
  values: Array<{
    value: string
    productCount: number
  }>
}

const wheelAxes = [
  'diameter',
  'pcd',
  'width',
  'offset',
  'centre_bore',
  'finish',
]

const suspensionAxes = [
  'front_drop_mm',
  'rear_drop_mm',
  'vehicle_application',
]

/**
 * Exterior: o tipo de peça (Splitter frontal, Saias
 * laterais, Spoiler Cap...) é o filtro principal dentro da
 * categoria, ao lado da marca do veículo.
 */
const exteriorAxes = [
  'productType',
]

const genericAxes = [
  'diameter',
  'width',
  'pcd',
  'offset',
  'centre_bore',
  'finish',
  'front_drop_mm',
  'rear_drop_mm',
  'vehicle_application',
  'thickness_mm',
  'productType',
]

/**
 * Eixos que nunca aparecem como filtro de cliente. A
 * carga por eixo continua a existir nos dados e nas
 * variantes, mas é metadado interno de compatibilidade e
 * não ajuda quem escolhe uma mola.
 */
const hiddenAxes = new Set([
  'axle_load',
])

const axisOrderByProfile: Record<
  CatalogFilterProfile,
  string[]
> = {
  wheels: wheelAxes,
  suspension: suspensionAxes,
  exterior: exteriorAxes,
  generic: genericAxes,
}

function includesKeyword(
  value: string,
  keywords: string[],
) {
  return keywords.some((keyword) =>
    value.includes(keyword),
  )
}

export function getCategoryFilterProfile(
  category: {
    name: string
    slug: string
  },
): CatalogFilterProfile {
  const value = `${category.name} ${category.slug}`
    .toLocaleLowerCase('pt-PT')

  if (
    includesKeyword(value, [
      'jante',
      'jantes',
      'roda',
      'rodas',
      'wheel',
      'wheels',
      'rim',
      'rims',
      'aro',
      'aros',
    ])
  ) {
    return 'wheels'
  }

  if (
    includesKeyword(value, [
      'suspens',
      'mola',
      'molas',
      'amortecedor',
      'amortecedores',
      'coilover',
      'spring',
      'springs',
      'shock',
      'shocks',
      'rebaixamento',
    ])
  ) {
    return 'suspension'
  }

  if (
    includesKeyword(value, [
      'exterior',
      'body',
      'body-kit',
      'bodykit',
      'carenagem',
      'para-choque',
    ])
  ) {
    return 'exterior'
  }

  return 'generic'
}

/**
 * Eixos de opção a mostrar na categoria, pela ordem em
 * que fazem sentido para o cliente. Só entram eixos que
 * existem nos dados reais dos produtos.
 */
export function getVisibleVariantFacets(
  profile: CatalogFilterProfile,
  facets: VariantFacet[],
): VariantFacet[] {
  const order = axisOrderByProfile[profile]

  return facets
    .filter(
      (facet) =>
        !hiddenAxes.has(facet.code) &&
        order.includes(facet.code),
    )
    .sort((first, second) => {
      const firstIndex = order.indexOf(
        first.code,
      )

      const secondIndex = order.indexOf(
        second.code,
      )

      return firstIndex - secondIndex
    })
}

/**
 * Em jantes o fabricante é a marca da jante; em suspensão
 * e exterior é quem fabricou o produto.
 */
export function getBrandFilterLabel(
  profile: CatalogFilterProfile,
) {
  return profile === 'wheels' ? 'Marca' : 'Fabricante'
}

/**
 * A compatibilidade de veículo faz sentido para quem
 * compra uma mola ou um componente exterior; em jantes
 * o que interessa é a medida.
 */
export function shouldShowVehicleFilter(
  profile: CatalogFilterProfile,
) {
  return profile !== 'wheels'
}

export function shouldShowVehicleGenerations(
  profile: CatalogFilterProfile,
  models: Array<{
    generations: unknown[]
  }>,
) {
  if (profile === 'suspension') {
    return true
  }

  return models.some(
    (model) => model.generations.length > 1,
  )
}
