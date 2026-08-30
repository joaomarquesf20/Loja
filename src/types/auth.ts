/**
 * Tipos de autenticação para roles
 */

export type UserRole = 'ADMIN' | 'SELLER' | 'BUYER'

export interface User {
  id: string  // Prisma usa strings para IDs
  email: string
  name: string
  role: UserRole
}

export interface AuthCredentials {
  email: string
  password: string
}
