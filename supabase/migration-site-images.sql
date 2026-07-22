-- ============================================================
--  늘 푸른 한글학교 — "사이트 이미지" 기능 추가 마이그레이션
--  사용법: Supabase 대시보드 → SQL Editor → New query →
--          이 파일 전체를 붙여넣고 RUN (한 번만 실행하면 됩니다)
--
--  사진 자체는 기존 'gallery' 버킷의 site/ · programs/ 폴더에 저장됩니다.
--  → 새 버킷/정책 설정 불필요 (기존 authenticated 업로드/삭제 정책이 그대로 적용).
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) 사이트 고정 이미지 슬롯 (site_images)
--    각 slot 키 하나당 사진 하나. 예: hero_bg, about_photo
-- ─────────────────────────────────────────────
create table if not exists public.site_images (
  slot        text primary key,          -- 사진이 들어갈 자리의 고유 키
  image_path  text not null,             -- storage(gallery 버킷) 내 파일 경로
  alt_ko      text,
  alt_en      text,
  updated_at  timestamptz not null default now()
);

alter table public.site_images enable row level security;

-- 방문자 포함 누구나 읽기 가능 (사이트에 표시돼야 하므로)
create policy "public can read site images"
  on public.site_images for select
  to anon, authenticated
  using (true);

-- 로그인한 관리자만 추가/수정/삭제
create policy "admins manage site images"
  on public.site_images for all
  to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────
-- 2) 수업/프로그램별 대표 사진 (programs 테이블에 컬럼 추가)
-- ─────────────────────────────────────────────
alter table public.programs
  add column if not exists image_path text;
