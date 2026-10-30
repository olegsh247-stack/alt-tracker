import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { googleConfigured, redirectUri, siteOrigin } from '../../../../../lib/google';
import { getUserId } from '../../../../../lib/getUser';

export const dynamic = 'force-dynamic';

// ?mode=login — войти через Google; ?mode=link — привязать Google к текущему аккаунту (нужен вход)
export async function GET(req) {
  const origin = siteOrigin(req);
  const mode = new URL(req.url).searchParams.get('mode') === 'link' ? 'link' : 'login';
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/${mode === 'link' ? 'account' : 'login'}?err=google_off`);
  if (mode === 'link' && !getUserId()) return NextResponse.redirect(`${origin}/login`);

  const nonce = crypto.randomBytes(16).toString('hex');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', nonce);
  url.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(url.toString());
  res.cookies.set('g_state', `${nonce}.${mode}`, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 600 });
  return res;
}
