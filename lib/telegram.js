const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramMessage(chatId, text) {
  if (!TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Находит chat_id последнего, кто написал боту (используется один раз при подключении)
export async function resolveLatestChatId() {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не настроен');
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?limit=5`);
  const d = await r.json();
  const updates = d.result || [];
  if (updates.length === 0) return null;
  const last = updates[updates.length - 1];
  const chatId = last.message?.chat?.id || last.my_chat_member?.chat?.id;
  return chatId ? String(chatId) : null;
}
