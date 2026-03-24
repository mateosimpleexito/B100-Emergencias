# Setup — B100 Emergencias

Guía paso a paso para levantar el proyecto desde cero.

---

## 1. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar todo el contenido de `supabase/schema.sql`
3. Copiar las keys desde **Settings → API**:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. VAPID Keys (Web Push)

```bash
cd web
npx web-push generate-vapid-keys
```

Copiar `Public Key` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
Copiar `Private Key` → `VAPID_PRIVATE_KEY`

---

## 3. Scraper Secret

```bash
openssl rand -hex 32
```

Usar el mismo valor en `web/.env` y `scraper/.env` como `SCRAPER_SECRET`.

---

## 4. Web App (Next.js)

```bash
cd web
cp .env.example .env.local
# completar .env.local con los valores anteriores

npm install
npm run dev
```

Producción → deploy en [Vercel](https://vercel.com):
- Conectar el repo
- Agregar todas las env vars en el panel de Vercel
- El cron de `/api/scrape` se puede configurar en `vercel.json` como fallback

---

## 5. Scraper Worker (Fly.io)

```bash
cd scraper
npm install

# Instalar Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --name b100-scraper --no-deploy

# Configurar secretos
fly secrets set APP_URL=https://b100-emergencias.vercel.app
fly secrets set SCRAPER_SECRET=<el mismo secreto de arriba>

# Deploy
fly deploy
```

El worker empieza a hacer polling cada 3 segundos automáticamente.

Para ver logs en tiempo real:
```bash
fly logs
```

---

## 6. Verificar que funciona

1. Abrir la app web en el celular
2. Tocar **"Activar alarmas de emergencia"**
3. Aceptar el permiso de notificaciones
4. Cuando el scraper detecte un incidente con M100-1, RES-100 o AMB-100 → **suena la alarma**

---

## Unidades monitoreadas

| Código | Vehículo |
|---|---|
| `M100-1` | Maquina 100 1 — Spartan Metrostar 2014 |
| `RES-100` | Rescate 100 — E-One Quest 2013 |
| `AMB-100` | Ambulancia 100 — Mercedes Sprinter 2019 |
| `AUX-100-1` | Auxiliar 1 — Mitsubishi L200 |
| `AUX-100-2` | Auxiliar 2 — Ford F250 |
