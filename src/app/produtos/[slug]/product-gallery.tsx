'use client'

/* eslint-disable @next/next/no-img-element */

import {
  useMemo,
  useState,
} from 'react'
import {
  getProductGalleryImages,
  type ProductImageMetadata,
} from '@/lib/product-images'
import {
  useProductImageSelection,
} from './product-image-selection'

type ProductGalleryProps = {
  name: string
  images: string[]
  imageMetadata?: ProductImageMetadata[]
  finish?: string | null
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
  imageMetadata,
  finish,
}: ProductGalleryProps) {
  const { selectedFinish } =
    useProductImageSelection()
  const activeFinish =
    finish !== undefined
      ? finish
      : selectedFinish

  const galleryImages = useMemo(
    () =>
      getProductGalleryImages(
        {
          images,
          imageMetadata,
        },
        activeFinish,
      ),
    [
      images,
      imageMetadata,
      activeFinish,
    ],
  )

  const galleryKey = galleryImages
    .map((image) => image.id)
    .join('|')
  const [viewState, setViewState] =
    useState<{
      galleryKey: string
      selectedIndex: number
      failedImages: Set<string>
    }>({
      galleryKey: '',
      selectedIndex: 0,
      failedImages: new Set(),
    })
  const isCurrentGallery =
    viewState.galleryKey === galleryKey
  const safeSelectedIndex = Math.min(
    isCurrentGallery
      ? viewState.selectedIndex
      : 0,
    Math.max(
      galleryImages.length - 1,
      0,
    ),
  )
  const failedImages =
    isCurrentGallery
      ? viewState.failedImages
      : new Set<string>()
  const selectedImage =
    galleryImages[safeSelectedIndex]
  const selectedFailed =
    !selectedImage ||
    failedImages.has(selectedImage.id)

  function markImageAsFailed(
    imageId: string,
  ) {
    setViewState((current) => {
      const next = new Set(
        isCurrentGallery
          ? current.failedImages
          : new Set<string>(),
      )
      next.add(imageId)
      return {
        galleryKey,
        selectedIndex:
          current.selectedIndex,
        failedImages: next,
      }
    })
  }

  return (
    <section
      aria-label="Imagens do produto"
      className="min-w-0"
    >
      <div className="aspect-[6/5] min-h-[20rem] w-full overflow-hidden rounded-sm bg-[#111315] ring-1 ring-white/6 sm:min-h-0">
        {selectedFailed ? (
          <EmptyImage />
        ) : (
          <img
            src={selectedImage.url}
            alt={
              selectedImage.altText ||
              name
            }
            onError={() =>
              markImageAsFailed(
                selectedImage.id,
              )
            }
            className="h-full w-full object-contain p-5 sm:p-7 lg:p-9"
          />
        )}
      </div>

      {galleryImages.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5 lg:max-w-2xl">
          {galleryImages.map(
            (image, index) => {
              const isSelected =
                index === safeSelectedIndex
              const hasFailed =
                failedImages.has(image.id)

              return (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Ver imagem ${index + 1} de ${name}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    setViewState({
                      galleryKey,
                      selectedIndex: index,
                      failedImages,
                    })
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
                      src={image.url}
                      alt=""
                      onError={() =>
                        markImageAsFailed(
                          image.id,
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
