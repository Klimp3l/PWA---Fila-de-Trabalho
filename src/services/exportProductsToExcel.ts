import * as XLSX from 'xlsx-js-style'
import type { AtividadeProdutoColumn, ProdutoAtividade } from '../types/workflow'
import {
  formatFieldValue,
  getProdutoFieldValue,
  normalizeBooleanValue,
} from '../components/product-list/utils'
import { getProdutoAtividadeKey } from './activityData'

const sanitizeFileNameSegment = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

const parseExcelDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsedDate = new Date(trimmed)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const resolveExcelCellValue = (fieldConfig: AtividadeProdutoColumn | undefined, rawValue: unknown) => {
  const configuredType = String(fieldConfig?.type ?? '').toLowerCase()

  if (configuredType === 'inputnumber' || configuredType === 'number' || configuredType === 'currency' || configuredType === 'money') {
    const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue)
    if (Number.isFinite(numeric)) {
      return numeric
    }
    return formatFieldValue(fieldConfig, rawValue)
  }

  if (configuredType === 'date') {
    const dateValue = parseExcelDateValue(rawValue)
    return dateValue ?? formatFieldValue(fieldConfig, rawValue)
  }

  if (configuredType === 'boolean') {
    const booleanValue = normalizeBooleanValue(rawValue)
    return booleanValue ?? formatFieldValue(fieldConfig, rawValue)
  }

  return formatFieldValue(fieldConfig, rawValue)
}

interface ExportProductsToExcelParams {
  products: ProdutoAtividade[]
  exportableFieldKeys: string[]
  fieldConfigByKey: Record<string, AtividadeProdutoColumn>
  specialFieldValuesByProduct: Record<string, Record<string, string | number | boolean | null>>
  activityLabel: string
}

export const exportProductsToExcel = ({
  products,
  exportableFieldKeys,
  fieldConfigByKey,
  specialFieldValuesByProduct,
  activityLabel,
}: ExportProductsToExcelParams) => {
  const exportHeaders = exportableFieldKeys.map((field) => fieldConfigByKey[field]?.label ?? field)
  const exportRows = products.map((produto) => {
    const productKey = getProdutoAtividadeKey(produto)
    const specialValues = specialFieldValuesByProduct[productKey] ?? {}
    return exportableFieldKeys.map((field) => {
      const fieldConfig = fieldConfigByKey[field]
      const hasSpecialValue = Object.prototype.hasOwnProperty.call(specialValues, field)
      const fieldValue = hasSpecialValue ? specialValues[field] : getProdutoFieldValue(produto, field)
      return resolveExcelCellValue(fieldConfig, fieldValue)
    })
  })

  const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows], { cellDates: true })
  const worksheetRange = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1')
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: worksheetRange.e.r, c: worksheetRange.e.c },
    }),
  }
  ;(worksheet as XLSX.WorkSheet & { '!freeze'?: unknown })['!freeze'] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  }
  worksheet['!cols'] = exportableFieldKeys.map((field, index) => {
    if (field === 'produto') {
      return { wch: 40 }
    }
    return {
      wch: Math.max(14, Math.min(28, exportHeaders[index]?.length + 6 || 16)),
    }
  })

  for (let rowIndex = 1; rowIndex <= worksheetRange.e.r; rowIndex += 1) {
    exportableFieldKeys.forEach((field, columnIndex) => {
      const fieldType = String(fieldConfigByKey[field]?.type ?? '').toLowerCase()
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      const cell = worksheet[cellRef] as (XLSX.CellObject & { z?: string }) | undefined
      if (!cell) {
        return
      }

      if (fieldType === 'date' && cell.v instanceof Date) {
        cell.z = 'dd/mm/yyyy'
        return
      }

      if (field === 'idproduto' && typeof cell.v === 'number') {
        cell.v = Math.trunc(cell.v)
        cell.z = '#,##0'
        return
      }

      if ((fieldType === 'inputnumber' || fieldType === 'number') && typeof cell.v === 'number') {
        cell.z = '#,##0.00'
        return
      }

      if ((fieldType === 'currency' || fieldType === 'money') && typeof cell.v === 'number') {
        cell.z = 'R$ #,##0.00'
      }
    })
  }

  for (let columnIndex = 0; columnIndex <= worksheetRange.e.c; columnIndex += 1) {
    const headerRef = XLSX.utils.encode_cell({ r: 0, c: columnIndex })
    const headerCell = worksheet[headerRef]
    if (!headerCell) {
      continue
    }
    ;(headerCell as XLSX.CellObject & { s?: unknown }).s = {
      fill: {
        patternType: 'solid',
        fgColor: { rgb: '1F4E78' },
      },
      font: {
        bold: true,
        color: { rgb: 'FFFFFF' },
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
    }
  }

  for (let rowIndex = 1; rowIndex <= worksheetRange.e.r; rowIndex += 1) {
    const stripeColor = rowIndex % 2 === 0 ? 'E8F1FB' : 'FFFFFF'
    for (let columnIndex = 0; columnIndex <= worksheetRange.e.c; columnIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      const cell = worksheet[cellRef]
      if (!cell) {
        continue
      }
      ;(cell as XLSX.CellObject & { s?: unknown }).s = {
        ...((cell as XLSX.CellObject & { s?: Record<string, unknown> }).s ?? {}),
        fill: {
          patternType: 'solid',
          fgColor: { rgb: stripeColor },
        },
      }
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos')

  const sanitizedLabel = sanitizeFileNameSegment(activityLabel || 'atividade')
  const dateSuffix = new Date().toISOString().replace(/[:.]/g, '-')
  XLSX.writeFile(workbook, `produtos-${sanitizedLabel || 'atividade'}-${dateSuffix}.xlsx`)
}
