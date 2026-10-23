/**
 * Utilitários puros de importação de catálogo: parsing de CSV,
 * detecção automática de colunas e normalização de valores de jante.
 * Sem dependências de servidor — testável isoladamente.
 */

export type ParsedCsv = {
  headers: string[]
  /** Linhas como mapa coluna → valor (células em branco viram ''). */
  rows: Array<Record<string, string>>
}

/**
 * Parser CSV tolerante: deteta vírgula, ponto e vírgula ou tabulação
 * como separador, suporta campos entre aspas com separadores dentro,
 * aspas duplicadas escapadas e quebras de linha CRLF/LF.
 */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '')

  const delimiter = detectDelimiter(clean)
  const rows: string[][] = []
  let currentField = ''
  let currentRow: string[] = []
  let insideQuotes = false

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index]

    if (insideQuotes) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          currentField += '"'
          index += 1
        } else {
          insideQuotes = false
        }
      } else {
        currentField += char
      }

      continue
    }

    if (char === '"') {
      insideQuotes = true
      continue
    }

    if (char === delimiter) {
      currentRow.push(currentField)
      currentField = ''
      continue
    }

    if (char === '\r') {
      continue
    }

    if (char === '\n') {
      currentRow.push(currentField)
      currentField = ''
      rows.push(currentRow)
      currentRow = []
      continue
    }

    currentField += char
  }

  // Última linha sem quebra final.
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  const nonEmptyRows = rows.filter(
    (row) => row.some((cell) => cell.trim() !== ''),
  )

  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = nonEmptyRows[0].map((header) =>
    header.trim(),
  )

  const parsedRows = nonEmptyRows
    .slice(1)
    .map((row) => {
      const record: Record<string, string> = {}

      headers.forEach((header, cellIndex) => {
        record[header] = row[cellIndex]?.trim() ?? ''
      })

      return record
    })

  return { headers, rows: parsedRows }
}

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 4000)
  const candidates = [',', ';', '\t', '|']

  let best = ','
  let bestCount = -1

  for (const candidate of candidates) {
    const count = sample
      .split('\n')[0]
      .split(candidate).length

    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

/**
 * Campos que o importador compreende, com a lista de cabeçalhos que
 * reconhece automaticamente (comparação normalizada: sem acentos,
 * maiúsculas/minúsculas e separadores irrelevantes).
 */
export const IMPORT_FIELDS = [
  'productCode',
  'productName',
  'brand',
  'category',
  'description',
  'diameter',
  'width',
  'pcd',
  'offset',
  'centreBore',
  'finish',
  'generalImage',
  'finishImage',
  'vehicleMake',
  'vehicleModel',
  'vehicleGeneration',
  'vehicleEngine',
  'yearFrom',
  'yearTo',
  'frontDropMm',
  'rearDropMm',
  'productType',
  'sku',
  'price',
  'priceSet',
  'stock',
  'isActive',
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

const FIELD_ALIASES: Record<ImportField, string[]> = {
  productCode: [
    'productcode',
    'product code',
    'modelcode',
    'model code',
    'codigoproduto',
    'codigo produto',
    'codigo',
    'codigo modelo',
    'modelo codigo',
    'sku produto',
    'produtocode',
    'ref modelo',
  ],
  productName: [
    'product',
    'productname',
    'product name',
    'nome',
    'nomeproduto',
    'nome produto',
    'wheel name',
    'wheelname',
    'modelo',
    'designacao',
    'designação',
  ],
  brand: [
    'brand',
    'manufacturer',
    'marca',
    'fabricante',
    'manufacturerbrand',
  ],
  category: [
    'category',
    'categoria',
    'categoria produto',
    'tipo',
  ],
  description: [
    'description',
    'descricao',
    'descrição',
    'desc',
  ],
  diameter: [
    'diameter',
    'diametro',
    'diâmetro',
    'diam',
    'size',
    'tamanho aro',
    'aro',
    'rim',
  ],
  width: [
    'width',
    'largura',
    'larg',
    'j width',
  ],
  pcd: [
    'pcd',
    'bolt pattern',
    'boltpattern',
    'furacao',
    'furação',
    'padrao parafusos',
    'padrão de parafusos',
    'stud pattern',
  ],
  offset: [
    'offset',
    'et',
    'et offset',
    'offset et',
    'convergencia',
    'convergência',
  ],
  centreBore: [
    'centre bore',
    'centrebore',
    'center bore',
    'cb',
    'furo central',
    'furo',
    'hub',
    'hub bore',
  ],
  finish: [
    'finish',
    'colour',
    'color',
    'cor',
    'acabamento',
    'colour finish',
    'color finish',
  ],
  generalImage: [
    'generalimage',
    'general image',
    'imagem geral',
    'image',
    'imagem',
    'img',
    'imageurl',
    'image url',
    'foto',
    'imagegeral',
    'imagegeralurl',
    'image geral url',
    'imagem geral url',
    'imagemgeral',
    'imagemgeralurl',
    'generalimageurl',
    'general image url',
  ],
  finishImage: [
    'finishimage',
    'finish image',
    'imagem acabamento',
    'imagem cor',
    'colour image',
    'color image',
    'imageacabamento',
    'imageacabamentourl',
    'image acabamento url',
    'imagem acabamento url',
    'imagemacabamento',
    'imagemacabamentourl',
    'acabamentourl',
    'finishimageurl',
    'finish image url',
  ],
  vehicleMake: [
    'make',
    'vehicle make',
    'marca veiculo',
    'marca veículo',
    'marcaveiculo',
    'vehiclebrand',
    'vehicle brand',
    'vehiclebrandname',
  ],
  vehicleModel: [
    'model',
    'vehicle model',
    'modelo veiculo',
    'modelo veículo',
    'modeloveiculo',
    'vehicle model name',
    'vehiclemodel',
    'vehiclemodelname',
  ],
  vehicleGeneration: [
    'generation',
    'vehicle generation',
    'geracao',
    'geração',
    'geracao chassis',
    'geracaochassis',
    'chassis',
    'platform',
    'plataforma',
  ],
  vehicleEngine: [
    'engine',
    'engine code',
    'motor',
    'codigo motor',
    'código motor',
    'motor codigo',
    'motorcodigo',
    'enginecode',
  ],
  yearFrom: [
    'year from',
    'yearfrom',
    'ano inicio',
    'ano início',
    'anoinicial',
    'ano inicial',
    'de ano',
    'ano de',
  ],
  yearTo: [
    'year to',
    'yearto',
    'ano fim',
    'ate ano',
    'até ano',
    'ano até',
    'anofinal',
    'ano final',
    'ano ate',
  ],
  frontDropMm: [
    'front drop',
    'frontdrop',
    'front drop mm',
    'rebaixo dianteiro',
    'front lowering',
  ],
  rearDropMm: [
    'rear drop',
    'reardrop',
    'rear drop mm',
    'rebaixo traseiro',
    'rear lowering',
  ],
  productType: [
    'product type',
    'producttype',
    'tipo produto',
    'type',
    'tipo de produto',
    // "TipoProduto" normaliza para "tipoproduto".
    'tipoproduto',
  ],
  sku: [
    'sku',
    'reference',
    'referencia',
    'referência',
    'ref',
    'codigo variante',
    'part number',
    'partnumber',
  ],
  price: [
    'price',
    'preco',
    'preço',
    'preco unitario',
    'preço unitário',
    'pvp',
    'preco unitario jante',
    'preço unitário jante',
    'custo',
  ],
  priceSet: [
    'precoconjunto4',
    'preço conjunto 4',
    'preco conjunto 4',
    'precoconjunto',
    'preço conjunto',
    'preco conjunto',
    'set of 4 price',
    'set price',
    'setprice',
  ],
  stock: [
    'stock',
    'qty',
    'quantity',
    'quantidade',
    'qtd',
    'estoque',
    'inventario',
    'inventário',
    // Cabeçalhos de teste/etiqueta do fornecedor:
    // "Stock_Teste" normaliza para "stock teste".
    'stock teste',
    'stock test',
  ],
  isActive: [
    'active',
    'isactive',
    'is active',
    'ativo',
    'activo',
    'status',
    'estado',
  ],
}

/**
 * Normaliza um cabeçalho para comparação: minúsculas, sem acentos,
 * separadores (espaço, hífen, underscore) colapsados.
 */
export function normalizeHeaderKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Deteta automaticamente o mapeamento coluna → campo a partir dos
 * cabeçalhos do ficheiro. Devolve também as colunas não reconhecidas
 * para o admin mapear manualmente.
 */
export function detectColumnMapping(
  headers: string[],
): {
  mapping: Partial<Record<ImportField, string>>
  unmappedColumns: string[]
} {
  const mapping: Partial<
    Record<ImportField, string>
  > = {}
  const used = new Set<string>()

  for (const header of headers) {
    const normalized =
      normalizeHeaderKey(header)

    let matched: ImportField | undefined

    for (const field of IMPORT_FIELDS) {
      if (mapping[field]) {
        continue
      }

      const aliases =
        FIELD_ALIASES[field]

      if (aliases.includes(normalized)) {
        matched = field
        break
      }
    }

    if (matched) {
      mapping[matched] = header
      used.add(header)
    }
  }

  const unmappedColumns = headers.filter(
    (header) => !used.has(header),
  )

  return { mapping, unmappedColumns }
}

export const WHEEL_IMPORT_FIELDS: ImportField[] = [
  'productCode',
  'productName',
  'brand',
  'category',
  'description',
  'diameter',
  'width',
  'pcd',
  'offset',
  'centreBore',
  'finish',
  'generalImage',
  'finishImage',
  'sku',
  'price',
  'stock',
  'isActive',
]

export const SUSPENSION_IMPORT_FIELDS: ImportField[] = [
  'productCode',
  'productName',
  'brand',
  'category',
  'description',
  'vehicleMake',
  'vehicleModel',
  'vehicleGeneration',
  'vehicleEngine',
  'yearFrom',
  'yearTo',
  'frontDropMm',
  'rearDropMm',
  'sku',
  'price',
  'stock',
  'isActive',
]

export const EXTERIOR_IMPORT_FIELDS: ImportField[] = [
  'productCode',
  'productName',
  'brand',
  'category',
  'description',
  'vehicleMake',
  'vehicleModel',
  'vehicleGeneration',
  'productType',
  'sku',
  'price',
  'stock',
  'isActive',
]

export const GENERIC_IMPORT_FIELDS: ImportField[] = [
  'productCode',
  'productName',
  'brand',
  'category',
  'description',
  'sku',
  'price',
  'stock',
  'isActive',
]

/**
 * Campos obrigatórios por perfil. Sem eles a linha é inválida
 * (nunca é importada em silêncio).
 */
export const REQUIRED_FIELDS_BY_PROFILE: Record<
  'wheels' | 'suspension' | 'exterior' | 'generic',
  ImportField[]
> = {
  // SKU não é obrigatório: sem referência no ficheiro, o SKU
  // interno é gerado automaticamente (estratégia "auto").
  wheels: [
    'productName',
    'price',
    'diameter',
    'width',
    'pcd',
    'offset',
    'centreBore',
    'finish',
  ],
  suspension: [
    'productName',
    'price',
    'vehicleMake',
    'vehicleModel',
    'frontDropMm',
    'rearDropMm',
  ],
  exterior: [
    'productName',
    'price',
    'productType',
  ],
  generic: ['productName', 'price'],
}

/**
 * Como o SKU interno de cada variante é obtido:
 * - "auto": gerado a partir dos dados do produto/variante
 *   (comportamento por defeito — o admin não inventa SKUs à mão).
 * - "supplier": usar a referência do fornecedor como SKU interno.
 * - "custom": o admin mapeou/editou SKUs manualmente (continuam a
 *   passar por validação de unicidade no servidor).
 */
export const SKU_STRATEGIES = [
  'auto',
  'supplier',
  'custom',
] as const

export type SkuStrategy =
  (typeof SKU_STRATEGIES)[number]

/**
 * Modo de falha do commit:
 * - "abort": qualquer produto com erro aborta o import inteiro
 *   (nada é escrito).
 * - "partial": o admin escolhe explicitamente importar os produtos
 *   válidos e registar os falhados no histórico.
 */
export const FAILURE_MODES = [
  'abort',
  'partial',
] as const

export type FailureMode =
  (typeof FAILURE_MODES)[number]

/**
 * Campos de seleção do ficheiro (ImportField) → códigos de opção
 * usados pela loja (ProductOption.code). Partilhado entre motor
 * (identidade de variantes) e serviço (matching na base de dados).
 */
export const FIELD_TO_OPTION_CODE: Record<
  string,
  string
> = {
  diameter: 'diameter',
  width: 'width',
  pcd: 'pcd',
  offset: 'offset',
  centreBore: 'centre_bore',
  finish: 'finish',
  frontDropMm: 'front_drop_mm',
  rearDropMm: 'rear_drop_mm',
  productType: 'productType',
}

export type SplitCompatibilityPart = {
  text: string
  isChassis: boolean
}

function isChassisToken(text: string): boolean {
  // G20, G21, F44, Mk2, GB, 8V, 127... códigos curtos de
  // chassis/geração sem palavras dentro.
  return /^(?:mk|[a-z]\d{1,2}|\d{2,3})[a-z0-9]*$/i.test(
    text,
  )
}

/**
 * Divide valores agrupados de compatibilidade por veículo que os
 * fornecedores usam só para efeitos de apresentação:
 * - gerações/chassis: "G22/G23", "G23 / G83", "G20; G21"
 * - modelos: "Q5 / SQ5", "Série 4 / M4"
 * Cada parte é uma entidade própria (VehicleGeneration ou
 * VehicleModel) — nunca uma única string "falsa" que esconde
 * várias aplicações. Textos sem separadores ("Mk2 Facelift",
 * "G20") ficam inteiros.
 */
export function splitCompatibilityValue(
  value: string,
): SplitCompatibilityPart[] {
  const parts = value
    .split(/\s*[/;|,]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length <= 1) {
    return [
      { text: value.trim(), isChassis: false },
    ]
  }

  return parts.map((part) => ({
    text: part,
    isChassis: isChassisToken(part),
  }))
}

/**
 * Normalizações pedidas para valores de jante — tolerantes com a
 * formatação dos fornecedores:
 * - diâmetro: 19 / 19" / 19,pol → 19
 * - largura: 8.5 / 8,5J / 8.5J → 8.5
 * - PCD: 5X120 / 5x120 → 5x120
 * - ET: 30 / ET30 → 30
 * - CB: 66,6 / 66.6 mm / 66.6mm → 66.6
 */
export function normalizeImportNumber(
  value: string,
): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(',', '.')

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeImportWheelValue(
  field: ImportField,
  value: string,
): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  switch (field) {
    case 'diameter': {
      const withoutInches = trimmed.replace(
        /\s*(?:["”“]|pol\.?|in\.?)$/i,
        '',
      )
      const parsed =
        normalizeImportNumber(withoutInches)
      // Formato canónico: 19" (igual ao editor manual).
      return parsed === null
        ? trimmed
        : `${parsed}"`
    }

    case 'width': {
      const withoutUnit = trimmed.replace(
        /\s*J$/i,
        '',
      )
      const parsed =
        normalizeImportNumber(withoutUnit)
      // Formato canónico: 8.5J (igual ao editor manual).
      return parsed === null
        ? trimmed
        : `${parsed}J`
    }

    case 'pcd': {
      // 5X120 → 5x120 (o separador fica em minúscula,
      // números intactos).
      const match = trimmed.match(
        /^(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i,
      )

      if (match) {
        const second = match[2].replace(',', '.')

        return `${match[1]}x${second}`
      }

      return trimmed
    }

    case 'offset': {
      const withoutPrefix = trimmed.replace(
        /^ET\s*/i,
        '',
      )
      const parsed =
        normalizeImportNumber(withoutPrefix)
      // Formato canónico: ET30 (igual ao editor manual).
      return parsed === null
        ? trimmed
        : `ET${parsed}`
    }

    case 'centreBore': {
      const withoutUnit = trimmed.replace(
        /\s*mm\.?$/i,
        '',
      )
      const parsed =
        normalizeImportNumber(withoutUnit)
      // Formato canónico: 66.6 mm (igual ao editor manual).
      return parsed === null
        ? trimmed
        : `${parsed} mm`
    }

    default:
      return trimmed
  }
}

/**
 * Normaliza um preço: aceita vírgula decimal e separadores de
 * milhares comuns ("1.234,56", "1,234.56", "299,90", "299.90").
 */
export function normalizeImportPrice(
  value: string,
): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  let normalized = trimmed.replace(/\s|€|R\$/g, '')

  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')

  if (hasComma && hasDot) {
    // O último separador é o decimal.
    if (
      normalized.lastIndexOf(',') >
      normalized.lastIndexOf('.')
    ) {
      normalized = normalized.replace(/\./g, '')
      normalized = normalized.replace(',', '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Vírgula pode ser decimal (299,90) ou de milhares
    // (1,234) — decide pela casa decimal seguinte.
    const parts = normalized.split(',')

    if (
      parts.length === 2 &&
      parts[1].length === 3 &&
      /^\d+$/.test(parts[1])
    ) {
      normalized = normalized.replace(/,/g, '')
    } else {
      normalized = normalized.replace(/,/g, '.')
    }
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeImportBoolean(
  value: string,
): boolean {
  const normalized = normalizeHeaderKey(value)

  if (
    ['false', '0', 'no', 'nao', 'inativo', ''].includes(
      normalized,
    )
  ) {
    return false
  }

  return true
}
