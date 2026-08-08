export const metadata = { title: 'Alt Tracker' };

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif',
        background: '#0b0e11',
        color: '#e6e6e6',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  );
}
