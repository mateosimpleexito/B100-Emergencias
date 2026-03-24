# PLANNING.md — B100-Emergencias

> Herramienta de **apoyo operativo** para los bomberos del **Cuartel San Isidro 100**.
> No reemplaza la radio ni el sistema de despacho — lo complementa.

---

## 1. Visión y Contexto

### 1.1 Descripción del proyecto

B100-Emergencias es una Progressive Web App (PWA) mobile-first de uso interno.
Su función principal: **detectar automáticamente cuando una unidad de B100 es despachada y alertar a los bomberos con una alarma sonora**, mostrando los detalles del incidente y su ubicación en el mapa.

### 1.2 Contexto operativo

| | |
|---|---|
| **Cuartel** | Bomberos Voluntarios San Isidro — Cuartel 100 |
| **Personal** | ~100 bomberos voluntarios, máx. 50 activos simultáneos |
| **Despacho** | Central vía radio; emergencias visibles en [sgonorte.bomberosperu.gob.pe/24horas](https://sgonorte.bomberosperu.gob.pe/24horas) |
| **Usuarios** | Únicamente personal interno (no ciudadanos) |
| **Plataforma** | Web (mobile-first), instalable como PWA |
| **Alcance** | Herramienta de apoyo — no reemplaza la radio ni el despacho |

### 1.3 Unidades de B100

| Nombre | Código en SGO Norte | Tipo | Vehículo | Año |
|---|---|---|---|---|
| Maquina 100 1 | `M100-1` | Autobomba | Spartan Metrostar | 2014 |
| Rescate 100 | `RES-100` | Rescate | E-One Quest Rescue Pumper | 2013 |
| Ambulancia 100 | `AMB-100` | Ambulancia | Mercedes Sprinter Bertolini | 2019 |
| Auxiliar 1 | `AUX-100-1` | Auxiliar | Mitsubishi L200 | — |
| Auxiliar 2 | `AUX-100-2` | Auxiliar | Ford F250 | — |

---

## 2. Fuente de datos: SGO Norte

La web `sgonorte.bomberosperu.gob.pe/24horas` muestra una tabla HTML de las últimas 24 horas de emergencias con auto-refresh.

### Estructura de cada fila

| Campo HTML | Contenido | Ejemplo |
|---|---|---|
| `Nro Parte` | ID único del incidente | `2026009817` |
| `Fecha y hora` | Timestamp del despacho | `18/03/2026 11:03:12 p.m.` |
| `Dirección / Distrito` | Dirección + **coordenadas GPS** | `CL. S/N MEDIA LUNA (-11.9883,-76.9388) - LURIGANCHO` |
| `Tipo` | Clasificación de la emergencia | `INCENDIO / ESTRUCTURAS / VIVIENDA / MATERIAL NOBLE` |
| `Estado` | Estado actual | `ATENDIENDO` / `CERRADO` |
| `Máquinas` | Unidades despachadas (chips) | `M100-1`, `RES-100`, `AMB-100` |

**Clave:** las coordenadas GPS vienen embebidas en el texto de la dirección entre paréntesis. No se necesita geocodificación externa.

### Estrategia de integración

```
Cron job (cada 60 seg)
  └── GET sgonorte.bomberosperu.gob.pe/24horas
       └── parsear HTML con cheerio
            └── filtrar filas donde "Máquinas" contiene
                M100-1 | RES-100 | AMB-100 | AUX-100-1 | AUX-100-2
                 └── ¿es un Nro Parte nuevo?
                      ├── SÍ → guardar en DB → enviar Web Push a todos los suscriptores
                      └── NO → actualizar estado si cambió (ATENDIENDO → CERRADO)
```

---

## 3. Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | **Next.js 14+ (App Router)** | SSR, App Router, soporte PWA |
| UI | **Tailwind CSS + shadcn/ui** | Componentes accesibles, desarrollo rápido |
| Backend/DB | **Supabase (PostgreSQL)** | Realtime, Auth, RLS — tier gratis cubre el uso |
| Scraper | **Cheerio** en API Route / Edge Function | Parseo HTML liviano sin headless browser |
| Push Notif. | **Web Push API (VAPID)** | Funciona con browser cerrado; Android nativo |
| Cron | **Vercel Cron Jobs** | Llama al scraper cada 60 seg — gratuito |
| Offline | **Service Worker + Cache API** | Último incidente accesible sin red |
| Mapa | **Leaflet + OpenStreetMap** | Gratuito, offline tiles, sin límite de uso |
| Auth | **Supabase Auth** | Login por email/magic link — sin contraseñas |
| Deploy | **Vercel** | CI/CD nativo Next.js, dominio gratis |

### Por qué no headless browser para el scraper

La web de SGO Norte es HTML renderizado server-side (PHP/Laravel). Cheerio + fetch es suficiente, más rápido y sin overhead. Si en el futuro el sitio pasa a SPA con JS, se migra a Puppeteer.

---

## 4. MVP — Alcance del Proyecto Inicial

### 4.1 Módulo de Alarma (CORE)

El corazón de la app. Cuando una unidad de B100 es despachada:

1. El cron job detecta el nuevo `Nro Parte`
2. Inserta el incidente en la base de datos
3. Supabase Realtime notifica al servidor
4. El servidor envía **Web Push** a todos los dispositivos suscritos
5. El celular **suena y vibra** aunque el navegador esté cerrado
6. Al tocar la notificación → abre la pantalla del incidente

**Estados de la notificación:**
- 🔴 Nueva emergencia — unidad de B100 despachada
- 🟡 Actualización — cambio de estado del incidente
- ✅ Cerrado — incidente finalizado

### 4.2 Pantalla de Incidente

Al abrir la notificación, el bombero ve:

```
┌─────────────────────────────────────┐
│ 🔴 INCENDIO / ESTRUCTURAS           │
│ VIVIENDA / MATERIAL NOBLE           │
│                                     │
│ 📍 CL. S/N MEDIA LUNA, LURIGANCHO   │
│                                     │
│ 🚒 M100-1  🚑 AMB-100               │
│                                     │
│ 🕐 11:03 p.m.  •  Nro: 2026009817  │
│ Estado: ATENDIENDO                  │
│                                     │
│  [       VER EN MAPA       ]        │
└─────────────────────────────────────┘
```

### 4.3 Mapa del Incidente

- Pin en las coordenadas exactas del incidente
- Las coordenadas se extraen del texto de la dirección con regex: `/\((-?\d+\.\d+),(-?\d+\.\d+)\)/`
- Mapa base OpenStreetMap (sin costo)
- Botón "Abrir en Google Maps / Waze" para navegación

### 4.4 Historial de Emergencias B100

- Lista de los últimos incidentes donde participaron unidades de B100
- Filtros: fecha, tipo, unidad, estado
- Vista de detalle de cada incidente pasado

### 4.5 Suscripción a Alarmas

- Al entrar a la app por primera vez: "¿Activar alarmas?" → botón grande
- Guarda el `push subscription` en Supabase vinculado al usuario
- El bombero puede silenciar temporalmente (ej. está de franco)

---

## 5. Modelo de Datos (MVP)

### `incidents`

```sql
incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nro_parte       text UNIQUE NOT NULL,        -- "2026009817"
  type            text NOT NULL,               -- "INCENDIO / ESTRUCTURAS / ..."
  address         text NOT NULL,               -- dirección completa del SGO
  district        text,                        -- "LURIGANCHO"
  lat             float8,                      -- extraído de la dirección
  lng             float8,                      -- extraído de la dirección
  status          text NOT NULL,               -- "ATENDIENDO" | "CERRADO"
  dispatched_at   timestamptz NOT NULL,        -- fecha/hora del SGO
  units           text[] NOT NULL,             -- ["M100-1", "AMB-100"]
  raw_html        text,                        -- HTML de la fila (debug)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

### `push_subscriptions`

```sql
push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
)
```

### `profiles`

```sql
profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users,
  full_name   text NOT NULL,
  badge       text UNIQUE,          -- número de legajo
  role        text DEFAULT 'bombero',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
)
```

---

## 6. Flujo Técnico Completo

```
[SGO Norte web] ──(fetch HTML)──> [Vercel Cron /api/scraper]
                                          │
                              parsea tabla con cheerio
                                          │
                              ¿hay Nro Parte con M100-1/RES-100/AMB-100?
                                    │               │
                                   SÍ (nuevo)      NO → ignorar
                                    │
                          INSERT en incidents (Supabase)
                                    │
                          Supabase Realtime → [Next.js server]
                                    │
                          Web Push VAPID → todos los push_subscriptions activos
                                    │
                          [Celular del bombero]
                          suena alarma + vibración
                                    │
                          tap → /incidents/[nro_parte]
                          muestra detalles + mapa Leaflet
