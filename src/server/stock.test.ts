import { beforeEach, describe, expect, test, vi } from 'vitest'
import { decrementStock } from './stock'

type UpdateManyArgs = {
  where: {
    id: string
    stockQuantity: {
      gte: number
    }
  }
  data: {
    stockQuantity: {
      decrement: number
    }
  }
}

type UpdateManyFn = (args: UpdateManyArgs) => Promise<{ count: number }>

const mockUpdateMany = vi.fn<UpdateManyFn>()

const mockStockClient = {
  product: {
    updateMany: mockUpdateMany,
  },
}

describe('decrementStock', () => {
  beforeEach(() => {
    mockUpdateMany.mockReset()
  })

  describe('A - quantity = 0 (inválido)', () => {
    test('lança erro e não chama updateMany', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 })

      await expect(
        decrementStock(mockStockClient, 'product-1', 0)
      ).rejects.toThrow('Quantidade inválida')

      expect(mockUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('B - quantity = -1 (inválido)', () => {
    test('lança erro e não chama updateMany', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 })

      await expect(
        decrementStock(mockStockClient, 'product-1', -1)
      ).rejects.toThrow('Quantidade inválida')

      expect(mockUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('C - quantity decimal', () => {
    test('lança erro e não chama updateMany', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 })

      await expect(
        decrementStock(mockStockClient, 'product-1', 1.5)
      ).rejects.toThrow('Quantidade inválida')

      expect(mockUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('D - stock suficiente (updateMany devolve count: 1)', () => {
    test('decrementStock resolve sem erro', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 })

      await decrementStock(mockStockClient, 'product-1', 2)

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'product-1',
          stockQuantity: { gte: 2 },
        },
        data: {
          stockQuantity: { decrement: 2 },
        },
      })
    })
  })

  describe('E - stock insuficiente (updateMany devolve count: 0)', () => {
    test('lança erro "Stock insuficiente"', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 })

      await expect(
        decrementStock(mockStockClient, 'product-1', 2)
      ).rejects.toThrow('Stock insuficiente')

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'product-1',
          stockQuantity: { gte: 2 },
        },
        data: {
          stockQuantity: { decrement: 2 },
        },
      })
    })
  })
})