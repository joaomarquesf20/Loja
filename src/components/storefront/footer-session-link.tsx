'use client'

import Link from 'next/link'
import {
  signOut,
  useSession,
} from 'next-auth/react'
import { useState } from 'react'

const footerLinkClass =
  'w-fit text-left text-sm font-semibold text-gray-600 transition hover:text-gray-900'

export default function FooterSessionLink() {
  const { status } = useSession()

  const [
    isSigningOut,
    setIsSigningOut,
  ] = useState(false)

  if (status !== 'authenticated') {
    return (
      <Link
        href="/login"
        className={footerLinkClass}
      >
        Entrar
      </Link>
    )
  }

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOut({
        callbackUrl: '/',
      })
    } catch {
      setIsSigningOut(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() =>
        void handleSignOut()
      }
      disabled={isSigningOut}
      className={`${footerLinkClass} disabled:opacity-50`}
    >
      {isSigningOut
        ? 'A sair…'
        : 'Terminar sessão'}
    </button>
  )
}
