// =============================================================================
// lib/collectors/csv-collector.ts
// CSV アップロードの Collector ラッパー
//
// 役割:
//   既存の CSV アップロードフロー（app/api/upload/route.ts）を
//   'csv_upload' ソースとして review_sources に記録できるようにするための
//   Collector インターフェース実装。
//
// 設計上の注意:
//   - CSV は UI からのファイルアップロードで処理するため、
//     preview() / collect() は通常の外部 API Collector とは異なる。
//   - preview() はモーダルからは呼ばれない（既存アップロード UI を使う）ため UNSUPPORTED。
//   - collect() は app/api/upload/route.ts が直接 reviews INSERT するため no-op。
//     Step 87-D で upload route 改修時に review_source_id を付与するフローを実装する。
//
// Step 87-D での作業:
//   app/api/upload/route.ts を改修して、プロジェクト作成後に review_sources へ
//   'csv_upload' ソースを登録し、reviews INSERT 時に review_source_id を付与する。
// =============================================================================

import type { BaseCollector, CollectOptions } from './base'
import { CollectorError } from './base'
import type { CollectorResult, SourcePreviewResult, CreateSourceRequest } from '@/types/sources'

export class CsvCollector implements BaseCollector {
  readonly sourceType = 'csv_upload' as const

  /**
   * CSV アップロードはモーダルの URL 入力フローを経由しないため、
   * preview() の呼び出しは想定していない。
   * ソース登録は app/api/upload/route.ts の改修（Step 87-D）で行う。
   */
  async preview(_request: CreateSourceRequest): Promise<SourcePreviewResult> {
    throw new CollectorError(
      'CSVアップロードはファイル選択から行ってください。URLプレビューは非対応です。',
      'UNSUPPORTED',
    )
  }

  /**
   * CSV アップロードの reviews INSERT は app/api/upload/route.ts が直接行うため、
   * collect() は何もしない（no-op）。
   * collect() が呼ばれた場合は空の CollectorResult を返す。
   */
  async collect(
    _sourceId: string,
    _options?: CollectOptions,
  ): Promise<CollectorResult> {
    return {
      reviews:       [],
      total_fetched: 0,
      has_more:      false,
      next_cursor:   null,
      errors:        [],
    }
  }
}
