-- ============================================================
--  늘 푸른 한글학교 — 홈 히어로 "슬라이드쇼" 기능 추가 마이그레이션
--  사용법: Supabase 대시보드 → SQL Editor → New query →
--          이 파일 전체를 붙여넣고 RUN (한 번만)
--
--  사진은 기존 'gallery' 버킷의 hero/ 폴더에 저장됩니다 (새 버킷 불필요).
-- ============================================================

create table if not exists public.hero_slides (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  image_path  text not null,               -- storage(gallery 버킷) 내 파일 경로
  sort_order  int not null default 0,       -- 슬라이드 표시 순서
  published   boolean not null default true
);

alter table public.hero_slides enable row level security;

-- 방문자 포함 누구나 공개 슬라이드 읽기 가능
create policy "public can read published hero slides"
  on public.hero_slides for select
  to anon, authenticated
  using (published = true or auth.role() = 'authenticated');

-- 로그인한 관리자만 추가/수정/삭제
create policy "admins manage hero slides"
  on public.hero_slides for all
  to authenticated
  using (true) with check (true);
