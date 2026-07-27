-- ============================================================
--  MCC 한글학교 — 학생 반 배정 기능 마이그레이션
--  사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 RUN (한 번만)
--
--  applications(신청서)는 자녀 1명당 1건이므로 곧 학생 레코드입니다.
--  상태가 '등록완료(enrolled)'가 되면 admin의 "학생/반 배정" 보드에
--  카드로 나타나고, 드래그로 반(programs)에 배정합니다.
-- ============================================================

alter table public.applications
  add column if not exists class_id uuid references public.programs(id) on delete set null;
