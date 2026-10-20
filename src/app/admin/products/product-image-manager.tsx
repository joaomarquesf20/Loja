'use client'

/* eslint-disable @next/next/no-img-element */

import {
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  AdminProductImage,
} from '@/server/admin-products'

type ImageDraft = AdminProductImage

type ImageGroup = {
  key: string | null
  label: string
  images: ImageDraft[]
}

type Props = {
  images: ImageDraft[]
  finishes: string[]
  defaultFinish?: string | null
  onDefaultFinishChange?: (
    value: string | null,
  ) => void
  onChange: (images: ImageDraft[]) => void
}

let draftSequence = 0

function nextDraftId() {
  draftSequence += 1
  return `draft-image-${Date.now()}-${draftSequence}`
}

function isValidImage(value: string) {
  if (
    value.startsWith('/') &&
    !value.startsWith('//')
  ) {
    return true
  }

  try {
    const url = new URL(value)
    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function normalizeGroupKey(
  value: string | null | undefined,
) {
  return value?.trim() || null
}

function groupImages(
  images: ImageDraft[],
  finishes: string[],
): ImageGroup[] {
  const normalizedFinishes = Array.from(
    new Set(
      finishes
        .map((finish) => finish.trim())
        .filter(Boolean),
    ),
  )
  const groups: ImageGroup[] = [
    {
      key: null,
      label: 'Geral',
      images: [],
    },
    ...normalizedFinishes.map(
      (finish) => ({
        key: finish,
        label: finish,
        images: [],
      }),
    ),
  ]
  const groupsByKey = new Map(
    groups.map((group) => [
      group.key?.toLocaleLowerCase('pt-PT') ??
        '__general__',
      group,
    ]),
  )

  for (const image of images) {
    const key = normalizeGroupKey(image.finish)
    const groupKey =
      key?.toLocaleLowerCase('pt-PT') ??
      '__general__'
    let group = groupsByKey.get(groupKey)

    if (!group) {
      group = {
        key,
        label: key ?? 'Geral',
        images: [],
      }
      groups.push(group)
      groupsByKey.set(groupKey, group)
    }

    group.images.push(image)
  }

  for (const group of groups) {
    group.images.sort(
      (first, second) =>
        (first.sortOrder ?? 0) -
          (second.sortOrder ?? 0) ||
        first.id.localeCompare(second.id),
    )
  }

  return groups
}

function normalizeImages(
  images: ImageDraft[],
  finishes: string[],
) {
  const groups = groupImages(
    images,
    finishes,
  )
  const normalized: ImageDraft[] = []

  for (const group of groups) {
    const primaryId =
      group.images.find(
        (image) => image.isPrimary,
      )?.id ?? group.images[0]?.id

    group.images.forEach(
      (image, index) => {
        normalized.push({
          ...image,
          sortOrder: index,
          isPrimary:
            image.id === primaryId,
        })
      },
    )
  }

  return normalized
}

function replaceGroupImages(
  images: ImageDraft[],
  finishes: string[],
  groupKey: string | null,
  nextGroupImages: ImageDraft[],
) {
  const groups = groupImages(
    images,
    finishes,
  )
  const targetKey =
    groupKey?.toLocaleLowerCase('pt-PT') ??
    '__general__'
  const nextByKey = new Map(
    groups.map((group) => [
      group.key?.toLocaleLowerCase('pt-PT') ??
        '__general__',
      group,
    ]),
  )
  const target = nextByKey.get(targetKey)
  if (target) {
    target.images = nextGroupImages
  }

  return normalizeImages(
    groups.flatMap((group) => group.images),
    finishes,
  )
}

export default function ProductImageManager({
  images,
  finishes,
  defaultFinish,
  onDefaultFinishChange,
  onChange,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(null)
  const uploadTargetRef =
    useRef<string | null>(null)
  const [uploading, setUploading] =
    useState(false)
  const [errors, setErrors] = useState<
    string[]
  >([])
  const [advancedUrls, setAdvancedUrls] =
    useState('')
  const [advancedFinish, setAdvancedFinish] =
    useState<string | null>(null)
  const [draggingId, setDraggingId] =
    useState<string | null>(null)
  const [dragOverKey, setDragOverKey] =
    useState<string | null>(null)

  const groups = useMemo(
    () => groupImages(images, finishes),
    [images, finishes],
  )

  function commit(nextImages: ImageDraft[]) {
    onChange(
      normalizeImages(
        nextImages,
        finishes,
      ),
    )
  }

  function openFilePicker(
    finish: string | null = null,
  ) {
    uploadTargetRef.current = finish
    fileInputRef.current?.click()
  }

  async function uploadFiles(
    fileList: FileList | File[],
  ) {
    const files = Array.from(fileList)
    if (files.length === 0) {
      return
    }

    setUploading(true)
    setErrors([])
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }

    try {
      const response = await fetch(
        '/api/admin/images/upload',
        {
          method: 'POST',
          body: formData,
        },
      )
      const body =
        (await response.json().catch(
          () => ({}),
        )) as {
          images?: Array<{
            url: string
            originalName?: string
          }>
          errors?: Array<{
            fileName?: string
            message?: string
          }>
          error?: string
        }

      if (!response.ok && !body.images) {
        throw new Error(
          body.error ??
            'Não foi possível carregar as imagens.',
        )
      }

      const targetFinish =
        uploadTargetRef.current
      const currentGroups = groupImages(
        images,
        finishes,
      )
      const targetKey =
        targetFinish?.toLocaleLowerCase(
          'pt-PT',
        ) ?? '__general__'
      const targetGroup =
        currentGroups.find(
          (group) =>
            (group.key?.toLocaleLowerCase(
              'pt-PT',
            ) ?? '__general__') ===
            targetKey,
        )
      let nextSortOrder =
        (targetGroup?.images.length ?? 0) + 1

      const uploaded = (
        body.images ?? []
      ).map((image) => {
        const next: ImageDraft = {
          id: nextDraftId(),
          url: image.url,
          altText: null,
          sortOrder: nextSortOrder,
          isPrimary:
            !targetGroup ||
            targetGroup.images.length === 0,
          finish: targetFinish,
          finishValueId: null,
        }
        nextSortOrder += 1
        return next
      })

      if (uploaded.length > 0) {
        commit([
          ...images,
          ...uploaded,
        ])
      }

      const uploadErrors = (
        body.errors ?? []
      ).map(
        (error) =>
          `${error.fileName ?? 'Imagem'}: ${error.message ?? 'falhou'}`,
      )
      setErrors(uploadErrors)
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar as imagens.',
      ])
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      uploadTargetRef.current = null
    }
  }

  function updateImage(
    id: string,
    patch: Partial<ImageDraft>,
  ) {
    commit(
      images.map((image) =>
        image.id === id
          ? { ...image, ...patch }
          : image,
      ),
    )
  }

  function removeImage(id: string) {
    commit(
      images.filter(
        (image) => image.id !== id,
      ),
    )
  }

  function moveImage(
    group: ImageGroup,
    index: number,
    direction: -1 | 1,
  ) {
    const nextIndex = index + direction
    if (
      nextIndex < 0 ||
      nextIndex >= group.images.length
    ) {
      return
    }

    const next = [...group.images]
    const [image] = next.splice(index, 1)
    next.splice(nextIndex, 0, image)
    commit(
      replaceGroupImages(
        images,
        finishes,
        group.key,
        next.map(
          (candidate, candidateIndex) => ({
            ...candidate,
            sortOrder: candidateIndex,
          }),
        ),
      ),
    )
  }

  function setPrimary(
    group: ImageGroup,
    id: string,
  ) {
    commit(
      images.map((image) => {
        const imageGroup =
          normalizeGroupKey(
            image.finish,
          )?.toLocaleLowerCase('pt-PT') ??
          '__general__'
        const targetGroup =
          group.key?.toLocaleLowerCase(
            'pt-PT',
          ) ?? '__general__'
        return imageGroup === targetGroup
          ? {
              ...image,
              isPrimary: image.id === id,
            }
          : image
      }),
    )
  }

  function assignImage(
    image: ImageDraft,
    finish: string | null,
  ) {
    const oldGroup = groupImages(
      images,
      finishes,
    ).find((group) =>
      group.images.some(
        (candidate) =>
          candidate.id === image.id,
      ),
    )
    const next = images.map(
      (candidate) =>
        candidate.id === image.id
          ? {
              ...candidate,
              finish,
              finishValueId: null,
            }
          : candidate,
    )
    const newGroup = groupImages(
      next,
      finishes,
    ).find((group) =>
      group.images.some(
        (candidate) =>
          candidate.id === image.id,
      ),
    )
    const shouldMakePrimary =
      newGroup &&
      !newGroup.images.some(
        (candidate) =>
          candidate.id !== image.id &&
          candidate.isPrimary,
      )

    commit(
      next.map((candidate) => {
        if (
          shouldMakePrimary &&
          candidate.id === image.id
        ) {
          return {
            ...candidate,
            isPrimary: true,
          }
        }
        if (
          oldGroup?.key ===
            newGroup?.key &&
          candidate.id !== image.id &&
          oldGroup?.images.length === 1
        ) {
          return {
            ...candidate,
            isPrimary: true,
          }
        }
        return candidate
      }),
    )
  }

  function dropImage(
    targetGroup: ImageGroup,
    targetId?: string,
  ) {
    if (!draggingId) {
      return
    }

    const dragged = images.find(
      (image) => image.id === draggingId,
    )
    if (!dragged) {
      return
    }

    const withoutDragged = images.filter(
      (image) => image.id !== draggingId,
    )
    const targetImages = withoutDragged.filter(
      (image) =>
        (normalizeGroupKey(
          image.finish,
        )?.toLocaleLowerCase('pt-PT') ??
          '__general__') ===
        (targetGroup.key?.toLocaleLowerCase(
          'pt-PT',
        ) ?? '__general__'),
    )
    const movedImage: ImageDraft = {
      ...dragged,
      finish: targetGroup.key,
      finishValueId: null,
    }
    const targetIndex = targetId
      ? targetImages.findIndex(
          (image) => image.id === targetId,
        )
      : targetImages.length
    targetImages.splice(
      targetIndex < 0
        ? targetImages.length
        : targetIndex,
      0,
      movedImage,
    )
    const reorderedTargetImages =
      targetImages.map(
        (image, imageIndex) => ({
          ...image,
          sortOrder: imageIndex,
        }),
      )

    const otherImages = withoutDragged.filter(
      (image) =>
        !targetImages.some(
          (target) => target.id === image.id,
        ),
    )
    commit([
      ...otherImages,
      ...reorderedTargetImages,
    ])
    setDraggingId(null)
    setDragOverKey(null)
  }

  function addAdvancedImages() {
    const urls = advancedUrls
      .split('\n')
      .map((url) => url.trim())
      .filter(Boolean)
    const invalid = urls.filter(
      (url) => !isValidImage(url),
    )
    if (invalid.length > 0) {
      setErrors([
        ...invalid.map(
          (url) =>
            `URL inválido: ${url}`,
        ),
      ])
      return
    }
    if (urls.length === 0) {
      return
    }

    const group = groupImages(
      images,
      finishes,
    ).find(
      (candidate) =>
        candidate.key ===
        advancedFinish,
    )
    const start = group?.images.length ?? 0
    commit([
      ...images,
      ...urls.map((url, index) => ({
        id: nextDraftId(),
        url,
        altText: null,
        sortOrder: start + index,
        isPrimary:
          (group?.images.length ?? 0) === 0,
        finish: advancedFinish,
        finishValueId: null,
      })),
    ])
    setAdvancedUrls('')
    setErrors([])
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">
            Imagens do produto
          </h2>
          <p className="mt-1 text-sm text-[#687078]">
            Carrega várias imagens, arrasta
            para reordenar e escolhe a capa
            de cada galeria.
          </p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => openFilePicker()}
          className="rounded-md bg-[#ef5b2a] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
        >
          {uploading
            ? 'A carregar...'
            : '+ Upload images'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        className="hidden"
        aria-label="Selecionar imagens"
        onChange={(event) => {
          if (event.target.files) {
            void uploadFiles(event.target.files)
          }
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => openFilePicker()}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault()
            openFilePicker()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOverKey('__drop__')
        }}
        onDragLeave={() => setDragOverKey(null)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOverKey(null)
          uploadTargetRef.current = null
          void uploadFiles(event.dataTransfer.files)
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragOverKey === '__drop__'
            ? 'border-[#ef5b2a] bg-[#fff7f3]'
            : 'border-black/15 bg-[#fafaf9] hover:border-[#ef5b2a]/50'
        }`}
      >
        <p className="text-sm font-bold">
          Arrasta imagens para aqui
        </p>
        <p className="mt-1 text-xs text-[#687078]">
          JPG, PNG, WebP, AVIF ou GIF,
          até 10 MB por ficheiro.
        </p>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <p className="font-bold">
            Não foi possível carregar todas
            as imagens:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {finishes.length > 0 && (
        <label className="grid max-w-sm gap-1 text-sm font-bold">
          Acabamento da imagem de catálogo
          <select
            value={defaultFinish ?? ''}
            onChange={(event) =>
              onDefaultFinishChange?.(
                event.target.value || null,
              )
            }
            className="rounded-md border bg-white px-3 py-2 font-normal"
          >
            <option value="">
              Imagem geral
            </option>
            {finishes.map((finish) => (
              <option
                key={finish}
                value={finish}
              >
                {finish}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <div
            key={group.key ?? '__general__'}
            className="rounded-xl border border-black/8 bg-[#fafaf9] p-4"
            onDragOver={(event) => {
              event.preventDefault()
              setDragOverKey(
                group.key ?? '__general__',
              )
            }}
            onDrop={(event) => {
              event.preventDefault()
              dropImage(group)
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-black uppercase tracking-[0.08em]">
                  {group.label}
                </h3>
                <p className="text-xs text-[#687078]">
                  {group.images.length}{' '}
                  {group.images.length === 1
                    ? 'imagem'
                    : 'imagens'}
                </p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() =>
                  openFilePicker(group.key)
                }
                className="rounded-md border border-black/12 bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-50"
              >
                + Adicionar
              </button>
            </div>

            {group.images.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-black/15 p-4 text-center text-xs text-[#687078]">
                Sem imagens atribuídas a este
                grupo.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.images.map(
                  (image, index) => (
                    <article
                      key={image.id}
                      draggable
                      onDragStart={() =>
                        setDraggingId(image.id)
                      }
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverKey(null)
                      }}
                      onDragOver={(event) =>
                        event.preventDefault()
                      }
                      onDrop={(event) => {
                        event.stopPropagation()
                        dropImage(
                          group,
                          image.id,
                        )
                      }}
                      className={`rounded-lg border bg-white p-2 ${
                        draggingId === image.id
                          ? 'border-[#ef5b2a] opacity-60'
                          : 'border-black/10'
                      }`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[#171a1d]">
                        <img
                          src={image.url}
                          alt={
                            image.altText ||
                            group.label
                          }
                          className="h-full w-full object-contain"
                        />
                        {image.isPrimary && (
                          <span className="absolute left-2 top-2 rounded bg-[#ef5b2a] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white">
                            Capa
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPrimary(
                              group,
                              image.id,
                            )
                          }
                          className="rounded border border-black/10 px-2 py-1 text-[11px] font-bold"
                        >
                          {image.isPrimary
                            ? 'Capa definida'
                            : 'Definir capa'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Mover imagem ${index + 1} para cima`}
                          disabled={index === 0}
                          onClick={() =>
                            moveImage(
                              group,
                              index,
                              -1,
                            )
                          }
                          className="rounded border border-black/10 px-2 py-1 text-xs disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Mover imagem ${index + 1} para baixo`}
                          disabled={
                            index ===
                            group.images.length - 1
                          }
                          onClick={() =>
                            moveImage(
                              group,
                              index,
                              1,
                            )
                          }
                          className="rounded border border-black/10 px-2 py-1 text-xs disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar imagem ${index + 1}`}
                          onClick={() =>
                            removeImage(image.id)
                          }
                          className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>

                      <label className="mt-2 grid gap-1 text-[11px] font-bold">
                        Texto alternativo
                        <input
                          aria-label={`Texto alternativo da imagem ${index + 1}`}
                          value={
                            image.altText ?? ''
                          }
                          onChange={(event) =>
                            updateImage(
                              image.id,
                              {
                                altText:
                                  event.target
                                    .value,
                              },
                            )
                          }
                          placeholder="Ex.: Vista lateral da jante"
                          className="rounded border px-2 py-1.5 font-normal"
                        />
                      </label>

                      <p className="mt-2 text-[11px] font-bold text-[#687078]">
                        Grupo:{' '}
                        <span className="text-black">
                          {group.label}
                        </span>
                      </p>

                      <label className="mt-2 grid gap-1 text-[11px] font-bold">
                        Alterar grupo
                        <select
                          aria-label={`Grupo da imagem ${index + 1}`}
                          value={image.finish ?? ''}
                          onChange={(event) =>
                            assignImage(
                              image,
                              event.target
                                .value || null,
                            )
                          }
                          className="rounded border bg-white px-2 py-1.5 font-normal"
                        >
                          <option value="">
                            Geral
                          </option>
                          {finishes.map(
                            (finish) => (
                              <option
                                key={finish}
                                value={finish}
                              >
                                {finish}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </article>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <details className="rounded-lg border border-black/10 bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold">
          Avançado: adicionar URL ou caminho
        </summary>
        <p className="mt-2 text-xs text-[#687078]">
          Use apenas se a imagem já estiver
          num URL HTTP/HTTPS ou num caminho
          relativo servido pela loja.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <textarea
            rows={3}
            value={advancedUrls}
            onChange={(event) =>
              setAdvancedUrls(
                event.target.value,
              )
            }
            placeholder="Um URL ou caminho por linha"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <select
            value={advancedFinish ?? ''}
            onChange={(event) =>
              setAdvancedFinish(
                event.target.value || null,
              )
            }
            className="rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">
              Geral
            </option>
            {finishes.map((finish) => (
              <option
                key={finish}
                value={finish}
              >
                {finish}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addAdvancedImages}
            className="self-end rounded-md border border-black/12 px-4 py-2 text-sm font-bold"
          >
            Adicionar
          </button>
        </div>
      </details>
    </section>
  )
}
