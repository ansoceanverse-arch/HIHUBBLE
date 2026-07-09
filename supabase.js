import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://jlculykgkdrwezyrnuvk.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsY3VseWtna2Ryd2V6eXJudXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MTc2MTAsImV4cCI6MjA5OTA5MzYxMH0.-vUjCPb1Jhlm_98ADrsCTuHFT18CId1ZyLyNDf-kYw8';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
