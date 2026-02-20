import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client:", err);
});

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS objectives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PLANNING',
        raw_input TEXT NOT NULL DEFAULT '',
        is_voice BOOLEAN DEFAULT false,
        what TEXT,
        context TEXT,
        expected_output TEXT,
        decision_rationale TEXT,
        jarvis_insight TEXT,
        plan JSONB DEFAULT '[]'::jsonb,
        outcome VARCHAR(20),
        raw_reflection TEXT,
        success_driver TEXT,
        failure_reason TEXT,
        suggested_similarities JSONB DEFAULT '[]'::jsonb,
        search_text TEXT DEFAULT '',
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE objectives ADD COLUMN IF NOT EXISTS raw_input TEXT NOT NULL DEFAULT '';
        ALTER TABLE objectives ADD COLUMN IF NOT EXISTS is_voice BOOLEAN DEFAULT false;
        ALTER TABLE objectives ADD COLUMN IF NOT EXISTS jarvis_insight TEXT;
        ALTER TABLE objectives ADD COLUMN IF NOT EXISTS search_text TEXT DEFAULT '';
        ALTER TABLE objectives ALTER COLUMN what DROP NOT NULL;
        ALTER TABLE objectives ALTER COLUMN context DROP NOT NULL;
        ALTER TABLE objectives ALTER COLUMN expected_output DROP NOT NULL;
        ALTER TABLE objectives ALTER COLUMN decision_rationale DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS objective_embeddings (
        objective_id UUID PRIMARY KEY REFERENCES objectives(id),
        user_id UUID NOT NULL,
        vector vector(384) NOT NULL,
        content_hash VARCHAR(64) NOT NULL
      );
    `);

    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'objective_embeddings'
            AND column_name = 'vector'
            AND udt_name = 'vector'
        ) THEN
          IF EXISTS (
            SELECT 1 FROM objective_embeddings
            WHERE vector_dims(vector) = 1536
            LIMIT 1
          ) THEN
            TRUNCATE objective_embeddings;
            ALTER TABLE objective_embeddings
              ALTER COLUMN vector TYPE vector(384);
            RAISE NOTICE 'Migrated embeddings from 1536 to 384 dims';
          END IF;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS background_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        retry_count INT DEFAULT 0,
        next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_poll ON background_jobs (status, next_retry_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_user ON objectives (user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_search_trgm ON objectives USING GIN (search_text gin_trgm_ops);
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_embeddings_hnsw') THEN
          CREATE INDEX idx_embeddings_hnsw ON objective_embeddings
            USING hnsw (vector vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_embeddings_user') THEN
          CREATE INDEX idx_embeddings_user ON objective_embeddings (user_id);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION delete_vector_on_soft_delete() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.is_deleted = true THEN
          DELETE FROM objective_embeddings WHERE objective_id = NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trg_soft_delete_vector ON objectives;
    `);
    await client.query(`
      CREATE TRIGGER trg_soft_delete_vector
      AFTER UPDATE ON objectives FOR EACH ROW
      EXECUTE FUNCTION delete_vector_on_soft_delete();
    `);

    console.log("[DB] Migrations completed successfully.");
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export async function listenChannel(
  channel: string,
  callback: (payload: string) => void
): Promise<void> {
  const client = await pool.connect();
  client.on("notification", (msg) => {
    if (msg.channel === channel && msg.payload) {
      callback(msg.payload);
    }
  });
  await client.query(`LISTEN ${channel}`);
  console.log(`[DB] Listening on channel: ${channel}`);
}

export default pool;
