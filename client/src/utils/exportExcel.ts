import * as XLSX from "xlsx";

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void {
  const worksheetData = data.map((row) => {
    const rowData: Record<string, any> = {};
    columns.forEach((col) => {
      const value = row[col.key];
      rowData[col.header] = value ?? "";
    });
    return rowData;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  const colWidths = columns.map((col) => ({
    wch: col.width || 20,
  }));
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `${filename}_${today}.xlsx`);
}

export const MEMBER_COLUMNS: ExportColumn[] = [
  { header: "ชื่อ-นามสกุล (ไทย)", key: "full_name_th", width: 25 },
  { header: "ชื่อเล่น", key: "nickname_th", width: 15 },
  { header: "ชื่อ-นามสกุล (อังกฤษ)", key: "full_name_en", width: 25 },
  { header: "เบอร์โทร", key: "phone", width: 15 },
  { header: "อีเมล", key: "email", width: 25 },
  { header: "บริษัท", key: "company", width: 25 },
  { header: "ตำแหน่ง", key: "position", width: 20 },
  { header: "ประเภทธุรกิจ", key: "business_type", width: 20 },
  { header: "สถานะ", key: "status", width: 12 },
  { header: "LINE ID", key: "line_id", width: 15 },
];

export const VISITOR_COLUMNS: ExportColumn[] = [
  { header: "ชื่อ-นามสกุล (ไทย)", key: "full_name_th", width: 25 },
  { header: "ชื่อเล่น", key: "nickname_th", width: 15 },
  { header: "เบอร์โทร", key: "phone", width: 15 },
  { header: "อีเมล", key: "email", width: 25 },
  { header: "บริษัท", key: "company", width: 25 },
  { header: "ตำแหน่ง", key: "position", width: 20 },
  { header: "ประเภทธุรกิจ", key: "business_type", width: 20 },
  { header: "สถานะ", key: "status", width: 12 },
  { header: "จำนวนเช็คอิน", key: "checkins_count", width: 12 },
];
