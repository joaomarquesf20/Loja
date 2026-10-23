import {
  describe,
  expect,
  test,
} from 'vitest'
import {
  buildImportPreview,
  buildRowInputs,
  buildVariantCombinationKey,
} from './catalog-import-engine'
import {
  detectColumnMapping,
  normalizeImportNumber,
  normalizeImportPrice,
  normalizeImportWheelValue,
  parseCsv,
  splitCompatibilityValue,
} from '@/lib/catalog-import'
import type {
  ImportMode,
  ImportProfile,
  SkuStrategy,
} from './catalog-import-types'

function buildCsv(rows: string[]) {
  return [
    'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;Stock',
    ...rows,
  ].join('\n')
}

function makeParsed(
  rows: string[],
  options?: {
    skuStrategy?: SkuStrategy
  },
) {
  const csv = parseCsv(buildCsv(rows))
  const { mapping } =
    detectColumnMapping(csv.headers)

  return buildRowInputs({
    rows: csv.rows,
    mapping,
    categoryProfile: 'wheels',
    skuStrategy: options?.skuStrategy,
  })
}

function makePreview(
  rows: string[],
  options?: {
    /**
     * Variantes já na BD: SKU → identidade (produto +
     * especificações) para classificar update vs colisão.
     */
    dbVariants?: Record<
      string,
      {
        productCode: string
        combinationKey: string
      }
    >
    /** O mesmo, indexado por referência do fornecedor. */
    dbVariantsBySupplierSku?: Record<
      string,
      {
        productCode: string
        combinationKey: string
      }
    >
    existingProductCodes?: string[]
    mode?: ImportMode
    profile?: ImportProfile
  },
) {
  const parsed = makeParsed(rows)

  return buildImportPreview({
    parsed,
    profile: options?.profile ?? 'wheels',
    mode: options?.mode ?? 'create-update',
    dbVariantsBySku: new Map(
      Object.entries(options?.dbVariants ?? {}).map(
        ([sku, identity]) => [
          sku,
          { sku, ...identity },
        ],
      ),
    ),
    dbVariantsBySupplierSku: new Map(
      Object.entries(
        options?.dbVariantsBySupplierSku ?? {},
      ).map(([supplierSku, identity]) => [
        supplierSku,
        {
          sku: `internal-for-${supplierSku}`,
          ...identity,
        },
      ]),
    ),
    existingProductCodes: new Set(
      options?.existingProductCodes ?? [],
    ),
  })
}

/** Combinação canónica usada nos ficheiros de teste. */
const COMBO = buildVariantCombinationKey({
  centreBore: '66.6 mm',
  diameter: '19"',
  finish: 'Silver',
  offset: 'ET30',
  pcd: '5x120',
  width: '8.5J',
})

describe('catalog import normalization', () => {
  test('normaliza formatos mistos de jante', () => {
    expect(
      normalizeImportWheelValue(
        'diameter',
        '19"',
      ),
    ).toBe('19"')
    expect(
      normalizeImportWheelValue(
        'diameter',
        '19',
      ),
    ).toBe('19"')
    expect(
      normalizeImportWheelValue(
        'width',
        '8,5J',
      ),
    ).toBe('8.5J')
    expect(
      normalizeImportWheelValue('width', '8.5J'),
    ).toBe('8.5J')
    expect(
      normalizeImportWheelValue('pcd', '5X120'),
    ).toBe('5x120')
    expect(
      normalizeImportWheelValue('offset', 'ET30'),
    ).toBe('ET30')
    expect(
      normalizeImportWheelValue('offset', '30'),
    ).toBe('ET30')
    expect(
      normalizeImportWheelValue(
        'centreBore',
        '66,6 mm',
      ),
    ).toBe('66.6 mm')
    expect(
      normalizeImportWheelValue(
        'centreBore',
        '66.6mm',
      ),
    ).toBe('66.6 mm')
  })

  test('aceita preços com vírgula e separadores de milhares', () => {
    expect(normalizeImportPrice('299,90')).toBe(
      299.9,
    )
    expect(normalizeImportPrice('299.90')).toBe(
      299.9,
    )
    expect(normalizeImportPrice('1.234,56')).toBe(
      1234.56,
    )
    expect(normalizeImportPrice('1,234.56')).toBe(
      1234.56,
    )
    expect(normalizeImportPrice('299,90 €')).toBe(
      299.9,
    )
  })

  test('números simples normalizam e lixo devolve null', () => {
    expect(normalizeImportNumber(' 4 ')).toBe(4)
    expect(normalizeImportNumber('abc')).toBeNull()
    expect(
      normalizeImportPrice('caro'),
    ).toBeNull()
  })
})

