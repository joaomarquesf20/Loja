import { act, renderHook } from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import {
  buildVehicleSelectionLabel,
  clearVehicleSelection,
  readVehicleSelection,
  subscribeVehicleSelection,
  useVehicleSelection,
  writeVehicleSelection,
} from './vehicle-selection'

const storedSelection = {
  configurationId: 'configuration-15td',
  label: 'Opel Corsa B 1.5 TD Sport',
  makeSlug: 'opel',
  modelSlug: 'corsa-b',
}

const STORAGE_KEY = 'pfa-veiculo'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe(
  'readVehicleSelection',
  () => {
    test(
      'devolve null sem registo em storage',
      () => {
        expect(
          readVehicleSelection(),
        ).toBeNull()
      },
    )

    test(
      'faz a volta completa do registo guardado',
      () => {
        writeVehicleSelection(
          storedSelection,
        )

        expect(
          readVehicleSelection(),
        ).toEqual(storedSelection)
      },
    )

    test(
      'ignora JSON inválido',
      () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          '{não é json',
        )

        expect(
          readVehicleSelection(),
        ).toBeNull()
      },
    )

    test(
      'ignora registos com campos inválidos',
      () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            configurationId: '',
            label: 'x',
            makeSlug: 'opel',
            modelSlug: null,
          }),
        )

        expect(
          readVehicleSelection(),
        ).toBeNull()
      },
    )
  },
)

describe(
  'writeVehicleSelection / clearVehicleSelection',
  () => {
    test(
      'grava e limpa o registo de storage',
      () => {
        writeVehicleSelection(
          storedSelection,
        )

        expect(
          window.localStorage.getItem(
            STORAGE_KEY,
          ),
        ).toBe(
          JSON.stringify(storedSelection),
        )

        clearVehicleSelection()

        expect(
          window.localStorage.getItem(
            STORAGE_KEY,
          ),
        ).toBeNull()
      },
    )

    test(
      'limpa registo inválido sem rebentar',
      () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          'lixo',
        )

        expect(() =>
          clearVehicleSelection(),
        ).not.toThrow()

        expect(
          readVehicleSelection(),
        ).toBeNull()
      },
    )
  },
)

describe(
  'subscribeVehicleSelection',
  () => {
    test(
      'descobre regressões por evento local',
      () => {
        const listener = vi.fn()
        const unsubscribe =
          subscribeVehicleSelection(
            listener,
          )

        writeVehicleSelection(
          storedSelection,
        )

        expect(listener).toHaveBeenCalledWith(
          storedSelection,
        )

        clearVehicleSelection()

        expect(
          listener,
        ).toHaveBeenLastCalledWith(null)

        unsubscribe()
      },
    )

    test(
      'descobre regressões por evento storage (outro tab)',
      () => {
        const listener = vi.fn()
        const unsubscribe =
          subscribeVehicleSelection(
            listener,
          )

        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
          }),
        )

        expect(listener).toHaveBeenCalledTimes(
          1,
        )

        unsubscribe()
      },
    )

    test(
      'deixa de notificar depois de unsubscribe',
      () => {
        const listener = vi.fn()
        const unsubscribe =
          subscribeVehicleSelection(
            listener,
          )

        unsubscribe()
        writeVehicleSelection(
          storedSelection,
        )

        expect(
          listener,
        ).not.toHaveBeenCalled()
      },
    )
  },
)

describe(
  'useVehicleSelection',
  () => {
    test(
      'lê a seleção guardada após a montagem',
      () => {
        writeVehicleSelection(
          storedSelection,
        )

        const { result } = renderHook(
          () => useVehicleSelection(),
        )

        expect(
          result.current,
        ).toEqual(storedSelection)
      },
    )

    test(
      'reage a mudanças e limpa',
      () => {
        const { result } = renderHook(
          () => useVehicleSelection(),
        )

        expect(
          result.current,
        ).toBeNull()

        act(() => {
          writeVehicleSelection(
            storedSelection,
          )
        })

        expect(
          result.current,
        ).toEqual(storedSelection)

        act(() => {
          clearVehicleSelection()
        })

        expect(
          result.current,
        ).toBeNull()
      },
    )
  },
)

describe(
  'buildVehicleSelectionLabel',
  () => {
    test(
      'compõe marca modelo configuração',
      () => {
        expect(
          buildVehicleSelectionLabel({
            makeName: 'Opel',
            modelName: 'Corsa B',
            configurationName:
              '1.5 TD Sport',
          }),
        ).toBe('Opel Corsa B 1.5 TD Sport')
      },
    )
  },
)
