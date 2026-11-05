// Каталог валют: код, код страны для флага (flag-icons), название по-русски и по-английски (для поиска).
export const CURRENCIES = [
  ['USD', 'us', 'Доллар США', 'US Dollar'], ['EUR', 'eu', 'Евро', 'Euro'], ['GBP', 'gb', 'Фунт стерлингов', 'British Pound'],
  ['JPY', 'jp', 'Японская иена', 'Japanese Yen'], ['CHF', 'ch', 'Швейцарский франк', 'Swiss Franc'], ['CNY', 'cn', 'Китайский юань', 'Chinese Yuan'],
  ['RUB', 'ru', 'Российский рубль', 'Russian Ruble'], ['UAH', 'ua', 'Украинская гривна', 'Ukrainian Hryvnia'], ['KZT', 'kz', 'Казахстанский тенге', 'Kazakhstani Tenge'],
  ['BYN', 'by', 'Белорусский рубль', 'Belarusian Ruble'], ['TRY', 'tr', 'Турецкая лира', 'Turkish Lira'], ['AED', 'ae', 'Дирхам ОАЭ', 'UAE Dirham'],
  ['SAR', 'sa', 'Саудовский риял', 'Saudi Riyal'], ['INR', 'in', 'Индийская рупия', 'Indian Rupee'], ['CAD', 'ca', 'Канадский доллар', 'Canadian Dollar'],
  ['AUD', 'au', 'Австралийский доллар', 'Australian Dollar'], ['NZD', 'nz', 'Новозеландский доллар', 'New Zealand Dollar'], ['SEK', 'se', 'Шведская крона', 'Swedish Krona'],
  ['NOK', 'no', 'Норвежская крона', 'Norwegian Krone'], ['DKK', 'dk', 'Датская крона', 'Danish Krone'], ['PLN', 'pl', 'Польский злотый', 'Polish Zloty'],
  ['CZK', 'cz', 'Чешская крона', 'Czech Koruna'], ['HUF', 'hu', 'Венгерский форинт', 'Hungarian Forint'], ['RON', 'ro', 'Румынский лей', 'Romanian Leu'],
  ['BGN', 'bg', 'Болгарский лев', 'Bulgarian Lev'], ['RSD', 'rs', 'Сербский динар', 'Serbian Dinar'], ['GEL', 'ge', 'Грузинский лари', 'Georgian Lari'],
  ['AMD', 'am', 'Армянский драм', 'Armenian Dram'], ['AZN', 'az', 'Азербайджанский манат', 'Azerbaijani Manat'], ['UZS', 'uz', 'Узбекский сум', 'Uzbekistani Som'],
  ['KGS', 'kg', 'Киргизский сом', 'Kyrgyzstani Som'], ['MDL', 'md', 'Молдавский лей', 'Moldovan Leu'], ['ILS', 'il', 'Израильский шекель', 'Israeli Shekel'],
  ['EGP', 'eg', 'Египетский фунт', 'Egyptian Pound'], ['ZAR', 'za', 'Южноафриканский рэнд', 'South African Rand'], ['NGN', 'ng', 'Нигерийская найра', 'Nigerian Naira'],
  ['BRL', 'br', 'Бразильский реал', 'Brazilian Real'], ['MXN', 'mx', 'Мексиканское песо', 'Mexican Peso'], ['ARS', 'ar', 'Аргентинское песо', 'Argentine Peso'],
  ['CLP', 'cl', 'Чилийское песо', 'Chilean Peso'], ['COP', 'co', 'Колумбийское песо', 'Colombian Peso'], ['KRW', 'kr', 'Южнокорейская вона', 'South Korean Won'],
  ['HKD', 'hk', 'Гонконгский доллар', 'Hong Kong Dollar'], ['SGD', 'sg', 'Сингапурский доллар', 'Singapore Dollar'], ['TWD', 'tw', 'Тайваньский доллар', 'Taiwan Dollar'],
  ['THB', 'th', 'Тайский бат', 'Thai Baht'], ['IDR', 'id', 'Индонезийская рупия', 'Indonesian Rupiah'], ['MYR', 'my', 'Малайзийский ринггит', 'Malaysian Ringgit'],
  ['PHP', 'ph', 'Филиппинское песо', 'Philippine Peso'], ['VND', 'vn', 'Вьетнамский донг', 'Vietnamese Dong'], ['PKR', 'pk', 'Пакистанская рупия', 'Pakistani Rupee'],
].map(([code, cc, name, en]) => ({ code, cc, name, en }));

export const CURRENCY_CODES = new Set(CURRENCIES.map(c => c.code));
export const currencyOf = (code) => CURRENCIES.find(c => c.code === code) || { code, cc: null, name: code, en: code };
const esNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['es'], { type: 'currency' }) : null;
// Название валюты на выбранном языке (ru — наше, en — английское, es — из Intl)
export function currencyName(c, lang) {
  if (lang === 'ru') return c.name;
  if (lang === 'es') { try { const n = esNames && esNames.of(c.code); if (n && n !== c.code) return n.charAt(0).toUpperCase() + n.slice(1); } catch {} }
  return c.en || c.name;
}
export const DEFAULT_FOREX = ['EUR', 'GBP', 'CNY', 'RUB'];
export const DEFAULT_BASE = 'USD';
