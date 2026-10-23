'use client'

import { useState } from 'react'

import type { CatalogFilterProfile } from '@/lib/storefront-category-profile'

export type AdminVariantDraft = {
  key: string
  id?: string
  sku: string
  price: string
  stockQuantity: string
  isActive: boolean
  selections: Record<string, string>
  specifications?: Array<{
    key: string
    label: string
    value: string
    unit: string | null
    position: number
  }>
}

type Props = {
  profile: CatalogFilterProfile
  variants: AdminVariantDraft[]
  /**
   * Mensagens de conflito por índice de linha: presente quando outra
   * variante repete exatamente as especificações + acabamento.
   */
  conflicts?: Record<number, string>
  onChange: (
    variants: AdminVariantDraft[],
  ) => void
}

let variantSequence = 0

function nextKey() {
  variantSequence += 1
  return `variant-${Date.now()}-${variantSequence}`
}

export function createVariantDraft(
  values: Partial<AdminVariantDraft> = {},
): AdminVariantDraft {
  return {
    sku: '',
    price: '',
    stockQuantity: '0',
    isActive: true,
    selections: {},
    ...values,
    key: nextKey(),
  }
}

function numericInputClass() {
  return 'w-full min-w-20 rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm'
}

/**
 * Gerador de combinações: recebe listas de valores por eixo e devolve
 * todas as combinações como linhas prontas na tabela. O admin remove
 * as combinações impossíveis e preenche PCD/ET/CB/preço/stock.
 */
function generateCombinations(
  axes: Array<{
    code: string
    values: string[]
  }>,
): Array<Record<string, string>> {
  let combinations: Array<
    Record<string, string>
  > = [{}]

  for (const axis of axes) {
    const values = axis.values
      .map((value) => value.trim())
      .filter(Boolean)

    if (values.length === 0) {
      continue
    }

    const next: Array<
      Record<string, string>
    > = []

    for (const combination of combinations) {
      for (const value of values) {
        next.push({
          ...combination,
          [axis.code]: value,
        })
      }
    }

    combinations = next
  }

  return combinations
}

function textInputClass() {
  return 'w-full min-w-28 rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm'
}

function VariantActions({
  variant,
  index,
  variants,
  onChange,
}: {
  variant: AdminVariantDraft
  index: number
  variants: AdminVariantDraft[]
  onChange: Props['onChange']
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        aria-label={`Duplicar variante ${index + 1}`}
        onClick={() => {
          const duplicate = createVariantDraft({
            ...variant,
            id: undefined,
            sku: `${variant.sku}-COPY`,
          })
          onChange([
            ...variants.slice(0, index + 1),
            duplicate,
            ...variants.slice(index + 1),
          ])
        }}
        className="rounded border border-black/10 px-2 py-1 text-xs font-bold hover:bg-black/5"
      >
        Duplicar
      </button>
      <button
        type="button"
        aria-label={`Eliminar variante ${index + 1}`}
        onClick={() =>
          onChange(
            variants.filter(
              (_, itemIndex) =>
                itemIndex !== index,
            ),
          )
        }
        className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
      >
        Eliminar
      </button>
    </div>
  )
}

