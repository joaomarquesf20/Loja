'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { AdminProduct } from '@/server/admin-products'

type Props = {
  product: AdminProduct
  busy: boolean
  onToggleActive: (product: AdminProduct) => void
  onDuplicate: (product: AdminProduct) => void
  onDelete: (product: AdminProduct) => void
}

const MENU_WIDTH = 192 // w-48, kept in sync with the width style below

/**
 * Dropdown with the per-product row actions. Keeps the table scannable:
 * one compact control per row instead of five flat buttons.
 *
 * The menu is positioned with `position: fixed` because the table lives in
 * an `overflow-x-auto` wrapper that would clip an absolutely positioned
 * panel. It closes on scroll/resize so it never detaches from its row.
 */
export default function ProductsRowMenu({
  product,
  busy,
  onToggleActive,
  onDuplicate,
  onDelete,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{
    top: number
    right: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    function handleViewportChange() {
      setIsOpen(false)
    }

    const buttonRect =
      menuButtonRef.current?.getBoundingClientRect()
    if (buttonRect) {
      setPosition({
        top: buttonRect.bottom + 4,
        right: window.innerWidth - buttonRect.right,
      })
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [isOpen])

  const itemClassName =
    'w-full rounded px-3 py-1.5 text-left text-sm font-bold transition hover:bg-black/5 disabled:opacity-50'

  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
    >
      <button
        ref={menuButtonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Ações para ${product.name}`}
        disabled={busy}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-md border border-black/12 px-3 py-1.5 text-sm font-bold transition hover:border-black/30 disabled:opacity-50"
      >
        Ações
        <span aria-hidden="true" className="text-[10px] leading-none">
          ▾
        </span>
      </button>

      {isOpen && position && (
        <div
          role="menu"
          aria-label={`Ações para ${product.name}`}
          style={{
            position: 'fixed',
            top: position.top,
            right: position.right,
            width: MENU_WIDTH,
          }}
          className="z-50 rounded-md border border-black/12 bg-white p-1 shadow-xl shadow-black/10"
        >
          <Link
            role="menuitem"
            href={`/admin/products/${product.id}`}
            className={itemClassName}
          >
            Editar
          </Link>
          <a
            role="menuitem"
            href={`/produtos/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className={itemClassName}
          >
            Preview
          </a>
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={() => {
              setIsOpen(false)
              onDuplicate(product)
            }}
            className={itemClassName}
          >
            Duplicar
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={() => {
              setIsOpen(false)
              onToggleActive(product)
            }}
            className={itemClassName}
          >
            {product.isActive ? 'Desativar' : 'Ativar'}
          </button>
          <div role="none" className="my-1 border-t border-black/10" />
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={() => {
              setIsOpen(false)
              onDelete(product)
            }}
            className={`${itemClassName} text-red-700`}
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}
