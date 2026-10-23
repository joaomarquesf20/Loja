'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import {
  detectColumnMapping,
  type ImportField,
} from '@/lib/catalog-import'

type ImportMode =
  | 'create-only'
  | 'create-update'

type ImportHistoryEntry = {
  id: string
  fileName: string
  mode: string
  status: string
  startedAt: string
  finishedAt: string | null
  createdBy: string | null
  createdProducts: number
  updatedProducts: number
  createdVariants: number
  updatedVariants: number
  errorCount: number
}

function historyStatusClass(
  status: string,
) {
  if (status === 'success') {
    return 'bg-green-100 text-green-800'
  }

  if (status === 'partial') {
    return 'bg-amber-100 text-amber-800'
  }

  return 'bg-red-100 text-red-800'
}

function historyStatusLabel(
  status: string,
) {
  if (status === 'success') {
    return 'sucesso'
  }

  if (status === 'partial') {
    return 'parcial'
  }

  return 'falhou'
}

const FIELD_LABELS: Record<
  ImportField,
  string
> = {
  productCode:
    'Código do produto (agrupamento)',
  productName: 'Nome do produto',
  brand: 'Fabricante',
  category: 'Categoria',
  description: 'Descrição',
  diameter: 'Diâmetro',
  width: 'Largura',
  pcd: 'Furação (PCD)',
  offset: 'Offset (ET)',
  centreBore: 'Furo central (CB)',
  finish: 'Cor / Acabamento',
  generalImage: 'Imagem geral (URL)',
  finishImage:
    'Imagem do acabamento (URL)',
  vehicleMake: 'Marca do veículo',
  vehicleModel: 'Modelo do veículo',
  vehicleGeneration:
    'Geração / chassis',
  vehicleEngine: 'Motor (código)',
  yearFrom: 'Ano inicial',
  yearTo: 'Ano final',
  frontDropMm: 'Rebaixo dianteiro',
  rearDropMm: 'Rebaixo traseiro',
  productType: 'Tipo de produto',
  sku: 'SKU da variante',
  price: 'Preço',
  priceSet: 'Preço do conjunto de 4',
  stock: 'Stock',
  isActive: 'Ativo',
}

const REQUIRED_BY_PROFILE: Record<
  string,
  ImportField[]
> = {
  wheels: [
    'productName',
    'price',
    'diameter',
    'width',
    'pcd',
    'offset',
    'centreBore',
    'finish',
  ],
  suspension: [
    'productName',
    'price',
    'vehicleMake',
    'vehicleModel',
    'frontDropMm',
    'rearDropMm',
  ],
  exterior: [
    'productName',
    'price',
    'productType',
  ],
  generic: ['productName', 'price'],
}

type PreviewVariant = {
  rowNumber: number
  sku: string
  skuGenerated: boolean
  supplierSku: string
  status: 'create' | 'update'
  collision: boolean
  price: number
  stock: number
}

type PreviewProduct = {
  groupKey: string
  name: string
  brand: string
  status: 'create' | 'update'
  variants: PreviewVariant[]
  images: Array<{
    url: string
    finish: string | null
  }>
}

type Preview = {
  profile: string
  mode: ImportMode
  skuStrategy: string
  productsToCreate: number
  productsToUpdate: number
  variantsToCreate: number
  variantsToUpdate: number
  generatedSkus: number
  matchedSkus: number
  collisions: number
  imagesToCreate: number
  products: PreviewProduct[]
  errors: Array<{
    row: number
    sku: string
    message: string
  }>
  warnings: Array<{
    row: number
    message: string
  }>
  totalRows: number
}

type CommitResult = {
  status: 'success' | 'failed' | 'partial'
  createdProducts: number
  updatedProducts: number
  createdVariants: number
  updatedVariants: number
  generatedSkus: number
  collisions: number
  createdImages: number
  matchedImages: number
  errorCount: number
  errors: Array<{
    row: number
    sku: string
    message: string
  }>
}

