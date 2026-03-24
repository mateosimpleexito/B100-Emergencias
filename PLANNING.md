# PLANNING.md — B100-Emergencias

> Documento de planificación del sistema de gestión de emergencias para **Bomberos Voluntarios San Isidro 100**.

---

## 1. Visión y Contexto

### 1.1 Descripción del proyecto

B100-Emergencias es una Progressive Web App (PWA) de uso interno para los bomberos voluntarios del **Cuartel San Isidro 100**. Su objetivo es digitalizar y agilizar la gestión operacional: desde la alerta de despacho hasta el cierre del incidente, pasando por el accountability en escena, la gestión de guardias y el registro histórico.

### 1.2 Contexto operativo

- **Organización:** Bomberos Voluntarios San Isidro (Argentina) — Cuartel 100
- **Personal:** aproximadamente 100 bomberos voluntarios
- **Despacho:** centralizado vía radio; las emergencias también son visibles en el sitio externo [bomberos24horas](https://www.bomberos24horas.com)
- **Guardias:** rotan en el cuartel; central despacha a quienes están de guardia
- **Destinatarios:** únicamente personal interno (no ciudadanos)
- **Objetivo a futuro:** integración con la Municipalidad de San Isidro

### 1.3 Problema que resuelve

Actualmente la coordinación se hace de forma manual (radio, WhatsApp, anotaciones en papel). Esto genera:

- Falta de accountability formal en escena (quién entró, cuándo, con qué EPP)
- Sin registro digital de quién respondió a cada despacho
- Gestión de guardias/turnos por fuera del sistema operativo
- Sin acceso rápido a información del incidente (dirección, tipo, historia del lugar)
- Dificultad para generar estadísticas e informes

---

## 2. Stack Tecnológico y Justificación

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | **Next.js 14+ (App Router)** | SSR/SSG para performance, file-based routing, soporte oficial para PWA |
| UI | **Tailwind CSS + shadcn/ui** | Desarrollo rápido, accesibilidad integrada, componentes headless |
| Backend/DB | **Supabase (PostgreSQL)** | Realtime nativo, Auth incluido, Storage, Row Level Security, open source |
| Realtime | **Supabase Realtime** | WebSockets sobre Postgres CDC — posiciones de unidades, estado de incidente |
| Push Notif. | **Web Push API / FCM** | Notificaciones nativas en Android (crítico para alertas de despacho) |
| Offline | **Service Workers + IndexedDB** | Acceso a datos en zonas sin señal; ley de Murphy aplica en emergencias |
| Mapas | **Mapbox GL JS** o **Leaflet + OSM** | Visualización de unidades, ruta, hidrantes, pre-planes |
| Auth | **Supabase Auth** | JWT, RLS por rol, soporte para invitación por email |
| Deploy | **Vercel** | CDN global, integración nativa con Next.js, previews por PR |

### 2.1 Por qué PWA y no app nativa

- Sin fricción de distribución (no requiere App Store para 100 usuarios)
- Actualización instantánea en todos los dispositivos
- Instalable en pantalla de inicio (Android/iOS)
- Costos de desarrollo y mantenimiento menores
- Funciona en cualquier dispositivo (incluyendo tablets en el cuartel)

---

## 3. Roles de Usuario

| Rol | Descripción | Permisos clave |
|---|---|---|
| **Bombero** | Miembro general de guardia | Ver incidentes activos, confirmar respuesta, ver mapa, registrar entrada/salida de escena |
| **Jefe de Guardia** | Responsable del turno en curso | Todo lo del Bombero + gestionar guardia, asignar unidades, iniciar/cerrar incidente |
| **Oficial de Incidente** | Comandante designado en escena | Todo lo del Jefe de Guardia en el incidente + autorizar acceso a escena, PAR check |
| **Admin** | Administrador del sistema | Gestión completa: personal, vehículos, roles, configuración del sistema |

---

## 4. Fases de Desarrollo

### Fase 1 — Fundamentos Operacionales (MVP)

**Objetivo:** Sistema funcional para el día a día: alerta, respuesta, mapa y guardias.

#### 4.1.1 Infraestructura base
- Scaffold Next.js 14 con App Router y TypeScript
- Setup de Supabase (proyecto, tablas iniciales, RLS)
- Configuración PWA (manifest.json, service worker, offline fallback)
- Sistema de autenticación (invitación por email, login seguro)
- Pipeline CI/CD con Vercel

#### 4.1.2 Alerta de despacho y confirmación de respuesta
- Push notification al momento de despacho (a bomberos de guardia)
- Pantalla de alerta con: tipo de incidente, dirección, hora, unidades despachadas
- Botón prominente "Voy" / "No voy" (confirmación en 1 tap)
- Vista de quiénes del equipo de guardia están respondiendo (en tiempo real)
- Entrada manual de incidentes (integración con bomberos24horas en Fase 2)

#### 4.1.3 Mapa en tiempo real
- Mapa como pantalla principal de la app
- Posición en tiempo real de las 5 unidades
- Estado de cada unidad: disponible / en camino / en escena / fuera de servicio
- Ruta desde la base al incidente
- Overlay de hidrantes (datos manuales en Fase 1)

#### 4.1.4 Gestión de guardias y turnos
- Calendario de guardias (quién está de guardia cada día/turno)
- Vista "guardia actual": lista de bomberos presentes en el cuartel
- Qué unidades están disponibles y tripuladas en el turno
- Las notificaciones de despacho solo llegan a bomberos de guardia activa
- Designación de Jefe de Guardia por turno

---

### Fase 2 — Seguridad y Registro

**Objetivo:** Accountability formal en escena e historial completo de incidentes.

#### 4.2.1 Accountability en escena
- Registro de entrada/salida de cada bombero a la zona caliente
- Asignación de Oficial de Incidente (IC)
- Timer PAR con recordatorios automáticos configurables
- Botón MAYDAY con alerta a todos los dispositivos
- Log de incidente con timestamps automáticos en cada acción

#### 4.2.2 Gestión y registro de incidentes
- Ciclo de vida completo: despacho → en camino → en escena → controlado → cerrado
- Informe de incidente autogenerado (PDF exportable)
- Documentación fotográfica desde la app
- Historial de incidentes con búsqueda y filtros
- Integración con bomberos24horas (scraping/API para importar datos del despacho)

---

### Fase 3 — Gestión de Compañía e Integraciones

**Objetivo:** Herramientas de administración, pre-planes y conexión con sistemas externos.

#### 4.3.1 Gestión de personal y vehículos
- Legajos de personal: roles, certificaciones, contacto de emergencia
- Registro de mantenimiento de cada uno de los 5 vehículos
- Pre-planes de edificios importantes del partido de San Isidro
- Dashboard de estadísticas (incidentes por tipo, respuesta por bombero, km por unidad)

#### 4.3.2 Integración con Municipalidad de San Isidro
- Propuesta de integración API con sistemas municipales
- Datos GIS de la municipalidad
- Base de datos de hidrantes de infraestructura municipal
- Datos catastrales para pre-planes

---

## 5. Modelos de Datos

### 5.1 `units` — Unidades

```sql
units (
  id            uuid PRIMARY KEY,
  name          text NOT NULL,           -- ej. "Maquina 100 1"
  short_name    text,                    -- ej. "M1"
  type          text,                    -- autobomba | rescate | ambulancia | auxiliar
  make          text,                    -- Spartan, E-One, Mercedes, Mitsubishi, Ford
  model         text,                    -- Metrostar, Quest, Sprinter, L200, F250
  year          int,
  status        text DEFAULT 'available', -- available | en_route | on_scene | out_of_service
  current_lat   float8,
  current_lng   float8,
  last_seen_at  timestamptz,
  created_at    timestamptz DEFAULT now()
)
```

**Pre-carga de las 5 unidades de B100:**

| Nombre | Tipo | Marca/Modelo | Año |
|---|---|---|---|
| Maquina 100 1 | autobomba | Spartan Metrostar | 2014 |
| Rescate 100 | rescate | E-One Quest Rescue Pumper | 2013 |
| Ambulancia 100 | ambulancia | Mercedes Sprinter Bertolini | 2019 |
| Auxiliar 1 | auxiliar | Mitsubishi L200 | — |
| Auxiliar 2 | auxiliar | Ford F250 | — |

---

### 5.2 `profiles` — Personal

```sql
profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users,
  full_name     text NOT NULL,
  badge_number  text UNIQUE,             -- número de legajo
  role          text DEFAULT 'bombero',  -- bombero | jefe_guardia | oficial_incidente | admin
  phone         text,
  certifications text[],
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
)
```

---

### 5.3 `shifts` — Guardias / Turnos

```sql
shifts (
  id              uuid PRIMARY KEY,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  jefe_guardia_id uuid REFERENCES profiles(id),
  notes           text,
  created_at      timestamptz DEFAULT now()
)

shift_members (
  id        uuid PRIMARY KEY,
  shift_id  uuid REFERENCES shifts(id),
  profile_id uuid REFERENCES profiles(id),
  checked_in_at  timestamptz,
  checked_out_at timestamptz
)
```

---

### 5.4 `incidents` — Incidentes

```sql
incidents (
  id              uuid PRIMARY KEY,
  incident_number text UNIQUE,          -- número de siniestro (ej. S-2024-001234)
  type            text,                 -- incendio | accidente | rescate | médico | etc.
  address         text NOT NULL,
  lat             float8,
  lng             float8,
  status          text DEFAULT 'dispatched',
    -- dispatched | en_route | on_scene | controlled | closed
  dispatched_at   timestamptz DEFAULT now(),
  arrived_at      timestamptz,
  controlled_at   timestamptz,
  closed_at       timestamptz,
  ic_id           uuid REFERENCES profiles(id),  -- Oficial de Incidente
  shift_id        uuid REFERENCES shifts(id),
  notes           text,
  source          text DEFAULT 'manual',  -- manual | bomberos24horas
  external_id     text,
  created_at      timestamptz DEFAULT now()
)
```

---

### 5.5 `incident_responses` — Respuestas al despacho

```sql
incident_responses (
  id          uuid PRIMARY KEY,
  incident_id uuid REFERENCES incidents(id),
  profile_id  uuid REFERENCES profiles(id),
  unit_id     uuid REFERENCES units(id),
  response    text,           -- going | not_going | standby
  responded_at timestamptz DEFAULT now()
)
```

---

### 5.6 `accountability` — Accountability en escena

```sql
accountability_log (
  id           uuid PRIMARY KEY,
  incident_id  uuid REFERENCES incidents(id),
  profile_id   uuid REFERENCES profiles(id),
  entry_time   timestamptz,
  exit_time    timestamptz,
  notes        text
)
```

---

### 5.7 `incident_logs` — Bitácora de incidente

```sql
incident_logs (
  id           uuid PRIMARY KEY,
  incident_id  uuid REFERENCES incidents(id),
  profile_id   uuid REFERENCES profiles(id),
  action       text,          -- despacho | llegada | entrada_escena | par_check | mayday | cierre | etc.
  description  text,
  logged_at    timestamptz DEFAULT now()
)
```

---

## 6. Principios UX para Operaciones de Emergencia

### 6.1 Offline-first

En una emergencia la red puede no estar disponible. Toda acción crítica debe funcionar sin conexión y sincronizarse al recuperar señal. Se utilizará Service Worker + IndexedDB para cachear incidentes activos, datos de unidades y el mapa base.

### 6.2 Regla de los 2 toques

Cualquier acción crítica (confirmar respuesta, registrar entrada a escena, PAR check) debe completarse en **2 toques o menos** desde la pantalla principal. El estrés operativo no admite menús profundos.

### 6.3 Targets táctiles grandes

Los elementos interactivos tendrán un mínimo de **48×48 px** (recomendación Apple/Google). En pantallas de alerta, los botones de acción primaria ocuparán al menos el 40% del ancho de pantalla.

### 6.4 Modo oscuro obligatorio

Las operaciones nocturnas son frecuentes. La app debe respetar el modo oscuro del sistema y ofrecer un toggle manual. El modo oscuro es el predeterminado en pantallas operacionales.

### 6.5 Mapa como pantalla principal

El mapa no es una pestaña secundaria; es la pantalla de inicio. Las unidades y el incidente activo son visibles de inmediato sin navegar.

### 6.6 Timestamps automáticos

Ninguna acción operativa requiere que el usuario ingrese la hora manualmente. Todos los eventos se registran con `timestamptz DEFAULT now()` del servidor para garantizar consistencia.

### 6.7 Alertas con vibración y sonido

Las notificaciones de despacho deben activar vibración del dispositivo y un sonido de alerta distintivo, independientemente del estado de la pantalla.

### 6.8 Pantalla siempre activa en modo operacional

Cuando hay un incidente activo, la app solicitará `WakeLock` para evitar que la pantalla se apague mientras el bombero está en escena.

---

## 7. Puntos de Integración

### 7.1 bomberos24horas

**Fase 1 (entrada manual):** el Jefe de Guardia ingresa los datos del despacho manualmente en la app.

**Fase 2 (integración):** explorar scraping del sitio o contacto con el proveedor para obtener un feed estructurado (JSON/RSS). Los datos a capturar son: número de siniestro, tipo, dirección, hora de despacho, cuartel asignado.

### 7.2 Municipalidad de San Isidro (Fase 3)

- Contacto formal con la Dirección de Sistemas municipal
- Datos objetivo: GIS del partido, base de hidrantes, datos catastrales
- Formato esperado: API REST o archivos GeoJSON/SHP actualizados periódicamente
- Uso: enriquecer pre-planes, mostrar hidrantes en mapa, datos del inmueble al despachar

---

## 8. Decisiones Técnicas Pendientes

| Decisión | Opciones | Estado |
|---|---|---|
| Proveedor de mapas | Mapbox GL JS vs Leaflet + OSM | Pendiente — evaluar costos y offline tiles |
| Push en iOS | Web Push en Safari 16.4+ vs fallback | Confirmar versión iOS mínima del equipo |
| Scraping bomberos24horas | Puppeteer/Playwright vs contacto con proveedor | Fase 2 |
| Hosting de mapas offline | Supabase Storage vs CDN | Pendiente |
| Formato de informe PDF | react-pdf vs puppeteer/headless | Fase 2 |

---

## 9. Convenciones del Proyecto

- **Idioma del código:** inglés (variables, funciones, esquema DB)
- **Idioma de la UI:** español rioplatense ("vos", "guardia", "siniestro")
- **Idioma de la documentación:** español
- **Ramas:** `main` (producción), `develop` (integración), `feature/*`, `fix/*`
- **Commits:** Conventional Commits en inglés (`feat:`, `fix:`, `chore:`)
- **Tests:** Vitest + React Testing Library; cobertura mínima de lógica crítica (accountability, despacho)

---

*Última actualización: marzo 2026*
*Documento vivo — actualizar a medida que evoluciona el proyecto*
