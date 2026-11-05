import './globals.css';
import { cookies } from 'next/headers';
import { LangProvider } from '../components/LangProvider';

export const metadata = {
  title: 'Alt Tracker',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }) {
  const c = cookies().get('lang')?.value;
  const lang = c === 'ru' ? 'ru' : 'en';
  return (
    <html lang={lang}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');}catch(e){}`,
          }}
        />
      </head>
      <body><LangProvider initial={lang}>{children}</LangProvider></body>
    </html>
  );
}
