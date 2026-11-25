import type { CellObject, SheetData } from 'write-excel-file/browser'
import writeExcelFile from 'write-excel-file/browser'

export async function exportXlsx(
  fileName: string,
  sheet: string,
  headers: string[],
  widths: number[],
  rows: (string | number)[][],
): Promise<void> {
  const sheetData: SheetData = [
    headers.map((header): CellObject => ({ value: header, type: String, fontWeight: 'bold' })),
    ...rows.map(row => row.map(toCell)),
  ]

  await writeExcelFile(sheetData, {
    sheet,
    columns: widths.map(width => ({ width })),
  }).toFile(fileName)
}

function toCell(value: string | number): CellObject {
  return typeof value === 'number'
    ? { value, type: Number, format: '0.00' }
    : { value, type: String }
}
