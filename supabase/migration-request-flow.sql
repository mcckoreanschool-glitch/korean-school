-- ============================================================
--  마이그레이션: 신청서 "요청 → 발송 → 작성" 흐름
--  Supabase → SQL Editor → New query → 전체 붙여넣기 → RUN
--  (기존 schema.sql 을 이미 실행한 프로젝트에서 추가로 실행)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) 신청서 요청 (form_requests) — 방문자가 제출
-- ─────────────────────────────────────────────
create table if not exists public.form_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  requester_name text not null,
  email          text not null,
  phone          text,
  num_children   text,
  message        text,
  status         text not null default 'requested',  -- requested | sent | completed | archived
  token          text not null default replace(gen_random_uuid()::text, '-', ''),
  sent_at        timestamptz
);

alter table public.form_requests enable row level security;

-- 누구나 요청 제출 가능
create policy "anyone submit request" on public.form_requests
  for insert to anon, authenticated with check (true);
-- 관리자만 조회/수정/삭제
create policy "admins read requests"   on public.form_requests for select to authenticated using (true);
create policy "admins update requests" on public.form_requests for update to authenticated using (true) with check (true);
create policy "admins delete requests" on public.form_requests for delete to authenticated using (true);

-- ─────────────────────────────────────────────
-- 2) applications 테이블을 상세 신청서 형태로 확장
-- ─────────────────────────────────────────────
alter table public.applications
  add column if not exists request_id      uuid references public.form_requests(id) on delete set null,
  add column if not exists student_name_ko text,
  add column if not exists student_name_en text,
  add column if not exists birthdate       date,
  add column if not exists gender          text,
  add column if not exists current_grade   text,
  add column if not exists current_school  text,
  add column if not exists allergies       text,
  add column if not exists guardian_name     text,
  add column if not exists guardian_relation text,
  add column if not exists guardian_phone    text,
  add column if not exists guardian_email    text,
  add column if not exists home_address      text,
  add column if not exists emergency_name    text,
  add column if not exists emergency_phone   text,
  add column if not exists church_name     text,
  add column if not exists is_member       text,
  add column if not exists consent_photo   boolean default false,
  add column if not exists consent_privacy boolean default false;

-- 기존 필수(not null) 컬럼을 선택 입력으로 완화 (새 양식은 이 컬럼을 안 씀)
alter table public.applications alter column child_name  drop not null;
alter table public.applications alter column parent_name drop not null;
alter table public.applications alter column phone       drop not null;

-- 예전 "누구나 직접 신청" 정책 제거 → 이제 토큰(RPC)으로만 제출 가능
drop policy if exists "anyone can submit application" on public.applications;

-- ─────────────────────────────────────────────
-- 3) 토큰 검증 함수 (SECURITY DEFINER)
--    방문자는 form_requests 를 직접 볼 수 없고, 이 함수로만 토큰 확인
-- ─────────────────────────────────────────────
create or replace function public.get_request_for_token(p_token text)
returns table (requester_name text, email text)
language sql security definer set search_path = public as $$
  select requester_name, email
  from public.form_requests
  where token = p_token and status = 'sent'
  limit 1;
$$;
grant execute on function public.get_request_for_token(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) 신청서 제출 함수 (SECURITY DEFINER)
--    유효한 'sent' 토큰일 때만 저장 + 요청을 'completed' 처리 (1회용)
-- ─────────────────────────────────────────────
create or replace function public.submit_application(p_token text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.form_requests;
begin
  select * into v_req from public.form_requests
    where token = p_token and status = 'sent' limit 1;
  if v_req.id is null then
    raise exception 'invalid_or_used_token';
  end if;

  insert into public.applications (
    request_id, student_name_ko, student_name_en, birthdate, gender,
    current_grade, current_school, korean_level, allergies,
    guardian_name, guardian_relation, guardian_phone, guardian_email,
    home_address, emergency_name, emergency_phone,
    church_name, is_member, consent_photo, consent_privacy, message, status
  ) values (
    v_req.id,
    p_data->>'student_name_ko', p_data->>'student_name_en',
    nullif(p_data->>'birthdate','')::date, p_data->>'gender',
    p_data->>'current_grade', p_data->>'current_school', p_data->>'korean_level', p_data->>'allergies',
    p_data->>'guardian_name', p_data->>'guardian_relation', p_data->>'guardian_phone', p_data->>'guardian_email',
    p_data->>'home_address', p_data->>'emergency_name', p_data->>'emergency_phone',
    p_data->>'church_name', p_data->>'is_member',
    coalesce((p_data->>'consent_photo')::boolean, false),
    coalesce((p_data->>'consent_privacy')::boolean, false),
    p_data->>'message', 'new'
  );

  update public.form_requests set status = 'completed' where id = v_req.id;
end;
$$;
grant execute on function public.submit_application(text, jsonb) to anon, authenticated;
