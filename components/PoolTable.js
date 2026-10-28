'use client';
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
//   isDisabled  — строка неактивна (например, уже в избранном)
export default function PoolTable({ rows, getKey, onRowClick, select, action, actionTitle = '', showAge = false, isDisabled }) {
  const selectMode = !!select?.mode;
  return (
    <div className="pool-table-wrap">
      <table className="pool-table">
        <thead>
          <tr>
            {selectMode && <th className="pt-check" />}
            <th className="pt-pair">Пара</th>
            <th className="pt-kind">Вид пула</th>
            <th className="pt-num">APR 24ч</th>
            <th className="pt-num">TVL</th>
            <th className="pt-num">Объём 24ч</th>
            <th className="pt-num">Комиссии 24ч</th>
            <th className="pt-num">Цена 24ч</th>
            {action && <th className="pt-action">{actionTitle}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const key = getKey(p);
            const isSel = selectMode && select.selected.has(p.id);
            const disabled = isDisabled ? isDisabled(p) : false;
            const fees24 = p.fees24 ?? (p.vol24 != null && p.feePct != null ? p.vol24 * p.feePct / 100 : null);
            const pctColor = p.change24 == null ? 'var(--text-dim)' : p.change24 >= 0 ? '#26a69a' : '#ef5350';
            return (
              <tr
                key={key}
                className={`pt-row${isSel ? ' pt-selected' : ''}${disabled ? ' pt-disabled' : ''}`}
                onClick={() => (selectMode ? select.onToggle(p) : onRowClick && onRowClick(p))}
              >
                {selectMode && (
                  <td className="pt-check">
                    <input type="checkbox" checked={isSel} onChange={() => select.onToggle(p)} onClick={(e) => e.stopPropagation()} style={{ width: 18, height: 18 }} />
                  </td>
                )}
                <td className="pt-pair">
                  <div className="pt-pair-name">{p.base}/{p.quote}</div>
                  {showAge && <div className="pt-sub">{fmtAge(p.createdAt)}</div>}
                </td>
                <td className="pt-kind">
                  <span className="pt-kind-inner">
                    <NetworkBadge network={p.network} />
                    <span className="pt-fee">{fmtFee(p.feePct, p.feeApprox)}</span>
                    <span className="pt-dex">{p.dex || '—'}</span>
                  </span>
                </td>
                <td className="pt-num pt-strong">{fmtApr(p.apr)}</td>
                <td className="pt-num">{fmtUsd(p.tvl)}</td>
                <td className="pt-num">{fmtUsd(p.vol24)}</td>
                <td className="pt-num">{fmtUsd(fees24)}</td>
                <td className="pt-num" style={{ color: pctColor }}>{fmtPct(p.change24)}</td>
                {action && <td className="pt-action">{action(p)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
