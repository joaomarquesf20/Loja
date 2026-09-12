import { prisma } from './db'

export const MAX_FAILED_LOGIN_ATTEMPTS =
  5

export const LOGIN_FAILURE_WINDOW_MS =
  15 * 60 * 1000

export const LOGIN_BLOCK_DURATION_MS =
  60 * 1000

const MAX_TRANSACTION_ATTEMPTS = 3

function isRetryableTransactionError(
  error: unknown,
) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error)
  ) {
    return false
  }

  return (
    (
      error as {
        code?: unknown
      }
    ).code === 'P2034'
  )
}

export function isLoginBlocked(
  blockedUntil: Date | null,
  now = new Date(),
) {
  return (
    blockedUntil !== null &&
    blockedUntil.getTime() >
      now.getTime()
  )
}

export async function recordFailedLogin(
  userId: string,
  now = new Date(),
) {
  for (
    let attempt = 1;
    attempt <=
    MAX_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const user =
            await tx.user.findUnique({
              where: {
                id: userId,
              },
              select: {
                isActive: true,
                failedLoginAttempts:
                  true,
                failedLoginWindowStartedAt:
                  true,
                loginBlockedUntil:
                  true,
              },
            })

          if (
            !user ||
            !user.isActive
          ) {
            return
          }

          if (
            isLoginBlocked(
              user.loginBlockedUntil,
              now,
            )
          ) {
            return
          }

          const previousBlockExpired =
            user.loginBlockedUntil !==
              null &&
            user.loginBlockedUntil.getTime() <=
              now.getTime()

          const windowExpired =
            user.failedLoginWindowStartedAt ===
              null ||
            now.getTime() -
              user.failedLoginWindowStartedAt.getTime() >=
              LOGIN_FAILURE_WINDOW_MS

          const resetWindow =
            previousBlockExpired ||
            windowExpired

          const nextAttempts =
            resetWindow
              ? 1
              : user.failedLoginAttempts +
                1

          const windowStartedAt =
            resetWindow
              ? now
              : user.failedLoginWindowStartedAt

          const shouldBlock =
            nextAttempts >=
            MAX_FAILED_LOGIN_ATTEMPTS

          const blockedUntil =
            shouldBlock
              ? new Date(
                  now.getTime() +
                    LOGIN_BLOCK_DURATION_MS,
                )
              : null

          await tx.user.update({
            where: {
              id: userId,
            },
            data: {
              failedLoginAttempts:
                nextAttempts,
              failedLoginWindowStartedAt:
                windowStartedAt,
              loginBlockedUntil:
                blockedUntil,
            },
          })
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

      return
    } catch (error) {
      if (
        !isRetryableTransactionError(
          error,
        ) ||
        attempt ===
          MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error
      }
    }
  }
}

export async function clearFailedLogins(
  userId: string,
) {
  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        {
          failedLoginAttempts: {
            gt: 0,
          },
        },
        {
          failedLoginWindowStartedAt:
            {
              not: null,
            },
        },
        {
          loginBlockedUntil: {
            not: null,
          },
        },
      ],
    },
    data: {
      failedLoginAttempts: 0,
      failedLoginWindowStartedAt:
        null,
      loginBlockedUntil: null,
    },
  })
}