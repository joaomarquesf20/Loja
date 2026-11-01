import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  buildBrandCssVariables,
  darkenHexColor,
  lightenHexColor,
  parseHexColor,
} from './brand-colors'

describe('brand-colors', () => {
  test('parse aceita apenas #RRGGBB', () => {
    expect(
      parseHexColor('#ef5b2a'),
    ).toEqual({ r: 239, g: 91, b: 42 })
    expect(
      parseHexColor(' #EF5B2A '),
    ).toEqual({ r: 239, g: 91, b: 42 })
    expect(
      parseHexColor('ef5b2a'),
    ).toBeNull()
    expect(
      parseHexColor('#ef5b2'),
    ).toBeNull()
    expect(
      parseHexColor('#ef5b2a1'),
    ).toBeNull()
    expect(
      parseHexColor('#zz5b2a'),
    ).toBeNull()
    expect(parseHexColor('')).toBeNull()
  })

  test('darken escurece mantendo a matiz', () => {
    expect(
      darkenHexColor('#ef5b2a'),
    ).toBe('#d25025')
    expect(
      darkenHexColor('#000000'),
    ).toBe('#000000')
    expect(
      darkenHexColor('inválido'),
    ).toBeNull()
  })

  test('lighten mistura com branco', () => {
    expect(
      lightenHexColor('#ef5b2a'),
    ).toBe('#f16f44')
    // 12% sobre a base mantém o tom lavado do template.
    expect(
      lightenHexColor('#ef5b2a', 0.12),
    ).toBe('#f16f44')
    expect(
      lightenHexColor(''),
    ).toBeNull()
  })

  test('buildBrandCssVariables devolve as três variáveis', () => {
    expect(
      buildBrandCssVariables('#ef5b2a'),
    ).toBe(
      '--brand: #ef5b2a; --brand-strong: #d25025; --brand-soft: #f16f44;',
    )
    expect(
      buildBrandCssVariables(
        'não-hex',
      ),
    ).toBeNull()
  })
})
