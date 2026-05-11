import Papa from 'papaparse'
import type { ParsedReviewRow } from '@/types/analysis'

export interface CsvParseResult {
  rows: ParsedReviewRow[]
  skipped_empty_count: number
  errors: string[]
}

export function parseCsvText(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  })

  if (!result.meta.fields?.includes('body')) {
    return {
      rows: [],
      skipped_empty_count: 0,
      errors: ['CSVに body 列が見つかりません。必須列です。'],
    }
  }

  const rows: ParsedReviewRow[] = []
  let skipped_empty_count = 0
  const errors: string[] = []

  for (const raw of result.data) {
    const body = raw['body']?.trim() ?? ''
    if (!body) {
      skipped_empty_count++
      continue
    }

    // rating: 1–5 integer only
    let rating: number | null = null
    const ratingRaw = raw['rating']?.trim()
    if (ratingRaw) {
      const n = parseInt(ratingRaw, 10)
      if (!isNaN(n) && n >= 1 && n <= 5 && String(n) === ratingRaw) {
        rating = n
      }
    }

    // reviewed_at: must parse as a valid date
    let reviewed_at: string | null = null
    const reviewedAtRaw = raw['reviewed_at']?.trim()
    if (reviewedAtRaw) {
      const d = new Date(reviewedAtRaw)
      if (!isNaN(d.getTime())) {
        reviewed_at = d.toISOString().split('T')[0]
      }
    }

    rows.push({
      body,
      rating,
      reviewer: raw['reviewer']?.trim() || null,
      reviewed_at,
      source: raw['source']?.trim() || null,
      raw,
    })
  }

  if (result.errors.length > 0) {
    errors.push(...result.errors.slice(0, 3).map((e) => `CSV解析エラー (行${e.row}): ${e.message}`))
  }

  return { rows, skipped_empty_count, errors }
}

/**
 * Client-side preview: parse a CSV File object and return:
 * - headers / first N rows for preview
 * - hasBodyColumn for early validation
 * - totalRowCount: full count of non-empty rows (single-pass via step callback)
 */
export async function parseCsvFilePreview(
  file: File,
  previewLimit = 5
): Promise<{
  headers: string[]
  rows: Record<string, string>[]
  hasBodyColumn: boolean
  totalRowCount: number
}> {
  return new Promise((resolve) => {
    const previewRows: Record<string, string>[] = []
    let headers: string[] = []
    let totalRowCount = 0

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
      step(result) {
        // Capture headers on first row
        if (headers.length === 0 && result.meta.fields) {
          headers = result.meta.fields
        }
        totalRowCount++
        if (previewRows.length < previewLimit) {
          previewRows.push(result.data)
        }
      },
      complete() {
        resolve({
          headers,
          rows: previewRows,
          hasBodyColumn: headers.includes('body'),
          totalRowCount,
        })
      },
    })
  })
}
