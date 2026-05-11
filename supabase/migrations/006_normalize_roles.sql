-- ---------------------------------------------------------------------------
-- 006_normalize_roles.sql
-- organization_members.role を新ロール体系に移行する
--
-- 旧ロール → 新ロール マッピング:
--   owner  → client_owner   (クライアント組織の管理者)
--   member → client_member  (クライアント組織の通常利用者)
--   admin  → platform_admin (Hype Up AI 運営者)
--   viewer → client_member  (閲覧専用ロールは廃止、安全側に倒す)
-- ---------------------------------------------------------------------------

UPDATE organization_members
SET role = 'client_owner'
WHERE role = 'owner';

UPDATE organization_members
SET role = 'client_member'
WHERE role = 'member';

UPDATE organization_members
SET role = 'platform_admin'
WHERE role = 'admin';

-- viewer は client_member に統合（閲覧専用ロールは廃止）
UPDATE organization_members
SET role = 'client_member'
WHERE role = 'viewer';
