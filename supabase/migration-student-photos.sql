-- ============================================================
--  MCC 한글학교 — 학생 사진 기능 마이그레이션
--  사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 RUN (한 번만)
--
--  학생 사진은 아동 개인정보이므로 공개 gallery 버킷이 아닌
--  비공개(private) 'students' 버킷에 저장하고, 로그인한 관리자만
--  서명 URL(signed URL)로 볼 수 있습니다.
-- ============================================================

-- 1) 신청서(=학생)에 사진 경로 컬럼
alter table public.applications
  add column if not exists photo_path text;

-- 2) 비공개 students 버킷
insert into storage.buckets (id, name, public)
values ('students', 'students', false)
on conflict (id) do nothing;

-- 3) 로그인한 관리자만 업로드/조회/삭제
create policy "admins manage student photos"
  on storage.objects for all to authenticated
  using (bucket_id = 'students') with check (bucket_id = 'students');
