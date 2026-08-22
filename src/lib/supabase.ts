import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * true เมื่อมีการตั้งค่า Supabase ครบ
 *
 * ถ้ายังไม่ได้ตั้ง เกมจะรันในโหมดออฟไลน์ได้ทันที (คำถามจาก JSON ในเครื่อง,
 * คะแนนเก็บใน localStorage) — ทำให้ `npm run dev` เล่นได้เลยตั้งแต่นาทีแรก
 * โดยไม่ต้องรอตั้งฐานข้อมูล ดู docs/05-setup-database.md
 */
export const hasBackend = Boolean(
  url && anonKey && !url.includes('YOUR-PROJECT') && !anonKey.includes('YOUR-ANON-KEY'),
);

/**
 * ⚠️ anon key เปิดเผยได้ ปลอดภัย — ถูกออกแบบมาให้อยู่ใน client และคุมด้วย RLS
 * ⛔ service_role key ห้ามอยู่ในโฟลเดอร์ src/ เด็ดขาด (Vite จะ bundle เข้าไฟล์ JS สาธารณะ)
 */
export const supabase: SupabaseClient | null = hasBackend
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'daragame.auth',
      },
    })
  : null;

/** ต้องเรียกก่อนใช้ RPC ทุกตัว — ได้ JWT จริงมาให้ RLS ใช้อ้างอิง */
export async function ensureAnonymousAuth(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    // เจอบ่อยที่สุด: ยังไม่ได้เปิด Anonymous sign-in ใน Dashboard
    throw new Error(
      `เข้าสู่ระบบไม่สำเร็จ: ${error.message}\n` +
        'ตรวจสอบว่าเปิด Authentication → Sign In / Providers → Anonymous sign-ins แล้วหรือยัง',
    );
  }
}
