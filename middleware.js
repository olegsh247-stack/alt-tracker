import { NextResponse } from 'next/server';

export function middleware(req) {
  const session = req.cookies.get('session');
  const path = req.nextUrl.pathname;
  const isAuthPage = path.startsWith('/login') || path.startsWith('/register');

  // Публичная главная для гостей; вошедших с неё возвращаем в приложение
  if (path.startsWith('/welcome')) {
    return session ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next();
  }
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL(path === '/' ? '/welcome' : '/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/welcome', '/add', '/account', '/pair/:path*'],
};
