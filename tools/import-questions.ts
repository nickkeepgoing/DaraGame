/**
 * นำเข้าคลังคำถามเข้า Supabase
 *
 *   npm run import:questions                        # ใช้ src/data/questions.local.json
 *   npm run import:questions -- questions.csv       # ใช้ CSV ที่ export จาก Google Sheet
 *   npm run import:questions -- questions.csv --dry # ตรวจอย่างเดียว ไม่เขียนลง DB
 *
 * หัวตาราง CSV (ตรงกับที่ครูกรอกใน Google Sheet):
 *   topic,role,stage,ord,difficulty,stem,choice_a,choice_b,choice_c,choice_d,answer,explanation
 *   answer = a | b | c | d
 *   role   = main | revive | final   (ไม่ใส่ = main)
 *   stage  = 1-3 เมื่อ role = main   (revive/final ให้เว้นว่าง)
 *
 * ⚠️ สคริปต์นี้ต้องใช้ SERVICE ROLE KEY เพราะต้องข้าม RLS เพื่อเขียนตารางคำถาม
 *    เก็บใน .env (ไม่มี prefix VITE_) เท่านั้น ห้ามใส่ใน .env.local ที่ขึ้นต้นด้วย VITE_
 *    เพราะ Vite จะ bundle ตัวแปร VITE_* ทุกตัวเข้าไฟล์ JS สาธารณะ
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Difficulty = 'easy' | 'medium' | 'hard';
type Role = 'main' | 'revive' | 'final';

interface Question {
  topic: string;
  role: Role;
  stage: number | null;
  ord: number;
  difficulty: Difficulty;
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
}

/* ------------------------------------------------------------------ */
/* อ่านไฟล์                                                            */
/* ------------------------------------------------------------------ */

/** parser CSV แบบรองรับ "ข้อความมีคอมมา" และ "" escape */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function fromCsv(path: string): Question[] {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const required = ['topic', 'difficulty', 'stem', 'choice_a', 'choice_b', 'answer', 'explanation'];
  for (const r of required) {
    if (col(r) === -1) throw new Error(`CSV ขาดคอลัมน์ "${r}"`);
  }

  const cell = (r: string[], name: string) =>
    col(name) === -1 ? '' : (r[col(name)] ?? '').trim();

  return rows.slice(1).map((r, i) => {
    const choices = ['choice_a', 'choice_b', 'choice_c', 'choice_d']
      .map((c) => cell(r, c))
      .filter(Boolean);
    const answerLetter = cell(r, 'answer').toLowerCase();
    const role = (cell(r, 'role') || 'main') as Role;
    const stageRaw = cell(r, 'stage');

    return {
      topic: cell(r, 'topic'),
      role,
      stage: role === 'main' ? Number(stageRaw || 1) : null,
      ord: Number(cell(r, 'ord') || i + 1),
      difficulty: cell(r, 'difficulty') as Difficulty,
      stem: cell(r, 'stem'),
      choices,
      answer: 'abcd'.indexOf(answerLetter),
      explanation: cell(r, 'explanation'),
    };
  });
}

function fromJson(path: string): Question[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    questions: (Partial<Question> & { stem: string })[];
  };
  return parsed.questions.map((q, i) => ({
    topic: q.topic ?? '',
    role: q.role ?? 'main',
    stage: q.role && q.role !== 'main' ? null : (q.stage ?? 1),
    ord: q.ord ?? i + 1,
    difficulty: q.difficulty ?? 'easy',
    stem: q.stem,
    choices: q.choices ?? [],
    answer: q.answer ?? -1,
    explanation: q.explanation ?? '',
  }));
}

/* ------------------------------------------------------------------ */
/* ตรวจความถูกต้องก่อนเขียน DB                                          */
/* ------------------------------------------------------------------ */

