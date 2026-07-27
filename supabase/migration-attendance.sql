-- ============================================================
--  MCC 한글학교 — 출석 체크 기능 마이그레이션
--  사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 RUN (한 번만)
--
--  학생(=등록완료된 applications) 1명당 수업일 하루에 출석 기록 1건.
--  status: present(출석) | late(지각) | absent(결석)
--  선생님 계정: Supabase → Authentication → Users → Add user 로 추가
--  (로그인한 사용자는 누구나 출석 입력 가능)
-- ============================================================

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  class_date  date not null,
  student_id  uuid not null references public.applications(id) on delete cascade,
  status      text not null default 'present',
  unique (class_date, student_id)
);

alter table public.attendance enable row level security;

-- 로그인한 교사/관리자만 조회·기록
create policy "staff manage attendance"
  on public.attendance for all to authenticated
  using (true) with check (true);
