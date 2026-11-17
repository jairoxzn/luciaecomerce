import { FileSpreadsheet, FileText } from "lucide-react";
import { buildQuery } from "@/lib/catalog-params";
import { defaultRange } from "@/lib/services/reports";
import { getDataset, isReportType, REPORT_TYPES } from "@/lib/services/report-datasets";
import { formatPEN, limaDateKey, parseLimaDate } from "@/lib/utils";
import { Card, FilterTabs, PageHeader, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Reportes" };
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const okDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tipoRaw = one(sp.tipo) ?? "ventas-diarias";
  const tipo = isReportType(tipoRaw) ? tipoRaw : "ventas-diarias";
  const d = defaultRange(30);
  const desde = okDate(one(sp.desde)) ? one(sp.desde)! : limaDateKey(d.from);
  const hasta = okDate(one(sp.hasta)) ? one(sp.hasta)! : limaDateKey(d.to);
  const range = { from: parseLimaDate(desde), to: parseLimaDate(hasta, true) };
  const ds = await getDataset(tipo, range);
  const qs = new URLSearchParams({ tipo, desde, hasta }).toString();
  const fmt = (v: string | number | undefined, kind?: string) => (kind === "money" ? formatPEN(Number(v ?? 0)) : kind === "int" ? Number(v ?? 0).toLocaleString("es-PE") : String(v ?? ""));

  return (
    <>
      <PageHeader title="Reportes" description="Datos reales de la base de datos, con exportación a Excel y PDF." actions={<>
        <a href={`/api/admin/reports/export?${qs}&formato=xlsx`} className={buttonClasses("outline", "sm")}><FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel</a>
        <a href={`/api/admin/reports/export?${qs}&formato=pdf`} className={buttonClasses("outline", "sm")}><FileText className="h-4 w-4 text-red-600" /> PDF</a>
      </>} />
      <FilterTabs current={tipo} hrefFor={(v) => `/admin/reportes${buildQuery(sp, { tipo: v })}`} tabs={REPORT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tipo" value={tipo} />
          <label className="text-sm"><span className="mb-1 block text-stone">Desde</span><input type="date" name="desde" defaultValue={desde} className="h-10 rounded-full border border-neutral-200 px-4" /></label>
          <label className="text-sm"><span className="mb-1 block text-stone">Hasta</span><input type="date" name="hasta" defaultValue={hasta} className="h-10 rounded-full border border-neutral-200 px-4" /></label>
          <button className="h-10 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-neutral-800">Aplicar</button>
        </form>
      </Card>
      <Card title={ds.title} padded={false}>
        <p className="border-b border-neutral-100 px-5 py-3 text-sm text-stone">{ds.description}</p>
        <Table>
          <thead><tr>{ds.columns.map((c) => <Th key={c.key} className={c.kind ? "text-right" : ""}>{c.label}</Th>)}</tr></thead>
          <tbody>
            {ds.rows.length === 0 && <TableEmpty cols={ds.columns.length} text="Sin datos en el período seleccionado." />}
            {ds.rows.map((r, i) => <tr key={i} className="hover:bg-brand-tint/20">{ds.columns.map((c) => <Td key={c.key} className={c.kind ? "text-right tabular-nums" : ""}>{fmt(r[c.key], c.kind)}</Td>)}</tr>)}
            {ds.totals && ds.rows.length > 0 && <tr className="bg-neutral-50 font-bold">{ds.columns.map((c, i) => <Td key={c.key} className={c.kind ? "text-right tabular-nums" : ""}>{i === 0 ? "TOTAL" : ds.totals![c.key] !== undefined ? fmt(ds.totals![c.key], c.kind) : ""}</Td>)}</tr>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
