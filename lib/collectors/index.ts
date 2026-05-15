// =============================================================================
// lib/collectors/index.ts
// Collector ファクトリ（レジストリ）
//
// 新しい Collector の追加手順:
//   1. lib/collectors/ 配下に Collector クラスを作成（BaseCollector を実装）
//   2. 下記 COLLECTORS オブジェクトにエントリを追加
//   3. types/sources.ts の SOURCE_TYPES / SOURCE_TYPE_LABELS に SourceType を追加
//   4. supabase/migrations/ に DB 変更が必要な場合は追加
//
// Phase 1 登録済み:
//   csv_upload    : CsvCollector（既存フローのソース化ラッパー）
//
// Phase 1 次 Step で追加予定（Step 87-E〜G）:
//   rakuten_ichiba: RakutenIchibaCollector
//   rakuten_travel: RakutenTravelCollector
//   google_places : GooglePlacesCollector
// =============================================================================

import type { BaseCollector } from './base'
import { CollectorError } from './base'
import { CsvCollector } from './csv-collector'
import type { SourceType } from '@/types/sources'

// ---------------------------------------------------------------------------
// Collector レジストリ
// ---------------------------------------------------------------------------

/**
 * SourceType → Collector のマッピング。
 * Phase 1 では csv_upload のみ登録。
 * 各 Collector インスタンスはシングルトンとして保持する（ステートレスのため安全）。
 */
const COLLECTORS: Partial<Record<SourceType, BaseCollector>> = {
  csv_upload: new CsvCollector(),
  // Step 87-E で追加:
  // rakuten_ichiba: new RakutenIchibaCollector(),
  // Step 87-G で追加:
  // rakuten_travel: new RakutenTravelCollector(),
  // google_places:  new GooglePlacesCollector(),
}

// ---------------------------------------------------------------------------
// getCollector
// ---------------------------------------------------------------------------

/**
 * SourceType に対応する Collector インスタンスを返す。
 * 未登録の SourceType が渡された場合は CollectorError(UNSUPPORTED) を投げる。
 *
 * @param sourceType - types/sources.ts で定義された SourceType
 * @returns BaseCollector の実装インスタンス
 * @throws {CollectorError} UNSUPPORTED — 未対応の sourceType
 *
 * @example
 *   const collector = getCollector('csv_upload')
 *   const result = await collector.collect(sourceId, { max_reviews: 500 })
 */
export function getCollector(sourceType: SourceType): BaseCollector {
  const collector = COLLECTORS[sourceType]
  if (!collector) {
    throw new CollectorError(
      `未対応のソースタイプです: ${sourceType}`,
      'UNSUPPORTED',
    )
  }
  return collector
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { CollectorError } from './base'
export type { BaseCollector, CollectOptions, CollectorErrorCode } from './base'
export type { ReviewInsertPayload } from './normalize'
export { anonymizeReviewer, normalizeRating, mergeTitle, toReviewInsert } from './normalize'
