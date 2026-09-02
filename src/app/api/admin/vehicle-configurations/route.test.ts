import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/db', () => ({
  prisma: {},
}))

vi.mock(
  '@/server/admin-auth',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/server/admin-auth')
      >()

    return {
      ...actual,
      requireAdmin: vi.fn(),
    }
  },
)

vi.mock(
  '@/server/vehicle-configurations',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/server/vehicle-configurations')
      >()

    return {
      ...actual,
      listVehicleConfigurations: vi.fn(),
      createVehicleConfiguration: vi.fn(),
    }
  },
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

import {
  NotFoundError,
  ValidationError,
  createVehicleConfiguration,
  listVehicleConfigurations,
} from '@/server/vehicle-configurations'

import { GET, POST } from './route'

const configurationRecord = {
  id: 'configuration-1',
  generationId: 'generation-1',
  name: '2.0 TDI 150',
  engineCode: 'EA288',
  engineType: 'Diesel',
  displacementCc: 1968,
  powerKw: 110,
  bodyType: 'Hatchback',
  yearFrom: 2013,
  yearTo: 2020,
}

describe(
  'Admin Vehicle Configurations API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.mocked(requireAdmin).mockReset()
    })

    describe('GET', () => {
      test(
        'devolve 200 com a lista de configurações',
        async () => {
          vi.mocked(
            listVehicleConfigurations,
          ).mockResolvedValue([
            configurationRecord,
          ])

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations?generationId=generation-1',
            )

          const response =
            await GET(request)

          expect(response.status).toBe(200)

          await expect(
            response.json(),
          ).resolves.toEqual([
            configurationRecord,
          ])
        },
      )

      test(
        'passa o generationId da query string ao service',
        async () => {
          vi.mocked(
            listVehicleConfigurations,
          ).mockResolvedValue([])

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations?generationId=generation-123',
            )

          await GET(request)

          expect(
            listVehicleConfigurations,
          ).toHaveBeenCalledWith(
            'generation-123',
          )
        },
      )

      test(
        'devolve 400 quando generationId está ausente',
        async () => {
          vi.mocked(
            listVehicleConfigurations,
          ).mockRejectedValue(
            new ValidationError(
              'ID da geração de veículo é obrigatório',
            ),
          )

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations',
            )

          const response =
            await GET(request)

          expect(
            listVehicleConfigurations,
          ).toHaveBeenCalledWith('')

          expect(response.status).toBe(400)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'ID da geração de veículo é obrigatório',
          })
        },
      )

      test(
        'devolve 400 quando generationId está vazio',
        async () => {
          vi.mocked(
            listVehicleConfigurations,
          ).mockRejectedValue(
            new ValidationError(
              'ID da geração de veículo é obrigatório',
            ),
          )

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations?generationId=',
            )

          const response =
            await GET(request)

          expect(
            listVehicleConfigurations,
          ).toHaveBeenCalledWith('')

          expect(response.status).toBe(400)
        },
      )

      test(
        'devolve 404 quando a geração não existe',
        async () => {
          vi.mocked(
            listVehicleConfigurations,
          ).mockRejectedValue(
            new NotFoundError(
              'Geração de veículo não encontrada',
            ),
          )

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations?generationId=generation-inexistente',
            )

          const response =
            await GET(request)

          expect(response.status).toBe(404)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Geração de veículo não encontrada',
          })
        },
      )

      test(
        'devolve 401 sem autenticação',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new UnauthorizedError(
              'Não autenticado',
            ),
          )

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations?generationId=generation-1',
            )

          const response =
            await GET(request)

          expect(response.status).toBe(401)

          expect(
            listVehicleConfigurations,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 403 sem permissão de administrador',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new ForbiddenError(
              'Acesso negado',
            ),
          )

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations?generationId=generation-1',
            )

          const response =
            await GET(request)

          expect(response.status).toBe(403)

          expect(
            listVehicleConfigurations,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 500 em erro inesperado',
        async () => {
          vi.mocked(
            listVehicleConfigurations,
          ).mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

          const request =
            new NextRequest(
              'http://localhost/api/admin/vehicle-configurations?generationId=generation-1',
            )

          const response =
            await GET(request)

          expect(response.status).toBe(500)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Erro interno do servidor',
          })
        },
      )
    })

    describe('POST', () => {
      test(
        'devolve 201 ao criar uma configuração',
        async () => {
          vi.mocked(
            createVehicleConfiguration,
          ).mockResolvedValue(
            configurationRecord,
          )

          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  generationId:
                    'generation-1',
                  name: '2.0 TDI 150',
                  engineCode: 'EA288',
                  engineType: 'Diesel',
                  displacementCc: 1968,
                  powerKw: 110,
                  bodyType: 'Hatchback',
                  yearFrom: 2013,
                  yearTo: 2020,
                }),
              },
            )

          const response =
            await POST(request)

          expect(response.status).toBe(201)

          await expect(
            response.json(),
          ).resolves.toEqual(
            configurationRecord,
          )
        },
      )

      test(
        'passa o body ao service',
        async () => {
          vi.mocked(
            createVehicleConfiguration,
          ).mockResolvedValue(
            configurationRecord,
          )

          const body = {
            generationId:
              'generation-1',
            name: '2.0 TDI 150',
            engineCode: 'EA288',
            engineType: 'Diesel',
            displacementCc: 1968,
            powerKw: 110,
            bodyType: 'Hatchback',
            yearFrom: 2013,
            yearTo: 2020,
          }

          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify(
                  body,
                ),
              },
            )

          await POST(request)

          expect(
            createVehicleConfiguration,
          ).toHaveBeenCalledWith(body)
        },
      )

      test(
        'devolve 400 com JSON malformado',
        async () => {
          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: '{',
              },
            )

          const response =
            await POST(request)

          expect(response.status).toBe(400)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'JSON inválido',
          })

          expect(
            createVehicleConfiguration,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 400 com dados inválidos',
        async () => {
          vi.mocked(
            createVehicleConfiguration,
          ).mockRejectedValue(
            new ValidationError(
              'Dados da configuração de veículo inválidos',
            ),
          )

          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  generationId: '',
                  name: '',
                }),
              },
            )

          const response =
            await POST(request)

          expect(response.status).toBe(400)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Dados da configuração de veículo inválidos',
          })
        },
      )

      test(
        'devolve 404 quando a geração não existe',
        async () => {
          vi.mocked(
            createVehicleConfiguration,
          ).mockRejectedValue(
            new NotFoundError(
              'Geração de veículo não encontrada',
            ),
          )

          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  generationId:
                    'generation-inexistente',
                  name: '2.0 TDI',
                }),
              },
            )

          const response =
            await POST(request)

          expect(response.status).toBe(404)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Geração de veículo não encontrada',
          })
        },
      )

      test(
        'devolve 401 sem autenticação',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new UnauthorizedError(
              'Não autenticado',
            ),
          )

          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  generationId:
                    'generation-1',
                  name: '2.0 TDI',
                }),
              },
            )

          const response =
            await POST(request)

          expect(response.status).toBe(401)

          expect(
            createVehicleConfiguration,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 403 sem permissão de administrador',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new ForbiddenError(
              'Acesso negado',
            ),
          )

          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  generationId:
                    'generation-1',
                  name: '2.0 TDI',
                }),
              },
            )

          const response =
            await POST(request)

          expect(response.status).toBe(403)

          expect(
            createVehicleConfiguration,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 500 em erro inesperado',
        async () => {
          vi.mocked(
            createVehicleConfiguration,
          ).mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  generationId:
                    'generation-1',
                  name: '2.0 TDI',
                }),
              },
            )

          const response =
            await POST(request)

          expect(response.status).toBe(500)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Erro interno do servidor',
          })
        },
      )
    })
  },
)