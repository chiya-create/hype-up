// =============================================================================
// lib/collectors/normalize.ts
// 収集レビューの正規化・匿名化レイヤー
//
// 責務:
//   - reviewer 名の匿名化（個人情報保護）
//   - rating の 1–5 スケール正規化
//   - title の body への結合
//   - NormalizedReview → ReviewInsert 変換（DB 挿入用）
//
// 個人情報方針:
//   - 実名パターンは保存しない（null を返す）
//   - ニックネームは先頭4文字+*** に短縮
//   - raw フィールドには個人情報リスクのあるデータを保存しない（{} 固定）
//   - 外部ユーザーIDは external_id として保存するが、内容はソース側でハッシュ済みであること
// =============================================================================

import { generateBodyHash } from '@/lib/utils/hash'
import type { NormalizedReview } from '@/types/sources'
import type { Json } from '@/types/database'

// ---------------------------------------------------------------------------
// ReviewInsertPayload — toReviewInsert() の戻り値型
// ---------------------------------------------------------------------------

/**
 * toReviewInsert() の戻り値型。
 * types/database.ts の ReviewInsert と互換性を持ち、
 * review_source_id / external_id / collected_at を必ず含む。
 * supabase.from('reviews').insert() にそのまま渡せる。
 */
export type ReviewInsertPayload = {
  project_id:       string
  body:             string
  body_hash:        string
  /** 個人情報リスクを避けるため空オブジェクト固定 */
  raw:              Json
  rating:           number | null
  reviewer:         string | null
  reviewed_at:      string | null
  source:           string | null
  review_source_id: string
  external_id:      string | null
  collected_at:     string
}

// ---------------------------------------------------------------------------
// anonymizeReviewer
// ---------------------------------------------------------------------------

/**
 * 日本語フルネームパターン: 姓(2〜5文字)+スペース+名(1〜5文字)
 * 例: "田中 花子"、"山田　太郎" → null
 */
