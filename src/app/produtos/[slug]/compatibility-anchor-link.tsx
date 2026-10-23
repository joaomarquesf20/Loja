'use client'

import type { MouseEvent } from 'react'

type CompatibilityAnchorLinkProps = {
  targetId: string
  applicationsCount: number
}

/**
 * Abre o painel de compatibilidade (um <details>) e faz
 * scroll até ele. Um simples href="#id" não abre o
 * <details> fechado, pelo que "Ver aplicação" parecia
 * não fazer nada / saltar para um sítio sem relação.
 */
export default function CompatibilityAnchorLink({
  targetId,
  applicationsCount,
}: CompatibilityAnchorLinkProps) {
  function handleClick(
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    event.preventDefault()

    const target =
      document.getElementById(targetId)

    if (!target) {
      return
    }

    if (
      target instanceof HTMLDetailsElement &&
      !target.open
    ) {
      target.open = true
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="transition hover:text-white"
    >
      {applicationsCount === 1
        ? 'Ver aplicação'
        : `Ver ${applicationsCount} aplicações`}
    </a>
  )
}
