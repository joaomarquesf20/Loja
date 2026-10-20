import type {
  ImportField,
  SkuStrategy,
} from '@/lib/catalog-import'

export type ImportProfile =
  | 'wheels'
  | 'suspension'
  | 'exterior'
  | 'generic'

export type ImportMode =
  | 'create-only'
  | 'create-update'

export type ImportRowError = {
  row: number
  sku: string
  message: string
}

export type ImportWarning = {
  row: number
  message: string
}

export type ProductRowInput = {
  rowNumber: number
  productCode: string
  productName: string
  brand: string
  category: string
  description: string
  /**
   * SKU interno: vazio quando o ficheiro não traz referência e a
   * estratégia é "auto" — é gerado pelo gerador determinístico.
   */
  sku: string
  /** Referência do fornecedor (supplierSku), guardada à parte. */
  supplierSku: string
  /** O SKU foi gerado automaticamente pelo gerador. */
  skuGenerated: boolean
  price: number
  /**
   * Preço opcional do conjunto de 4 jantes (coluna
   * "PrecoConjunto4"). Só existe quando o ficheiro o traz;
   * viaja junto da linha porque é propriedade da variante.
   */
  priceSet: number | null
  stock: number
  isActive: boolean
  /** Valores normalizados das especificações por campo importado. */
  selections: Record<string, string>
  /** Imagens pedidas por esta linha (todas pertencem a ESTE produto). */
  images: Array<{
    url: string
    finish: string | null
  }>
  /**
   * Aplicações de veículo declaradas na linha (suspensão/exterior).
   * São compatibilidades ao nível do produto.
   */
  compatibilities: Array<{
    make: string
    model: string
    generation: string
    engine: string
    yearFrom: number | null
    yearTo: number | null
  }>
  specifications: Array<{
    key: string
    label: string
    value: string
    unit: string | null
    position: number
  }>
}

export type ImportPreviewVariant = {
  /** Número da linha no ficheiro (para edits de SKU). */
  rowNumber: number
  sku: string
  /** O SKU foi gerado automaticamente (indicador no preview). */
  skuGenerated: boolean
  /** SKU dado pelo fornecedor, para o admin conferir. */
  supplierSku: string
  status: 'create' | 'update'
  /**
   * O SKU gerado colide com uma variante diferente já existente —
   * o commit resolve com sufixo único e isto fica sinalizado.
   */
  collision: boolean
  price: number
  stock: number
  selections: Record<string, string>
}

export type ImportPreviewProduct = {
  groupKey: string
  name: string
  brand: string
  category: string
  status: 'create' | 'update'
  variants: ImportPreviewVariant[]
  images: Array<{
    url: string
    finish: string | null
  }>
}

export type ImportPreview = {
  profile: ImportProfile
  mode: ImportMode
  skuStrategy: SkuStrategy
  productsToCreate: number
  productsToUpdate: number
  variantsToCreate: number
  variantsToUpdate: number
  generatedSkus: number
  matchedSkus: number
  collisions: number
  /** Imagens (dedupe finish+URL) que o import vai criar. */
  imagesToCreate: number
  products: ImportPreviewProduct[]
  errors: ImportRowError[]
  warnings: ImportWarning[]
  totalRows: number
}

export type ImportCommitResult = {
  id: string
  status: 'success' | 'failed' | 'partial'
  createdProducts: number
  updatedProducts: number
  createdVariants: number
  updatedVariants: number
  errorCount: number
  /** SKUs gerados automaticamente neste import. */
  generatedSkus: number
  /** Colisões resolvidas com sufixo único. */
  collisions: number
  /** Imagens novas criadas neste import. */
  createdImages: number
  /** Imagens já existentes e reutilizadas (dedupe). */
  matchedImages: number
  errors: ImportRowError[]
  warnings: ImportWarning[]
}

export type { ImportField, SkuStrategy }
