-- ============================================================
--  마이그레이션 2: 자녀 수에 따라 여러 학생 신청 지원
--  Supabase → SQL Editor → New query → 전체 붙여넣기 → RUN
-- ============================================================

-- get_request_for_token: 자녀 수(num_children)도 반환하도록 변경
drop function if exists public.get_request_for_token(text);
create function public.get_request_for_token(p_token text)
returns table (requester_name text, email text, num_children text)
language sql security definer set search_path = public as $$
  select requester_name, email, num_children
  from public.form_requests
  where token = p_token and status = 'sent'
  limit 1;
$$;
grant execute on function public.get_request_for_token(text) to anon, authenticated;

-- submit_application: p_data.students 배열이면 자녀 1명당 1건으로 저장
--  (보호자·교회·동의·문의는 공통값으로 각 건에 복사)
create or replace function public.submit_application(p_token text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_req public.form_requests;
  v_students jsonb;
  v_s jsonb;
begin
  select * into v_req from public.form_requests
    where token = p_token and status = 'sent' limit 1;
  if v_req.id is null then
    raise exception 'invalid_or_used_token';
  end if;

  v_students := coalesce(p_data->'students', '[]'::jsonb);
  -- 하위호환: students 배열이 없으면 단일 학생으로 처리
  if jsonb_array_length(v_students) = 0 then
    v_students := jsonb_build_array(p_data);
  end if;

  for v_s in select * from jsonb_array_elements(v_students) loop
    insert into public.applications (
      request_id, student_name_ko, student_name_en, birthdate, gender,
      current_grade, current_school, korean_level, allergies,
      guardian_name, guardian_relation, guardian_phone, guardian_email,
      home_address, emergency_name, emergency_phone,
      church_name, is_member, consent_photo, consent_privacy, message, status
    ) values (
      v_req.id,
      v_s->>'student_name_ko', v_s->>'student_name_en',
      nullif(v_s->>'birthdate','')::date, v_s->>'gender',
      v_s->>'current_grade', v_s->>'current_school', v_s->>'korean_level', v_s->>'allergies',
      p_data->>'guardian_name', p_data->>'guardian_relation', p_data->>'guardian_phone', p_data->>'guardian_email',
      p_data->>'home_address', p_data->>'emergency_name', p_data->>'emergency_phone',
      p_data->>'church_name', p_data->>'is_member',
      coalesce((p_data->>'consent_photo')::boolean, false),
      coalesce((p_data->>'consent_privacy')::boolean, false),
      p_data->>'message', 'new'
    );
  end loop;

  update public.form_requests set status = 'completed' where id = v_req.id;
end;
$$;
grant execute on function public.submit_application(text, jsonb) to anon, authenticated;
