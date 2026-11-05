'use client';
import { Widget, useTheme } from './TvChart';
import { useLang } from './LangProvider';

// Экономический календарь TradingView (бесплатный виджет): даты выхода данных и заседаний центробанков
export default function TvCalendar() {
  const theme = useTheme();
  const { lang } = useLang();
  return (
    <Widget
      className="tv-calendar"
      src="https://s3.tradingview.com/external-embedding/embed-widget-events.js"
      config={{
        colorTheme: theme, isTransparent: true, locale: lang, width: '100%', height: '100%',
        importanceFilter: '0,1', currencyFilter: 'USD,EUR,GBP,JPY,CHF,CAD,AUD,NZD,CNY,RUB,TRY',
      }}
    />
  );
}