function validate(q: Question, line: number): string | null {
  if (!q.topic) return 'ไม่ได้ระบุ topic';
  if (!['main', 'revive', 'final'].includes(q.role))
    return `role ต้องเป็น main/revive/final (ได้ "${q.role}")`;
  if (q.role === 'main' && !(q.stage && q.stage >= 1))
    return 'คำถามประจำด่าน (role=main) ต้องระบุ stage';
  if (q.role !== 'main' && q.stage !== null)
    return `คำถาม role=${q.role} ห้ามระบุ stage`;
  if (!['easy', 'medium', 'hard'].includes(q.difficulty))
    return `difficulty ต้องเป็น easy/medium/hard (ได้ "${q.difficulty}")`;
  if (q.stem.trim().length < 5) return 'คำถามสั้นเกินไป';
  if (q.choices.length < 2) return 'ต้องมีตัวเลือกอย่างน้อย 2 ข้อ';
  if (q.answer < 0 || q.answer >= q.choices.length)
    return `answer ไม่ตรงกับตัวเลือกที่มี (บรรทัด ${line})`;
  if (q.explanation.trim().length < 10)
    return 'คำอธิบายสั้นเกินไป — คำอธิบายคือหัวใจของเกมการศึกษา ห้ามปล่อยว่าง';
  if (new Set(q.choices.map((c) => c.trim())).size !== q.choices.length)
    return 'มีตัวเลือกซ้ำกัน';
  return null;
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const file = args.find((a) => !a.startsWith('--')) ?? 'src/data/questions.local.json';

  console.log(`📖 อ่านไฟล์ ${file}`);
  const questions = file.endsWith('.csv') ? fromCsv(file) : fromJson(file);

  /* ---- ตรวจก่อน ---- */
  const errors: string[] = [];
  const seen = new Set<string>();
  const valid: Question[] = [];

  questions.forEach((q, i) => {
    const line = i + 2;
    const problem = validate(q, line);
    if (problem) {
      errors.push(`  บรรทัด ${line}: ${problem}`);
      return;
    }
    const key = q.stem.trim();
    if (seen.has(key)) {
      errors.push(`  บรรทัด ${line}: คำถามซ้ำกับข้อก่อนหน้า`);
      return;
    }
    seen.add(key);
    valid.push(q);
  });

  console.log(`✅ ผ่าน ${valid.length} ข้อ   ❌ มีปัญหา ${errors.length} ข้อ`);
  if (errors.length) console.log(errors.join('\n'));

  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  const byRole: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  for (const q of valid) {
    byDifficulty[q.difficulty]++;
    byRole[q.role] = (byRole[q.role] ?? 0) + 1;
    if (q.role === 'main') byStage[`ด่าน ${q.stage}`] = (byStage[`ด่าน ${q.stage}`] ?? 0) + 1;
  }
  console.log('   ระดับ  :', byDifficulty);
  console.log('   บทบาท :', byRole);
  console.log('   ด่าน   :', byStage);

  if (!byRole.final) console.log('   ⚠️  ยังไม่มีคำถามบอสสุดท้าย (role=final) — ผู้เล่นจะชนะเกมไม่ได้');
  if (!byRole.revive) console.log('   ⚠️  ยังไม่มีคำถามฟื้น (role=revive) — ตายแล้วจบเลย');

  if (dryRun) {
    console.log('\n🔎 โหมด --dry ไม่เขียนลงฐานข้อมูล');
    return;
  }
  if (!valid.length) return;

  if (!URL || !SERVICE_KEY) {
    console.error(
      '\n⛔ ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env ก่อน\n' +
        '   (ดู docs/05-setup-database.md ขั้นตอนที่ 6)',
    );
    process.exitCode = 1;
    return;
  }

  const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

  /* ---- map slug หมวด -> id ---- */
  const { data: topicRows, error: topicErr } = await db.from('topics').select('id, slug');
  if (topicErr) throw new Error(`อ่านตาราง topics ไม่ได้: ${topicErr.message}`);
  const topicId = new Map((topicRows ?? []).map((t) => [t.slug as string, t.id as number]));

  const unknown = [...new Set(valid.map((q) => q.topic))].filter((t) => !topicId.has(t));
  if (unknown.length) {
    console.error(`⛔ ไม่รู้จักหมวด: ${unknown.join(', ')}`);
    console.error(`   หมวดที่มี: ${[...topicId.keys()].join(', ')}`);
    process.exitCode = 1;
    return;
  }

  /* ---- เขียนทีละข้อ (upsert ด้วย stem เพื่อรันซ้ำได้) ---- */
  let inserted = 0;
  let updated = 0;

  for (const q of valid) {
    const { data: existing } = await db
      .from('questions')
      .select('id')
      .eq('stem', q.stem.trim())
      .maybeSingle();

    const payload = {
      topic_id: topicId.get(q.topic)!,
      role: q.role,
      stage: q.stage,
      ord: q.ord,
      difficulty: q.difficulty,
      stem: q.stem.trim(),
      explanation: q.explanation.trim(),
      is_active: true,
    };

    let questionId: string;
    if (existing) {
      const { error } = await db.from('questions').update(payload).eq('id', existing.id);
      if (error) throw new Error(`อัปเดตไม่สำเร็จ "${q.stem}": ${error.message}`);
      questionId = existing.id as string;
      await db.from('choices').delete().eq('question_id', questionId);
      updated++;
    } else {
      const { data, error } = await db.from('questions').insert(payload).select('id').single();
      if (error) throw new Error(`เพิ่มไม่สำเร็จ "${q.stem}": ${error.message}`);
      questionId = data.id as string;
      inserted++;
    }

    const { error: choiceErr } = await db.from('choices').insert(
      q.choices.map((content, i) => ({
        question_id: questionId,
        content: content.trim(),
        is_correct: i === q.answer,
        ord: i,
      })),
    );
    if (choiceErr) throw new Error(`เพิ่มตัวเลือกไม่สำเร็จ "${q.stem}": ${choiceErr.message}`);
  }

  console.log(`\n🎉 เสร็จแล้ว — เพิ่มใหม่ ${inserted} ข้อ, อัปเดต ${updated} ข้อ`);
}

main().catch((err: unknown) => {
  console.error('\n💥', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
