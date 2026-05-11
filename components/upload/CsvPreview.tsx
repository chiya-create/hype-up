'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface CsvPreviewProps {
  headers: string[]
  rows: Record<string, string>[]
  hasBodyColumn: boolean
}

const IMPORTANT_COLS = new Set(['body', 'rating', 'source', 'reviewer', 'reviewed_at'])

export function CsvPreview({ headers, rows, hasBodyColumn }: CsvPreviewProps) {
  if (headers.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium">
          プレビュー
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            先頭 {rows.length} 行 · {headers.length} 列
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {headers.map((h) => (
            <span
              key={h}
              className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                h === 'body'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : IMPORTANT_COLS.has(h)
                    ? 'bg-muted text-foreground'
                    : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {h}
              {h === 'body' && ' ✓'}
            </span>
          ))}
          {!hasBodyColumn && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono">
              body（未検出）
            </span>
          )}
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead
                  key={h}
                  className={`whitespace-nowrap ${
                    h === 'body' ? 'min-w-[220px] bg-primary/5 font-semibold' : 'min-w-[90px]'
                  }`}
                >
                  {h}
                  {h === 'body' && (
                    <span className="ml-1 text-xs font-normal text-primary">必須</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {headers.map((h) => (
                  <TableCell
                    key={h}
                    className={`text-sm align-top ${h === 'body' ? 'bg-primary/5' : ''}`}
                  >
                    <span className="line-clamp-2 text-xs">{row[h] ?? ''}</span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
