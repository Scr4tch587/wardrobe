import { addDays, weekdayIndex } from "../lib/dates";

export function Heatmap({ dates, cutoff }: { dates: string[]; cutoff: string }) {
  const worn = new Set(dates);
  const endOffset = 6 - weekdayIndex(cutoff);
  const end = addDays(cutoff, endOffset);
  const cells: { date: string; on: boolean; future: boolean }[] = [];
  for (let index = 53 * 7 - 1; index >= 0; index--) {
    const date = addDays(end, -index);
    cells.push({ date, on: worn.has(date), future: date > cutoff });
  }
  const weeks: (typeof cells)[] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));

  return (
    <svg viewBox={`0 0 ${weeks.length * 12} 84`} role="img" aria-label="Days worn" className="w-full">
      {weeks.map((week, x) =>
        week.map((cell, y) => (
          <rect
            key={cell.date}
            x={x * 12}
            y={y * 12}
            width="10"
            height="10"
            rx="2"
            fill={cell.future ? "transparent" : cell.on ? "#9a3412" : "#e7e0d4"}
          >
            <title>{cell.future ? "" : `${cell.date}${cell.on ? " worn" : ""}`}</title>
          </rect>
        )),
      )}
    </svg>
  );
}

export function Bars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const height = Math.max(rows.length, 1) * 32;
  return (
    <svg viewBox={`0 0 560 ${height}`} role="img" className="w-full">
      {rows.map((row, index) => (
        <g key={row.label} transform={`translate(0 ${index * 32})`}>
          <text x="0" y="16" fill="#6f675e" fontSize="12">
            {row.label}
          </text>
          <rect x="150" y="4" width={(row.value / max) * 280} height="16" rx="4" fill="#314237" />
          <text x="440" y="16" fill="#1c1915" fontSize="12">
            {row.note ?? String(Math.round(row.value * 10) / 10)}
          </text>
        </g>
      ))}
    </svg>
  );
}