describe('splitCompatibilityValue (valores agrupados de veículo)', () => {
  test('separa gerações/chassis curtos "G22/G23" em entidades distintas', () => {
    expect(splitCompatibilityValue('G22/G23')).toEqual([
      { text: 'G22', isChassis: true },
      { text: 'G23', isChassis: true },
    ])
    expect(splitCompatibilityValue('G23 / G83')).toEqual([
      { text: 'G23', isChassis: true },
      { text: 'G83', isChassis: true },
    ])
  })

  test('separa modelos agrupados: "Q5 / SQ5" e "Série 4 / M4" são relações distintas', () => {
    // O flag isChassis é informativo (formato de código curto);
    // o que interessa é CADA parte virar a sua própria relação.
    expect(splitCompatibilityValue('Q5 / SQ5')).toEqual([
      { text: 'Q5', isChassis: expect.any(Boolean) },
      { text: 'SQ5', isChassis: expect.any(Boolean) },
    ])
    expect(
      splitCompatibilityValue('Série 4 / M4'),
    ).toEqual([
      { text: 'Série 4', isChassis: false },
      { text: 'M4', isChassis: expect.any(Boolean) },
    ])
  })

  test('texto simples e valores vazios ficam intactos', () => {
    expect(splitCompatibilityValue('Mk2 Facelift')).toEqual([
      { text: 'Mk2 Facelift', isChassis: false },
    ])
    expect(splitCompatibilityValue('')).toEqual([
      { text: '', isChassis: false },
    ])
  })
})

describe('catalog import column detection', () => {
  test('deteta cabeçalhos do CSV Maxton (Stock_Teste, MarcaVeiculo, TipoProduto...)', () => {
    const csv = parseCsv(
      [
        'ProductCode;NomeProduto;Fabricante;Categoria;MarcaVeiculo;ModeloVeiculo;GeracaoChassis;MotorCodigo;AnoInicial;AnoFinal;TipoProduto;Preco;Stock_Teste;Ativo',
        'BM-1;Splitter;Maxton Design;Exterior;BMW;Série 4;G22/G23;;2020;2024;Splitter frontal;199.0;6;True',
      ].join('\n'),
    )
    const { mapping } =
      detectColumnMapping(csv.headers)

    expect(mapping.productCode).toBe('ProductCode')
    expect(mapping.productName).toBe('NomeProduto')
    expect(mapping.brand).toBe('Fabricante')
    expect(mapping.category).toBe('Categoria')
    expect(mapping.vehicleMake).toBe('MarcaVeiculo')
    expect(mapping.vehicleModel).toBe('ModeloVeiculo')
    expect(mapping.vehicleGeneration).toBe(
      'GeracaoChassis',
    )
    expect(mapping.vehicleEngine).toBe('MotorCodigo')
    expect(mapping.yearFrom).toBe('AnoInicial')
    expect(mapping.yearTo).toBe('AnoFinal')
    expect(mapping.productType).toBe('TipoProduto')
    expect(mapping.price).toBe('Preco')
    expect(mapping.stock).toBe('Stock_Teste')
    expect(mapping.isActive).toBe('Ativo')
  })

  test('deteta colunas com nomes comuns pt/en', () => {
    const csv = parseCsv(
      'Wheel Name;Manufacturer;PCD;Colour;Qty;Price\nX;Y;5x120;Preto;1;9,9',
    )
    const { mapping, unmappedColumns } =
      detectColumnMapping(csv.headers)

    expect(mapping.productName).toBe('Wheel Name')
    expect(mapping.brand).toBe('Manufacturer')
    expect(mapping.pcd).toBe('PCD')
    expect(mapping.finish).toBe('Colour')
    expect(mapping.stock).toBe('Qty')
    expect(mapping.price).toBe('Price')
    expect(unmappedColumns).toEqual([])
  })

  test('deteta PrecoConjunto4 como preço do conjunto de 4', () => {
    const csv = parseCsv(
      'Product;Preco;PrecoConjunto4;Stock\nX;299,90;1149,90;4',
    )
    const { mapping } = detectColumnMapping(
      csv.headers,
    )

    expect(mapping.price).toBe('Preco')
    expect(mapping.priceSet).toBe(
      'PrecoConjunto4',
    )
  })

  test('parser CSV suporta aspas com separador dentro e ponto e vírgula', () => {
    const csv = parseCsv(
      'Name;Description\n"Veemann; MF-Z7";"Uma jante, muito boa"',
    )

    expect(csv.rows[0].Name).toBe(
      'Veemann; MF-Z7',
    )
    expect(csv.rows[0].Description).toBe(
      'Uma jante, muito boa',
    )
  })
})

