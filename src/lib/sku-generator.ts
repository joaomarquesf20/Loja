/**
 * Gerador de SKUs internos para o importador (e reutilizável noutros
 * fluxos). O objetivo: o admin não inventa SKUs à mão; a loja recebe
 * identificadores legíveis, determinísticos e estáveis.
 *
 * Formato para jantes:
 *   MANUFACTURER-MODEL-DIAMETER-WIDTH-PCD-ET-FINISH
 *   VEE-MFZ7-19-85-5X120-ET30-GB
 *
 * O SKU interno é o identificador estável da loja. A referência do
 * fornecedor (supplierSku) é guardada em separado e NUNCA substitui
 * o SKU interno de uma variante já criada.
 */

/** Abreviaturas canónicas de acabamentos/coros (pt/en). */
const FINISH_ABBREVIATIONS: Array<{
  pattern: RegExp
  abbreviation: string
}> = [
  { pattern: /^gloss\s*black$/i, abbreviation: 'GB' },
  { pattern: /^satin\s*black$/i, abbreviation: 'SB' },
  { pattern: /^matte\s*black$/i, abbreviation: 'MB' },
  { pattern: /^black$/i, abbreviation: 'BLK' },
  { pattern: /^silver(\s*machined)?$/i, abbreviation: 'SIL' },
  { pattern: /^silver\s*polished$/i, abbreviation: 'SILP' },
  { pattern: /^white$/i, abbreviation: 'WHT' },
  { pattern: /^bronze$/i, abbreviation: 'BRZ' },
  { pattern: /^brass$/i, abbreviation: 'BRS' },
  { pattern: /^gold$/i, abbreviation: 'GLD' },
  { pattern: /^copper$/i, abbreviation: 'CPR' },
  { pattern: /^graphite$/i, abbreviation: 'GRF' },
  { pattern: /^gunmetal(lic)?$/i, abbreviation: 'GM' },
  { pattern: /^anthracite$/i, abbreviation: 'ANT' },
  { pattern: /^grey$|^gray$/i, abbreviation: 'GRY' },
  { pattern: /^blue$/i, abbreviation: 'BLU' },
  { pattern: /^red$/i, abbreviation: 'RED' },
  { pattern: /^green$/i, abbreviation: 'GRN' },
  { pattern: /^orange$/i, abbreviation: 'ORG' },
  { pattern: /^matt?e$/i, abbreviation: 'MAT' },
  { pattern: /^gloss$/i, abbreviation: 'GLS' },
  { pattern: /^hyper\s*silver$/i, abbreviation: 'HS' },
  {
    pattern: /^diamond\s*cut(\s*face)?$/i,
    abbreviation: 'DC',
  },
  {
    pattern: /^shadow\s*chrome$/i,
    abbreviation: 'SC',
  },
  { pattern: /^chrome$/i, abbreviation: 'CHR' },
]

/**
 * Normaliza a largura para o formato de SKU: "8.5J"/"8,5" → 85
 * (meio-polegar ×10, sem separador decimal nem unidade J).
 */
export function normalizeSkuWidthPart(
  value: string,
): string {
  const withoutUnit = value
    .trim()
    .replace(/\s*J$/i, '')
    .replace(',', '.')

  const parsed = Number.parseFloat(withoutUnit)

  if (Number.isNaN(parsed)) {
    return sanitizeSkuToken(value)
  }

  // 8.5 → 85; 9 → 90; 8.25 → 825 (×10 elimina o decimal).
  return String(Math.round(parsed * 10))
}

/**
 * Normaliza o diâmetro: "19\"" → 19, "18,5" → 185 (×10 só
 * quando há parte decimal).
 */
