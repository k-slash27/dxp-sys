-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- PostGIS already enabled by the image

CREATE TABLE IF NOT EXISTS production_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace    VARCHAR(100) NOT NULL,
  record_date  DATE NOT NULL,
  text_content TEXT,
  photos       JSONB NOT NULL DEFAULT '[]',
  location     GEOMETRY(POINT, 4326),
  created_by   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_records_workspace  ON production_records(workspace);
CREATE INDEX IF NOT EXISTS idx_prod_records_date       ON production_records(record_date);
CREATE INDEX IF NOT EXISTS idx_prod_records_created_by ON production_records(created_by);
