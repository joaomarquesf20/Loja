import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  getCallbackHref,
  getSafeCallbackUrl,
} from './safe-callback-url'

const ORIGIN = 'http://localhost:3000'

describe('safe callback URL', () => {
  test('aceita callback interno e preserva query e hash', () => {
    expect(
      getSafeCallbackUrl(
        '/checkout?step=payment#card',
        ORIGIN,
      ),
    ).toBe(
      '/checkout?step=payment#card',
    )
  })

  test.each([
    null,
    '',
    'https://example.com/checkout',
    '//example.com/checkout',
    '/\\example.com/checkout',
  ])(
    'rejeita callback externo ou ambíguo %s',
    (callbackUrl) => {
      expect(
        getSafeCallbackUrl(
          callbackUrl,
          ORIGIN,
        ),
      ).toBe('/')
    },
  )

  test('não acrescenta callback quando o destino é a raiz', () => {
    expect(
      getCallbackHref(
        '/login',
        '/',
      ),
    ).toBe('/login')
  })

  test('codifica callback interno no href', () => {
    expect(
      getCallbackHref(
        '/login',
        '/checkout',
      ),
    ).toBe(
      '/login?callbackUrl=%2Fcheckout',
    )
  })
})
