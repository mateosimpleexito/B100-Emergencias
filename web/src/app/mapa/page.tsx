import Link from 'next/link'
import MapaEmergencias from './MapaEmergencias'

export const metadata = {
  title: 'Mapa de Emergencias — B100',
}

export default function MapaPage() {
  return (
    <main className="flex flex-col h-screen max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <Link href="/" className="text-zinc-400 text-2xl leading-none">←</Link>
        <div>
          <h1 className="text-base font-bold leading-none">Mapa de emergencias</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Hidrantes · Hospitales · Seguros</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MapaEmergencias />
      </div>
    </main>
  )
}
