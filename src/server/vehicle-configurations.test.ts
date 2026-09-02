import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createVehicleConfiguration,
  deleteVehicleConfiguration,
  getVehicleConfigurationById,
  listVehicleConfigurations,
  updateVehicleConfiguration,
  type VehicleConfigurationClient,
} from './vehicle-configurations'

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
  'vehicle configurations service',
  () => {
    let client: VehicleConfigurationClient

    beforeEach(() => {
      client = {
        vehicleGeneration: {
          findUnique: vi.fn(),
        },
        vehicleConfiguration: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        productVehicleCompatibility: {
          count: vi.fn(),
        },
      }
    })

    describe(
      'listVehicleConfigurations',
      () => {
        test(
          'rejeita generationId vazio',
          async () => {
            await expect(
              listVehicleConfigurations(
                '',
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )

            expect(
              client.vehicleGeneration
                .findUnique,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'rejeita geração inexistente',
          async () => {
            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue(null)

            await expect(
              listVehicleConfigurations(
                'generation-1',
                client,
              ),
            ).rejects.toBeInstanceOf(
              NotFoundError,
            )

            expect(
              client.vehicleConfiguration
                .findMany,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'filtra pela geração e ordena por nome',
          async () => {
            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue({
              id: 'generation-1',
            })

            vi.mocked(
              client.vehicleConfiguration
                .findMany,
            ).mockResolvedValue([
              configurationRecord,
            ])

            const result =
              await listVehicleConfigurations(
                'generation-1',
                client,
              )

            expect(
              client.vehicleGeneration
                .findUnique,
            ).toHaveBeenCalledWith({
              where: {
                id: 'generation-1',
              },
            })

            expect(
              client.vehicleConfiguration
                .findMany,
            ).toHaveBeenCalledWith({
              where: {
                generationId:
                  'generation-1',
              },
              orderBy: {
                name: 'asc',
              },
            })

            expect(result).toEqual([
              configurationRecord,
            ])
          },
        )

        test(
          'normaliza Decimal de powerKw para number',
          async () => {
            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue({
              id: 'generation-1',
            })

            vi.mocked(
              client.vehicleConfiguration
                .findMany,
            ).mockResolvedValue([
              {
                ...configurationRecord,
                powerKw: {
                  toString: () =>
                    '110.5',
                },
              },
            ])

            const result =
              await listVehicleConfigurations(
                'generation-1',
                client,
              )

            expect(
              result[0].powerKw,
            ).toBe(110.5)
          },
        )
      },
    )

    describe(
      'getVehicleConfigurationById',
      () => {
        test(
          'rejeita id vazio',
          async () => {
            await expect(
              getVehicleConfigurationById(
                '',
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita configuração inexistente',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(null)

            await expect(
              getVehicleConfigurationById(
                'configuration-1',
                client,
              ),
            ).rejects.toBeInstanceOf(
              NotFoundError,
            )
          },
        )

        test(
          'devolve configuração existente',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            await expect(
              getVehicleConfigurationById(
                'configuration-1',
                client,
              ),
            ).resolves.toEqual(
              configurationRecord,
            )

            expect(
              client.vehicleConfiguration
                .findUnique,
            ).toHaveBeenCalledWith({
              where: {
                id: 'configuration-1',
              },
            })
          },
        )
      },
    )

    describe(
      'createVehicleConfiguration',
      () => {
        test(
          'rejeita generationId vazio',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId: '',
                  name: '2.0 TDI',
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )

            expect(
              client.vehicleConfiguration
                .create,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'rejeita nome vazio',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: '',
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita nome acima de 120 caracteres',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: 'a'.repeat(121),
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita displacementCc não inteiro',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: 'Motor',
                  displacementCc:
                    1968.5,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita displacementCc não positivo',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: 'Motor',
                  displacementCc: 0,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita powerKw não positivo',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: 'Motor',
                  powerKw: 0,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita powerKw infinito',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: 'Motor',
                  powerKw:
                    Number.POSITIVE_INFINITY,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita anos não inteiros',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: 'Motor',
                  yearFrom: 2019.5,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita yearTo anterior a yearFrom',
          async () => {
            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: 'Motor',
                  yearFrom: 2020,
                  yearTo: 2019,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )

            expect(
              client.vehicleGeneration
                .findUnique,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'rejeita geração inexistente',
          async () => {
            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue(null)

            await expect(
              createVehicleConfiguration(
                {
                  generationId:
                    'generation-1',
                  name: '2.0 TDI',
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              NotFoundError,
            )

            expect(
              client.vehicleConfiguration
                .create,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'cria configuração válida com trim',
          async () => {
            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue({
              id: 'generation-1',
            })

            vi.mocked(
              client.vehicleConfiguration
                .create,
            ).mockResolvedValue(
              configurationRecord,
            )

            const result =
              await createVehicleConfiguration(
                {
                  generationId:
                    ' generation-1 ',
                  name:
                    ' 2.0 TDI 150 ',
                  engineCode:
                    ' EA288 ',
                  engineType:
                    ' Diesel ',
                  displacementCc: 1968,
                  powerKw: 110,
                  bodyType:
                    ' Hatchback ',
                  yearFrom: 2013,
                  yearTo: 2020,
                },
                client,
              )

            expect(
              client.vehicleConfiguration
                .create,
            ).toHaveBeenCalledWith({
              data: {
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
              },
            })

            expect(result).toEqual(
              configurationRecord,
            )
          },
        )

        test(
          'usa null nos campos opcionais ausentes',
          async () => {
            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue({
              id: 'generation-1',
            })

            vi.mocked(
              client.vehicleConfiguration
                .create,
            ).mockResolvedValue({
              ...configurationRecord,
              engineCode: null,
              engineType: null,
              displacementCc: null,
              powerKw: null,
              bodyType: null,
              yearFrom: null,
              yearTo: null,
            })

            await createVehicleConfiguration(
              {
                generationId:
                  'generation-1',
                name: 'Configuração',
              },
              client,
            )

            expect(
              client.vehicleConfiguration
                .create,
            ).toHaveBeenCalledWith({
              data: {
                generationId:
                  'generation-1',
                name: 'Configuração',
                engineCode: null,
                engineType: null,
                displacementCc: null,
                powerKw: null,
                bodyType: null,
                yearFrom: null,
                yearTo: null,
              },
            })
          },
        )
      },
    )

    describe(
      'updateVehicleConfiguration',
      () => {
        test(
          'rejeita id vazio',
          async () => {
            await expect(
              updateVehicleConfiguration(
                '',
                {
                  name: 'Novo nome',
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita input inválido',
          async () => {
            await expect(
              updateVehicleConfiguration(
                'configuration-1',
                {
                  name: '',
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )

            expect(
              client.vehicleConfiguration
                .findUnique,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'rejeita configuração inexistente',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(null)

            await expect(
              updateVehicleConfiguration(
                'configuration-1',
                {
                  name: 'Novo nome',
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              NotFoundError,
            )
          },
        )

        test(
          'rejeita geração inexistente ao mudar generationId',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue(null)

            await expect(
              updateVehicleConfiguration(
                'configuration-1',
                {
                  generationId:
                    'generation-2',
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              NotFoundError,
            )

            expect(
              client.vehicleConfiguration
                .update,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'valida intervalo final ao alterar apenas yearFrom',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            await expect(
              updateVehicleConfiguration(
                'configuration-1',
                {
                  yearFrom: 2021,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )

            expect(
              client.vehicleConfiguration
                .update,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'valida intervalo final ao alterar apenas yearTo',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            await expect(
              updateVehicleConfiguration(
                'configuration-1',
                {
                  yearTo: 2012,
                },
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'permite limpar yearTo com null',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            const updated = {
              ...configurationRecord,
              yearTo: null,
            }

            vi.mocked(
              client.vehicleConfiguration
                .update,
            ).mockResolvedValue(updated)

            await expect(
              updateVehicleConfiguration(
                'configuration-1',
                {
                  yearTo: null,
                },
                client,
              ),
            ).resolves.toEqual(updated)

            expect(
              client.vehicleConfiguration
                .update,
            ).toHaveBeenCalledWith({
              where: {
                id: 'configuration-1',
              },
              data: {
                yearTo: null,
              },
            })
          },
        )

        test(
          'atualiza dados válidos com trim',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            const updated = {
              ...configurationRecord,
              name: '2.0 TDI Atualizado',
              engineCode: 'EA288 EVO',
              bodyType: 'Carrinha',
              powerKw: 120,
            }

            vi.mocked(
              client.vehicleConfiguration
                .update,
            ).mockResolvedValue(updated)

            const result =
              await updateVehicleConfiguration(
                'configuration-1',
                {
                  name:
                    ' 2.0 TDI Atualizado ',
                  engineCode:
                    ' EA288 EVO ',
                  bodyType:
                    ' Carrinha ',
                  powerKw: 120,
                },
                client,
              )

            expect(
              client.vehicleConfiguration
                .update,
            ).toHaveBeenCalledWith({
              where: {
                id: 'configuration-1',
              },
              data: {
                name:
                  '2.0 TDI Atualizado',
                engineCode:
                  'EA288 EVO',
                bodyType: 'Carrinha',
                powerKw: 120,
              },
            })

            expect(result).toEqual(updated)
          },
        )

        test(
          'permite mover configuração para outra geração existente',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            vi.mocked(
              client.vehicleGeneration
                .findUnique,
            ).mockResolvedValue({
              id: 'generation-2',
            })

            const updated = {
              ...configurationRecord,
              generationId:
                'generation-2',
            }

            vi.mocked(
              client.vehicleConfiguration
                .update,
            ).mockResolvedValue(updated)

            await expect(
              updateVehicleConfiguration(
                'configuration-1',
                {
                  generationId:
                    ' generation-2 ',
                },
                client,
              ),
            ).resolves.toEqual(updated)

            expect(
              client.vehicleGeneration
                .findUnique,
            ).toHaveBeenCalledWith({
              where: {
                id: 'generation-2',
              },
            })
          },
        )
      },
    )

    describe(
      'deleteVehicleConfiguration',
      () => {
        test(
          'rejeita id vazio',
          async () => {
            await expect(
              deleteVehicleConfiguration(
                '',
                client,
              ),
            ).rejects.toBeInstanceOf(
              ValidationError,
            )
          },
        )

        test(
          'rejeita configuração inexistente',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(null)

            await expect(
              deleteVehicleConfiguration(
                'configuration-1',
                client,
              ),
            ).rejects.toBeInstanceOf(
              NotFoundError,
            )
          },
        )

        test(
          'bloqueia delete com compatibilidades associadas',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            vi.mocked(
              client
                .productVehicleCompatibility
                .count,
            ).mockResolvedValue(1)

            await expect(
              deleteVehicleConfiguration(
                'configuration-1',
                client,
              ),
            ).rejects.toBeInstanceOf(
              ConflictError,
            )

            expect(
              client
                .productVehicleCompatibility
                .count,
            ).toHaveBeenCalledWith({
              where: {
                vehicleConfigurationId:
                  'configuration-1',
              },
            })

            expect(
              client.vehicleConfiguration
                .delete,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'apaga configuração sem compatibilidades associadas',
          async () => {
            vi.mocked(
              client.vehicleConfiguration
                .findUnique,
            ).mockResolvedValue(
              configurationRecord,
            )

            vi.mocked(
              client
                .productVehicleCompatibility
                .count,
            ).mockResolvedValue(0)

            vi.mocked(
              client.vehicleConfiguration
                .delete,
            ).mockResolvedValue(
              configurationRecord,
            )

            await expect(
              deleteVehicleConfiguration(
                'configuration-1',
                client,
              ),
            ).resolves.toEqual(
              configurationRecord,
            )

            expect(
              client.vehicleConfiguration
                .delete,
            ).toHaveBeenCalledWith({
              where: {
                id: 'configuration-1',
              },
            })
          },
        )
      },
    )
  },
)