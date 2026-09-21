'use client'

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react'

type ProductGalleryProps = {
  name: string
  images: string[]
}

function EmptyImage() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        aria-hidden="true"
        className="size-36 rounded-full border-[20px] border-white/7 sm:size-44 sm:border-[24px]"
      />

      <span className="absolute bottom-6 text-[10px] font-bold uppercase tracking-[0.12em] text-white/24">
        Imagem em breve
      </span>
    </div>
  )
}

export default function ProductGallery({
  name,
  images,
}: ProductGalleryProps) {
  const normalizedImages = useMemo(
    () =>
      Array.from(
        new Set(
          images
            .map((image) =>
              image.trim(),
            )
            .filter(Boolean),
        ),
      ),
    [images],
  )

  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0)

  const [failedImages, setFailedImages] =
    useState<Set<number>>(
      () => new Set(),
    )

  const selectedImage =
    normalizedImages[selectedIndex]

  const selectedFailed =
    selectedImage === undefined ||
    failedImages.has(selectedIndex)

  function markImageAsFailed(
    index: number,
  ) {
    setFailedImages(
      (current) => {
        const next = new Set(current)
        next.add(index)
        return next
      },
    )
  }

  return (
    <section
      aria-label="Imagens do produto"
      className="min-w-0"
    >
      <div className="aspect-[6/5] min-h-[20rem] overflow-hidden rounded-sm bg-[#111315] ring-1 ring-white/6 sm:min-h-0">
        {selectedFailed ? (
          <EmptyImage />
        ) : (
          <img
            src={selectedImage}
            alt={name}
            onError={() =>
              markImageAsFailed(
                selectedIndex,
              )
            }
            className="h-full w-full object-contain p-5 sm:p-7 lg:p-9"
          />
        )}
      </div>

      {normalizedImages.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5 lg:max-w-2xl">
          {normalizedImages.map(
            (image, index) => {
              const isSelected =
                index === selectedIndex

              const hasFailed =
                failedImages.has(index)

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  aria-label={`Ver imagem ${index + 1} de ${name}`}
                  aria-pressed={
                    isSelected
                  }
                  onClick={() =>
                    setSelectedIndex(
                      index,
                    )
                  }
                  className={`aspect-square overflow-hidden rounded-sm bg-[#111315] p-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${isSelected
                    ? 'ring-1 ring-brand/70'
                    : 'ring-1 ring-white/6 hover:ring-white/16'}`}
                >
                  {hasFailed ? (
                    <span className="grid h-full w-full place-items-center text-[9px] font-bold uppercase tracking-[0.08em] text-white/24">
                      Sem imagem
                    </span>
                  ) : (
                    <img
                      src={image}
                      alt=""
                      onError={() =>
                        markImageAsFailed(
                          index,
                        )
                      }
                      className="h-full w-full object-contain"
                    />
                  )}
                </button>
              )
            },
          )}
        </div>
      )}
    </section>
  )
}
