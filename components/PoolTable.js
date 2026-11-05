'use client';
import { useT, useLang } from './LangProvider';
import NetworkBadge from './NetworkBadge';
import { fmtUsd, fmtPct, fmtFee, fmtApr, fmtAge } from '../lib/format';

// Одна таблица пулов с общей шапкой — и для результатов поиска, и для избранного.
// Колонки: Пара | Вид пула (комиссия + площадка) | APR 24ч | TVL | Объём 24ч | Комиссии 24ч | Цена 24ч.
//   rows        — пулы
//   getKey(p)   — уникальный ключ строки
//   onRowClick  — клик по строке
//   select      — { mode, selected:Set, onToggle(p) } — режим выбора для удаления (необязательно)
//   action(p)   — содержимое последней колонки (например «☆ добавить»), необязательно
//   actionTitle — заголовок этой колонки
//   showAge     — показывать возраст пула под парой
//   onSelect(p) — клик по строке выбирает пул (например, для графика); isActive(p) — подсветить выбранную строку
//   pairExtra(p) — маленький элемент справа от названия пары (☆ в избранное, ↗ открыть)
//   isDisabled  — строка неактивна (например, уже в избранном); markDisabled — рисовать у такой пары галочку
export default function PoolTable({ rows, getKey, onRowClick, onSelect, isActive, pairExtra, select, action, actionTitle = '', showAge = false, isDisabled, markDisabled = false }) {
  const t = useT();
  const { lang } = useLang();
  const selectMode = !!select?.mode;
  return (
    <div className="pool-table-wrap">
      <table className={`pool-table${selectMode ? ' pt-has-check' : ''}`}>
        <thead>
          <tr>
            {selectMode && <th className="pt-check" />}
            <th className="pt-pair">{t('Пара')}</th>
            <th className="pt-kind">{t('Вид пула')}</th>
            <th className="pt-num pt-apr">{t('APR 24ч')}</th>
            <th className="pt-num pt-tvl">TVL</th>
            <th className="pt-num pt-vol"><span className="pt-long">{t('Объём 24ч')}</span><span className="pt-short">{t('Объём')}</span></th>
            <th className="pt-num pt-fees"><span className="pt-long">{t('Комиссии 24ч')}</span><span className="pt-short">{t('Комисс.')}</span></th>
            <th className="pt-num pt-chg">{t('Цена 24ч')}</th>
            {action && <th className="pt-action">{actionTitle}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const key = getKey(p);
            const isSel = selectMode && select.selected.has(p.id);
            const disabled = isDisabled ? isDisabled(p) : false;
            const fees24 = p.fees24 ?? (p.vol24 != null && p.feePct != null ? p.vol24 * p.feePct / 100 : null);
            const pctColor = p.change24 == null ? 'var(--text-dim)' : p.change24 >= 0 ? 'var(--up)' : 'var(--down)';
            return (
              <tr
                key={key}
                className={`pt-row${isSel ? ' pt-selected' : ''}${disabled ? ' pt-disabled' : ''}${!isSel && isActive && isActive(p) ? ' pt-active' : ''}`}
                tabIndex={disabled && !selectMode ? -1 : 0}
                aria-disabled={disabled || undefined}
                aria-label={`${p.base}/${p.quote}, ${p.dex || ''}`}
                onClick={() => (selectMode ? select.onToggle(p) : onSelect ? onSelect(p) : !disabled && onRowClick && onRowClick(p))}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                  e.preventDefault();
                  if (selectMode) select.onToggle(p); else if (onSelect) onSelect(p); else if (!disabled && onRowClick) onRowClick(p);
                }}
              >
                {selectMode && (
                  <td className="pt-check">
                    <input type="checkbox" checked={isSel} onChange={() => select.onToggle(p)} onClick={(e) => e.stopPropagation()} style={{ width: 18, height: 18 }} />
                  </td>
                )}
                <td className="pt-pair">
                  <div className="pt-pair-name">
                    <span>{p.base}/{p.quote}{markDisabled && disabled && <span className="pt-mark" title={t('В избранном')}> ✓</span>}</span>
                    {showAge && <span className="pt-age" title={t('Возраст пула')}>{fmtAge(p.createdAt, t, lang === 'en' ? '.' : ',')}</span>}
                    {pairExtra && !selectMode && <span className="pt-extra" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{pairExtra(p)}</span>}
                  </div>
                </td>
                <td className="pt-kind">
                  <span className="pt-kind-inner">
                    <NetworkBadge network={p.network} />
                    <span className="pt-fee">{fmtFee(p.feePct, p.feeApprox)}</span>
                    <span className="pt-dex" title={p.dex || ''}>{p.dex || '—'}</span>
                  </span>
                </td>
                <td className="pt-num pt-apr pt-strong">{fmtApr(p.apr)}</td>
                <td className="pt-num pt-tvl">{fmtUsd(p.tvl)}</td>
                <td className="pt-num pt-vol">{fmtUsd(p.vol24)}</td>
                <td className="pt-num pt-fees">{fmtUsd(fees24)}</td>
                <td className="pt-num pt-chg" style={{ color: pctColor }}>{fmtPct(p.change24)}</td>
                {action && <td className="pt-action">{action(p)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
