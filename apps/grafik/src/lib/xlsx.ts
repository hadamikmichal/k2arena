// Eksport do Excela (.xlsx) – wiele arkuszy, pogrubiony i zamrożony nagłówek, autofiltr, szerokości kolumn.
import ExcelJS from "exceljs";
import type { Table } from "./formStats";

export async function toXlsx(sheets: { name: string; table: Table }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "K2 Arena – grafik";
  wb.created = new Date();
  for (const { name, table } of sheets) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.addRow(table.header).font = { bold: true };
    for (const r of table.rows) ws.addRow(r);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.header.length } };
    ws.columns.forEach((col, i) => {
      const longest = Math.max(...[table.header[i], ...table.rows.map((r) => r[i])].map((v) => String(v ?? "").length));
      col.width = Math.min(60, Math.max(8, longest + 2));
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
