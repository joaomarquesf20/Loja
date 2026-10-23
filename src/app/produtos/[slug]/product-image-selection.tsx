'use client'

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

type ProductImageSelectionContextValue = {
  selectedFinish: string | null
  setSelectedFinish: Dispatch<
    SetStateAction<string | null>
  >
}

const defaultContext = {
  selectedFinish: null,
  setSelectedFinish: () => undefined,
}

const ProductImageSelectionContext =
  createContext<ProductImageSelectionContextValue>(
    defaultContext,
  )

export function ProductImageSelectionProvider({
  children,
}: {
  children: ReactNode
}) {
  const [selectedFinish, setSelectedFinish] =
    useState<string | null>(null)

  const value = useMemo(
    () => ({
      selectedFinish,
      setSelectedFinish,
    }),
    [selectedFinish],
  )

  return (
    <ProductImageSelectionContext.Provider
      value={value}
    >
      {children}
    </ProductImageSelectionContext.Provider>
  )
}

export function useProductImageSelection() {
  return useContext(
    ProductImageSelectionContext,
  )
}

export function useProductFinishSelection() {
  const { setSelectedFinish } =
    useProductImageSelection()
  return useCallback(
    (finish: string | null) => {
      setSelectedFinish(finish)
    },
    [setSelectedFinish],
  )
}
