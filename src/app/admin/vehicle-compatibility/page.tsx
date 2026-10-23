import VehicleCompatibilityClient from './vehicle-compatibility-client'

export default function VehicleCompatibilityPage() {
  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef5b2a]">
          Dados partilhados
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          Compatibilidade de veículos
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687078]">
          Gere a hierarquia usada pelos produtos:
          marca, modelo, geração/chassis e
          motor/configuração.
        </p>
      </header>

      <VehicleCompatibilityClient />
    </main>
  )
}
