import {
  describe,
  expect,
  test,
} from 'vitest'
import {
  render,
  screen,
  fireEvent,
} from '@testing-library/react'
import MobileFilterDrawer from './mobile-filter-drawer'

describe('MobileFilterDrawer', () => {
  test('move o foco para o conteúdo ao abrir e devolve ao fechar', () => {
    const { container } = render(
      <MobileFilterDrawer activeCount={1}>
        <input
          type="checkbox"
          aria-label="Filtro de teste"
        />
      </MobileFilterDrawer>,
    )

    const trigger = screen.getByRole(
      'button',
      { name: 'Abrir filtros' },
    )

    expect(
      document.body.style.overflow,
    ).toBe('')

    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', {
      name: 'Filtros',
    })
    expect(
      dialog.getAttribute('aria-modal'),
    ).toBe('true')
    expect(
      document.body.style.overflow,
    ).toBe('hidden')

    const dialogFocusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button, input',
      ),
    ]
    expect(document.activeElement).toBe(
      dialogFocusables[0],
    )

    // Tab no último elemento volta ao primeiro (ciclo fechado).
    dialogFocusables[
      dialogFocusables.length - 1
    ].focus()
    fireEvent.keyDown(window, {
      key: 'Tab',
    })
    expect(document.activeElement).toBe(
      dialogFocusables[0],
    )

    // Escape fecha o drawer e devolve o foco ao gatilho.
    fireEvent.keyDown(window, {
      key: 'Escape',
    })
    expect(
      screen.queryByRole('dialog'),
    ).not.toBeInTheDocument()
    expect(document.activeElement).toBe(
      trigger,
    )
    expect(
      document.body.style.overflow,
    ).toBe('')

    container.remove()
  })
})
