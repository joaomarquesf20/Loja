import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  InvalidJsonBodyError,
  readJsonBody,
  RequestPayloadTooLargeError,
} from './http-request'

function createRequest(
  body?: string,
  headers?: HeadersInit,
) {
  return new Request(
    'http://localhost/test',
    {
      method: 'POST',
      headers,
      body,
    },
  )
}

describe('readJsonBody', () => {
  it('reads valid JSON', async () => {
    const request =
      createRequest(
        JSON.stringify({
          hello: 'world',
        }),
      )

    await expect(
      readJsonBody(request),
    ).resolves.toEqual({
      hello: 'world',
    })
  })

  it('accepts a body exactly at the byte limit', async () => {
    const body =
      JSON.stringify({
        value: 'teste',
      })

    const size =
      new TextEncoder()
        .encode(body)
        .byteLength

    const request =
      createRequest(body)

    await expect(
      readJsonBody(
        request,
        size,
      ),
    ).resolves.toEqual({
      value: 'teste',
    })
  })

  it('rejects invalid JSON', async () => {
    const request =
      createRequest(
        '{"broken":',
      )

    await expect(
      readJsonBody(request),
    ).rejects.toBeInstanceOf(
      InvalidJsonBodyError,
    )
  })

  it('rejects an empty body', async () => {
    const request =
      createRequest()

    await expect(
      readJsonBody(request),
    ).rejects.toBeInstanceOf(
      InvalidJsonBodyError,
    )
  })

  it('rejects a declared content length above the limit', async () => {
    const request =
      createRequest(
        '{}',
        {
          'content-length':
            '1000',
        },
      )

    await expect(
      readJsonBody(
        request,
        100,
      ),
    ).rejects.toBeInstanceOf(
      RequestPayloadTooLargeError,
    )
  })

  it('enforces the limit using the actual body bytes', async () => {
    const request =
      createRequest(
        JSON.stringify({
          value:
            'abcdefghijklmnopqrstuvwxyz',
        }),
      )

    await expect(
      readJsonBody(
        request,
        10,
      ),
    ).rejects.toBeInstanceOf(
      RequestPayloadTooLargeError,
    )
  })

  it('counts UTF-8 bytes instead of JavaScript characters', async () => {
    const body =
      JSON.stringify('€')

    const byteLength =
      new TextEncoder()
        .encode(body)
        .byteLength

    expect(
      body.length,
    ).toBeLessThan(
      byteLength,
    )

    const request =
      createRequest(body)

    await expect(
      readJsonBody(
        request,
        byteLength - 1,
      ),
    ).rejects.toBeInstanceOf(
      RequestPayloadTooLargeError,
    )
  })

  it('rejects an invalid configured limit', async () => {
    const request =
      createRequest('{}')

    await expect(
      readJsonBody(
        request,
        0,
      ),
    ).rejects.toBeInstanceOf(
      RangeError,
    )
  })
})