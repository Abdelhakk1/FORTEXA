type CsvCell = string | number | boolean | null | undefined;

interface DownloadCsvOptions<T extends object> {
  filename: string;
  columns: Array<{ key: keyof T & string; label: string }>;
  rows: T[];
}

function escapeCell(value: CsvCell) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function downloadCsv<T extends object>({ filename, columns, rows }: DownloadCsvOptions<T>) {
  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => escapeCell(row[column.key] as CsvCell)).join(","))
    .join("\n");

  const csvContent = [header, body].filter(Boolean).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