describe('catalog import grouping and preview', () => {
  test('um produto com várias variantes agrupa numa só ficha', () => {
    const preview = makePreview([
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver Machined;VMFZ7-001;299,90;4',
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Gloss Black;VMFZ7-002;309,90;6',
      'VMF-MFZ7;Veemann;Jantes;19;9.5J;5x120;40;66.6;Gloss Black;VMFZ7-003;329,90;2',
    ])

    expect(preview.errors).toEqual([])
    expect(preview.productsToCreate).toBe(1)
    expect(preview.variantsToCreate).toBe(3)

    const product = preview.products[0]

    expect(product.name).toBe('VMF-MFZ7')
    expect(product.variants).toHaveLength(3)
    expect(product.variants[0].sku).toBe(
      'VMFZ7-001',
    )
    expect(
      product.variants[0].selections.diameter,
    ).toBe('19"')
    expect(
      product.variants[0].selections.width,
    ).toBe('8.5J')
    expect(
      product.variants[0].selections.offset,
    ).toBe('ET30')
    expect(
      product.variants[0].selections.centreBore,
    ).toBe('66.6 mm')
    expect(
      product.variants[0].selections.pcd,
    ).toBe('5x120')
    expect(
      product.variants[0].selections.finish,
    ).toBe('Silver Machined')
  })

  test('vários produtos agrupam separadamente', () => {
    const preview = makePreview([
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;VMFZ7-001;299,90;4',
      'VMF-JR11;Japan Racing;Jantes;18;8J;5x112;35;66.6;Bronze;JR11-001;199,90;2',
    ])

    expect(preview.productsToCreate).toBe(2)
    expect(preview.variantsToCreate).toBe(2)
    expect(preview.products).toHaveLength(2)
  })

  test('sem productCode agrupa pelo nome do produto', () => {
    const csv = parseCsv(
      'Product;Finish;SKU;Price\nVeemann MF-Z7;Silver;A-1;99\nVeemann MF-Z7;Black;A-2;99',
    )
    const { mapping } =
      detectColumnMapping(csv.headers)

    const parsed = buildRowInputs({
      rows: csv.rows,
      mapping,
      categoryProfile: 'generic',
    })

    expect(parsed.products).toHaveLength(1)
    expect(parsed.products[0].variants).toHaveLength(
      2,
    )
  })

  test('SKU duplicado no ficheiro é erro, não import silencioso', () => {
    const preview = makePreview([
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;DUP-1;299,90;4',
      'VMF-MFZ7;Veemann;Jantes;19;9.5J;5x120;40;66.6;Silver;DUP-1;299,90;4',
    ])

    expect(
      preview.errors.some((error) =>
        error.message.includes('SKU duplicado'),
      ),
    ).toBe(true)
  })

  test('combinação duplicada de especificações é erro', () => {
    const preview = makePreview([
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;COMB-1;299,90;4',
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;COMB-2;309,90;4',
    ])

    expect(
      preview.errors.some((error) =>
        error.message.includes('Combinação'),
      ),
    ).toBe(true)
  })

  test('linha malformada gera erro com número da linha', () => {
    const preview = makePreview([
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;OK-1;299,90;4',
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;BAD-1;caro;4',
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;BAD-2;;4',
    ])

    const row3 = preview.errors.find(
      (error) => error.row === 3,
    )
    const row4 = preview.errors.find(
      (error) => error.row === 4,
    )

    expect(
      row3?.message.includes('Preço inválido'),
    ).toBe(true)
    expect(
      row4?.message.includes('Preço inválido'),
    ).toBe(true)
    expect(preview.variantsToCreate).toBe(1)
  })

  test('campo obrigatório em falta é erro explícito', () => {
    const preview = makePreview([
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;;30;66.6;Silver;MISS-1;299,90;4',
    ])

    expect(
      preview.errors.some((error) =>
        error.message.includes('obrigatório'),
      ),
    ).toBe(true)
    expect(preview.variantsToCreate).toBe(0)
  })

  test('reimport classifica SKU conhecido como update', () => {
    const preview = makePreview(
      [
        'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;VMFZ7-001;319,90;9',
      ],
      {
        dbVariants: {
          'VMFZ7-001': {
            productCode: 'VMF-MFZ7',
            combinationKey: COMBO,
          },
        },
        existingProductCodes: ['VMF-MFZ7'],
      },
    )

    expect(preview.productsToUpdate).toBe(1)
    expect(preview.variantsToUpdate).toBe(1)
    expect(preview.variantsToCreate).toBe(0)
    expect(preview.errors).toEqual([])
  })

  test('modo criar-apenas rejeita SKU existente', () => {
    const preview = makePreview(
      [
        'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;EXIST-1;299,90;4',
      ],
      {
        dbVariants: {
          'EXIST-1': {
            productCode: 'VMF-MFZ7',
            combinationKey: COMBO,
          },
        },
        mode: 'create-only',
      },
    )

    expect(
      preview.errors.some((error) =>
        error.message.includes('criar apenas'),
      ),
    ).toBe(true)
  })

  test('chave de combinação ignora maiúsculas e espaços', () => {
    expect(
      buildVariantCombinationKey({
        finish: 'Gloss Black',
        diameter: '19',
      }),
    ).toBe(
      buildVariantCombinationKey({
        diameter: '19',
        finish: 'gloss black',
      }),
    )
  })

  test('sem SKU no ficheiro, gera SKU determinístico no preview', () => {
    const parsed = makeParsed([
      'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Gloss Black;;299,90;4',
    ])

    const preview = buildImportPreview({
      parsed,
      profile: 'wheels',
      mode: 'create-update',
      existingProductCodes: new Set(),
      dbVariantsBySku: new Map(),
      dbVariantsBySupplierSku: new Map(),
    })

    expect(preview.errors).toEqual([])
    expect(preview.generatedSkus).toBe(1)
    expect(preview.collisions).toBe(0)

    const variant = preview.products[0].variants[0]

    expect(variant.skuGenerated).toBe(true)
    // Nome por código: VMF-MFZ7 → VMF + MFZ7.
    expect(variant.sku).toBe(
      'VMF-MFZ7-19-85-5X120-ET30-66.6MM-GB',
    )
  })

  test('colisão real de SKU gerado é sinalizada com sufixo no preview', () => {
    // MESMA especificação, produto DIFERENTE, mesmo SKU gerado:
    // é outra variante → colisão.
    const otherCombo = buildVariantCombinationKey({
      centreBore: '66.6 mm',
      diameter: '19"',
      finish: 'Gloss Black',
      offset: 'ET30',
      pcd: '5x120',
      width: '8.5J',
    })

    const generatedSku =
      'VMF-MFZ7-19-85-5X120-ET30-66.6MM-GB'

    const preview = makePreview(
      [
        'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Gloss Black;;299,90;4',
      ],
      {
        dbVariants: {
          [generatedSku]: {
            productCode: 'OTHER-PRODUCT',
            combinationKey: otherCombo,
          },
        },
      },
    )

    expect(preview.collisions).toBe(1)
    expect(
      preview.products[0].variants[0].collision,
    ).toBe(true)

    const finalSku =
      preview.products[0].variants[0].sku

    expect(finalSku).not.toBe(generatedSku)
    expect(finalSku).toContain(generatedSku)
  })

  test('linhas com imagem geral e imagem de acabamento entram no preview associadas ao produto', () => {
    const csv = parseCsv(
      [
        'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;Stock;ImageGeralURL;ImageAcabamentoURL',
        'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;SUP-001;299,90;4;https://cdn.sixnine-wheels.com/mfz7.jpg;https://cdn.sixnine-wheels.com/mfz7-silver.jpg',
      ].join('\n'),
    )
    const { mapping } =
      detectColumnMapping(csv.headers)

    const parsed = buildRowInputs({
      rows: csv.rows,
      mapping,
      categoryProfile: 'wheels',
    })

    expect(parsed.errors).toHaveLength(0)

    const images = parsed.products[0].images

    // Ambas as imagens pertencem a ESTE produto, e a de
    // acabamento fica associada à cor da linha.
    expect(images).toEqual([
      {
        url: 'https://cdn.sixnine-wheels.com/mfz7.jpg',
        finish: null,
      },
      {
        url: 'https://cdn.sixnine-wheels.com/mfz7-silver.jpg',
        finish: 'Silver',
      },
    ])
  })

  test('cabeçalhos SIXNINE (ImagemGeralURL/ImagemAcabamentoURL) são detetados automaticamente', () => {
    // Cabeçalhos REAIS do ficheiro SIXNINE (ortografia PT).
    const csv = parseCsv(
      [
        'ProductCode;Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Acabamento;SKU;Price;Stock;ImagemGeralURL;ImagemAcabamentoURL',
        'FF-TWO;FF-TWO;SIXNINE;Jantes;21;10J;5x112;35;66.6;HyperSilver;;399,90;2;https://sixnine-wheels.com/ff-two.jpg;https://sixnine-wheels.com/ff-two-hypersilver.jpg',
      ].join('\n'),
    )
    const { mapping, unmappedColumns } =
      detectColumnMapping(csv.headers)

    expect(mapping.productCode).toBe(
      'ProductCode',
    )
    expect(mapping.finish).toBe('Acabamento')
    expect(mapping.generalImage).toBe(
      'ImagemGeralURL',
    )
    expect(mapping.finishImage).toBe(
      'ImagemAcabamentoURL',
    )
    expect(unmappedColumns).toEqual([])

    const parsed = buildRowInputs({
      rows: csv.rows,
      mapping,
      categoryProfile: 'wheels',
    })

    expect(parsed.errors).toHaveLength(0)
    expect(
      parsed.products[0].images,
    ).toEqual([
      {
        url: 'https://sixnine-wheels.com/ff-two.jpg',
        finish: null,
      },
      {
        url: 'https://sixnine-wheels.com/ff-two-hypersilver.jpg',
        finish: 'HyperSilver',
      },
    ])
  })

  test('imagem de acabamento sem acabamento na linha é ignorada com aviso no dry-run', () => {
    // Perfil genérico: não exige acabamento, por isso é o caminho
    // realista em que uma imagem de acabamento fica órfã.
    const csv = parseCsv(
      [
        'Product;Price;ImageAcabamentoURL',
        'BOT-1;12,00;https://sixnine-wheels.com/bot-1-sem-cor.jpg',
      ].join('\n'),
    )
    const { mapping } =
      detectColumnMapping(csv.headers)

    expect(mapping.finishImage).toBe(
      'ImageAcabamentoURL',
    )

    const parsed = buildRowInputs({
      rows: csv.rows,
      mapping,
      categoryProfile: 'generic',
    })

    // Nenhuma imagem foi produzida para a linha…
    expect(parsed.products[0].images).toEqual([])

    // …mas o admin é avisado em vez de o URL desaparecer
    // em silêncio (era a causa de "Imagem em breve").
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.warnings[0]).toMatchObject({
      row: expect.any(Number),
      message: expect.stringContaining(
        'https://sixnine-wheels.com/bot-1-sem-cor.jpg',
      ),
    })
    expect(
      parsed.warnings[0].message,
    ).toContain('não indica acabamento')
  })

  test('mesma variante identificada por supplierSku faz update mantendo o SKU interno', () => {
    const preview = makePreview(
      [
        'VMF-MFZ7;Veemann;Jantes;19;8.5J;5x120;30;66.6;Silver;SUP-001;299,90;4',
      ],
      {
        dbVariantsBySupplierSku: {
          'SUP-001': {
            productCode: 'VMF-MFZ7',
            combinationKey: COMBO,
          },
        },
      },
    )

    expect(preview.variantsToUpdate).toBe(1)
    expect(preview.variantsToCreate).toBe(0)
    expect(preview.matchedSkus).toBe(1)

    // O SKU interno existente é mantido — a referência do
    // fornecedor não substitui o identificador da loja.
    expect(
      preview.products[0].variants[0].sku,
    ).toBe('internal-for-SUP-001')
  })

  test('dry-run reprova linha cujo SKU obrigatório não pode ser produzido', () => {
    // Estratégia "supplier" com ficheiro SEM referências:
    // nenhum SKU interno consegue ser produzido. O preview
    // tem de reprovar a linha ANTES do commit chegar ao Prisma
    // (em produção falhava com Null constraint violation).
    const parsed = makeParsed(
      [
        'FF-ONE;SIXNINE;Jantes;20;8.5J;5x112;45;66.6;GlossyBlack;;349,90;6',
      ],
      { skuStrategy: 'supplier' },
    )

    const preview = buildImportPreview({
      parsed,
      profile: 'wheels',
      mode: 'create-update',
      skuStrategy: 'supplier',
      existingProductCodes: new Set(),
      dbVariantsBySku: new Map(),
      dbVariantsBySupplierSku: new Map(),
    })

    expect(preview.errors).toHaveLength(1)

    const [rowError] = preview.errors

    expect(rowError.row).toBe(2)
    expect(rowError.message).toBe(
      "Campo obrigatório 'sku' não foi produzido pelo importador.",
    )
    expect(preview.variantsToCreate).toBe(1)
  })

  test('dry-run aprova linha com stock = 0 e SKU gerado (zero nunca é falta de dados)', () => {
    const parsed = makeParsed([
      'FF-ONE;SIXNINE;Jantes;20;8.5J;5x112;45;66.6;GlossyBlack;;349,90;0',
    ])

    const preview = buildImportPreview({
      parsed,
      profile: 'wheels',
      mode: 'create-update',
      skuStrategy: 'auto',
      existingProductCodes: new Set(),
      dbVariantsBySku: new Map(),
      dbVariantsBySupplierSku: new Map(),
    })

    expect(preview.errors).toEqual([])
    expect(preview.generatedSkus).toBe(1)
    expect(preview.products[0].variants[0].stock).toBe(0)
    expect(preview.products[0].variants[0].sku).toBe(
      'FF-ONE-20-85-5X112-ET45-66.6MM-GLOSSYBLACK',
    )
  })
})

