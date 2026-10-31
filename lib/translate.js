// Перевод заголовков новостей на русский — бесплатный сервис MyMemory (ключ не нужен).
// Лимит без регистрации — около 5000 символов в день, поэтому:
//  • переводим только «важные» новости (не ценовой шум), не больше MAX_TITLES за раз;
//  • каждый заголовок переводим один раз и запоминаем (в памяти и в таблице news_ru в Supabase);
//  • при исчерпании лимита до конца часа не пробуем снова, а новости остаются на английском.
// Чтобы поднять лимит до ~50 000 символов в день, можно задать переменную MYMEMORY_EMAIL (своя почта).
import { supabase } from './supabaseClient';

const MAX_TITLES = 40;
const mem = new Map();   // link -> перевод
let quotaUntil = 0;
const CYR = /[А-Яа-яЁё]/;

const decode = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");

async function translateOne(text) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : '';
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru${email}`, { cache: 'no-store', signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    const out = j?.responseData?.translatedText;
    if (r.status === 429 || j?.quotaFinished || /MYMEMORY WARNING|YOU USED ALL AVAILABLE/i.test(String(out))) {
      quotaUntil = Date.now() + 60 * 60 * 1000;
      throw new Error('quota');
    }
    if (!r.ok || typeof out !== 'string' || !CYR.test(out)) throw new Error('bad');
    return decode(out).trim();
  } finally { clearTimeout(t); }
}

// Добавляет item.titleRu где возможно; возвращает, сколько заголовков осталось без перевода
export async function addRussian(items, budgetMs = 3500) {
  const targets = items.filter(it => it.cat !== 'other' && !it.noise).slice(0, MAX_TITLES);
  const need = [];
  for (const it of targets) {
    const hit = mem.get(it.link);
    if (hit) it.titleRu = hit; else need.push(it);
  }
  if (need.length === 0) return 0;

  try {
    const { data } = await supabase.from('news_ru').select('link, title_ru').in('link', need.map(it => it.link));
    for (const row of data || []) mem.set(row.link, row.title_ru);
  } catch {}
  const todo = [];
  for (const it of need) {
    const hit = mem.get(it.link);
    if (hit) it.titleRu = hit; else todo.push(it);
  }

  const deadline = Date.now() + budgetMs;
  const fresh = [];
  let pending = 0;
  for (let i = 0; i < todo.length; i += 3) {
    if (Date.now() > deadline || Date.now() < quotaUntil) { pending += todo.length - i; break; }
    await Promise.all(todo.slice(i, i + 3).map(async (it) => {
      try {
        const ru = await translateOne(it.title);
        mem.set(it.link, ru);
        it.titleRu = ru;
        fresh.push({ link: it.link, title_ru: ru });
      } catch { pending++; }
    }));
  }
  if (fresh.length) {
    try { await supabase.from('news_ru').upsert(fresh, { onConflict: 'link' }); } catch {}
  }
  return pending;
}
