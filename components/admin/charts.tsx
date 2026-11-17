"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPEN } from "@/lib/utils";

const BRAND = "#E65385";
const PALETTE = ["#E65385", "#171717", "#F7B7CD", "#4F7CAC", "#4D7C5B", "#737373", "#D9A441", "#8B5CF6"];
const axis = { fontSize: 11, fill: "#737373" };

const shortDate = (s: string) => {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
};
const monthLabel = (s: string) => new Intl.DateTimeFormat("es-PE", { month: "short" }).format(new Date(`${s}T12:00:00-05:00`));

function Empty({ text = "Sin datos en el período" }: { text?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-stone">{text}</div>;
}

type SalesPoint = { label: string; total: number; orders: number };

export function SalesAreaChart({ data }: { data: SalesPoint[] }) {
  if (!data.some((d) => d.total > 0)) return <div className="h-64"><Empty text="Aún no hay ventas confirmadas en este período" /></div>;
  return (
    <div className="h-64" role="img" aria-label="Gráfico de ventas diarias">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={BRAND} stopOpacity={0.35} /><stop offset="95%" stopColor={BRAND} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
          <XAxis dataKey="label" tickFormatter={shortDate} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `S/${v}`} />
          <Tooltip formatter={(v) => [formatPEN(Number(v)), "Ventas"]} labelFormatter={(l) => shortDate(String(l))} contentStyle={{ borderRadius: 12, border: "1px solid #eee" }} />
          <Area type="monotone" dataKey="total" stroke={BRAND} strokeWidth={2.5} fill="url(#sales)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBarChart({ data }: { data: SalesPoint[] }) {
  if (!data.length) return <div className="h-64"><Empty /></div>;
  return (
    <div className="h-64" role="img" aria-label="Gráfico de ventas mensuales">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
          <XAxis dataKey="label" tickFormatter={monthLabel} tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `S/${v}`} />
          <Tooltip formatter={(v) => [formatPEN(Number(v)), "Ventas"]} labelFormatter={(l) => monthLabel(String(l))} contentStyle={{ borderRadius: 12, border: "1px solid #eee" }} />
          <Bar dataKey="total" fill={BRAND} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopProductsChart({ data }: { data: { name: string; units: number }[] }) {
  if (!data.length) return <div className="h-64"><Empty /></div>;
  return (
    <div className="h-64" role="img" aria-label="Productos más vendidos">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={130} tick={axis} tickLine={false} axisLine={false} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
          <Tooltip formatter={(v) => [`${v} uds.`, "Vendidas"]} contentStyle={{ borderRadius: 12, border: "1px solid #eee" }} />
          <Bar dataKey="units" fill={BRAND} radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, money = false, label }: { data: { name: string; value: number }[]; money?: boolean; label: string }) {
  const valueFormatter = (v: number) => (money ? formatPEN(v) : String(v));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="h-64"><Empty /></div>;
  return (
    <div className="flex flex-col items-center gap-4" role="img" aria-label={label}>
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [valueFormatter(Number(v)), String(name)]} contentStyle={{ borderRadius: 12, border: "1px solid #eee" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{d.name}</span>
            <span className="font-semibold tabular-nums">{valueFormatter(d.value)} <span className="font-normal text-stone">({Math.round((d.value / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
