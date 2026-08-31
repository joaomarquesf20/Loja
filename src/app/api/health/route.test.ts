import { describe, expect, test } from 'vitest'
import { GET } from './route'

describe('Health API /api/health', () => {
  test('GET retorna status 200 com corpo { status: "ok" }', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })
})