import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getPrice } from '../../../lib/exchanges';
import { sendTelegramMessage } from '../../../lib/telegram';

// Защищено секретом в query-параметре, вызывается внешним cron (например cron-job.org) раз в несколько минут
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { data: pairs, error } = await supabase
    .from('pairs')
    .select('*, users(telegram_chat_id)')
    .or('alert_above.not.is.null,alert_below.not.is.null');

  if (error) return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 });

  let checked = 0, notified = 0;

  for (const p of pairs || []) {
    const chatId = p.users?.telegram_chat_id;
    if (!chatId) continue;
    checked++;

    try {
      const [price1, price2] = await Promise.all([
        getPrice(p.exchange1, p.asset1),
        getPrice(p.exchange2, p.asset2),
      ]);
      const ratio = price1 / price2;

      let direction = null;
      if (p.alert_above && ratio >= p.alert_above) direction = 'above';
      else if (p.alert_below && ratio <= p.alert_below) direction = 'below';

      if (direction && direction !== p.last_alert_direction) {
        const label = direction === 'above' ? 'выше' : 'ниже';
        const threshold = direction === 'above' ? p.alert_above : p.alert_below;
        await sendTelegramMessage(
          chatId,
          `⚠️ ${p.asset1}/${p.asset2}: соотношение ${ratio.toFixed(6)} стало ${label} порога ${threshold}`
        );
        notified++;
        await supabase.from('pairs').update({ last_alert_direction: direction }).eq('id', p.id);
      } else if (!direction && p.last_alert_direction) {
        // цена вернулась в норму — сбрасываем, чтобы уведомление могло сработать снова при следующем пересечении
        await supabase.from('pairs').update({ last_alert_direction: null }).eq('id', p.id);
      }
    } catch (e) {
      // если цены не получить — просто пропускаем пару в этой проверке
    }
  }

  return NextResponse.json({ checked, notified });
}
