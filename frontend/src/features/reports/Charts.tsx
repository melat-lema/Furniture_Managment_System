import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../../lib/format';

const GOLD = '#f8af39';
const GRID = 'rgba(255,255,255,0.06)';
const AXIS = '#71717a';
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export interface ChartRow {
  label: string;
  value: number;
  /** a short extra line in the tooltip, for example "12 sales" */
  detail?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-100">{row.label}</p>
      <p className="text-gold-300">{formatMoney(row.value)}</p>
      {row.detail && <p className="text-zinc-500">{row.detail}</p>}
    </div>
  );
}

/** Money per day. */
export function DailyChart({ rows }: { rows: ChartRow[] }) {
  return (
    <div role="img" aria-label="Sales per day">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={GOLD} stopOpacity={0.35} />
              <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tickFormatter={(value: string) => value.slice(5)} stroke={AXIS} fontSize={12} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(value: number) => compact.format(value)} stroke={AXIS} fontSize={12} width={48} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="value" stroke={GOLD} strokeWidth={2} fill="url(#goldFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A ranking: one horizontal bar per row. */
export function RankChart({ rows, label }: { rows: ChartRow[]; label: string }) {
  const height = Math.max(150, rows.length * 42 + 24);
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tickFormatter={(value: number) => compact.format(value)} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fill: '#d4d4d8', fontSize: 12 }}
            tickFormatter={(value: string) => (value.length > 17 ? `${value.slice(0, 16)}…` : value)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={GOLD} radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
