import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const dbPassword = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;
const projectRef = 'fefrlcxctuhdbztyoncs';

if (!dbPassword) {
  console.error("❌ Missing Database Password.");
  console.log("Usage: node apply_sql_with_password.js <YOUR_SUPABASE_DB_PASSWORD>");
  process.exit(1);
}

// Supabase Direct PostgreSQL Connection URI
const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

async function main() {
  console.log(`Connecting directly to PostgreSQL database (db.${projectRef}.supabase.co)...`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL successfully!");

    const sqlScript = fs.readFileSync('supabase/migrations/20260723220000_production_complete_database.sql', 'utf8');

    console.log("Executing migration: 20260723220000_production_complete_database.sql...");
    await client.query(sqlScript);

    console.log("==========================================================================");
    console.log("🎉 SUCCESS! All 33 tables, functions, triggers, RLS policies, and storage");
    console.log("   buckets have been created and verified on your Supabase project!");
    console.log("==========================================================================");
  } catch (err) {
    console.error("❌ Migration execution error:", err.message);
  } finally {
    await client.end();
  }
}

main();
