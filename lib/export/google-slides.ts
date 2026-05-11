// =============================================================================
// Google Slides / Drive API 連携 — Phase 2 設計メモ
//
// 現状: PPTX出力のみ実装済み。ユーザーは Google Drive にアップロードして利用可能。
// Phase 2 では以下の自動化を実装予定。
// =============================================================================

// TODO: [Phase 2-1] Google OAuth 認証
// - next-auth または @auth/nextjs を使って Google OAuth フローを実装
// - スコープ: https://www.googleapis.com/auth/presentations
//             https://www.googleapis.com/auth/drive.file
// - アクセストークンを Supabase の sessions テーブルまたは next-auth セッションに保持
//
// 参考: https://developers.google.com/identity/protocols/oauth2/web-server

// TODO: [Phase 2-2] Google Slides API でプレゼンテーション新規作成
// - POST https://slides.googleapis.com/v1/presentations
// - タイトルを設定してから batchUpdate で各要素を追加
// - レイアウトは WIDE (16:9) を指定
//
// 参考: https://developers.google.com/slides/api/reference/rest/v1/presentations/create

// TODO: [Phase 2-3] Drive API で PPTX を Google Slides に変換インポート
// - 既存の generateProjectOnePagerPptx / generateComparisonOnePagerPptx で Buffer 生成
// - Drive API multipart upload: POST https://www.googleapis.com/upload/drive/v3/files
//   headers: { 'Content-Type': 'multipart/related' }
//   mimeType: 'application/vnd.google-apps.presentation' (自動変換)
// - レスポンスの fileId を返してユーザーに Google Slides URL を提示
//
// 参考: https://developers.google.com/drive/api/guides/manage-uploads#multipart

// TODO: [Phase 2-4] テンプレートスライドの複製
// - 社内で管理するマスタースライドのファイルIDを環境変数 GOOGLE_SLIDES_TEMPLATE_ID に設定
// - Drive API: POST https://www.googleapis.com/drive/v3/files/{templateId}/copy
// - 複製後に batchUpdate でプレースホルダーテキストを差し替え
//
// 参考: https://developers.google.com/slides/api/guides/presentations#copy_a_presentation

// TODO: [Phase 2-5] batchUpdate でテキスト差し替え
// - Slides API: POST https://slides.googleapis.com/v1/presentations/{presentationId}:batchUpdate
// - replaceAllText リクエストでプレースホルダーを実データに置換
// - 例:
//   requests: [
//     { replaceAllText: { containsText: { text: '{{SUMMARY}}' }, replaceText: analysis.summary } },
//     { replaceAllText: { containsText: { text: '{{PROJECT_NAME}}' }, replaceText: project.name } },
//     ...
//   ]
//
// 参考: https://developers.google.com/slides/api/reference/rest/v1/presentations/batchUpdate

// TODO: [Phase 2-6] ユーザーへの共有
// - Drive API Permissions: POST https://www.googleapis.com/drive/v3/files/{fileId}/permissions
// - role: 'writer' / 'reader' でメールアドレス宛に共有
// - 生成した Google Slides URL (https://docs.google.com/presentation/d/{fileId}) をフロントに返却

// =============================================================================
// 実装時の推奨パッケージ
// - googleapis: npm install googleapis
// - @googleapis/slides: npm install @googleapis/slides (型定義付き)
// - next-auth: npm install next-auth (OAuth管理)
// =============================================================================

// =============================================================================
// 関数シグネチャ定義 (Phase 2 実装予定)
// =============================================================================

export interface UploadPptxToDriveParams {
  /** PPTX の Buffer (generateProjectOnePagerPptx などで生成) */
  pptxBuffer: Buffer
  /** Google Drive 上のファイル名 */
  filename: string
  /** OAuth アクセストークン */
  accessToken: string
  /** アップロード先の Drive フォルダID (省略時はマイドライブルート) */
  folderId?: string
}

export interface CreateFromTemplateParams {
  /** スライドテンプレートの Drive ファイルID (env: GOOGLE_SLIDES_TEMPLATE_ID) */
  templateFileId: string
  /** 新しいスライドのタイトル */
  title: string
  /** batchUpdate で差し替えるプレースホルダーマップ */
  placeholders: Record<string, string>
  /** OAuth アクセストークン */
  accessToken: string
}

export interface GoogleSlidesExportResult {
  /** 作成された Google Slides のファイルID */
  fileId: string
  /** ブラウザで開けるURL */
  url: string
}

/**
 * 単体分析1枚サマリーを Google Slides としてエクスポートする
 * @param projectId - Supabase の projects.id
 * TODO: Phase 2 で実装
 *   1. Supabase から project + analysis を取得
 *   2. generateProjectOnePagerPptx で PPTX Buffer を生成
 *   3. uploadPptxToDriveAndConvertToSlides でアップロード & 変換
 *   4. 生成された Slides の URL を返す
 */
export async function exportProjectOnePagerToGoogleSlides(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _projectId: string
): Promise<GoogleSlidesExportResult> {
  throw new Error('Not implemented: Google Slides export is planned for Phase 2')
}

/**
 * 競合比較1枚サマリーを Google Slides としてエクスポートする
 * @param reportId - Supabase の comparison_reports.id
 * TODO: Phase 2 で実装
 *   1. Supabase から comparison_report + project names を取得
 *   2. generateComparisonOnePagerPptx で PPTX Buffer を生成
 *   3. uploadPptxToDriveAndConvertToSlides でアップロード & 変換
 *   4. 生成された Slides の URL を返す
 */
export async function exportComparisonOnePagerToGoogleSlides(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _reportId: string
): Promise<GoogleSlidesExportResult> {
  throw new Error('Not implemented: Google Slides export is planned for Phase 2')
}

/**
 * PPTX Buffer を Google Drive にアップロードし、Google Slides に変換する
 * TODO: Phase 2 で実装
 *   - Drive API multipart upload (mimeType: application/vnd.google-apps.presentation)
 *   - アップロードレスポンスから fileId を取得
 *   - https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true
 */
export async function uploadPptxToDriveAndConvertToSlides(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _params: UploadPptxToDriveParams
): Promise<GoogleSlidesExportResult> {
  throw new Error('Not implemented: Google Slides export is planned for Phase 2')
}

/**
 * テンプレートスライドを複製し、プレースホルダーテキストを差し替えて新しいスライドを作成する
 * TODO: Phase 2 で実装
 *   - Drive API files.copy でテンプレートを複製
 *   - Slides API batchUpdate で replaceAllText リクエストを実行
 *   - 完成した Slides の URL を返す
 */
export async function createGoogleSlidesFromTemplate(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _params: CreateFromTemplateParams
): Promise<GoogleSlidesExportResult> {
  throw new Error('Not implemented: Google Slides export is planned for Phase 2')
}
