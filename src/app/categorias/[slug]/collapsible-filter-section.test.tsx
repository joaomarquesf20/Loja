import { describe, expect, test } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import CollapsibleFilterSection from './collapsible-filter-section'

describe('CollapsibleFilterSection', () => {
  test('começa aberta e colapsa ao clicar no cabeçalho', () => {
    render(
      <CollapsibleFilterSection title="Diâmetro">
        <div>14&quot;</div>
        <div>19&quot;</div>
      </CollapsibleFilterSection>,
    )

    expect(
      screen.getByRole('button', { name: /Diâmetro/ }),
    ).toHaveAttribute('aria-expanded', 'true')
    // A entidade &quot; é renderizada como aspas no DOM.
    expect(screen.getByText('19"')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Diâmetro/ }),
    )

    expect(
      screen.getByRole('button', { name: /Diâmetro/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByText('19"'),
    ).not.toBeInTheDocument()
  })

  test('defaultOpen={false} começa colapsada e expande ao clicar', () => {
    render(
      <CollapsibleFilterSection
        title="Furação"
        defaultOpen={false}
      >
        <div>5x112</div>
      </CollapsibleFilterSection>,
    )

    expect(
      screen.getByRole('button', { name: /Furação/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByText('5x112'),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Furação/ }),
    )

    expect(screen.getByText('5x112')).toBeInTheDocument()
  })

  test('mostra a contagem de valores ativos no cabeçalho', () => {
    render(
      <CollapsibleFilterSection
        title="Offset (ET)"
        activeCount={2}
      >
        <div>ET30</div>
      </CollapsibleFilterSection>,
    )

    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