describe('catalog import — perfil exterior (Maxton)', () => {
  const EXTERIOR_HEADERS =
    'ProductCode;NomeProduto;Fabricante;Categoria;Descricao;MarcaVeiculo;ModeloVeiculo;GeracaoChassis;MotorCodigo;AnoInicial;AnoFinal;TipoProduto;Preco;Stock_Teste;Ativo'

  function buildExteriorParsed(rows: string[]) {
    const csv = parseCsv(
      [EXTERIOR_HEADERS, ...rows].join('\n'),
    )
    const { mapping } =
      detectColumnMapping(csv.headers)

    return buildRowInputs({
      rows: csv.rows,
      mapping,
      categoryProfile: 'exterior',
    })
  }

  test('stock do CSV "Stock_Teste" chega à variante (nunca 0 silencioso)', () => {
    const parsed = buildExteriorParsed([
      'BM-1;Splitter Frontal G22;Maxton Design;Exterior;desc;BMW;Série 4;G22/G23;;2020;2024;Splitter frontal;199.0;6;True',
    ])

    expect(parsed.products).toHaveLength(1)
    expect(parsed.products[0].variants[0].stock).toBe(6)
    expect(
      parsed.products[0].variants[0].isActive,
    ).toBe(true)
  })

  test('gerações agrupadas "G22/G23" viram compatibilidades separadas', () => {
    const parsed = buildExteriorParsed([
      'BM-1;Splitter Frontal G22;Maxton Design;Exterior;desc;BMW;Série 4;G22/G23;;2020;2024;Splitter frontal;199.0;6;True',
      'BM-2;Spoiler Cap G83;Maxton Design;Exterior;desc;BMW;Série 4 / M4;G23/G83;;2020;2024;Spoiler Cap;164.0;3;True',
    ])

    const first = parsed.products[0].compatibilities

    expect(first).toHaveLength(2)
    expect(first[0]).toMatchObject({
      make: 'BMW',
      model: 'Série 4',
      generation: 'G22',
    })
    expect(first[1]).toMatchObject({
      make: 'BMW',
      model: 'Série 4',
      generation: 'G23',
    })

    // "Série 4 / M4" separa-se também; com gerações agrupadas
    // cada combinação modelo×geração vira a sua própria relação
    // (Série 4→G23, Série 4→G83, M4→G23, M4→G83).
    const second = parsed.products[1].compatibilities

    expect(second).toHaveLength(4)
    expect(second).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: 'Série 4',
          generation: 'G23',
        }),
        expect.objectContaining({
          model: 'Série 4',
          generation: 'G83',
        }),
        expect.objectContaining({
          model: 'M4',
          generation: 'G23',
        }),
        expect.objectContaining({
          model: 'M4',
          generation: 'G83',
        }),
      ]),
    )
  })

  test('TipoProduto entra como seleção de variante (eixo de escolha)', () => {
    const parsed = buildExteriorParsed([
      'BM-1;Splitter Frontal G22;Maxton Design;Exterior;desc;BMW;Série 4;G22;;2020;2024;Splitter frontal;199.0;6;True',
    ])

    expect(
      parsed.products[0].variants[0].selections
        .productType,
    ).toBe('Splitter frontal')
  })

  test('TipoProduto também entra nas especificações técnicas da ficha', () => {
    const parsed = buildExteriorParsed([
      'BM-1;Splitter Frontal G22;Maxton Design;Exterior;desc;BMW;Série 4;G22;;2020;2024;Splitter frontal;199.0;6;True',
    ])

    const specifications =
      parsed.products[0].variants[0].specifications

    expect(specifications).toContainEqual(
      expect.objectContaining({
        key: 'productType',
        label: 'Tipo de produto',
        value: 'Splitter frontal',
      }),
    )
  })

  test('PrecoConjunto4 do CSV chega à variante como priceSet; em branco fica null', () => {
    const csv = parseCsv(
      [
        'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;PrecoConjunto4;Stock',
        'SIX-FF1;SIXNINE;Jantes;19;8.5J;5x112;45;66.6;GlossyBlack;FF1-A;479,99;1849,90;4',
        'SIX-FF1;SIXNINE;Jantes;19;8.5J;5x112;45;66.6;HyperSilver;FF1-B;489,99;;4',
      ].join('\n'),
    )
    const { mapping } =
      detectColumnMapping(csv.headers)

    const parsed = buildRowInputs({
      rows: csv.rows,
      mapping,
      categoryProfile: 'wheels',
    })

    const variants = parsed.products[0].variants

    expect(variants[0].priceSet).toBe(1849.9)
    expect(variants[1].priceSet).toBeNull()
  })

  test('Preço de conjunto malformado é aviso, nunca erro de linha', () => {
    const csv = parseCsv(
      [
        'Product;Manufacturer;Category;Diameter;Width;PCD;ET;CB;Finish;SKU;Price;PrecoConjunto4;Stock',
        'SIX-FF1;SIXNINE;Jantes;19;8.5J;5x112;45;66.6;GlossyBlack;FF1-A;479,99;caro;4',
      ].join('\n'),
    )
    const { mapping } =
      detectColumnMapping(csv.headers)

    const parsed = buildRowInputs({
      rows: csv.rows,
      mapping,
      categoryProfile: 'wheels',
    })

    expect(parsed.errors).toEqual([])
    expect(parsed.warnings).toHaveLength(1)
    expect(
      parsed.warnings[0].message,
    ).toContain('conjunto')
    expect(
      parsed.products[0].variants[0].priceSet,
    ).toBeNull()
  })
})