export default function ImportClient() {
  const [step, setStep] = useState<
    'upload' | 'mapping' | 'preview' | 'result'
  >('upload')
  const [fileName, setFileName] =
    useState('')
  const [fileText, setFileText] =
    useState('')
  const [dragOver, setDragOver] =
    useState(false)
  const [headers, setHeaders] =
    useState<string[]>([])
  const [mapping, setMapping] = useState<
    Partial<Record<ImportField, string>>
  >({})
  const [profile, setProfile] =
    useState<'wheels' | 'suspension' | 'exterior' | 'generic'>(
      'wheels',
    )
  const [mode, setMode] =
    useState<ImportMode>('create-update')
  const [skuStrategy, setSkuStrategy] =
    useState<'auto' | 'supplier' | 'custom'>(
      'auto',
    )
  const [failureMode, setFailureMode] =
    useState<'abort' | 'partial'>('abort')
  const [skuOverrides, setSkuOverrides] =
    useState<Record<number, string>>({})
  const [preview, setPreview] =
    useState<Preview | null>(null)
  const [result, setResult] =
    useState<CommitResult | null>(null)
  const [error, setError] = useState<
    string | null
  >(null)
  const [working, setWorking] =
    useState(false)
  const [history, setHistory] = useState<
    ImportHistoryEntry[]
  >([])
  const [historyLoading, setHistoryLoading] =
    useState(true)
  const [historyVersion, setHistoryVersion] =
    useState(0)

  // O histórico recarrega no arranque e depois de cada
  // tentativa de import (bump em historyVersion). Durante
  // atualizações a tabela anterior permanece visível.
  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/import/history')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            'Não foi possível obter o histórico.',
          )
        }

        return (await response.json()) as
          ImportHistoryEntry[]
      })
      .then((entries) => {
        if (!cancelled) {
          setHistory(entries)
        }
      })
      .catch(() => {
        // Histórico indisponível: a secção fica vazia.
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [historyVersion])

  const requiredFields =
    REQUIRED_BY_PROFILE[profile]

  async function readFile(
    file: File,
  ) {
    setError(null)
    setFileText('')

    const isCsv =
      /\.csv$/i.test(file.name) ||
      file.type === 'text/csv'

    if (!isCsv) {
      setError(
        'Formato não suportado. Usa um ficheiro CSV (XLSX: exporta como CSV).',
      )
      return
    }

    const text = await file.text()

    if (!text.trim()) {
      setError(
        'O ficheiro está vazio.',
      )
      return
    }

    setFileName(file.name)
    setFileText(text)

    const firstLine = text
      .split(/\r?\n/)[0]
      .trim()

    if (!firstLine) {
      setError(
        'O ficheiro não tem cabeçalhos.',
      )
      return
    }

    const delimiter = [
      ';',
      ',',
      '\t',
      '|',
    ].sort(
      (left, right) =>
        firstLine.split(right).length -
          firstLine.split(left).length,
    )[0]

    const parsedHeaders = firstLine
      .split(delimiter)
      .map((header) =>
        header.trim().replace(/^"|"$/g, ''),
      )

    setHeaders(parsedHeaders)
    setMapping(
      autoDetectMapping(parsedHeaders),
    )
    setStep('mapping')
  }

  async function loadPreview() {
    const missing = requiredFields.filter(
      (field) => !mapping[field],
    )

    if (missing.length > 0) {
      setError(
        `Mapeia as colunas obrigatórias: ${missing
          .map(
            (field) =>
              FIELD_LABELS[field],
          )
          .join(', ')}.`,
      )
      return
    }

    setWorking(true)
    setError(null)

    try {
      const response = await fetch(
        '/api/admin/import/preview',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            fileText,
            fileName,
            mapping,
            profile,
            mode,
            skuStrategy,
            skuOverrides,
          }),
        },
      )

      const body =
        (await response.json()) as
          | Preview
          | { error: string }

      if (!response.ok) {
        throw new Error(
          'error' in body
            ? body.error
            : 'Falha na pré-visualização.',
        )
      }

      setPreview(body as Preview)
      setStep('preview')
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'Falha na pré-visualização.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function runImport() {
    setWorking(true)
    setError(null)

    try {
      const response = await fetch(
        '/api/admin/import/commit',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            fileText,
            fileName,
            mapping,
            profile,
            mode,
            failureMode,
            skuStrategy,
            skuOverrides,
          }),
        },
      )

      const body =
        (await response.json()) as
          | CommitResult
          | { error: string }

      if (!response.ok) {
        throw new Error(
          'error' in body
            ? body.error
            : 'Falha na importação.',
        )
      }

      setResult(body as CommitResult)
      setStep('result')
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Falha na importação.',
      )
    } finally {
      setWorking(false)
      // Histórico recarrega mesmo quando o pedido é
      // rejeitado: tentativas falhadas ficam registadas.
      setHistoryVersion((version) =>
        version + 1,
      )
    }
  }

  function reset() {
    setStep('upload')
    setFileName('')
    setFileText('')
    setHeaders([])
    setMapping({})
    setPreview(null)
    setResult(null)
    setError(null)
    setHistoryVersion((version) =>
      version + 1,
    )
  }

  const errorCount =
    preview?.errors.length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef5b2a]">
            Importar catálogo
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Importação em massa
          </h1>
        </div>

        <Link
          href="/admin/products"
          className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold"
        >
          ← Produtos
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs font-bold">
        {(
          [
            'upload',
            'mapping',
            'preview',
            'result',
          ] as const
        ).map((stepName, index) => {
          const currentIndex =
            [
              'upload',
              'mapping',
              'preview',
              'result',
            ].indexOf(step)

          return (
            <li
              key={stepName}
              className={`rounded-full px-3 py-1.5 ${
                index <= currentIndex
                  ? 'bg-[#ef5b2a] text-white'
                  : 'bg-white text-[#687078] ring-1 ring-black/10'
              }`}
            >
              {index + 1}.{' '}
              {stepName === 'upload'
                ? 'Ficheiro'
                : stepName === 'mapping'
                  ? 'Colunas'
                  : stepName === 'preview'
                    ? 'Validação'
                    : 'Resultado'}
            </li>
          )
        })}
      </ol>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {step === 'upload' && (
        <section className="space-y-4">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() =>
              setDragOver(false)
            }
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)

              const file =
                event.dataTransfer
                  .files[0]

              if (file) {
                void readFile(file)
              }
            }}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition ${
              dragOver
                ? 'border-[#ef5b2a] bg-[#fff7f3]'
                : 'border-black/15 bg-white'
            }`}
          >
            <p className="text-sm font-bold">
              Arrasta o ficheiro CSV para
              aqui
            </p>
            <p className="mt-1 text-xs text-[#687078]">
              Ou seleciona manualmente.
              Suporta vírgula, ponto e
              vírgula ou tabulação como
              separador.
            </p>

            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Selecionar ficheiro CSV"
              className="mx-auto mt-4 block text-sm"
              onChange={(event) => {
                const file =
                  event.target
                    .files?.[0]

                if (file) {
                  void readFile(
                    file,
                  )
                }
              }}
            />
          </div>

          <div className="rounded-xl border border-black/8 bg-white p-5 text-sm">
            <h2 className="font-black">
              Como funciona
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#687078]">
              <li>
                Cada linha é uma{' '}
                <strong>variante</strong>
                ; linhas com o mesmo código
                de produto agrupam numa só
                ficha.
              </li>
              <li>
                O SKU identifica a variante:
                reimportar atualiza preço,
                stock e estado em vez de
                duplicar.
              </li>
              <li>
                Nada é escrito antes da
                validação completa; nada é
                apagado por faltar no
                ficheiro.
              </li>
            </ul>
          </div>
        </section>
      )}

      {step === 'mapping' && (
        <section className="space-y-4">
          <div className="rounded-xl border border-black/8 bg-white p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#687078]">
                  Ficheiro
                </p>
                <p className="font-black">
                  {fileName}
                </p>
              </div>

              <label className="grid gap-1 text-sm font-bold">
                Tipo de catálogo
                <select
                  value={profile}
                  onChange={(
                    event,
                  ) =>
                    setProfile(
                      event
                        .target
                        .value as
                        'wheels' | 'suspension' | 'exterior' | 'generic',
                    )
                  }
                  className="rounded-md border px-3 py-2 font-normal"
                >
                  <option value="wheels">
                    Jantes
                  </option>
                  <option value="suspension">
                    Suspensão
                  </option>
                  <option value="exterior">
                    Exterior
                  </option>
                  <option value="generic">
                    Genérico
                  </option>
                </select>
              </label>

              <label className="grid gap-1 text-sm font-bold">
                Modo
                <select
                  value={mode}
                  onChange={(
                    event,
                  ) =>
                    setMode(
                      event
                        .target
                        .value as ImportMode,
                    )
                  }
                  className="rounded-md border px-3 py-2 font-normal"
                >
                  <option value="create-update">
                    Criar + atualizar
                    existentes
                  </option>
                  <option value="create-only">
                    Apenas criar novos
                  </option>
                </select>
              </label>

              <label className="grid gap-1 text-sm font-bold">
                SKUs
                <select
                  value={skuStrategy}
                  onChange={(
                    event,
                  ) =>
                    setSkuStrategy(
                      event
                        .target
                        .value as
                        | 'auto'
                        | 'supplier'
                        | 'custom',
                    )
                  }
                  className="rounded-md border px-3 py-2 font-normal"
                >
                  <option value="auto">
                    Gerados
                    automaticamente
                  </option>
                  <option value="supplier">
                    Usar referência do
                    fornecedor
                  </option>
                  <option value="custom">
                    Editados manualmente
                  </option>
                </select>
              </label>

              <label className="grid gap-1 text-sm font-bold">
                Se algo falhar
                <select
                  value={failureMode}
                  onChange={(
                    event,
                  ) =>
                    setFailureMode(
                      event
                        .target
                        .value as
                        | 'abort'
                        | 'partial',
                    )
                  }
                  className="rounded-md border px-3 py-2 font-normal"
                >
                  <option value="abort">
                    Abortar tudo (mais
                    seguro)
                  </option>
                  <option value="partial">
                    Importar o que estiver
                    válido
                  </option>
                </select>
              </label>
            </div>

            {skuStrategy === 'custom' && (
              <p className="mt-3 rounded-lg border border-[#ef5b2a]/30 bg-[#fff7f3] p-3 text-xs text-[#687078]">
                Modo manual: edita os SKUs na
                tabela de pré-visualização antes de
                importar. SKUs manuais são validados
                no servidor e nunca recebem sufixos
                automáticos — colidem com erro
                explícito.
              </p>
            )}

            <h2 className="mt-5 font-black">
              Mapeamento de colunas
            </h2>
            <p className="mt-1 text-sm text-[#687078]">
              Detetado automaticamente —
              confirma ou ajusta. Campos
              marcados com * são
              obrigatórios.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(
                Object.keys(
                  FIELD_LABELS,
                ) as ImportField[]
              ).map((field) => {
                const isRequired =
                  requiredFields.includes(
                    field,
                  )

                return (
                  <label
                    key={field}
                    className="grid gap-1 text-xs font-bold"
                  >
                    {FIELD_LABELS[
                      field
                    ]}
                    {isRequired
                      ? ' *'
                      : ''}
                    <select
                      value={
                        mapping[
                          field
                        ] ?? ''
                      }
                      onChange={(
                        event,
                      ) =>
                        setMapping(
                          (
                            current,
                          ) => ({
                            ...current,
                            [field]:
                              event
                                .target
                                .value ||
                              undefined,
                          }),
                        )
                      }
                      className="rounded-md border px-2 py-1.5 font-normal"
                    >
                      <option value="">
                        — Ignorar —
                      </option>
                      {headers.map(
                        (
                          header,
                        ) => (
                          <option
                            key={
                              header
                            }
                            value={
                              header
                            }
                          >
                            {
                              header
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() =>
                void loadPreview()
              }
              className="rounded-md bg-[#ef5b2a] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              {working
                ? 'A validar...'
                : 'Validar e pré-visualizar'}
            </button>
          </div>
        </section>
      )}

      {step === 'preview' && preview && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase text-emerald-700">
                Criar
              </p>
              <p className="mt-1 text-xl font-black">
                {preview.productsToCreate}{' '}
                produtos ·{' '}
                {
                  preview.variantsToCreate
                }{' '}
                variantes
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {preview.generatedSkus}{' '}
                SKUs gerados
              </p>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-bold uppercase text-sky-700">
                Atualizar
              </p>
              <p className="mt-1 text-xl font-black">
                {preview.productsToUpdate}{' '}
                produtos ·{' '}
                {
                  preview.variantsToUpdate
                }{' '}
                variantes
              </p>
              <p className="mt-1 text-xs text-sky-700">
                {preview.matchedSkus} SKUs
                já existentes
              </p>
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-bold uppercase text-violet-700">
                Imagens
              </p>
              <p className="mt-1 text-xl font-black">
                {
                  preview.imagesToCreate
                }{' '}
                a criar
              </p>
              <p className="mt-1 text-xs text-violet-700">
                geral + por acabamento
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase text-amber-700">
                Avisos
              </p>
              <p className="mt-1 text-xl font-black">
                {preview.warnings.length}
              </p>
              {preview.collisions > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  {
                    preview.collisions
                  }{' '}
                  colisões de SKU (sufixo
                  único)
                </p>
              )}
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold uppercase text-red-700">
                Erros
              </p>
              <p className="mt-1 text-xl font-black">
                {errorCount}
              </p>
            </div>
          </div>

          {errorCount > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-black">
                Corrige estas linhas antes de
                importar — nada será escrito
                enquanto houver erros.
              </p>
              <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-y-auto pl-5">
                {preview.errors.map(
                  (rowError, index) => (
                    <li
                      key={`${rowError.row}-${index}`}
                    >
                      Linha{' '}
                      {rowError.row}
                      {rowError.sku
                        ? ` (${rowError.sku})`
                        : ''}
                      :{' '}
                      {
                        rowError.message
                      }
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-black">
                Avisos
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {preview.warnings.map(
                  (warning, index) => (
                    <li
                      key={`${warning.row}-${index}`}
                    >
                      Linha{' '}
                      {warning.row}:{' '}
                      {warning.message}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-black/8 bg-white p-5">
            <h2 className="font-black">
              Produtos detetados (
              {preview.products.length})
            </h2>

            <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
              {preview.products.map(
                (product) => (
                  <details
                    key={
                      product.groupKey
                    }
                    className="rounded-lg border border-black/8 p-3"
                  >
                    <summary className="cursor-pointer text-sm font-bold">
                      {product.status ===
                      'create'
                        ? 'Novo'
                        : 'Atualizar'}
                      :{' '}
                      {product.name}{' '}
                      <span className="font-normal text-[#687078]">
                        (
                        {product.variants.length}{' '}
                        variantes)
                      </span>
                    </summary>

                    <table className="mt-2 w-full text-left text-xs">
                      <thead className="text-[#687078]">
                        <tr>
                          <th className="py-1">
                            Estado
                          </th>
                          <th className="py-1">
                            SKU
                          </th>
                          <th className="py-1">
                            Preço
                          </th>
                          <th className="py-1">
                            Stock
                          </th>
                          {skuStrategy ===
                            'custom' && (
                            <th className="py-1">
                              Editar SKU
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {product.variants.map(
                          (
                            variant,
                          ) => (
                            <tr
                              key={
                                variant.sku
                              }
                              className={
                                variant.collision
                                  ? 'bg-amber-50'
                                  : undefined
                              }
                            >
                              <td className="py-1">
                                {variant.status ===
                                'create'
                                  ? 'Nova'
                                  : 'Atualizar'}
                              </td>
                              <td className="py-1">
                                {
                                  variant.sku
                                }
                                {variant.skuGenerated && (
                                  <span
                                    title="SKU gerado automaticamente"
                                    className="ml-2 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-black text-[#2c5fb8]"
                                  >
                                    automático
                                  </span>
                                )}
                                {variant.collision && (
                                  <span
                                    title="SKU já pertence a outra variante; será criado com sufixo único"
                                    className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800"
                                  >
                                    colisão
                                  </span>
                                )}
                                {variant.supplierSku && (
                                  <span
                                    title={`Referência do fornecedor: ${variant.supplierSku}`}
                                    className="ml-2 text-[10px] text-[#687078]"
                                  >
                                    ref:{' '}
                                    {
                                      variant.supplierSku
                                    }
                                  </span>
                                )}
                              </td>
                              <td className="py-1">
                                {variant.price.toFixed(
                                  2,
                                )}{' '}
                                €
                              </td>
                              <td className="py-1">
                                {
                                  variant.stock
                                }
                              </td>
                              {skuStrategy ===
                                'custom' && (
                                <td className="py-1">
                                  <input
                                    aria-label={`Editar SKU da linha ${variant.rowNumber}`}
                                    defaultValue={
                                      skuOverrides[
                                        variant.rowNumber
                                      ] ?? ''
                                    }
                                    placeholder="SKU manual"
                                    className="w-32 rounded border border-black/10 px-2 py-1"
                                    onChange={(
                                      event,
                                    ) =>
                                      setSkuOverrides(
                                        (
                                          current,
                                        ) => ({
                                          ...current,
                                          [variant.rowNumber]:
                                            event.target.value.toUpperCase(),
                                        }),
                                      )
                                    }
                                  />
                                </td>
                              )}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>

                    {product.images.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#687078]">
                          {'Imagens a criar '}
                          ({product.images.length})
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {product.images.map(
                            (image) => (
                              <li
                                key={`${image.finish ?? 'geral'}|${image.url}`}
                                className="truncate text-[#3d434a]"
                              >
                                <span className="font-bold">
                                  {image.finish ===
                                  null
                                    ? 'Geral'
                                    : image.finish}
                                  {':'}
                                </span>{' '}
                                <span
                                  title={
                                    image.url
                                  }
                                >
                                  {
                                    image.url
                                  }
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </details>
                ),
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setStep('mapping')
              }
              className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold"
            >
              ← Ajustar mapeamento
            </button>
            <button
              type="button"
              disabled={
                working || errorCount > 0
              }
              onClick={() =>
                void runImport()
              }
              className="rounded-md bg-[#ef5b2a] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              {working
                ? 'A importar...'
                : errorCount > 0
                  ? 'Corrige os erros primeiro'
                  : 'Importar agora'}
            </button>
          </div>
        </section>
      )}

      {step === 'result' && result && (
        <section className="space-y-4">
          <div
            role="status"
            className={`rounded-xl border p-5 ${
              result.status === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : result.status === 'partial'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-red-200 bg-red-50'
            }`}
          >
            <p className="text-lg font-black">
              {result.status ===
              'success'
                ? 'Importação concluída'
                : result.status ===
                    'partial'
                  ? 'Importação parcial'
                  : 'Importação falhou'}
            </p>
            <p className="mt-1 text-sm">
              {result.createdProducts}{' '}
              produtos criados ·{' '}
              {result.updatedProducts}{' '}
              atualizados ·{' '}
              {result.createdVariants}{' '}
              variantes criadas ·{' '}
              {result.updatedVariants}{' '}
              atualizadas ·{' '}
              {result.createdImages}{' '}
              imagens criadas ·{' '}
              {result.matchedImages}{' '}
              imagens já existentes ·{' '}
              {result.generatedSkus} SKUs
              gerados ·{' '}
              {result.collisions} colisões ·{' '}
              {result.errorCount} erros
            </p>

            {result.errors.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {result.errors.map(
                  (
                    rowError,
                    index,
                  ) => (
                    <li
                      key={index}
                    >
                      {
                        rowError.sku
                      }
                      :{' '}
                      {
                        rowError.message
                      }
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-[#ef5b2a] px-5 py-2 text-sm font-black text-white"
            >
              Nova importação
            </button>
            <Link
              href="/admin/products"
              className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold"
            >
              Ver produtos
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black tracking-tight">
            Histórico de importações
          </h2>
          <button
            type="button"
            onClick={() =>
              setHistoryVersion((version) =>
                version + 1,
              )
            }
            className="rounded-md border border-black/12 bg-white px-3 py-1.5 text-xs font-bold hover:border-black/30"
          >
            Atualizar
          </button>
        </div>

        {historyLoading ? (
          <p className="rounded-lg border border-black/8 bg-white p-4 text-sm text-[#687078]">
            A carregar histórico…
          </p>
        ) : history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 bg-white p-4 text-sm text-[#687078]">
            Ainda não há importações registadas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-black/8">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="bg-[#f4f4f2] uppercase tracking-[0.05em] text-[#687078]">
                <tr>
                  <th className="p-3">Ficheiro</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Modo</th>
                  <th className="p-3">Produtos</th>
                  <th className="p-3">Variantes</th>
                  <th className="p-3">Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 bg-white">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="p-3 font-bold">
                      {entry.fileName}
                    </td>
                    <td className="p-3">
                      {new Date(
                        entry.startedAt,
                      ).toLocaleString('pt-PT')}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-black ${historyStatusClass(entry.status)}`}
                      >
                        {historyStatusLabel(
                          entry.status,
                        )}
                      </span>
                    </td>
                    <td className="p-3">
                      {entry.mode ===
                      'create-only'
                        ? 'Só criar'
                        : 'Criar + atualizar'}
                    </td>
                    <td className="p-3">
                      +{entry.createdProducts} /{' '}
                      ~{entry.updatedProducts}
                    </td>
                    <td className="p-3">
                      +{entry.createdVariants} /{' '}
                      ~{entry.updatedVariants}
                    </td>
                    <td className="p-3">
                      {entry.errorCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Pré-preenche o formulário com a MESMA deteção que o servidor
 * usa (fonte canónica em src/lib/catalog-import). Havia aqui uma
 * tabela de aliases duplicada que ficou desatualizada e nunca
 * reconhecia colunas como ImageGeralURL/ImageAcabamentoURL — o
 * mapping enviado ao commit perdia as imagens e a loja ficava
 * com "Imagem em breve".
 */
function autoDetectMapping(
  headers: string[],
): Partial<Record<ImportField, string>> {
  return detectColumnMapping(headers).mapping
}
