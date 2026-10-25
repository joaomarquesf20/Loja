import { render, screen } from '@testing-library/react'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    getServerSession:
      vi.fn(),
    redirect: vi.fn(
      () => {
        throw new Error(
          'NEXT_REDIRECT',
        )
      },
    ),
    notFound: vi.fn(
      () => {
        throw new Error(
          'NEXT_NOT_FOUND',
        )
      },
    ),
    usePathname: vi.fn(),
    signOut: vi.fn(),
  }),
)

vi.mock('next-auth', () => ({
  getServerSession:
    mocks.getServerSession,
}))

vi.mock(
  'next-auth/react',
  () => ({
    signOut: mocks.signOut,
  }),
)

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  usePathname: mocks.usePathname,
}))

vi.mock('@/server/auth', () => ({
  authOptions: {},
}))

import AdminLayout from './layout'

describe(
  'AdminLayout',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.usePathname.mockReturnValue(
        '/admin/products',
      )
    })

    test(
      'redireciona para o login sem sessão',
      async () => {
        mocks.getServerSession.mockResolvedValueOnce(
          null,
        )

        await expect(
          AdminLayout({
            children: null,
          }),
        ).rejects.toThrow(
          'NEXT_REDIRECT',
        )

        expect(
          mocks.redirect,
        ).toHaveBeenCalledWith(
          '/login',
        )
        expect(
          mocks.notFound,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'esconde o backoffice a utilizadores não admin',
      async () => {
        mocks.getServerSession.mockResolvedValueOnce(
          {
            user: { role: 'BUYER' },
          },
        )

        await expect(
          AdminLayout({
            children: null,
          }),
        ).rejects.toThrow(
          'NEXT_NOT_FOUND',
        )

        expect(
          mocks.notFound,
        ).toHaveBeenCalledTimes(
          1,
        )
        expect(
          mocks.redirect,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'monta a shell admin com navegação, breadcrumb, loja e logout',
      async () => {
        mocks.getServerSession.mockResolvedValueOnce(
          {
            user: { role: 'ADMIN' },
          },
        )

        render(
          await AdminLayout({
            children: (
              <div>
                Conteúdo da
                página
              </div>
            ),
          }),
        )

        expect(
          mocks.getServerSession,
        ).toHaveBeenCalledTimes(
          1,
        )

        expect(
          screen.getByRole(
            'navigation',
            {
              name: 'Áreas de administração',
            },
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole('link', {
            name: 'Painel',
          }).getAttribute('href'),
        ).toBe('/admin')
        expect(
          screen.getByRole('link', {
            name: 'Produtos',
          }).getAttribute('href'),
        ).toBe('/admin/products')

        expect(
          screen.getByRole(
            'navigation',
            {
              name:
                'Caminho de navegação',
            },
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByRole('link', {
            name: 'Admin',
          }).getAttribute('href'),
        ).toBe('/admin')
        // Nav + breadcrumb expõem "Produtos" duas vezes.
        expect(
          screen.getAllByText(
            'Produtos',
          ),
        ).toHaveLength(2)


        expect(
          screen.getByRole('link', {
            name: /Ver loja/,
          }).getAttribute('href'),
        ).toBe('/')

        expect(
          screen.getByRole('button', {
            name: 'Sair',
          }),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Conteúdo da página',
          ),
        ).toBeInTheDocument()
      },
    )
  },
)
