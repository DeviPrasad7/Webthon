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

/**
 * Run the full DB migration: extensions, tables, indexes, triggers.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS objectives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PLANNING',
        what TEXT NOT NULL,
        context TEXT NOT NULL,
        expected_output TEXT NOT NULL,
        decision_rationale TEXT NOT NULL,
        plan JSONB DEFAULT '[]'::jsonb,
        outcome VARCHAR(20),
        raw_reflection TEXT,
        success_driver TEXT,
        failure_reason TEXT,
        suggested_similarities JSONB DEFAULT '[]'::jsonb,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS objective_embeddings (
        objective_id UUID PRIMARY KEY REFERENCES objectives(id),
        user_id UUID NOT NULL,
        vector vector(1536) NOT NULL,
        content_hash VARCHAR(64) NOT NULL
      );
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

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_poll ON background_jobs (status, next_retry_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_user ON objectives (user_id);
    `);

    // Trigger function
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

    // Drop trigger if exists, then recreate
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

/**
 * Get a client from the pool for transactional work.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Simple query helper.
 */
export function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

/**
 * Setup LISTEN on the given channel and invoke callback on notification.
 */
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