export default function ProductVariantEditor({
  profile,
  variants,
  conflicts,
  onChange,
}: Props) {
  const [generatorOpen, setGeneratorOpen] =
    useState(false)
  const [generatorAxes, setGeneratorAxes] =
    useState<Record<string, string>>({})

  /**
   * Gera todas as combinações dos eixos preenchidos e junta-as à
   * tabela. Combinações já existentes (mesmas especificações) não
   * são duplicadas — o admin remove as impossíveis e preenche o
   * resto sem clicar vinte vezes em "Adicionar variante".
   */
  function runGenerator() {
    const axesByProfile: Record<
      string,
      string[]
    > = {
      wheels: [
        'diameter',
        'width',
        'finish',
      ],
      suspension: [
        'front_drop_mm',
        'rear_drop_mm',
      ],
    }

    const codes =
      axesByProfile[profile] ?? []

    const axes = codes
      .map((code) => ({
        code,
        values: (
          generatorAxes[code] ?? ''
        )
          .split(/[,;\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
      }))
      .filter(
        (axis) => axis.values.length > 0,
      )

    if (axes.length === 0) {
      return
    }

    const combinations =
      generateCombinations(axes)

    const existingKeys = new Set(
      variants.map((variant) =>
        Object.entries(
          variant.selections,
        )
          .filter(([, value]) => value.trim())
          .sort(([left], [right]) =>
            left.localeCompare(right),
          )
          .map(
            ([code, value]) =>
              `${code}=${value.trim().toLocaleLowerCase('pt-PT')}`,
          )
          .join('\u0000'),
      ),
    )

    const nextVariants = [...variants]

    for (const combination of combinations) {
      const key = Object.entries(
        combination,
      )
        .sort(([left], [right]) =>
          left.localeCompare(right),
        )
        .map(
          ([code, value]) =>
            `${code}=${value.trim().toLocaleLowerCase('pt-PT')}`,
        )
        .join('\u0000')

      if (existingKeys.has(key)) {
        continue
      }

      existingKeys.add(key)

      nextVariants.push(
        createVariantDraft({
          selections: combination,
        }),
      )
    }

    onChange(nextVariants)
    setGeneratorAxes({})
    setGeneratorOpen(false)
  }

  function updateVariant(
    index: number,
    patch: Partial<AdminVariantDraft>,
  ) {
    onChange(
      variants.map((variant, itemIndex) =>
        itemIndex === index
          ? { ...variant, ...patch }
          : variant,
      ),
    )
  }

  function updateSelection(
    index: number,
    code: string,
    value: string,
  ) {
    updateVariant(index, {
      selections: {
        ...variants[index].selections,
        [code]: value,
      },
    })
  }

  function renderCommonCells(
    variant: AdminVariantDraft,
    index: number,
  ) {
    return (
      <>
        <td className="p-2">
          <input
            aria-label={`SKU da variante ${index + 1}`}
            required
            value={variant.sku}
            onChange={(event) =>
              updateVariant(index, {
                sku: event.target.value,
              })
            }
            className={textInputClass()}
          />
        </td>
        <td className="p-2">
          <input
            aria-label={`Preço da variante ${index + 1}`}
            required
            type="text"
            inputMode="decimal"
            placeholder="169,90"
            value={variant.price}
            onChange={(event) =>
              updateVariant(index, {
                price: event.target.value,
              })
            }
            className={numericInputClass()}
          />
        </td>
        <td className="p-2">
          <input
            aria-label={`Stock da variante ${index + 1}`}
            required
            type="text"
            inputMode="numeric"
            placeholder="8"
            value={variant.stockQuantity}
            onChange={(event) =>
              updateVariant(index, {
                stockQuantity:
                  event.target.value,
              })
            }
            className={numericInputClass()}
          />
        </td>
      </>
    )
  }

  function renderWheelCells(
    variant: AdminVariantDraft,
    index: number,
  ) {
    const fields = [
      {
        code: 'diameter',
        label: 'Diâmetro',
        placeholder: '18"',
      },
      {
        code: 'width',
        label: 'Largura',
        placeholder: '8J',
      },
      {
        code: 'pcd',
        label: 'PCD',
        placeholder: '5x112',
      },
      {
        code: 'offset',
        label: 'ET',
        placeholder: 'ET40',
      },
      {
        code: 'centre_bore',
        label: 'CB',
        placeholder: '66.6 mm',
      },
      {
        code: 'finish',
        label: 'Acabamento',
        placeholder: 'Satin Black',
      },
    ]

    return (
      <>
        {fields.map((field) => (
          <td key={field.code} className="p-2">
            <input
              aria-label={`${field.label} da variante ${index + 1}`}
              required
              value={
                variant.selections[field.code] ??
                ''
              }
              placeholder={field.placeholder}
              onChange={(event) =>
                updateSelection(
                  index,
                  field.code,
                  event.target.value,
                )
              }
              className={textInputClass()}
            />
          </td>
        ))}
        {renderCommonCells(variant, index)}
      </>
    )
  }

  function renderSuspensionCells(
    variant: AdminVariantDraft,
    index: number,
  ) {
    return (
      <>
        <td className="p-2">
          <input
            aria-label={`Rebaixo dianteiro da variante ${index + 1}`}
            required
            type="number"
            min="0"
            value={
              variant.selections.front_drop_mm ??
              ''
            }
            placeholder="30"
            onChange={(event) =>
              updateSelection(
                index,
                'front_drop_mm',
                event.target.value,
              )
            }
            className={numericInputClass()}
          />
        </td>
        <td className="p-2">
          <input
            aria-label={`Rebaixo traseiro da variante ${index + 1}`}
            required
            type="number"
            min="0"
            value={
              variant.selections.rear_drop_mm ?? ''
            }
            placeholder="30"
            onChange={(event) =>
              updateSelection(
                index,
                'rear_drop_mm',
                event.target.value,
              )
            }
            className={numericInputClass()}
          />
        </td>
        {renderCommonCells(variant, index)}
      </>
    )
  }

  const conflictEntries = Object.entries(
    conflicts ?? {},
  ).map(
    ([index, message]) =>
      [Number(index), message] as [
        number,
        string,
      ],
  )

  const title =
    profile === 'wheels'
      ? 'Variantes da jante'
      : profile === 'suspension'
        ? 'Variantes de rebaixo'
        : 'Variantes do produto'

  const description =
    profile === 'wheels'
      ? 'Cada linha é uma configuração real da mesma jante. Não Ligações a veículos.'
      : profile === 'suspension'
        ? 'Define o rebaixo dianteiro e traseiro de cada conjunto.'
        : 'Cada linha tem o seu próprio SKU, preço e stock.'

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">
            {title}
          </h3>
          <p className="mt-1 text-sm text-[#687078]">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile === 'wheels' && (
            <button
              type="button"
              onClick={() =>
                setGeneratorOpen(
                  (open) => !open,
                )
              }
              className="rounded-md border border-[#ef5b2a]/40 bg-[#fff7f3] px-4 py-2 text-sm font-bold text-[#ef5b2a] hover:border-[#ef5b2a]"
            >
              ⚙ Gerar combinações
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onChange([
                ...variants,
                createVariantDraft(
                  profile === 'suspension'
                    ? {
                        selections: {
                          front_drop_mm:
                            '30',
                          rear_drop_mm:
                            '30',
                        },
                      }
                    : {},
                ),
              ])
            }
            className="rounded-md border border-black/12 px-4 py-2 text-sm font-bold hover:border-black/30"
          >
            + Adicionar variante
          </button>
        </div>
      </div>

      {generatorOpen && (
        <div className="rounded-lg border border-[#ef5b2a]/30 bg-[#fff7f3] p-4">
          <p className="text-sm font-black">
            Gerar combinações de variantes
          </p>
          <p className="mt-1 text-xs text-[#687078]">
            Separa os valores por vírgula.
            Todas as combinações são criadas
            como linhas novas — remove as
            impossíveis e preenche PCD, ET,
            CB, SKU, preço e stock depois.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              {
                code: 'diameter',
                label: 'Diâmetros',
                placeholder:
                  '18, 19, 20',
              },
              {
                code: 'width',
                label: 'Larguras',
                placeholder:
                  '8.5, 9.5',
              },
              {
                code: 'finish',
                label: 'Acabamentos',
                placeholder:
                  'Silver, Gloss Black',
              },
            ].map((axis) => (
              <label
                key={axis.code}
                className="grid gap-1 text-xs font-bold"
              >
                {axis.label}
                <input
                  value={
                    generatorAxes[
                      axis.code
                    ] ?? ''
                  }
                  placeholder={
                    axis.placeholder
                  }
                  onChange={(
                    event,
                  ) =>
                    setGeneratorAxes(
                      (
                        current,
                      ) => ({
                        ...current,
                        [axis.code]:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm font-normal"
                />
              </label>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={runGenerator}
              className="rounded-md bg-[#ef5b2a] px-4 py-2 text-xs font-black text-white"
            >
              Gerar linhas
            </button>
            <button
              type="button"
              onClick={() =>
                setGeneratorOpen(false)
              }
              className="rounded-md border border-black/12 bg-white px-4 py-2 text-xs font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {variants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/20 bg-[#f8f8f7] p-8 text-center">
          <p className="font-semibold">
            Ainda não existem variantes
          </p>
          <button
            type="button"
            onClick={() =>
              onChange([
                createVariantDraft(),
              ])
            }
            className="mt-2 text-sm font-bold text-[#ef5b2a] underline"
          >
            Adicionar a primeira
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/8">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-[#f4f4f2] uppercase tracking-[0.05em] text-[#687078]">
              <tr>
                {profile === 'wheels' && (
                  <>
                    <th className="p-3">Diâmetro</th>
                    <th className="p-3">Largura</th>
                    <th className="p-3">PCD</th>
                    <th className="p-3">ET</th>
                    <th className="p-3">CB</th>
                    <th className="p-3">Acabamento</th>
                  </>
                )}
                {profile === 'suspension' && (
                  <>
                    <th className="p-3">
                      Rebaixo dianteiro
                    </th>
                    <th className="p-3">
                      Rebaixo traseiro
                    </th>
                  </>
                )}
                <th className="p-3">SKU</th>
                <th className="p-3">Preço</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Ativa</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6 bg-white">
              {variants.map((variant, index) => {
                const conflictMessage =
                  conflicts?.[index]

                return (
                  <tr
                    key={variant.key}
                    className={
                      conflictMessage
                        ? 'bg-red-50'
                        : undefined
                    }
                  >
                    {profile === 'wheels' &&
                      renderWheelCells(
                        variant,
                        index,
                      )}
                    {profile === 'suspension' &&
                      renderSuspensionCells(
                        variant,
                        index,
                      )}
                    {profile !== 'wheels' &&
                      profile !== 'suspension' &&
                      renderCommonCells(
                        variant,
                        index,
                      )}
                    <td className="p-2 text-center">
                      <input
                        aria-label={`Variante ${index + 1} ativa`}
                        type="checkbox"
                        checked={variant.isActive}
                        onChange={(event) =>
                          updateVariant(index, {
                            isActive:
                              event.target.checked,
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <VariantActions
                        variant={variant}
                        index={index}
                        variants={variants}
                        onChange={onChange}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {conflictEntries.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p className="font-black">
            Variantes repetidas
          </p>
          <p className="mt-1">
            Cada linha tem de ter o seu próprio acabamento ou
            especificações — mesmo o preço, stock e SKU diferentes não
            tornam duas linhas distintas.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {conflictEntries.map(
              ([index, message]) => (
                <li key={index}>
                  {message}
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </section>
  )
}
