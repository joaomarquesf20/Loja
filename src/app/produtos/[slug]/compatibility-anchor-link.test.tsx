import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import CompatibilityAnchorLink from './compatibility-anchor-link'

describe(
  'CompatibilityAnchorLink',
  () => {
    const scrollIntoView =
      vi.fn()

    beforeEach(() => {
      scrollIntoView.mockClear()

      Element.prototype.scrollIntoView =
        scrollIntoView
    })

    afterEach(() => {
      cleanup()
    })

    test(
      'abre a secção de compatibilidade e desloca até ela',
      () => {
        render(
          <>
            <CompatibilityAnchorLink
              targetId="compatibilidade"
              applicationsCount={1}
            />

            <details id="compatibilidade">
              <summary>
                Compatibilidade
              </summary>

              <p>
                Volkswagen Golf Mk7
                2012–2019
              </p>
            </details>
          </>,
        )

        const details =
          document.getElementById(
            'compatibilidade',
          ) as HTMLDetailsElement

        expect(
          details.open,
        ).toBe(false)

        fireEvent.click(
          screen.getByRole('link', {
            name: 'Ver aplicação',
          }),
        )

        expect(
          details.open,
        ).toBe(true)

        expect(
          scrollIntoView,
        ).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        })
      },
    )

    test(
      'anuncia o número de aplicações',
      () => {
        render(
          <CompatibilityAnchorLink
            targetId="compatibilidade"
            applicationsCount={3}
          />,
        )

        expect(
          screen.getByRole('link', {
            name: 'Ver 3 aplicações',
          }),
        ).toHaveAttribute(
          'href',
          '#compatibilidade',
        )
      },
    )
  },
)
