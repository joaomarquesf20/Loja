import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  isPortugalMainlandPostalCode,
  parsePortugalPostalCode,
} from './portugal-postal-code'

describe(
  'parsePortugalPostalCode',
  () => {
    test.each([
      [
        '1000-001',
        1000,
      ],
      [
        '4000-123',
        4000,
      ],
      [
        '8970-999',
        8970,
      ],
    ])(
      'classifica %s como Portugal Continental',
      (
        postalCode,
        prefix,
      ) => {
        expect(
          parsePortugalPostalCode(
            postalCode,
          ),
        ).toEqual({
          valid: true,
          postalCode,
          prefix,
          region:
            'PORTUGAL_MAINLAND',
        })
      },
    )

    test.each([
      [
        '9000-001',
        9000,
      ],
      [
        '9400-001',
        9400,
      ],
    ])(
      'classifica %s como Madeira',
      (
        postalCode,
        prefix,
      ) => {
        expect(
          parsePortugalPostalCode(
            postalCode,
          ),
        ).toEqual({
          valid: true,
          postalCode,
          prefix,
          region: 'MADEIRA',
        })
      },
    )

    test.each([
      [
        '9500-001',
        9500,
      ],
      [
        '9700-001',
        9700,
      ],
      [
        '9980-001',
        9980,
      ],
    ])(
      'classifica %s como Açores',
      (
        postalCode,
        prefix,
      ) => {
        expect(
          parsePortugalPostalCode(
            postalCode,
          ),
        ).toEqual({
          valid: true,
          postalCode,
          prefix,
          region: 'AZORES',
        })
      },
    )

    test(
      'remove espaços exteriores antes de validar',
      () => {
        expect(
          parsePortugalPostalCode(
            '  4000-123  ',
          ),
        ).toEqual({
          valid: true,
          postalCode: '4000-123',
          prefix: 4000,
          region:
            'PORTUGAL_MAINLAND',
        })
      },
    )

    test.each([
      null,
      undefined,
      4000123,
      '',
      '   ',
      '4000123',
      '4000 123',
      '4000--123',
      '400-123',
      '40000-123',
      '4000-12',
      '4000-1234',
      'ABCD-123',
      '4000-ABC',
      '0999-123',
    ])(
      'rejeita código postal inválido: %s',
      (postalCode) => {
        expect(
          parsePortugalPostalCode(
            postalCode,
          ),
        ).toEqual({
          valid: false,
          postalCode: null,
          prefix: null,
          region: null,
        })
      },
    )
  },
)

describe(
  'isPortugalMainlandPostalCode',
  () => {
    test.each([
      '1000-001',
      '4000-123',
      '8970-999',
    ])(
      'devolve true para código Continental %s',
      (postalCode) => {
        expect(
          isPortugalMainlandPostalCode(
            postalCode,
          ),
        ).toBe(true)
      },
    )

    test.each([
      '9000-001',
      '9400-001',
      '9500-001',
      '9980-001',
      '4000123',
      '0999-123',
      '',
    ])(
      'devolve false para código não elegível %s',
      (postalCode) => {
        expect(
          isPortugalMainlandPostalCode(
            postalCode,
          ),
        ).toBe(false)
      },
    )
  },
)
