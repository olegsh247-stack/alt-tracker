import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabaseClient';
import { createSessionValue } from '../../../../../lib/session';
import { getUserId } from '../../../../../lib/getUser';
import { exchangeCode, googleConfigured, siteOrigin } from '../../../../../lib/google';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const origin = siteOrigin(req);
  const back = (path) => {
    const res = NextResponse.redirect(`${origin}${path}`);
    res.cookies.set('g_state', '', { path: '/', maxAge: 0 });
    return res;
  };
  const sp = new URL(req.url).searchParams;
  const [nonce, mode] = (req.cookies.get('g_state')?.value || '').split('.');
  const fail = (err) => back(`/${mode === 'link' ? 'account' : 'login'}?err=${err}`);

  if (!googleConfigured()) return fail('google_off');
  if (sp.get('error')) return fail('google_cancel');
  if (!nonce || !sp.get('code') || sp.get('state') !== nonce) return fail('google_state');

  let g;
  try { g = await exchangeCode(req, sp.get('code')); } catch { return fail('google_fail'); }

  if (mode === 'link') {
    const userId = getUserId();
    if (!userId) return back('/login');
    const { data: other } = await supabase.from('users').select('id').eq('google_sub', g.sub).maybeSingle();
    if (other && other.id !== userId) return fail('google_taken'); // этот Google уже привязан к другому аккаунту
    const { error } = await supabase.from('users').update({ google_sub: g.sub, google_email: g.email || null }).eq('id', userId);
    if (error) return fail('google_db');
    return back('/account?ok=google_linked');
  }

  const { data: user } = await supabase.from('users').select('id').eq('google_sub', g.sub).maybeSingle();
  if (!user) return fail('google_unlinked');
  const res = back('/');
  res.cookies.set('session', createSessionValue(user.id), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
