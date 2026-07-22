// ===== 상세 신청서 페이지 로직 =====
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  const loadingView = $("#loadingView");
  const invalidView = $("#invalidView");
  const doneView    = $("#doneView");
  const form        = $("#applyForm");

  function show(view) {
    [loadingView, invalidView, doneView, form].forEach((v) => (v.hidden = true));
    view.hidden = false;
  }

  const token = new URLSearchParams(location.search).get("token");

  async function init() {
    if (!window.isSupabaseConfigured() || !window.supabase) { show(invalidView); return; }
    const sb = window.getSupabase();
    if (!token) { show(invalidView); return; }

    // 토큰 검증 (SECURITY DEFINER RPC)
    const { data, error } = await sb.rpc("get_request_for_token", { p_token: token });
    if (error || !data || !data.length) { show(invalidView); return; }

    const req = data[0];
    $("#greeting").textContent = `${req.requester_name}님, 환영합니다! 아래 신청서를 작성해 주세요.`;
    // 요청 시 남긴 이메일을 보호자 이메일에 기본 입력
    if (req.email) form.guardian_email.value = req.email;
    show(form);
    if (window.attachPhoneFormat) {
      window.attachPhoneFormat(form.guardian_phone);
      window.attachPhoneFormat(form.emergency_phone);
    }
    setupSubmit(sb);
  }

  function setupSubmit(sb) {
    const note = $("#applyNote");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // 필수 검증
      let ok = true;
      form.querySelectorAll("[required]").forEach((f) => {
        const bad = f.type === "checkbox" ? !f.checked : !f.value.trim();
        f.style.outline = bad ? "2px solid #e74c3c" : "";
        if (bad) ok = false;
      });
      if (!ok) {
        note.className = "form-note error";
        note.textContent = "* 필수 항목(*)을 모두 작성해 주세요. / Please complete all required fields.";
        return;
      }

      const fd = new FormData(form);
      const payload = {};
      ["student_name_ko","student_name_en","birthdate","gender","current_grade","current_school",
       "korean_level","allergies","guardian_name","guardian_relation","guardian_phone","guardian_email",
       "home_address","emergency_name","emergency_phone","church_name","is_member","message"]
        .forEach((k) => (payload[k] = (fd.get(k) || "").toString().trim()));
      payload.consent_photo = form.consent_photo.checked;
      payload.consent_privacy = form.consent_privacy.checked;

      const btn = $("#applyBtn");
      btn.disabled = true; btn.textContent = "제출 중… / Submitting…";
      const { error } = await sb.rpc("submit_application", { p_token: token, p_data: payload });
      btn.disabled = false; btn.textContent = "신청서 제출하기 / Submit Application";

      if (error) {
        note.className = "form-note error";
        note.textContent = /invalid_or_used_token/.test(error.message)
          ? "이미 제출되었거나 만료된 링크입니다. / This link is already used or expired."
          : "제출 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요. / Something went wrong, please try again.";
        return;
      }
      show(doneView);
      window.scrollTo(0, 0);
    });
  }

  init();
})();
