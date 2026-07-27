-- ============================================================
--  MCC 한글학교 — 사이트 설정(site_settings) 테이블 추가
--  용도: 신청서 이메일 추가 안내문 등, admin에서 편집하는 고정 문구 저장
--  사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 RUN (한 번만)
-- ============================================================

create table if not exists public.site_settings (
  key         text primary key,           -- 예: email_extra_ko, email_extra_en
  value       text,
  updated_at  timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- 로그인한 관리자만 읽기/쓰기 (이메일 발송 함수도 관리자 토큰으로 읽음)
create policy "admins read settings"
  on public.site_settings for select to authenticated using (true);
create policy "admins manage settings"
  on public.site_settings for all to authenticated using (true) with check (true);