```

---

## 7. UX Principles (emergencias)

- **Offline-first:** el último incidente activo debe ser visible sin red (Service Worker cache)
- **2 toques máximo:** de la notificación al mapa, máximo 2 interacciones
- **Targets grandes:** mínimo 48×48px; botones primarios ≥ 40% del ancho
- **Dark mode por defecto:** operaciones nocturnas son la norma
- **Alarma siempre suena:** independiente del volumen del sistema (usar `<audio>` + notificación)
- **Coords automáticas:** nunca pedir al usuario que ingrese ubicación manualmente

---

## 8. Decisiones Técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Scraper | Cheerio (HTML) | SGO Norte es server-rendered, no SPA |
| Mapa | Leaflet + OSM | Gratis, sin API key, tiles offline |
| Push | Web Push VAPID | Sin app nativa; funciona en Android con browser cerrado |
| Cron | Vercel Cron | Integrado, gratis, sin infra extra |
| Auth | Magic link email | Sin contraseñas para usuarios no técnicos |
| iOS Push | Requiere iOS 16.4+ y "Añadir a pantalla de inicio" | Documentar en onboarding |

---

## 9. Fases futuras (post-MVP)

Luego de validar el MVP con la compañía:

- **Protocolos y herramientas:** fichas técnicas, procedimientos, guías de rescate
- **Historial estadístico:** dashboard de incidentes por tipo/mes/unidad
- **Pre-planes de edificios:** planos e info de inmuebles del distrito
- **Integración municipal:** hidrantes, datos catastrales de San Isidro
- **Gestión de personal:** legajos, certificaciones (como plus, no indispensable)

---

## 10. Convenciones del Proyecto

- **Código:** inglés (variables, funciones, esquema DB)
- **UI:** español (`"Emergencia activa"`, `"Ver en mapa"`)
- **Documentación:** español
- **Ramas:** `main` → producción, `develop` → integración, `feature/*`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`)

---

*Última actualización: marzo 2026*
*Documento vivo — se actualiza con el proyecto*
