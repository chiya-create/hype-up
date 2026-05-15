// =============================================================================
// lib/collectors/base.ts
// Collector 共通インターフェース・エラー型定義
//
// 設計原則:
//   - 新しい収集ソースは BaseCollector を実装するだけでパイプラインに接続できる。
//   - エラーは CollectorError に構造化して投げる。致命的でない問題は CollectorResult.errors に格納。
//   - CollectOptions は将来の差分同期（Phase 2: cursor/since_date）に備えて拡張可能に設計。
// =============================================================================

import type { CollectorResult, SourcePreviewResult, CreateSourceRequest } from '@/types/sources'

// ---------------------------------------------------------------------------
// CollectorErrorCode
// ---------------------------------------------------------------------------

export type CollectorErrorCode =
  | 'INVALID_URL'       // URL が解析できない・形式が不正
  | 'SOURCE_NOT_FOUND'  // 指定した商品・施設・場所が見つからない
  | 'AUTH_FAILED'       // API キー不正または権限不足
  | 'RATE_LIMITED'      // レート制限に達した（retryable=true）
  | 'NETWORK_ERROR'     // ネットワーク通信失敗（5xx 等、retryable の場合あり）
  | 'EMPTY_RESULT'      // 0件取得（エラーではないが呼び出し元に伝える用途）
  | 'PARSE_ERROR'       // レスポンスの JSON パース失敗
  | 'UNSUPPORTED'       // このCollectorでは非対応の操作

// ---------------------------------------------------------------------------
// CollectorError
// ---------------------------------------------------------------------------

/**
 * Collector が投げる構造化エラー。
 *
 * retryable=true のエラー（RATE_LIMITED / NETWORK_ERROR）は
 * 呼び出し元で一定時間後にリトライを検討できる。
 *
 * UI 向けには error.message をそのまま表示してよい（日本語メッセージを想定）。
 */
export class CollectorError extends Error {
  readonly code:      CollectorErrorCode
  readonly retryable: boolean

  constructor(
    message:   string,
    code:      CollectorErrorCode,
    retryable: boolean = false,
  ) {
    super(message)
    this.name      = 'CollectorError'
    this.code      = code
    this.retryable = retryable
  }
}

// ---------------------------------------------------------------------------
// CollectOptions
// ---------------------------------------------------------------------------

export interface CollectOptions {
  /** 取得する最大件数。省略時は呼び出し元で上限を設定すること。 */
  max_reviews?: number

  /**
   * Phase 2: 差分取得の開始位置カーソル。
   * 前回収集の CollectorResult.next_cursor を渡す。
   * Phase 1 では各 Collector が無視してよい。
   */
  cursor?: string

  /**
   * Phase 2: この日付以降のレビューのみ取得（YYYY-MM-DD）。
   * Phase 1 では各 Collector が無視してよい。
   */
  since_date?: string
}

// ---------------------------------------------------------------------------
// BaseCollector
// ---------------------------------------------------------------------------

/**
 * 全 Collector が実装するインターフェース。
 *
 * 新しい収集ソースの追加手順:
 *   1. BaseCollector を実装したクラスを lib/collectors/ 配下に作成
 *   2. lib/collectors/index.ts の COLLECTORS に登録
 *   3. types/sources.ts の SOURCE_TYPES / SOURCE_TYPE_LABELS に追加
 *   4. supabase/migrations/ に必要な DB 変更を追加（不要な場合は省略）
 */
export interface BaseCollector {
  /** SourceType と一致する識別子 */
  readonly sourceType: string

  /**
   * URL または ID からソース情報を解決し、プレビューデータを返す。
   * ソースの登録は行わない（UI モーダルの確認ステップで使用）。
   *
   * ⚠️ このメソッドは外部 API を呼び出すため、
   *    呼び出し元の API route で必ずプロジェクトアクセス権限チェックを行うこと。
   *    （types/sources.ts の SourcePreviewRequest JSDoc も参照）
   *
   * @throws {CollectorError} INVALID_URL / SOURCE_NOT_FOUND / AUTH_FAILED 等
   */
  preview(request: CreateSourceRequest): Promise<SourcePreviewResult>

  /**
   * レビューを収集して返す。
   * max_reviews を超えた場合は has_more=true で打ち切る。
   *
   * エラーの扱い:
   *   - 非致命的なエラー（1件だけパース失敗等）→ CollectorResult.errors に追加して続行
   *   - 致命的なエラー（認証失敗・ネットワーク不能）→ CollectorError を投げる
   *
   * @throws {CollectorError} AUTH_FAILED / NETWORK_ERROR / RATE_LIMITED 等
   */
  collect(sourceId: string, options?: CollectOptions): Promise<CollectorResult>
}
