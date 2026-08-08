import './globals.css';

export const metadata = {
  title: 'Alt Tracker',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
