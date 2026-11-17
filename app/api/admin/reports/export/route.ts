import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { assertAdmin, AuthError } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { defaultRange } from "@/lib/services/reports";
import { getDataset, isReportType, type Dataset } from "@/lib/services/report-datasets";
import { getSettings } from "@/lib/services/settings";
import { formatPEN, parseLimaDate } from "@/lib/utils";

export const runtime = "nodejs";

function fmt(v: string | number | undefined, kind?: string) {
  if (v === undefined) return "";
  if (kind === "money") return formatPEN(Number(v));
  return String(v);
}

async function toXlsx(ds: Dataset, store: string, rangeLabel: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = store;
  const ws = wb.addWorksheet(ds.title.slice(0, 30));
  ws.addRow([`${store} — ${ds.title}`]).font = { bold: true, size: 14 };
  ws.addRow([rangeLabel]).font = { color: { argb: "FF737373" } };
  ws.addRow([]);
  const head = ws.addRow(ds.columns.map((c) => c.label));
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE65385" } }));
  for (const r of ds.rows) ws.addRow(ds.columns.map((c) => (c.kind === "money" || c.kind === "int" ? Number(r[c.key] ?? 0) : r[c.key] ?? "")));
  if (ds.totals) {
    const t = ws.addRow(ds.columns.map((c, i) => (i === 0 ? "TOTAL" : ds.totals![c.key] ?? "")));
    t.font = { bold: true };
  }
  ds.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(14, c.label.length + 4);
    if (c.kind === "money") col.numFmt = '"S/" #,##0.00';
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function toPdf(ds: Dataset, store: string, rangeLabel: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, layout: ds.columns.length > 5 ? "landscape" : "portrait" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#E65385").fontSize(18).text(store, { continued: false });
    doc.fillColor("#171717").fontSize(14).text(ds.title);
    doc.fillColor("#737373").fontSize(9).text(rangeLabel).moveDown(0.3).text(ds.description, { width: doc.page.width - 80 }).moveDown(0.8);

    const width = doc.page.width - 80;
    const colW = width / ds.columns.length;
    const drawRow = (vals: string[], bold = false, fill?: string) => {
      const y = doc.y;
      if (y > doc.page.height - 70) { doc.addPage(); }
      const top = doc.y;
      if (fill) doc.rect(40, top - 2, width, 18).fill(fill);
      doc.fillColor(fill ? "#FFFFFF" : "#171717").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      vals.forEach((v, i) => doc.text(v, 40 + i * colW + 4, top + 2, { width: colW - 8, height: 14, ellipsis: true, lineBreak: false }));
      doc.y = top + 18;
      doc.x = 40;
    };
    drawRow(ds.columns.map((c) => c.label), true, "#E65385");
    if (ds.rows.length === 0) doc.fillColor("#737373").text("Sin datos en el período seleccionado.", 40, doc.y + 6);
    for (const r of ds.rows) drawRow(ds.columns.map((c) => fmt(r[c.key], c.kind)));
    if (ds.totals) drawRow(ds.columns.map((c, i) => (i === 0 ? "TOTAL" : ds.totals![c.key] !== undefined ? fmt(ds.totals![c.key], c.kind) : "")), true);
    doc.end();
  });
}

export async function GET(req: Request) {
  try {
    const admin = await assertAdmin();
    const sp = new URL(req.url).searchParams;
    const tipo = sp.get("tipo") ?? "";
    const formato = sp.get("formato") === "pdf" ? "pdf" : "xlsx";
    if (!isReportType(tipo)) return NextResponse.json({ error: "Tipo de reporte inválido" }, { status: 400 });
    const d = defaultRange(30);
    const desde = sp.get("desde");
    const hasta = sp.get("hasta");
    const okDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const range = { from: okDate(desde) ? parseLimaDate(desde!) : d.from, to: okDate(hasta) ? parseLimaDate(hasta!, true) : d.to };
    const [ds, settings] = await Promise.all([getDataset(tipo, range), getSettings()]);
    const rangeLabel = `Período: ${desde ?? "últimos 30 días"} a ${hasta ?? "hoy"} · Generado ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}`;
    await logAudit(admin.id, `EXPORT_${formato.toUpperCase()}`, "Report", tipo);
    const body = formato === "pdf" ? await toPdf(ds, settings.storeName, rangeLabel) : await toXlsx(ds, settings.storeName, rangeLabel);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte-${tipo}.${formato}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
    console.error("[reports] export", e);
    return NextResponse.json({ error: "No se pudo generar el reporte" }, { status: 500 });
  }
}
