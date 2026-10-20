import { File as NodeFile } from 'node:buffer'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const {
  requireAdminMock,
  storeImageFileMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  storeImageFileMock: vi.fn(),
}))

vi.mock('@/server/admin-auth', () => ({
  UnauthorizedError: class extends Error {},
  ForbiddenError: class extends Error {},
  requireAdmin: requireAdminMock,
}))

vi.mock('@/server/image-storage', () => ({
  ImageStorageError: class extends Error {
    statusCode: number
    constructor(
      message: string,
      statusCode = 400,
    ) {
      super(message)
      this.statusCode = statusCode
    }
  },
  storeImageFile: storeImageFileMock,
}))

import { POST } from './route'

function uploadRequest(
  files: NodeFile[],
) {
  return {
    formData: async () => ({
      getAll: (field: string) =>
        field === 'files' ? files : [],
    }),
  } as unknown as Request
}

describe('admin image upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({
      user: { id: 'admin-1' },
    })
  })

  test(
    'aceita vários ficheiros e devolve erros por ficheiro',
    async () => {
      storeImageFileMock
        .mockResolvedValueOnce({
          url: '/uploads/one.jpg',
          originalName: 'one.jpg',
          mimeType: 'image/jpeg',
          size: 10,
        })
        .mockRejectedValueOnce(
          new Error('ficheiro inválido'),
        )

      const response = await POST(
        uploadRequest([
          new NodeFile(['one'], 'one.jpg', {
            type: 'image/jpeg',
          }),
          new NodeFile(['bad'], 'bad.jpg', {
            type: 'image/jpeg',
          }),
        ]),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        images: [
          {
            url: '/uploads/one.jpg',
            originalName: 'one.jpg',
            mimeType: 'image/jpeg',
            size: 10,
          },
        ],
        errors: [
          {
            fileName: 'bad.jpg',
            message:
              'Não foi possível carregar esta imagem.',
          },
        ],
      })
      expect(
        storeImageFileMock,
      ).toHaveBeenCalledTimes(2)
    },
  )

  test(
    'rejeita um pedido sem ficheiros',
    async () => {
      const response = await POST(
        uploadRequest([]),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error:
          'Seleciona pelo menos uma imagem.',
      })
      expect(
        storeImageFileMock,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'devolve 401 sem autenticação',
    async () => {
      const { UnauthorizedError } =
        await import(
          '@/server/admin-auth'
        )
      requireAdminMock.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await POST(
        uploadRequest([
          new NodeFile(['one'], 'one.jpg', {
            type: 'image/jpeg',
          }),
        ]),
      )

      expect(response.status).toBe(401)
    },
  )
})
