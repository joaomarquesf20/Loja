import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock(
  '@/server/vehicle-configurations',
  () => {
    class ValidationError extends Error {}
    class NotFoundError extends Error {}
    class ConflictError extends Error {}

    return {
      ValidationError,
      NotFoundError,
      ConflictError,
      getVehicleConfigurationById:
        vi.fn(),
      updateVehicleConfiguration:
        vi.fn(),
      deleteVehicleConfiguration:
        vi.fn(),
    }
  },
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  deleteVehicleConfiguration,
  getVehicleConfigurationById,
  updateVehicleConfiguration,
} from '@/server/vehicle-configurations'

import {
  DELETE,
  GET,
  PATCH,
} from './route'

const vehicleConfiguration = {
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

function createContext(
  id = 'configuration-1',
) {
  return {
    params: Promise.resolve({ id }),
  }
}

function createPatchRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/vehicle-configurations/configuration-1',
    {
      method: 'PATCH',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

function createRequest(
  method = 'GET',
) {
  return new Request(
    'http://localhost/api/admin/vehicle-configurations/configuration-1',
    {
      method,
    },
  )
}

describe(
  '/api/admin/vehicle-configurations/[id]',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      vi.mocked(
        requireAdmin,
      ).mockResolvedValue(
        undefined as never,
      )
    })

    describe('GET', () => {
      test(
        'devolve 200 com a configuração',
        async () => {
          vi.mocked(
            getVehicleConfigurationById,
          ).mockResolvedValue(
            vehicleConfiguration,
          )

          const response = await GET(
            createRequest(),
            createContext(),
          )

          expect(
            response.status,
          ).toBe(200)

          await expect(
            response.json(),
          ).resolves.toEqual(
            vehicleConfiguration,
          )
        },
      )

      test(
        'passa o id correto para getVehicleConfigurationById',
        async () => {
          vi.mocked(
            getVehicleConfigurationById,
          ).mockResolvedValue(
            vehicleConfiguration,
          )

          await GET(
            createRequest(),
            createContext(
              'configuration-technical',
            ),
          )

          expect(
            getVehicleConfigurationById,
          ).toHaveBeenCalledWith(
            'configuration-technical',
          )
        },
      )

      test(
        'devolve 400 para id vazio',
        async () => {
          vi.mocked(
            getVehicleConfigurationById,
          ).mockRejectedValue(
            new ValidationError(
              'ID da configuração de veículo é obrigatório',
            ),
          )

          const response = await GET(
            createRequest(),
            createContext(''),
          )

          expect(
            response.status,
          ).toBe(400)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Dados inválidos',
          })
        },
      )

      test(
        'devolve 404 para configuração inexistente',
        async () => {
          vi.mocked(
            getVehicleConfigurationById,
          ).mockRejectedValue(
            new NotFoundError(
              'Configuração de veículo não encontrada',
            ),
          )

          const response = await GET(
            createRequest(),
            createContext(),
          )

          expect(
            response.status,
          ).toBe(404)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Configuração de veículo não encontrada',
          })
        },
      )

      test(
        'devolve 401 quando não está autenticado',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new UnauthorizedError(),
          )

          const response = await GET(
            createRequest(),
            createContext(),
          )

          expect(
            response.status,
          ).toBe(401)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Não autenticado',
          })

          expect(
            getVehicleConfigurationById,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 403 quando não tem autorização',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new ForbiddenError(),
          )

          const response = await GET(
            createRequest(),
            createContext(),
          )

          expect(
            response.status,
          ).toBe(403)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Sem autorização',
          })
        },
      )

      test(
        'devolve 500 em erro inesperado',
        async () => {
          const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(
              () => undefined,
            )

          vi.mocked(
            getVehicleConfigurationById,
          ).mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

          const response = await GET(
            createRequest(),
            createContext(),
          )

          expect(
            response.status,
          ).toBe(500)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Erro interno do servidor',
          })

          expect(
            consoleError,
          ).toHaveBeenCalled()

          consoleError.mockRestore()
        },
      )
    })

    describe('PATCH', () => {
      test(
        'devolve 200 com configuração atualizada',
        async () => {
          const updatedConfiguration = {
            ...vehicleConfiguration,
            name:
              '2.0 TDI 150 Atualizado',
          }

          vi.mocked(
            updateVehicleConfiguration,
          ).mockResolvedValue(
            updatedConfiguration,
          )

          const response =
            await PATCH(
              createPatchRequest({
                name:
                  '2.0 TDI 150 Atualizado',
              }),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(200)

          await expect(
            response.json(),
          ).resolves.toEqual(
            updatedConfiguration,
          )
        },
      )

      test(
        'passa id e body corretos para updateVehicleConfiguration',
        async () => {
          vi.mocked(
            updateVehicleConfiguration,
          ).mockResolvedValue(
            vehicleConfiguration,
          )

          const body = {
            name:
              '2.0 TDI Atualizado',
            engineCode:
              'EA288 EVO',
            engineType: 'Diesel',
            displacementCc: 1968,
            powerKw: 120,
            bodyType: 'Carrinha',
            yearFrom: 2015,
            yearTo: 2021,
          }

          await PATCH(
            createPatchRequest(body),
            createContext(
              'configuration-technical',
            ),
          )

          expect(
            updateVehicleConfiguration,
          ).toHaveBeenCalledWith(
            'configuration-technical',
            body,
          )
        },
      )

      test(
        'devolve 400 para JSON malformado',
        async () => {
          const request =
            new Request(
              'http://localhost/api/admin/vehicle-configurations/configuration-1',
              {
                method: 'PATCH',
                headers: {
                  'content-type':
                    'application/json',
                },
                body: '{',
              },
            )

          const response =
            await PATCH(
              request,
              createContext(),
            )

          expect(
            response.status,
          ).toBe(400)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Dados inválidos',
          })

          expect(
            updateVehicleConfiguration,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 400 para ValidationError',
        async () => {
          vi.mocked(
            updateVehicleConfiguration,
          ).mockRejectedValue(
            new ValidationError(
              'Dados da configuração de veículo inválidos',
            ),
          )

          const response =
            await PATCH(
              createPatchRequest({
                name: '',
              }),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(400)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Dados inválidos',
          })
        },
      )

      test(
        'devolve 404 para configuração inexistente',
        async () => {
          vi.mocked(
            updateVehicleConfiguration,
          ).mockRejectedValue(
            new NotFoundError(
              'Configuração de veículo não encontrada',
            ),
          )

          const response =
            await PATCH(
              createPatchRequest({
                name:
                  'Configuração Atualizada',
              }),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(404)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Configuração de veículo não encontrada',
          })
        },
      )

      test(
        'devolve 404 para geração inexistente',
        async () => {
          vi.mocked(
            updateVehicleConfiguration,
          ).mockRejectedValue(
            new NotFoundError(
              'Geração de veículo não encontrada',
            ),
          )

          const response =
            await PATCH(
              createPatchRequest({
                generationId:
                  'generation-inexistente',
              }),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(404)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Geração de veículo não encontrada',
          })
        },
      )

      test(
        'devolve 401 quando não está autenticado',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new UnauthorizedError(),
          )

          const response =
            await PATCH(
              createPatchRequest({
                name:
                  'Configuração Atualizada',
              }),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(401)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Não autenticado',
          })

          expect(
            updateVehicleConfiguration,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 403 quando não tem autorização',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new ForbiddenError(),
          )

          const response =
            await PATCH(
              createPatchRequest({
                name:
                  'Configuração Atualizada',
              }),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(403)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Sem autorização',
          })
        },
      )

      test(
        'devolve 500 em erro inesperado',
        async () => {
          const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(
              () => undefined,
            )

          vi.mocked(
            updateVehicleConfiguration,
          ).mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

          const response =
            await PATCH(
              createPatchRequest({
                name:
                  'Configuração Atualizada',
              }),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(500)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Erro interno do servidor',
          })

          expect(
            consoleError,
          ).toHaveBeenCalled()

          consoleError.mockRestore()
        },
      )
    })

    describe('DELETE', () => {
      test(
        'devolve 200 com configuração apagada',
        async () => {
          vi.mocked(
            deleteVehicleConfiguration,
          ).mockResolvedValue(
            vehicleConfiguration,
          )

          const response =
            await DELETE(
              createRequest('DELETE'),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(200)

          await expect(
            response.json(),
          ).resolves.toEqual(
            vehicleConfiguration,
          )
        },
      )

      test(
        'passa id correto para deleteVehicleConfiguration',
        async () => {
          vi.mocked(
            deleteVehicleConfiguration,
          ).mockResolvedValue(
            vehicleConfiguration,
          )

          await DELETE(
            createRequest('DELETE'),
            createContext(
              'configuration-technical',
            ),
          )

          expect(
            deleteVehicleConfiguration,
          ).toHaveBeenCalledWith(
            'configuration-technical',
          )
        },
      )

      test(
        'devolve 400 para id vazio',
        async () => {
          vi.mocked(
            deleteVehicleConfiguration,
          ).mockRejectedValue(
            new ValidationError(
              'ID da configuração de veículo é obrigatório',
            ),
          )

          const response =
            await DELETE(
              createRequest('DELETE'),
              createContext(''),
            )

          expect(
            response.status,
          ).toBe(400)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Dados inválidos',
          })
        },
      )

      test(
        'devolve 404 para configuração inexistente',
        async () => {
          vi.mocked(
            deleteVehicleConfiguration,
          ).mockRejectedValue(
            new NotFoundError(
              'Configuração de veículo não encontrada',
            ),
          )

          const response =
            await DELETE(
              createRequest('DELETE'),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(404)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Configuração de veículo não encontrada',
          })
        },
      )

      test(
        'devolve 409 quando existem compatibilidades associadas',
        async () => {
          vi.mocked(
            deleteVehicleConfiguration,
          ).mockRejectedValue(
            new ConflictError(
              'Não é possível apagar uma configuração de veículo com compatibilidades de produtos associadas',
            ),
          )

          const response =
            await DELETE(
              createRequest('DELETE'),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(409)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Não é possível apagar uma configuração de veículo com compatibilidades de produtos associadas',
          })
        },
      )

      test(
        'devolve 401 quando não está autenticado',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new UnauthorizedError(),
          )

          const response =
            await DELETE(
              createRequest('DELETE'),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(401)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Não autenticado',
          })

          expect(
            deleteVehicleConfiguration,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 403 quando não tem autorização',
        async () => {
          vi.mocked(
            requireAdmin,
          ).mockRejectedValue(
            new ForbiddenError(),
          )

          const response =
            await DELETE(
              createRequest('DELETE'),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(403)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error: 'Sem autorização',
          })
        },
      )

      test(
        'devolve 500 em erro inesperado',
        async () => {
          const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(
              () => undefined,
            )

          vi.mocked(
            deleteVehicleConfiguration,
          ).mockRejectedValue(
            new Error(
              'Erro inesperado',
            ),
          )

          const response =
            await DELETE(
              createRequest('DELETE'),
              createContext(),
            )

          expect(
            response.status,
          ).toBe(500)

          await expect(
            response.json(),
          ).resolves.toEqual({
            error:
              'Erro interno do servidor',
          })

          expect(
            consoleError,
          ).toHaveBeenCalled()

          consoleError.mockRestore()
        },
      )
    })
  },
)