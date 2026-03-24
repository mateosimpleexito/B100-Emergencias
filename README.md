# B100-Emergencias

![Estado](https://img.shields.io/badge/estado-en%20desarrollo-yellow)
![Next.js](https://img.shields.io/badge/Next.js-14+-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-verde?logo=supabase&color=3ECF8E)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-offline--first-orange)

Sistema de gestión de emergencias para **Bomberos Voluntarios San Isidro — Cuartel 100**.

PWA mobile-first para uso interno del personal: alerta de despacho, confirmación de respuesta, mapa en tiempo real de unidades, accountability en escena y registro de incidentes.

---

## Documentación

- [PLANNING.md](./PLANNING.md) — Documento de planificación completo: visión, stack, fases, modelos de datos, principios UX e integraciones

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14+ (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Backend / DB | Supabase (PostgreSQL + Realtime + Auth + Storage) |
| Push Notifications | Web Push API / FCM |
| Offline | Service Workers + IndexedDB |
| Mapas | Mapbox GL JS / Leaflet |
| Deploy | Vercel |

---

## Unidades del Cuartel 100

| Unidad | Tipo | Vehículo |
|---|---|---|
| Maquina 100 1 | Autobomba | Spartan Metrostar 2014 |
| Rescate 100 | Rescate | E-One Quest Rescue Pumper 2013 |
| Ambulancia 100 | Ambulancia | Mercedes Sprinter Bertolini 2019 |
| Auxiliar 1 | Auxiliar | Mitsubishi L200 |
| Auxiliar 2 | Auxiliar | Ford F250 |

---

## Configuración local (próximamente)

> Las instrucciones de setup se completarán una vez definida la estructura del proyecto en la Fase 1.

```bash
# Clonar el repositorio
git clone https://github.com/uchi516/b100-emergencias.git
cd b100-emergencias

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Completar con credenciales de Supabase

# Iniciar en desarrollo
npm run dev
```

---

## Fases de desarrollo

- **Fase 1** — Fundamentos: auth, PWA, alerta de despacho, mapa en tiempo real, guardias
- **Fase 2** — Seguridad: accountability en escena, PAR timer, MAYDAY, registro de incidentes
- **Fase 3** — Gestión: personal, vehículos, pre-planes, integración municipal

Ver [PLANNING.md](./PLANNING.md) para el detalle completo de cada fase.

---

## Licencia

Uso interno — Bomberos Voluntarios San Isidro. No distribuir.