export function normalizeSkuDiameterPart(
  value: string,
): string {
  const withoutInches = value
    .trim()
    .replace(/\s*(?:"|”|”|pol\.?|in\.?)$/i, '')
    .replace(',', '.')

  const parsed = Number.parseFloat(withoutInches)

  if (Number.isNaN(parsed)) {
    return sanitizeSkuToken(value)
  }

  return Number.isInteger(parsed)
    ? String(parsed)
    : String(Math.round(parsed * 10))
}

/**
 * Normaliza o PCD: "5x120" → 5X120 (maiúsculas, sem espaços).
 */
export function normalizeSkuPcdPart(
  value: string,
): string {
  const compact = value.trim().replace(/\s+/g, '')

  const match = compact.match(
    /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i,
  )

  if (match) {
    const first = match[1].replace(',', '.')
    const second = match[2].replace(',', '.')

    return `${first}X${second}`
  }

  return sanitizeSkuToken(compact)
}

/** "ET30"/"30" → ET30; preserva offsets negativos. */
export function normalizeSkuOffsetPart(
  value: string,
): string {
  const compact = value.trim().replace(/\s+/g, '')
  const withoutPrefix = compact.replace(/^ET/i, '')

  const parsed = Number.parseFloat(
    withoutPrefix.replace(',', '.'),
  )

  if (Number.isNaN(parsed)) {
    return sanitizeSkuToken(compact)
  }

  return `ET${parsed}`
}

/**
 * Abrevia acabamentos conhecidos (Gloss Black → GB) e, para
 * valores desconhecidos, usa as iniciais (Fancy Blue → FB) —
 * sempre determinístico.
 */
export function normalizeSkuFinishPart(
  value: string,
): string {
  const trimmed = value.trim()

  for (const entry of FINISH_ABBREVIATIONS) {
    if (entry.pattern.test(trimmed)) {
      return entry.abbreviation
    }
  }

  const words = trimmed
    .split(/[\s/\\-]+/)
    .filter(Boolean)

  if (words.length >= 2) {
    return sanitizeSkuToken(
      words
        .map((word) => word.charAt(0))
        .join(''),
    ).toUpperCase()
  }

  return sanitizeSkuToken(trimmed).toUpperCase()
}

/**
 * Mantém apenas caracteres seguros para SKU: A-Z 0-9 e hífen.
 */
export function sanitizeSkuToken(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type GeneratedSkuInput = {
  /** Nome do produto (ex.: "Veemann MF-Z7") ou código de modelo. */
  productName: string
  /** Fabricante, usado como marca quando o nome não a contém. */
  brand?: string
  /** Especificações da variante (formato canónico da loja). */
  selections: Record<string, string>
}

/**
 * Gera o SKU base (sem sufixo de colisão): determinístico para os
 * mesmos dados de entrada, legível e normalizado.
 *
 *   Veemann MF-Z7 + 19"/8.5J/5x120/ET30/66.6mm/Gloss Black
 *   → VEE-MFZ7-19-85-5X120-ET30-66.6MM-GB
 */
export function generateImportSku({
  productName,
  brand,
  selections,
}: GeneratedSkuInput): string {
  const parts: string[] = []

  const nameParts = productName
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  let manufacturer: string
  let model: string

  if (nameParts.length > 1) {
    // "Veemann MF-Z7" → marca + modelo.
    manufacturer = nameParts[0]
    model = nameParts.slice(1).join('')
  } else if (
    nameParts.length === 1 &&
    nameParts[0].includes('-')
  ) {
    // Nome por código: "VMF-MFZ7" → VMF + MFZ7.
    const hyphenIndex = nameParts[0].indexOf('-')

    manufacturer = nameParts[0].slice(0, hyphenIndex)
    model = nameParts[0].slice(hyphenIndex + 1)
  } else if (brand?.trim()) {
    // Nome é só o modelo; a marca vem da coluna Manufacturer.
    manufacturer = brand.trim()
    model = nameParts[0] ?? ''
  } else {
    manufacturer = nameParts[0] ?? ''
    model = ''
  }

  if (manufacturer) {
    // Marca abreviada (Veemann → VEE), como no formato de
    // referência; marcas curtas ficam intactas (BBS, JR, ENKEI
    // → ENK só se > 4 caracteres... ENKEI(5) → ENK).
    parts.push(
      (
        manufacturer.length > 4
          ? manufacturer.slice(0, 3)
          : manufacturer
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12),
    )
  }

  if (model) {
    // Modelo compacto, sem hífens/espaços: MF-Z7 → MFZ7.
    parts.push(
      model
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, 16),
    )
  }

  if (selections.diameter) {
    parts.push(
      normalizeSkuDiameterPart(
        selections.diameter,
      ).slice(0, 8),
    )
  }

  if (selections.width) {
    parts.push(
      normalizeSkuWidthPart(
        selections.width,
      ).slice(0, 8),
    )
  }

  if (selections.pcd) {
    parts.push(
      normalizeSkuPcdPart(selections.pcd).slice(
        0,
        16,
      ),
    )
  }

  if (selections.offset) {
    parts.push(
      normalizeSkuOffsetPart(
        selections.offset,
      ).slice(0, 10),
    )
  }

  if (selections.centreBore) {
    // CB no formato compacto: 66.6 mm → 66.6MM (ponto decimal
    // preservado para legibilidade).
    const bore = selections.centreBore
      .replace(/\s*mm\.?$/i, '')
      .replace(/[^A-Za-z0-9.]/g, '')
      .toUpperCase()
      .slice(0, 10)

    if (bore) {
      parts.push(`${bore}MM`)
    }
  }

  for (const key of [
    'frontDropMm',
    'rearDropMm',
  ] as const) {
    const value = selections[key]

    if (value) {
      parts.push(
        `${key === 'frontDropMm' ? 'FD' : 'RD'}${sanitizeSkuToken(
          value.replace(/\s*mm\.?$/i, ''),
        )}`.slice(0, 12),
      )
    }
  }

  if (selections.finish) {
    parts.push(
      normalizeSkuFinishPart(
        selections.finish,
      ).slice(0, 20),
    )
  }

  const filtered = parts.filter(Boolean)

  if (filtered.length === 0) {
    return 'SKU'
  }

  return filtered.join('-').slice(0, 96)
}

/**
 * Sufixo determinístico para colisões (ex.: -A7K2): derivado do
 * SKU + identidade da variante. 4 caracteres de 32 símbolos =
 * ~1M combinações; colisões de colisão são improváveis e mesmo
 * assim resolvidas com um contador.
 */
const SUFFIX_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function collisionSuffix(
  baseSku: string,
  identity: string,
): string {
  const input = `${baseSku}\u0000${identity}`

  // FNV-1a de 32 bits — suficiente e sem dependências.
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  let value = hash >>> 0
  let suffix = ''

  for (let index = 0; index < 4; index += 1) {
    suffix =
      SUFFIX_ALPHABET[value % SUFFIX_ALPHABET.length] +
      suffix
    value = Math.floor(value / SUFFIX_ALPHABET.length)
  }

  return suffix
}

/**
 * Junta sufixo de colisão ao SKU respeitando o limite de 100
 * caracteres (constraint real da coluna).
 */
export function appendSkuSuffix(
  sku: string,
  suffix: string,
): string {
  const delimiter = '-'
  const maxSku = 100
  const extra = delimiter.length + suffix.length

  const base =
    sku.length + extra > maxSku
      ? sku.slice(0, maxSku - extra).replace(/-+$/, '')
      : sku

  return `${base}${delimiter}${suffix}`
}
