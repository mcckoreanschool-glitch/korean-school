// ===== 상세 신청서 페이지 로직 (자녀 수만큼 학생 블록 생성) =====
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const loadingView = $("#loadingView");
  const invalidView = $("#invalidView");
  const doneView    = $("#doneView");
  const form        = $("#applyForm");

  function show(view) {
    [loadingView, invalidView, doneView, form].forEach((v) => (v.hidden = true));
    view.hidden = false;
  }

  const token = new URLSearchParams(location.search).get("token");

  // ── 학생 블록 HTML (자녀 1명 분량) ──
  function studentBlockHTML(i) {
    return `
    <div class="student-block">
      <div class="student-block-head">자녀 ${i + 1} <span class="sub">Student ${i + 1}</span></div>
      <div class="grid-2">
        <div class="field"><label>이름 (한글) <span class="req-star">*</span><small>Name (Korean)</small></label><input data-f="student_name_ko" required></div>
        <div class="field"><label>이름 (영문)<small>Name (English)</small></label><input data-f="student_name_en"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>생년월일 <span class="req-star">*</span><small>Date of Birth</small></label><input type="date" data-f="birthdate" required></div>
        <div class="field"><label>성별<small>Gender</small></label>
          <select data-f="gender"><option value="">선택 / Select</option><option>남 / Male</option><option>여 / Female</option><option>기타 / Other</option></select>
        </div>
      </div>
      <div class="grid-2">
        <div class="field"><label>현재 학년<small>Current Grade</small></label><input data-f="current_grade" placeholder="예) 2학년 / Grade 2"></div>
        <div class="field"><label>다니는 학교<small>Current School</small></label><input data-f="current_school"></div>
      </div>
      <div class="field"><label>한국어 수준<small>Korean Level</small></label>
        <select data-f="korean_level"><option value="">선택 / Select</option><option>처음이에요 / Beginner</option><option>조금 할 수 있어요 / Some Korean</option><option>집에서 사용해요 / Used at home</option></select>
      </div>
      <div class="field"><label>알레르기 · 특이사항<small>Allergies / Special notes</small></label><textarea data-f="allergies" rows="2"></textarea></div>
    </div>`;
  }

  function renderStudents(n) {
    const box = $("#studentBlocks");
    // 기존 입력값 보존
    const prev = $$("#studentBlocks .student-block").map((b) => {
      const o = {}; $$("[data-f]", b).forEach((el) => (o[el.dataset.f] = el.value)); return o;
    });
    box.innerHTML = Array.from({ length: n }, (_, i) => studentBlockHTML(i)).join("");
    $$("#studentBlocks .student-block").forEach((b, i) => {
      if (!prev[i]) return;
      $$("[data-f]", b).forEach((el) => { if (prev[i][el.dataset.f] != null) el.value = prev[i][el.dataset.f]; });
    });
  }

  async function init() {
    if (!window.isSupabaseConfigured() || !window.supabase) { show(invalidView); return; }
    const sb = window.getSupabase();
    if (!token) { show(invalidView); return; }

    const { data, error } = await sb.rpc("get_request_for_token", { p_token: token });
    if (error || !data || !data.length) { show(invalidView); return; }

    const req = data[0];
    $("#greeting").textContent = `${req.requester_name}님, 환영합니다! 아래 신청서를 작성해 주세요.`;
    if (req.email) form.guardian_email.value = req.email;

    // 요청 시 남긴 자녀 수로 초기 블록 개수 결정 (1~4)
    const m = String(req.num_children || "").match(/\d+/);
    let n = m ? parseInt(m[0], 10) : 1;
    n = Math.min(Math.max(n, 1), 4);
    $("#childCount").value = String(n);
    renderStudents(n);

    show(form);
    if (window.attachPhoneFormat) {
      window.attachPhoneFormat(form.guardian_phone);
      window.attachPhoneFormat(form.emergency_phone);
    }
    $("#childCount").addEventListener("change", (e) => renderStudents(parseInt(e.target.value, 10) || 1));
    setupSubmit(sb);
  }

  function setupSubmit(sb) {
    const note = $("#applyNote");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // 필수 검증 (학생 블록 + 공통 필수 포함)
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

      // 자녀별 학생 정보 수집
      const students = $$("#studentBlocks .student-block").map((b) => {
        const s = {};
        $$("[data-f]", b).forEach((el) => (s[el.dataset.f] = (el.value || "").trim()));
        return s;
      });

      // 공통(보호자·교회·동의·문의) 정보
      const fd = new FormData(form);
      const payload = { students };
      ["guardian_name","guardian_relation","guardian_phone","guardian_email",
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