const JP_FULL_NAME_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,5}[\s　][\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{1,5}$/u

/**
 * 英語フルネームパターン: 頭文字大文字の名+スペース+頭文字大文字の姓
 * 例: "John Smith"、"Maria Garcia" → null
 */
const EN_FULL_NAME_RE = /^[A-Z][a-z]{1,19}\s[A-Z][a-z]{1,19}$/

/**
 * レビュワー名を匿名化する。
 *
 * 変換ルール:
 *   1. null / 空文字列 → null
 *   2. 日本語フルネームパターン → null（実名と判定して保存しない）
 *   3. 英語フルネームパターン → null
 *   4. 4文字以下のニックネーム → そのまま保持
 *   5. 5文字以上のニックネーム → 先頭4文字 + '***' に短縮
 *
 * @param raw - 収集元から取得したレビュワー名（未処理）
 * @returns 匿名化済みの文字列、または null
 */
export function anonymizeReviewer(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  // 実名パターン → 保存しない
  if (JP_FULL_NAME_RE.test(s)) return null
  if (EN_FULL_NAME_RE.test(s)) return null

  // 4文字以下はニックネームとして許容
  if (s.length <= 4) return s

  // 5文字以上はニックネームの先頭4文字 + *** に短縮
  return s.slice(0, 4) + '***'
}

// ---------------------------------------------------------------------------
// normalizeRating
// ---------------------------------------------------------------------------

/**
 * 任意スケールの評価値を 1–5 の整数に正規化する。
 *
 * 対応スケール:
 *   - 5点満点  : そのまま四捨五入（楽天・Google 等）
 *   - 10点満点 : (n / 10) * 5 にスケール変換後、四捨五入
 *   - 100点満点: (n / 100) * 5 にスケール変換後、四捨五入
 *   - 小数     : maxScale 基準でスケール後、四捨五入
 *
 * @param raw      - 収集元の評価値（数値または文字列）
 * @param maxScale - 収集元のスケール最大値（省略時 5）
 * @returns 1–5 の整数、または変換不能な場合 null
 *
 * @example
 *   normalizeRating(4)          // → 4
 *   normalizeRating(4.3)        // → 4
 *   normalizeRating(8, 10)      // → 4
 *   normalizeRating(80, 100)    // → 4
 *   normalizeRating('5.0')      // → 5
 *   normalizeRating(null)       // → null
 *   normalizeRating(0)          // → null（範囲外）
 *   normalizeRating(6)          // → null（5点満点で範囲外）
 */
export function normalizeRating(
  raw:      number | string | null | undefined,
  maxScale: number = 5,
): number | null {
  if (raw === null || raw === undefined) return null

  const n = typeof raw === 'string' ? parseFloat(raw) : raw
  if (!isFinite(n) || isNaN(n)) return null
  if (n < 0) return null

  // スケール変換して四捨五入
  const scaled = maxScale === 5 ? n : (n / maxScale) * 5
  const rounded = Math.round(scaled)

  if (rounded < 1 || rounded > 5) return null
  return rounded
}

// ---------------------------------------------------------------------------
// mergeTitle
// ---------------------------------------------------------------------------

/**
 * レビュータイトルをレビュー本文に結合する。
 *
 * 分析プロンプトはタイトルを別フィールドとして扱わないため、
 * title がある場合は body の先頭に改行区切りで結合する。
 * 分析では "タイトル\n本文" として処理される。
 *
 * @param body  - レビュー本文（必須）
 * @param title - レビュータイトル（任意）
 * @returns title + '\n' + body、または title がない場合は body のみ
 *
 * @example
 *   mergeTitle('保湿力が高い', '最高の商品')  // → '最高の商品\n保湿力が高い'
 *   mergeTitle('保湿力が高い', null)           // → '保湿力が高い'
 *   mergeTitle('保湿力が高い', '')             // → '保湿力が高い'
 */
export function mergeTitle(body: string, title: string | null | undefined): string {
  const t = title?.trim()
  if (!t) return body
  // タイトルと本文が同じ場合は結合しない（一部ソースでタイトル=本文になるケース対策）
  if (t === body.trim()) return body
  return `${t}\n${body}`
}

// ---------------------------------------------------------------------------
// toReviewInsert
// ---------------------------------------------------------------------------

/**
 * NormalizedReview を reviews テーブルへの INSERT レコードに変換する。
 *
 * 呼び出し元がセットすること:
 *   - project_id       : 対象プロジェクトの ID
 *   - reviewSourceId   : review_sources.id（収集ソースの ID）
 *
 * この関数が行うこと:
 *   - mergeTitle()     : title を body に結合
 *   - generateBodyHash(): body から SHA-256 ハッシュを生成
 *   - anonymizeReviewer(): reviewer を匿名化
 *   - raw = {}         : 個人情報リスクを避けるため空オブジェクト固定
 *   - collected_at     : 現在時刻（ISO 8601）を設定
 *
 * ⚠️ 重複排除は呼び出し元の UPSERT で行うこと。
 *    DB ユニーク制約: (project_id, review_source_id, external_id) WHERE NOT NULL
 *    body_hash による同一内容の重複は upsert ignoreDuplicates では防げないため、
 *    事前に重複チェックが必要な場合は呼び出し元で実施すること。
 *
 * @param normalized     - Collector が返す正規化済みレビュー
 * @param projectId      - 挿入先プロジェクト ID
 * @param reviewSourceId - review_sources テーブルの ID
 * @returns ReviewInsertPayload（supabase.from('reviews').insert() に直接渡せる）
 */
export function toReviewInsert(
  normalized:     NormalizedReview,
  projectId:      string,
  reviewSourceId: string,
): ReviewInsertPayload {
  const body = mergeTitle(normalized.body, normalized.title)

  return {
    project_id:       projectId,
    body,
    body_hash:        generateBodyHash(body),
    raw:              {} as Json,  // 個人情報リスク回避: 生データは保存しない
    rating:           normalized.rating,
    reviewer:         anonymizeReviewer(normalized.reviewer),
    reviewed_at:      normalized.reviewed_at ?? null,
    source:           normalized.source_label,
    review_source_id: reviewSourceId,
    external_id:      normalized.external_id ?? null,
    collected_at:     new Date().toISOString(),
  }
}
