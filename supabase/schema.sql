-- ============================================================
--  늘 푸른 한글학교 (MCC Korean School) — Supabase DB 스키마
--  사용법: Supabase 대시보드 → SQL Editor → New query →
--          이 파일 전체를 붙여넣고 RUN
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) 입학/등록 신청 (applications)
-- ─────────────────────────────────────────────
create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  child_name   text not null,
  age_grade    text,
  korean_level text,
  parent_name  text not null,
  phone        text not null,
  email        text,
  message      text,
  status       text not null default 'new'   -- new | contacted | enrolled | archived
);

-- ─────────────────────────────────────────────
-- 2) 공지사항 (notices)
-- ─────────────────────────────────────────────
create table if not exists public.notices (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  notice_date  date not null default current_date,
  category_ko  text,
  category_en  text,
  title_ko     text not null,
  title_en     text,
  body_ko      text,
  body_en      text,
  published    boolean not null default true
);

-- ─────────────────────────────────────────────
-- 3) 갤러리 (gallery)  — 사진은 Storage의 'gallery' 버킷에 저장
-- ─────────────────────────────────────────────
create table if not exists public.gallery (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  image_path   text not null,               -- storage 내 파일 경로
  caption_ko   text,
  caption_en   text,
  sort_order   int not null default 0,
  published    boolean not null default true
);

-- ─────────────────────────────────────────────
-- 4) 수업/프로그램 (programs)
-- ─────────────────────────────────────────────
create table if not exists public.programs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  sort_order   int not null default 0,
  tag_ko       text,
  tag_en       text,
  name_ko      text not null,
  name_en      text,
  desc_ko      text,
  desc_en      text,
  published    boolean not null default true
);

-- ============================================================
--  RLS (행 수준 보안) — 아주 중요!
--  방문자(anon): 신청서 INSERT + 공개글 SELECT 만
--  관리자(authenticated=로그인): 전부 가능
-- ============================================================
alter table public.applications enable row level security;
alter table public.notices      enable row level security;
alter table public.gallery      enable row level security;
alter table public.programs     enable row level security;

-- ── applications ──
-- 누구나 신청서 제출 가능
create policy "anyone can submit application"
  on public.applications for insert
  to anon, authenticated
  with check (true);
-- 로그인한 관리자만 조회/수정/삭제
create policy "admins can read applications"
  on public.applications for select to authenticated using (true);
create policy "admins can update applications"
  on public.applications for update to authenticated using (true) with check (true);
create policy "admins can delete applications"
  on public.applications for delete to authenticated using (true);

-- ── notices ──
create policy "public can read published notices"
  on public.notices for select
  to anon, authenticated
  using (published = true or auth.role() = 'authenticated');
create policy "admins manage notices"
  on public.notices for all to authenticated using (true) with check (true);

-- ── gallery ──
create policy "public can read published gallery"
  on public.gallery for select
  to anon, authenticated
  using (published = true or auth.role() = 'authenticated');
create policy "admins manage gallery"
  on public.gallery for all to authenticated using (true) with check (true);

-- ── programs ──
create policy "public can read published programs"
  on public.programs for select
  to anon, authenticated
  using (published = true or auth.role() = 'authenticated');
create policy "admins manage programs"
  on public.programs for all to authenticated using (true) with check (true);

-- ============================================================
--  샘플 데이터 (선택) — 처음 화면을 채워줍니다. 나중에 Admin에서 수정/삭제.
-- ============================================================
insert into public.programs (sort_order, tag_ko, tag_en, name_ko, name_en, desc_ko, desc_en) values
 (1, '유아·유치', 'Preschool',    '새싹반',   'Sprout Class', '놀이와 노래로 한글을 처음 만나요. 듣고 말하기 중심.', 'First steps into Hangeul through play and song.'),
 (2, '초급',     'Beginner',     '한글반',   'Hangeul Class','자음·모음부터 낱말 읽기까지. 기초를 단단하게 다집니다.', 'From consonants and vowels to reading words.'),
 (3, '중급',     'Intermediate', '이음반',   'Bridge Class', '문장 읽기와 짧은 글쓰기. 생각을 한국어로 표현해요.', 'Reading sentences and short writing.'),
 (4, '고급',     'Advanced',     '한마루반', 'Hanmaru Class','글쓰기·발표·역사와 문화까지 폭넓게 배웁니다.', 'Writing, presentations, history, and culture.');

insert into public.notices (notice_date, category_ko, category_en, title_ko, title_en, body_ko, body_en) values
 ('2026-07-15', '모집', 'Enrollment', '2026 가을학기 신입생 모집 안내', 'Fall 2026 enrollment now open', '9월 개강 가을학기 신입생을 모집합니다. 온라인 신청서를 통해 접수해 주세요.', 'Now accepting new students for the Fall term.'),
 ('2026-06-28', '행사', 'Event',      '여름 한국문화 체험의 날', 'Summer Korean Culture Day', '전통놀이와 한식 만들기로 함께한 즐거운 하루였습니다.', 'A joyful day of traditional games and Korean cooking.'),
 ('2026-05-10', '안내', 'Notice',     '봄학기 발표회 및 수료식', 'Spring recital & completion ceremony', '한 학기 동안 배운 것을 나누는 발표회가 열립니다.', 'A recital to share what we learned this term.');

-- ============================================================
--  Storage 버킷은 SQL이 아니라 대시보드에서 만듭니다:
--  Storage → New bucket → 이름: gallery → Public bucket 체크 → Save
--  (정책은 아래 안내 참고)
-- ============================================================
