'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CsvPreview } from './CsvPreview'
import { parseCsvFilePreview } from '@/lib/csv/parser'
import { INDUSTRY_TEMPLATES, INDUSTRY_IDS, MAX_REVIEWS_PER_PROJECT, WARNING_REVIEWS_THRESHOLD } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'

interface PreviewData {
  headers: string[]
  rows: Record<string, string>[]
  hasBodyColumn: boolean
  totalRowCount: number
}

interface UploadResult {
  project_id: string
  total_rows: number
  inserted_count: number
  skipped_empty_count: number
  skipped_duplicate_count: number
  chunk_count: number
  errors: string[]
}

export function CsvUploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState<IndustryId>('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  const handleFile = useCallback(async (selected: File) => {
    if (!selected.name.endsWith('.csv')) {
      setError('CSV ファイルのみ対応しています')
      return
    }
    setFile(selected)
    setError(null)
    setResult(null)
    const data = await parseCsvFilePreview(selected)
    setPreview(data)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFile(dropped)
    },
    [handleFile]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleFile(selected)
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setError(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('CSVファイルを選択してください'); return }
    if (!projectName.trim()) { setError('プロジェクト名を入力してください'); return }
    if (preview && !preview.hasBodyColumn) { setError('CSVに body 列が必要です'); return }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectName', projectName.trim())
      formData.append('description', description.trim())
      formData.append('industry', industry)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'アップロードに失敗しました')
        return
      }

      setResult(json)
      // 1秒後にダッシュボードへ遷移
      setTimeout(() => router.push(`/projects/${json.project_id}`), 1000)
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* プロジェクト名 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="projectName">
          商品名 / プロジェクト名 <span className="text-destructive">*</span>
        </label>
        <input
          id="projectName"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="例: ○○シャンプー レビュー分析"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        />
      </div>

      {/* 説明 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="description">
          補足情報（任意）
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: Amazon の直近1年分のレビュー"
          rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          disabled={loading}
        />
      </div>

      {/* 業界テンプレート */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="industry">
          業界テンプレート
        </label>
        <select
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value as IndustryId)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        >
          {INDUSTRY_IDS.map((id) => (
            <option key={id} value={id}>
              {INDUSTRY_TEMPLATES[id].label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {INDUSTRY_TEMPLATES[industry].description}
        </p>
        {industry !== 'general' && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2 space-y-1">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">重視する分析観点</p>
            <ul className="space-y-0.5">
              {INDUSTRY_TEMPLATES[industry].analysisFocus.map((f, i) => (
                <li key={i} className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  • {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* CSVアップロードエリア */}
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'}`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">CSV をドラッグ&amp;ドロップ</p>
            <p className="text-xs text-muted-foreground mt-1">または クリックして選択</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <Card className={preview && !preview.hasBodyColumn ? 'border-destructive/50' : ''}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="rounded-md p-1 hover:bg-muted"
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-muted-foreground">
                    列数:{' '}
                    <span className="font-medium text-foreground">
                      {preview.headers.length}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    レビュー件数:{' '}
                    <span
                      className={
                        preview.totalRowCount > MAX_REVIEWS_PER_PROJECT
                          ? 'font-bold text-destructive'
                          : preview.totalRowCount > WARNING_REVIEWS_THRESHOLD
                            ? 'font-bold text-amber-600'
                            : 'font-medium text-foreground'
                      }
                    >
                      {preview.totalRowCount.toLocaleString()} 件
                    </span>
                  </span>
                  <span
                    className={
                      preview.hasBodyColumn
                        ? 'text-green-600 font-medium'
                        : 'text-destructive font-medium'
                    }
                  >
                    {preview.hasBodyColumn ? '✓ body 列あり' : '✗ body 列なし'}
                  </span>
                </div>

                {/* 件数警告 */}
                {preview.totalRowCount > MAX_REVIEWS_PER_PROJECT && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                    <span className="font-medium">件数超過:</span>{' '}
                    現在の MVP では 1 プロジェクトあたり最大{' '}
                    <strong>{MAX_REVIEWS_PER_PROJECT.toLocaleString()} 件</strong>
                    まで対応しています。
                    CSV を {Math.ceil(preview.totalRowCount / MAX_REVIEWS_PER_PROJECT)} 分割してアップロードしてください。
                    大規模分析は今後の非同期ジョブ化で対応予定です。
                  </div>
                )}
                {preview.totalRowCount > WARNING_REVIEWS_THRESHOLD &&
                  preview.totalRowCount <= MAX_REVIEWS_PER_PROJECT && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <span className="font-medium">件数注意:</span>{' '}
                    {preview.totalRowCount.toLocaleString()} 件の分析には数分かかる場合があります。
                    ページを閉じずにお待ちください。
                  </div>
                )}

                {!preview.hasBodyColumn && (
                  <p className="text-destructive text-xs">
                    body 列が必要です。列名を確認してください。
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* プレビュー */}
      {preview && (
        <CsvPreview
          headers={preview.headers}
          rows={preview.rows}
          hasBodyColumn={preview.hasBodyColumn}
        />
      )}

      {/* エラー */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 成功 */}
      {result && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
          <p className="font-medium">アップロード完了 — ダッシュボードへ移動中...</p>
          <p>登録: {result.inserted_count} 件 / 空行スキップ: {result.skipped_empty_count} 件 / 重複スキップ: {result.skipped_duplicate_count} 件</p>
          <p>チャンク: {result.chunk_count} 個</p>
        </div>
      )}

      {/* ローディング */}
      {loading && <Progress value={null} className="h-1" />}

      <Button
        type="submit"
        disabled={
          loading ||
          !file ||
          (preview != null && !preview.hasBodyColumn) ||
          (preview != null && preview.totalRowCount > MAX_REVIEWS_PER_PROJECT)
        }
        className="w-full"
      >
        {loading ? 'アップロード中...' : 'アップロードして分析準備'}
      </Button>
    </form>
  )
}
