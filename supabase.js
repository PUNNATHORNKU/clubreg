// =============================================================
// supabase.js - Supabase Client Configuration
// วิธีใช้: แก้ค่า SUPABASE_URL และ SUPABASE_ANON_KEY ด้านล่าง
// =============================================================

const SUPABASE_URL      = 'https://hizoturzmhmofthskhny.supabase.co/rest/v1/';   // ← แก้ตรงนี้
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkenRweXpyd2txZW55d29qbnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjQwNzEsImV4cCI6MjA5NDM0MDA3MX0.jkKNr93EnvoM_96VeZMGtv30e4nUJkV_Dxy07HB7REk';                   // ← แก้ตรงนี้

// สร้าง Supabase client ด้วย CDN (ไม่ต้อง npm)
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
