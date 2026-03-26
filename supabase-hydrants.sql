-- ─── Reportes de hidrantes ─────────────────────────────────────────────────
-- hydrant_idx = índice del hidrante en el GeoJSON estático (0-10245)

CREATE TABLE IF NOT EXISTS hydrant_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hydrant_idx   INTEGER NOT NULL,           -- índice en hidrantes-sedapal.json

  -- Estado general
  status        TEXT NOT NULL,              -- 'operational','damaged','missing','capped','unknown'

  -- Tags de condición (array)
  tags          TEXT[] DEFAULT '{}',        -- ['cap_missing','no_water','low_pressure',...]

  -- Datos técnicos
  diameter      TEXT,                       -- '2.5 pulgadas','4 pulgadas','4.5 pulgadas','6 pulgadas'
  pressure      TEXT,                       -- 'muy_baja','baja','media','alta','muy_alta'
  flow          TEXT,                       -- 'muy_bajo','bajo','medio','alto','muy_alto'
  box_key       TEXT,                       -- 'abierta','cerrada','no_se_puede_abrir','sin_tapon'

  -- Fotos
  photo_urls    TEXT[] DEFAULT '{}',

  -- Notas libres
  notes         TEXT,

  -- Quién reportó (sin auth, solo nombre)
  reporter_name TEXT NOT NULL DEFAULT 'Anónimo',

  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydrant_reports_idx ON hydrant_reports(hydrant_idx);
CREATE INDEX IF NOT EXISTS hydrant_reports_created ON hydrant_reports(created_at DESC);

-- ─── Correcciones de posición ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hydrant_corrections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hydrant_idx   INTEGER NOT NULL,
  old_lat       DOUBLE PRECISION NOT NULL,
  old_lng       DOUBLE PRECISION NOT NULL,
  new_lat       DOUBLE PRECISION NOT NULL,
  new_lng       DOUBLE PRECISION NOT NULL,
  reporter_name TEXT NOT NULL DEFAULT 'Anónimo',
  approved      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydrant_corrections_idx ON hydrant_corrections(hydrant_idx);

-- ─── RLS: acceso público de lectura/escritura (sin auth, proyecto voluntario)
ALTER TABLE hydrant_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE hydrant_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read reports"      ON hydrant_reports      FOR SELECT USING (true);
CREATE POLICY "public insert reports"    ON hydrant_reports      FOR INSERT WITH CHECK (true);
CREATE POLICY "public read corrections"  ON hydrant_corrections  FOR SELECT USING (true);
CREATE POLICY "public insert corrections"ON hydrant_corrections  FOR INSERT WITH CHECK (true);
CREATE POLICY "public update corrections"ON hydrant_corrections  FOR UPDATE USING (true);

-- ─── Storage bucket para fotos ──────────────────────────────────────────────
-- Ejecutar esto también en el SQL Editor:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hydrants',
  'hydrants',
  true,                          -- público: URLs directas sin auth
  819200,                        -- 800KB max por foto
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public upload hydrant photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hydrants');

CREATE POLICY "public read hydrant photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hydrants');
