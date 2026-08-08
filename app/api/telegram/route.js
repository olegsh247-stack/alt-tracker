import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getUserId } from '../../../lib/getUser';
import { resolveLatestChatId, sendTelegramMessage } from '../../../lib/telegram';

// Пользователь заранее написал что-то боту, мы находим его chat_id и сохраняем
export async function POST() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  let chatId;
  try {
    chatId = await resolveLatestChatId();
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  if (!chatId) {
    return NextResponse.json({ error: 'Не нашли сообщений боту. Сначала напишите вашему боту в Telegram что-нибудь, потом нажмите кнопку ещё раз.' }, { status: 400 });
  }

  const { error } = await supabase.from('users').update({ telegram_chat_id: chatId }).eq('id', userId);
  if (error) return NextResponse.json({ error: 'Не удалось сохранить' }, { status: 500 });

  await sendTelegramMessage(chatId, 'Telegram подключён к Alt Tracker ✅');
  return NextResponse.json({ ok: true, chatId });
}

export async function GET() {
  const userId = getUserId();
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  const { data } = await supabase.from('users').select('telegram_chat_id').eq('id', userId).single();
  return NextResponse.json({ connected: !!data?.telegram_chat_id });
}
