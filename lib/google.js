// Вход через Google (OAuth 2.0, схема «authorization code»). Нужны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Адрес сайта берём из заголовков запроса (за прокси Vercel) — он должен совпадать с тем, что указан в консоли Google
export function siteOrigin(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
export const redirectUri = (req) => `${siteOrigin(req)}/api/auth/google/callback`;

// Обмен кода на данные пользователя. id_token получен напрямую от Google по защищённому соединению,
// поэтому подпись отдельно не проверяем (так допускает спецификация), но сверяем получателя и подтверждение почты.
export async function exchangeCode(req, code) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(req),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`google token ${r.status}`);
  const j = await r.json();
  const payload = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString('utf8'));
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('bad aud');
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss)) throw new Error('bad iss');
  if (!payload.sub) throw new Error('no sub');
  return { sub: String(payload.sub), email: payload.email_verified ? String(payload.email || '') : '' };
}
