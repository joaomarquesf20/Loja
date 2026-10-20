import { describe, expect, test } from 'vitest'

import {
  appendSkuSuffix,
  collisionSuffix,
  generateImportSku,
  normalizeSkuDiameterPart,
  normalizeSkuFinishPart,
  normalizeSkuOffsetPart,
  normalizeSkuPcdPart,
  normalizeSkuWidthPart,
  sanitizeSkuToken,
} from './sku-generator'

describe('gerador de SKU de importação', () => {
  test('formato de jante completo: VEE-MFZ7-19-85-5X120-ET30-GB', () => {
    expect(
      generateImportSku({
        productName: 'Veemann MF-Z7',
        selections: {
          diameter: '19"',
          width: '8.5J',
          pcd: '5x120',
          offset: 'ET30',
          centreBore: '66.6 mm',
          finish: 'Gloss Black',
        },
      }),
    ).toBe(
      'VEE-MFZ7-19-85-5X120-ET30-66.6MM-GB',
    )
  })

  test('é determinístico e imune a maiúsculas/espaços', () => {
    const first = generateImportSku({
      productName: 'veemann mf-z7',
      selections: {
        diameter: '19',
        width: '8,5',
        pcd: '5X120',
        offset: '30',
        finish: 'gloss black',
      },
    })

    const second = generateImportSku({
      productName: 'Veemann MF-Z7',
      selections: {
        diameter: '19"',
        width: '8.5J',
        pcd: '5x120',
        offset: 'ET30',
        finish: 'Gloss Black',
      },
    })

    expect(first).toBe(second)
  })

  test('sem código de modelo, o nome completo alimenta o SKU', () => {
    expect(
      generateImportSku({
        productName: 'Mola Esportiva',
        selections: {
          frontDropMm: '35',
          rearDropMm: '35',
        },
      }),
    ).toBe('MOLA-ESPORTIVA-FD35-RD35')
  })

  test('suporte para suspensão (FD/RD) e sem seleções', () => {
    expect(
      generateImportSku({
        productName: 'Coilovers JR',
        selections: {},
      }),
    ).toBe('COI-JR')

    expect(
      generateImportSku({
        productName: 'Kit',
        selections: {
          frontDropMm: '30',
          rearDropMm: '40',
        },
      }),
    ).toBe('KIT-FD30-RD40')
  })

  test('nome vazio devolve fallback estável', () => {
    expect(
      generateImportSku({
        productName: '',
        selections: {},
      }),
    ).toBe('SKU')
  })

  test('exemplo do enunciado: VEE-MFZ7-19-85-5X120-ET30-GB', () => {
    // Mesma variante do exemplo do enunciado, com vírgula
    // decimal e formatação de fornecedor.
    expect(
      generateImportSku({
        productName: 'VEEMANN MFZ7',
        selections: {
          diameter: '19',
          width: '8,5',
          pcd: '5x120',
          offset: 'ET30',
          finish: 'Gloss Black',
        },
      }),
    ).toBe('VEE-MFZ7-19-85-5X120-ET30-GB')
  })
})

describe('normalização de partes de SKU', () => {
  test('largura 8.5J → 85', () => {
    expect(normalizeSkuWidthPart('8.5J')).toBe('85')
    expect(normalizeSkuWidthPart('8,5')).toBe('85')
    expect(normalizeSkuWidthPart('9J')).toBe('90')
    expect(normalizeSkuWidthPart('7')).toBe('70')
  })

  test('diâmetro 19" → 19', () => {
    expect(normalizeSkuDiameterPart('19"')).toBe('19')
    expect(normalizeSkuDiameterPart('18,5')).toBe('185')
    expect(normalizeSkuDiameterPart('20')).toBe('20')
  })

  test('PCD 5x120 → 5X120', () => {
    expect(normalizeSkuPcdPart('5x120')).toBe('5X120')
    expect(normalizeSkuPcdPart('5X112')).toBe('5X112')
  })

  test('offset ET30/30 → ET30', () => {
    expect(normalizeSkuOffsetPart('ET30')).toBe('ET30')
    expect(normalizeSkuOffsetPart('30')).toBe('ET30')
    expect(normalizeSkuOffsetPart('ET-15')).toBe(
      'ET-15',
    )
  })

  test('acabamentos conhecidos abreviam; desconhecidos usam iniciais', () => {
    expect(normalizeSkuFinishPart('Gloss Black')).toBe(
      'GB',
    )
    expect(normalizeSkuFinishPart('silver')).toBe(
      'SIL',
    )
    expect(
      normalizeSkuFinishPart('Silver Machined'),
    ).toBe('SIL')
    expect(normalizeSkuFinishPart('Fancy Blue')).toBe(
      'FB',
    )
    expect(normalizeSkuFinishPart('Racing')).toBe(
      'RACING',
    )
  })

  test('sanitize remove acentos e caracteres inseguros', () => {
    expect(sanitizeSkuToken('Mola Esportiva')).toBe(
      'MOLA-ESPORTIVA',
    )
    expect(sanitizeSkuToken('Ação')).toBe('ACAO')
    expect(sanitizeSkuToken('  --a b--  ')).toBe('A-B')
  })
})

describe('colisões de SKU', () => {
  test('sufixo determinístico e estável', () => {
    const first = collisionSuffix(
      'VEE-MFZ7-19-85-5X120-ET30-GB',
      'row:3',
    )

    const second = collisionSuffix(
      'VEE-MFZ7-19-85-5X120-ET30-GB',
      'row:3',
    )

    const other = collisionSuffix(
      'VEE-MFZ7-19-85-5X120-ET30-GB',
      'row:4',
    )

    expect(first).toBe(second)
    expect(first).toMatch(/^[A-HJ-NP-Z2-9]{4}$/)
    expect(first).not.toBe(other)
  })

  test('appendSkuSuffix respeita o limite de 100 caracteres', () => {
    const longSku = 'A'.repeat(98)

    const withSuffix = appendSkuSuffix(
      longSku,
      'A7K2',
    )

    expect(withSuffix.length).toBeLessThanOrEqual(100)
    expect(withSuffix.endsWith('-A7K2')).toBe(true)

    expect(appendSkuSuffix('BASE', 'X1Y2')).toBe(
      'BASE-X1Y2',
    )
  })
})
