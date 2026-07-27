// ============================================================
//  MCC 한글학교 — 관리자 로직
// ============================================================
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const configWarn = $("#configWarn");
  const loginView = $("#loginView");
  const dashView = $("#dashView");
  let sb = null;

  if (!window.isSupabaseConfigured()) {
    configWarn.hidden = false;
    loginView.hidden = false;
    $("#loginMsg").textContent = "먼저 config.js에 Supabase 정보를 입력하세요.";
    $("#loginMsg").className = "login-msg error";
    return;
  }

  sb = window.getSupabase();

  sb.auth.getSession().then(({ data }) => {
    if (data.session) showDashboard(data.session.user);
    else loginView.hidden = false;
  });

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#loginMsg"), btn = $("#loginBtn");
    btn.disabled = true; btn.textContent = "로그인 중…"; msg.textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({
      email: $("#loginEmail").value.trim(), password: $("#loginPassword").value,
    });
    btn.disabled = false; btn.textContent = "로그인";
    if (error) { msg.className = "login-msg error"; msg.textContent = "로그인 실패: 이메일 또는 비밀번호를 확인하세요."; return; }
    showDashboard(data.user);
  });

  $("#logoutBtn").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  function showDashboard(user) {
    loginView.hidden = true;
    dashView.hidden = false;
    $("#whoami").textContent = user.email;
    setupTabs();
    loadRequests();
    loadApplications();
    loadNotices();
    loadGallery();
    loadPrograms();
    loadHeroSlides();
    loadSiteImages();
    loadStudentBoard();
    initAttendance();
  }
  $("#heroAdd").addEventListener("change", (e) => {
    // FileList는 입력창과 연동된 live 객체 — 비우기 전에 반드시 복사해둬야 함
    const files = Array.from(e.target.files);
    e.target.value = "";
    addHeroSlides(files);
  });

  function setupTabs() {
    $$(".dash-tab").forEach((tab) => tab.addEventListener("click", () => {
      $$(".dash-tab").forEach((t) => t.classList.remove("active"));
      $$(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`.panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
    }));
  }

  let toastTimer;
  function toast(text, isErr) {
    const t = $("#toast");
    t.textContent = text; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }
  const esc = (s) => (s == null ? "" : String(s)).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });

  function setBadge(id, n) { const b = $(id); b.textContent = n; b.classList.toggle("zero", n === 0); }

  // ============================================================
  //  1) 신청서 요청 (form_requests)
  // ============================================================
  let reqCache = [];
  const REQ_LABEL = { requested: "요청됨", sent: "발송됨", completed: "작성완료", archived: "보관" };

  async function loadRequests() {
    const { data, error } = await sb.from("form_requests").select("*").order("created_at", { ascending: false });
    if (error) { $("#reqBody").innerHTML = `<tr><td colspan="8" class="empty">불러오기 실패: ${esc(error.message)}</td></tr>`; return; }
    reqCache = data || [];
    renderRequests();
    setBadge("#badgeReq", reqCache.filter((r) => r.status === "requested").length);
  }

  function renderRequests() {
    const filter = $("#reqFilter").value;
    const rows = reqCache.filter((r) => !filter || r.status === filter);
    if (!rows.length) { $("#reqBody").innerHTML = `<tr><td colspan="8" class="empty">요청이 없습니다.</td></tr>`; return; }
    $("#reqBody").innerHTML = rows.map((r) => {
      let action = "";
      if (r.status === "requested") action = `<button class="btn btn-primary btn-xs" data-send="${r.id}">📨 신청서 보내기</button>`;
      else if (r.status === "sent") action = `<button class="btn btn-ghost btn-xs" data-send="${r.id}">재발송</button>`;
      else if (r.status === "completed") action = `<span class="pill pill-on">작성완료</span>`;
      const pillClass = r.status === "completed" ? "status-enrolled" : r.status === "sent" ? "status-contacted" : r.status === "requested" ? "status-new" : "status-archived";
      return `<tr>
        <td>${fmtDate(r.created_at)}</td>
        <td><b>${esc(r.requester_name)}</b></td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.phone)}</td>
        <td>${esc(r.num_children)}</td>
        <td class="msg">${esc(r.message)}</td>
        <td><span class="status-pill ${pillClass}">${REQ_LABEL[r.status] || r.status}</span></td>
        <td class="nowrap">${action} <button class="row-del" data-del="${r.id}" title="삭제">🗑</button></td>
      </tr>`;
    }).join("");

    $$("#reqBody [data-send]").forEach((b) => b.addEventListener("click", () => sendApplication(b.dataset.send, b)));
    $$("#reqBody [data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 요청을 삭제할까요?")) return;
      const { error } = await sb.from("form_requests").delete().eq("id", b.dataset.del);
      if (error) return toast("삭제 실패", true);
      toast("삭제되었습니다."); loadRequests();
    }));
  }

  $("#reqFilter").addEventListener("change", renderRequests);

  // 공용: 서버리스 함수로 신청서 링크 이메일 발송
  async function emailApplicationLink(email, name, token) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch("/api/send-application", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email, name, applyToken: token }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = j.detail ? (typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)) : "";
        console.error("send-application failed:", resp.status, j);
        alert("메일 발송 실패 (HTTP " + resp.status + ")\n\n" + (j.error || "") + "\n" + detail);
        return false;
      }
      return true;
    } catch (e) {
      alert("메일 발송 오류: " + e.message);
      return false;
    }
  }

  async function sendApplication(id, btn) {
    const r = reqCache.find((x) => x.id === id);
    if (!r) return;
    if (!confirm(`${r.requester_name}님(${r.email})에게 신청서 작성 링크를 이메일로 보낼까요?`)) return;
    if (btn) { btn.disabled = true; btn.textContent = "보내는 중…"; }

    // 상태를 sent 로 (토큰이 유효해짐)
    const { error: upErr } = await sb.from("form_requests")
      .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (upErr) { toast("상태 변경 실패", true); if (btn) { btn.disabled = false; btn.textContent = "📨 신청서 보내기"; } return; }

    const ok = await emailApplicationLink(r.email, r.requester_name, r.token);
    toast(ok ? "✓ 신청서를 이메일로 보냈어요!" : "메일 발송 실패 (상태는 '발송됨') — 팝업 참고", !ok);
    loadRequests();
  }

  // 관리자가 직접 학부모에게 신청서 링크 발송 (요청 없이)
  $("#directSend").addEventListener("click", () => {
    openModal("직접 신청서 보내기", `
      <p class="panel-hint" style="margin:0 0 4px">학부모 이메일을 알고 있을 때, 요청 없이 바로 신청서 작성 링크를 보냅니다.</p>
      <div class="field"><label>학부모 이름</label><input id="d_name" placeholder="예) 김보람"></div>
      <div class="field"><label>이메일 <span style="color:#c0392b">*</span></label><input id="d_email" type="email" placeholder="parent@example.com"></div>
      <div class="field-two">
        <div class="field"><label>연락처 (선택)</label><input id="d_phone"></div>
        <div class="field"><label>메모 (선택)</label><input id="d_msg" placeholder="관리자용 메모"></div>
      </div>
    `, async () => {
      const email = $("#d_email").value.trim();
      const name = $("#d_name").value.trim();
      if (!email) { toast("이메일을 입력하세요.", true); return false; }
      // 이미 'sent' 상태로 요청 레코드 생성 (토큰 자동 발급)
      const { data, error } = await sb.from("form_requests").insert({
        requester_name: name || email, email,
        phone: $("#d_phone").value.trim(), message: $("#d_msg").value.trim(),
        status: "sent", sent_at: new Date().toISOString(),
      }).select().single();
      if (error) { toast("생성 실패: " + error.message, true); return false; }

      const ok = await emailApplicationLink(email, name || email, data.token);
      toast(ok ? "✓ 신청서를 이메일로 보냈어요!" : "레코드는 생성됐지만 메일 발송 실패 — 팝업 참고", !ok);
      loadRequests();
      return true;
    });
    if (window.attachPhoneFormat) window.attachPhoneFormat($("#d_phone"));
  });

  // 신청서 이메일에 함께 실리는 고정 안내문 편집 (서식 편집기)
  $("#editEmailExtra").addEventListener("click", async () => {
    const { data, error } = await sb.from("site_settings").select("key, value")
      .in("key", ["email_extra_ko", "email_extra_en"]);
    if (error) { toast("안내문 불러오기 실패 (마이그레이션 SQL 실행 확인)", true); return; }
    const map = {};
    (data || []).forEach((r) => { map[r.key] = r.value || ""; });

    // 저장된 값 → 편집기 초기 HTML (예전 일반 텍스트는 줄바꿈만 <br>로)
    const isHtml = (v) => /<[a-z][^>]*>/i.test(v || "");
    const toEditor = (v) => (isHtml(v) ? v : esc(v).replace(/\n/g, "<br>"));
    // 편집기 → 저장 값 (내용이 실제로 없으면 빈 문자열)
    const fromEditor = (el) => (el.textContent.trim() || el.querySelector("img") ? el.innerHTML.trim() : "");

    const rtBar = (target) => `
      <div class="rt-bar" data-target="${target}">
        <button type="button" data-cmd="bold" title="굵게"><b>B</b></button>
        <button type="button" data-cmd="italic" title="기울임"><i>I</i></button>
        <button type="button" data-cmd="underline" title="밑줄"><u>U</u></button>
        <span class="rt-sep"></span>
        <select data-size title="글자 크기">
          <option value="">크기</option>
          <option value="2">작게</option>
          <option value="3">보통</option>
          <option value="5">크게</option>
          <option value="6">아주 크게</option>
        </select>
        <span class="rt-sep"></span>
        <button type="button" class="rt-color" data-color="#221e13" style="color:#221e13" title="검정">가</button>
        <button type="button" class="rt-color" data-color="#c0392b" style="color:#c0392b" title="빨강">가</button>
        <button type="button" class="rt-color" data-color="#1d6fb8" style="color:#1d6fb8" title="파랑">가</button>
        <button type="button" class="rt-color" data-color="#8a6a0c" style="color:#8a6a0c" title="금색">가</button>
        <span class="rt-sep"></span>
        <button type="button" data-cmd="removeFormat" title="선택한 부분의 서식 지우기">지우개</button>
      </div>`;

    openModal("이메일 안내문 수정", `
      <p class="panel-hint" style="margin:0 0 4px">신청서 발송 이메일의 <b>"신청서 작성하기" 버튼 아래</b>에 함께 실리는 고정 안내문입니다. 비워두면 안내문 없이 발송됩니다.<br>✏️ 서식: 바꾸고 싶은 글자를 <b>드래그로 선택한 뒤</b> 위 버튼(굵게·크기·색상)을 누르세요.</p>
      <div class="field"><label>안내문 (한국어)</label>
        ${rtBar("s_extra_ko")}
        <div class="rt-editor" id="s_extra_ko" contenteditable="true" data-placeholder="예)&#10;· 개강일: 9월 첫째 주 주일&#10;· 준비물: 필기도구, 실내화">${toEditor(map.email_extra_ko)}</div>
      </div>
      <div class="field"><label>안내문 (영어 · 선택)</label>
        ${rtBar("s_extra_en")}
        <div class="rt-editor" id="s_extra_en" contenteditable="true" data-placeholder="e.g. · First day: first Sunday of September">${toEditor(map.email_extra_en)}</div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="s_preview">👁 이메일 미리보기</button>
      <div id="s_preview_box" class="email-preview" hidden>
        <p class="ep-label">받는 사람에게 이렇게 보입니다 (지금 입력 중인 내용 기준):</p>
        <iframe id="s_preview_frame" title="이메일 미리보기" sandbox=""></iframe>
      </div>
    `, async () => {
      const now = new Date().toISOString();
      const rows = [
        { key: "email_extra_ko", value: fromEditor($("#s_extra_ko")), updated_at: now },
        { key: "email_extra_en", value: fromEditor($("#s_extra_en")), updated_at: now },
      ];
      const { error: upErr } = await sb.from("site_settings").upsert(rows);
      if (upErr) { toast("저장 실패: " + upErr.message, true); return false; }
      toast("안내문이 저장되었습니다. 다음 발송부터 적용돼요.");
      return true;
    });

    // 서식 도구막대 동작 (execCommand — 인라인 스타일로 기록되어 이메일에 그대로 반영)
    document.execCommand("styleWithCSS", false, true);
    $$(".rt-bar").forEach((bar) => {
      const editor = $("#" + bar.dataset.target);
      const run = (cmd, val) => { editor.focus(); document.execCommand(cmd, false, val || null); };
      bar.querySelectorAll("[data-cmd]").forEach((b) =>
        b.addEventListener("mousedown", (e) => { e.preventDefault(); run(b.dataset.cmd); }));
      bar.querySelectorAll(".rt-color").forEach((b) =>
        b.addEventListener("mousedown", (e) => { e.preventDefault(); run("foreColor", b.dataset.color); }));
      const sizeSel = bar.querySelector("[data-size]");
      sizeSel.addEventListener("change", () => {
        if (sizeSel.value) { run("fontSize", sizeSel.value); sizeSel.value = ""; }
      });
    });

    // 미리보기: 지금 입력 중인(저장 전 포함) 내용으로 실제 발송 HTML을 받아 표시
    $("#s_preview").addEventListener("click", async () => {
      const btn = $("#s_preview");
      btn.disabled = true; btn.textContent = "불러오는 중…";
      try {
        const { data: { session } } = await sb.auth.getSession();
        const resp = await fetch("/api/send-application", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            preview: true,
            extra_ko: fromEditor($("#s_extra_ko")),
            extra_en: fromEditor($("#s_extra_en")),
          }),
        });
        const j = await resp.json().catch(() => ({}));
        if (!resp.ok || !j.html) { toast("미리보기 실패" + (j.error ? ": " + j.error : ""), true); return; }
        const frame = $("#s_preview_frame");
        frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff">${j.html}</body></html>`;
        $("#s_preview_box").hidden = false;
      } catch (e) {
        toast("미리보기 오류: " + e.message, true);
      } finally {
        btn.disabled = false; btn.textContent = "👁 이메일 미리보기";
      }
    });
  });

  // ============================================================
  //  2) 제출된 신청서 (applications)
  // ============================================================
  let appsCache = [];
  const APP_LABEL = { new: "신규", reviewed: "검토완료", enrolled: "등록완료", archived: "보관" };

  async function loadApplications() {
    const { data, error } = await sb.from("applications").select("*").order("created_at", { ascending: false });
    if (error) { $("#appsList").innerHTML = `<p class="empty">불러오기 실패: ${esc(error.message)}</p>`; return; }
    appsCache = data || [];
    renderApps();
    setBadge("#badgeApps", appsCache.filter((a) => a.status === "new").length);
  }

  function renderApps() {
    const filter = $("#appFilter").value;
    const rows = appsCache.filter((a) => !filter || a.status === filter);
    if (!rows.length) { $("#appsList").innerHTML = `<p class="empty">제출된 신청서가 없습니다.</p>`; return; }
    $("#appsList").innerHTML = rows.map((a) => {
      const opts = Object.keys(APP_LABEL).map((k) => `<option value="${k}" ${a.status === k ? "selected" : ""}>${APP_LABEL[k]}</option>`).join("");
      const name = esc(a.student_name_ko || a.child_name || "(이름 없음)") + (a.student_name_en ? ` <span class="muted">(${esc(a.student_name_en)})</span>` : "");
      return `<div class="admin-item">
        <div class="ai-main">
          <div class="ai-meta">${fmtDate(a.created_at)} 제출 · 학년 ${esc(a.current_grade) || "-"}</div>
          <h3>${name}</h3>
          <p>보호자 ${esc(a.guardian_name) || "-"} · ${esc(a.guardian_phone) || "-"} · ${esc(a.guardian_email) || "-"}</p>
        </div>
        <div class="ai-actions">
          <select class="status-select status-${a.status}" data-status="${a.id}">${opts}</select>
          <button class="icon-btn" data-detail="${a.id}">상세</button>
          <button class="icon-btn danger" data-del="${a.id}">삭제</button>
        </div>
      </div>`;
    }).join("");

    $$("#appsList [data-status]").forEach((sel) => sel.addEventListener("change", async (e) => {
      const { error } = await sb.from("applications").update({ status: e.target.value }).eq("id", e.target.dataset.status);
      if (error) return toast("상태 변경 실패", true);
      const rec = appsCache.find((x) => x.id === e.target.dataset.status); if (rec) rec.status = e.target.value;
      loadApplications(); loadStudentBoard();
      toast(e.target.value === "enrolled" ? "등록완료! 학생/반 배정 탭에 카드가 생겼어요." : "상태가 변경되었습니다.");
    }));
    $$("#appsList [data-detail]").forEach((b) => b.addEventListener("click", () => showAppDetail(appsCache.find((x) => x.id === b.dataset.detail))));
    $$("#appsList [data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 신청서를 삭제할까요?")) return;
      const { error } = await sb.from("applications").delete().eq("id", b.dataset.del);
      if (error) return toast("삭제 실패", true);
      toast("삭제되었습니다."); loadApplications(); loadStudentBoard();
    }));
  }

  const ST_BUCKET = "students";   // 학생 사진 전용 비공개 버킷 (관리자만 접근)

  function showAppDetail(a) {
    if (!a) return;
    const row = (label, val) => `<div class="dl-row"><dt>${label}</dt><dd>${esc(val) || "-"}</dd></div>`;
    const yn = (v) => (v ? "✓ 동의" : "✗ 미동의");
    const photoBox = `
      <div class="st-photo-box">
        <div class="st-photo" id="stPhotoImg">${esc((a.student_name_ko || a.child_name || "?").charAt(0))}</div>
        <div class="st-photo-actions">
          <label class="btn btn-ghost btn-sm file-btn" id="stPhotoBtn">📷 ${a.photo_path ? "사진 변경" : "사진 올리기"}<input type="file" id="stPhotoFile" accept="image/*" hidden></label>
          <button class="icon-btn danger" id="stPhotoDel" ${a.photo_path ? "" : "hidden"}>사진 삭제</button>
        </div>
      </div>`;
    const html = `
      <h4 class="dl-sec">① 학생 정보</h4>
      ${row("이름 (한글)", a.student_name_ko)}${row("이름 (영문)", a.student_name_en)}
      ${row("생년월일", a.birthdate)}${row("성별", a.gender)}
      ${row("현재 학년", a.current_grade)}${row("다니는 학교", a.current_school)}
      ${row("한국어 수준", a.korean_level)}${row("알레르기·특이사항", a.allergies)}
      <h4 class="dl-sec">② 보호자 정보</h4>
      ${row("보호자 이름", a.guardian_name)}${row("관계", a.guardian_relation)}
      ${row("휴대폰", a.guardian_phone)}${row("이메일", a.guardian_email)}
      ${row("집 주소", a.home_address)}
      ${row("비상 연락처", a.emergency_name)}${row("비상 전화", a.emergency_phone)}
      <h4 class="dl-sec">③ 교회 / 신앙</h4>
      ${row("출석 교회", a.church_name)}${row("교인 여부", a.is_member)}
      <h4 class="dl-sec">④ 동의</h4>
      ${row("사진·영상 활용", yn(a.consent_photo))}${row("개인정보 수집", yn(a.consent_privacy))}
      <h4 class="dl-sec">⑤ 기타</h4>
      ${row("문의사항", a.message)}
      <div class="dl-row"><dt>제출일</dt><dd>${new Date(a.created_at).toLocaleString("ko-KR")}</dd></div>`;
    openModal(`신청서 · ${esc(a.student_name_ko || "")}`, `${photoBox}<dl class="detail-dl">${html}</dl>`, null);

    // 사진 표시 (비공개 버킷 → 서명 URL로 관리자만 열람)
    const renderPhoto = async () => {
      const box = $("#stPhotoImg");
      if (!a.photo_path) {
        box.innerHTML = esc((a.student_name_ko || a.child_name || "?").charAt(0));
        $("#stPhotoDel").hidden = true;
        return;
      }
      const { data, error } = await sb.storage.from(ST_BUCKET).createSignedUrl(a.photo_path, 3600);
      if (error || !data) { toast("사진 불러오기 실패 (학생 사진 마이그레이션 확인)", true); return; }
      box.innerHTML = `<img src="${data.signedUrl}" alt="학생 사진">`;
      $("#stPhotoDel").hidden = false;
    };
    renderPhoto();

    // 캐시(신청서 목록·배정 보드) 동기화
    const syncCaches = (path) => {
      [appsCache, boardStudents].forEach((arr) => {
        const r = (arr || []).find((x) => x.id === a.id);
        if (r) r.photo_path = path;
      });
      a.photo_path = path;
    };

    $("#stPhotoFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const blob = await openCropper(file);   // 위치·크기 조절 후 정사각형으로 잘라서 받음
      if (!blob) return;                       // 취소
      toast("업로드 중…");
      const path = `${a.id}-${Date.now()}.jpg`;
      const up = await sb.storage.from(ST_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) { toast("업로드 실패: " + up.error.message, true); return; }
      const { error } = await sb.from("applications").update({ photo_path: path }).eq("id", a.id);
      if (error) { toast("저장 실패: " + error.message, true); return; }
      if (a.photo_path) await sb.storage.from(ST_BUCKET).remove([a.photo_path]);
      syncCaches(path);
      $("#stPhotoBtn").firstChild.textContent = "📷 사진 변경";
      toast("사진이 저장되었습니다.");
      renderPhoto(); loadStudentBoard();
    });

    $("#stPhotoDel").addEventListener("click", async () => {
      if (!confirm("이 학생의 사진을 삭제할까요?")) return;
      await sb.storage.from(ST_BUCKET).remove([a.photo_path]);
      const { error } = await sb.from("applications").update({ photo_path: null }).eq("id", a.id);
      if (error) { toast("삭제 실패: " + error.message, true); return; }
      syncCaches(null);
      toast("사진이 삭제되었습니다.");
      renderPhoto(); loadStudentBoard();
    });
  }

  $("#appFilter").addEventListener("change", renderApps);

  $("#exportApps").addEventListener("click", () => {
    if (!appsCache.length) return toast("내보낼 데이터가 없습니다.", true);
    const cols = [
      ["제출일", (a) => new Date(a.created_at).toLocaleString("ko-KR")],
      ["학생(한글)", "student_name_ko"], ["학생(영문)", "student_name_en"], ["생년월일", "birthdate"],
      ["성별", "gender"], ["학년", "current_grade"], ["학교", "current_school"], ["한국어수준", "korean_level"],
      ["알레르기", "allergies"], ["보호자", "guardian_name"], ["관계", "guardian_relation"],
      ["휴대폰", "guardian_phone"], ["이메일", "guardian_email"], ["주소", "home_address"],
      ["비상연락처", "emergency_name"], ["비상전화", "emergency_phone"], ["출석교회", "church_name"],
      ["교인여부", "is_member"], ["사진동의", (a) => (a.consent_photo ? "Y" : "N")],
      ["개인정보동의", (a) => (a.consent_privacy ? "Y" : "N")], ["문의", "message"],
      ["상태", (a) => APP_LABEL[a.status] || a.status],
    ];
    const lines = [cols.map((c) => c[0]).join(",")];
    appsCache.forEach((a) => {
      lines.push(cols.map((c) => {
        const v = typeof c[1] === "function" ? c[1](a) : a[c[1]];
        return `"${(v == null ? "" : String(v)).replace(/"/g, '""')}"`;
      }).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = "제출된_신청서.csv"; el.click();
    URL.revokeObjectURL(url);
  });

  // ============================================================
  //  2.5) 학생 / 반 배정 보드 (등록완료된 신청서 = 학생 카드)
  // ============================================================
  let boardStudents = [];

  async function loadStudentBoard() {
    const box = $("#studentBoard");
    if (!box) return;
    const [clsRes, stuRes] = await Promise.all([
      sb.from("programs").select("id, name_ko, tag_ko, sort_order").order("sort_order", { ascending: true }),
      sb.from("applications").select("*").eq("status", "enrolled").order("created_at", { ascending: true }),
    ]);
    if (clsRes.error || stuRes.error) {
      box.innerHTML = `<p class="empty">불러오기 실패: ${esc((clsRes.error || stuRes.error).message)}<br>(반 배정 마이그레이션 SQL 실행을 확인하세요)</p>`;
      return;
    }
    boardStudents = stuRes.data || [];
    const cols = [{ id: "", name_ko: "🗂 미배정", tag_ko: "" }, ...(clsRes.data || [])];

    const cardHtml = (s) => {
      const name = esc(s.student_name_ko || s.child_name || "(이름 없음)");
      const meta = [s.current_grade, s.korean_level].filter(Boolean).map(esc).join(" · ");
      const opts = cols.map((c) => `<option value="${c.id}" ${(s.class_id || "") === c.id ? "selected" : ""}>${esc(c.id ? c.name_ko : "미배정")}</option>`).join("");
      return `
      <div class="st-card" draggable="true" data-id="${s.id}" title="클릭하면 학생 정보를 볼 수 있어요">
        <div class="st-card-top">
          <span class="st-avatar" data-avatar="${esc(s.photo_path || "")}">${esc((s.student_name_ko || s.child_name || "?").charAt(0))}</span>
          <div class="st-card-name">
            <b>${name}</b>${s.student_name_en ? `<small class="st-en">${esc(s.student_name_en)}</small>` : ""}
            ${meta ? `<span class="st-meta">${meta}</span>` : ""}
          </div>
        </div>
        <select class="st-move" data-move="${s.id}" title="반 이동">${opts}</select>
      </div>`;
    };

    box.innerHTML = cols.map((c) => {
      const list = boardStudents.filter((s) => (s.class_id || "") === c.id);
      return `
      <div class="st-col" data-class="${c.id}">
        <div class="st-col-head">
          <span>${esc(c.name_ko)}</span>
          <b class="st-count">${list.length}</b>
        </div>
        <div class="st-col-body">
          ${list.map(cardHtml).join("") || '<p class="st-empty">여기로 드래그</p>'}
        </div>
      </div>`;
    }).join("");

    // 카드 클릭 → 상세, 드래그 → 반 배정
    $$("#studentBoard .st-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.dataset.id);
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("click", (e) => {
        if (e.target.closest(".st-move")) return;   // 반 선택 메뉴 클릭은 제외
        showAppDetail(boardStudents.find((x) => x.id === card.dataset.id));
      });
    });
    $$("#studentBoard .st-move").forEach((sel) => {
      sel.addEventListener("click", (e) => e.stopPropagation());
      sel.addEventListener("change", () => assignStudent(sel.dataset.move, sel.value || null));
    });
    $$("#studentBoard .st-col").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drag-over"); });
      col.addEventListener("drop", (e) => {
        e.preventDefault(); col.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain");
        if (id) assignStudent(id, col.dataset.class || null);
      });
    });

    // 카드 아바타: 비공개 버킷 사진을 서명 URL로 일괄 로드
    const paths = boardStudents.filter((s) => s.photo_path).map((s) => s.photo_path);
    if (paths.length) {
      const { data: signed } = await sb.storage.from(ST_BUCKET).createSignedUrls(paths, 3600);
      const urlMap = {};
      (signed || []).forEach((r) => { if (r.signedUrl) urlMap[r.path] = r.signedUrl; });
      $$("#studentBoard .st-avatar").forEach((el) => {
        const u = urlMap[el.dataset.avatar];
        if (u) el.innerHTML = `<img src="${u}" alt="">`;
      });
    }
  }

  async function assignStudent(id, classId) {
    const s = boardStudents.find((x) => x.id === id);
    if (s && (s.class_id || null) === classId) return;   // 같은 반이면 무시
    const { error } = await sb.from("applications").update({ class_id: classId }).eq("id", id);
    if (error) { toast("배정 실패: " + error.message, true); return; }
    toast(classId ? "반이 배정되었습니다." : "미배정으로 이동했습니다.");
    loadStudentBoard();
  }

  // ============================================================
  //  2.6) 사진 조절(크롭) 도구 — 드래그로 위치, 슬라이더로 확대/축소
  //  openCropper(file) → 조절된 정사각형 JPEG Blob (취소 시 null)
  // ============================================================
  const CROP_VIEW = 320;   // 화면 미리보기 크기(px)
  const CROP_OUT = 512;    // 저장되는 이미지 크기(px)
  const cropUI = { img: null, scale: 1, min: 1, cx: 0, cy: 0, resolve: null, drag: null };

  function cropClamp() {
    const c = cropUI, half = CROP_VIEW / c.scale / 2;
    c.cx = Math.min(Math.max(c.cx, half), c.img.naturalWidth - half);
    c.cy = Math.min(Math.max(c.cy, half), c.img.naturalHeight - half);
  }
  function cropDraw() {
    const c = cropUI, ctx = $("#cropCanvas").getContext("2d");
    ctx.clearRect(0, 0, CROP_VIEW, CROP_VIEW);
    if (!c.img) return;
    const s = CROP_VIEW / c.scale;
    ctx.drawImage(c.img, c.cx - s / 2, c.cy - s / 2, s, s, 0, 0, CROP_VIEW, CROP_VIEW);
  }
  function openCropper(file) {
    return new Promise((resolve) => {
      const c = cropUI;
      c.resolve = resolve;
      const img = new Image();
      img.onload = () => {
        c.img = img;
        c.min = Math.max(CROP_VIEW / img.naturalWidth, CROP_VIEW / img.naturalHeight);
        c.scale = c.min;
        c.cx = img.naturalWidth / 2; c.cy = img.naturalHeight / 2;
        $("#cropZoom").value = 100;
        $("#cropOverlay").hidden = false;
        cropDraw();
      };
      img.onerror = () => { toast("이미지를 열 수 없습니다. (jpg/png 권장)", true); closeCropper(null); };
      img.src = URL.createObjectURL(file);
    });
  }
  function closeCropper(blob) {
    $("#cropOverlay").hidden = true;
    const c = cropUI;
    if (c.img) { URL.revokeObjectURL(c.img.src); c.img = null; }
    const r = c.resolve; c.resolve = null;
    if (r) r(blob || null);
  }

  $("#cropZoom").addEventListener("input", () => {
    const c = cropUI; if (!c.img) return;
    c.scale = c.min * ($("#cropZoom").value / 100);
    cropClamp(); cropDraw();
  });
  (() => {
    const cv = $("#cropCanvas");
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      cropUI.drag = { x: e.clientX, y: e.clientY };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      const c = cropUI; if (!c.drag || !c.img) return;
      const factor = CROP_VIEW / cv.getBoundingClientRect().width;   // CSS 축소 보정
      c.cx -= (e.clientX - c.drag.x) * factor / c.scale;
      c.cy -= (e.clientY - c.drag.y) * factor / c.scale;
      c.drag = { x: e.clientX, y: e.clientY };
      cropClamp(); cropDraw();
    });
    const end = () => { cropUI.drag = null; };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
  })();
  $("#cropCancel").addEventListener("click", () => closeCropper(null));
  $("#cropOverlay").addEventListener("click", (e) => { if (e.target === $("#cropOverlay")) closeCropper(null); });
  $("#cropSave").addEventListener("click", () => {
    const c = cropUI; if (!c.img) return closeCropper(null);
    const out = document.createElement("canvas");
    out.width = CROP_OUT; out.height = CROP_OUT;
    const s = CROP_VIEW / c.scale;
    out.getContext("2d").drawImage(c.img, c.cx - s / 2, c.cy - s / 2, s, s, 0, 0, CROP_OUT, CROP_OUT);
    out.toBlob((blob) => closeCropper(blob), "image/jpeg", 0.9);
  });

  // ============================================================
  //  2.7) 출석 체크 — 반·날짜별로 학생 출석/지각/결석 기록
  // ============================================================
  const ATT_STATUS = { present: "출석", late: "지각", absent: "결석" };
  let attStudents = [];
  let attRecords = {};   // student_id → 출석 레코드

  // 수업이 주일이므로 기본 날짜 = 가장 최근 일요일 (오늘이 일요일이면 오늘)
  function lastSundayYMD() {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  let attClasses = [];
  let attMode = "check";   // check(출석 체크) | sheet(출석부)

  async function initAttendance() {
    $("#attDate").value = lastSundayYMD();
    const now = new Date();
    $("#attMonth").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data } = await sb.from("programs").select("id, name_ko, sort_order").order("sort_order", { ascending: true });
    attClasses = data || [];
    $("#attClass").innerHTML =
      `<option value="__all">전체 (모든 반)</option>` +
      attClasses.map((c) => `<option value="${c.id}">${esc(c.name_ko)}</option>`).join("") +
      `<option value="__none">미배정</option>`;
    loadAttendance();
  }

  function setAttMode(m) {
    attMode = m;
    $("#attModeCheck").classList.toggle("on", m === "check");
    $("#attModeSheet").classList.toggle("on", m === "sheet");
    $("#attDate").hidden = m !== "check";
    $("#attAllPresent").hidden = m !== "check";
    $("#attMonth").hidden = m !== "sheet";
    if (m === "check") loadAttendance(); else loadAttSheet();
  }
  $("#attModeCheck").addEventListener("click", () => setAttMode("check"));
  $("#attModeSheet").addEventListener("click", () => setAttMode("sheet"));

  async function loadAttendance() {
    const date = $("#attDate").value;
    const cls = $("#attClass").value;
    const box = $("#attList");
    if (!date) { box.innerHTML = `<p class="empty">날짜를 선택하세요.</p>`; return; }
    let q = sb.from("applications").select("*").eq("status", "enrolled");
    if (cls === "__none") q = q.is("class_id", null);
    else if (cls !== "__all") q = q.eq("class_id", cls);
    const [stuRes, attRes] = await Promise.all([
      q.order("student_name_ko", { ascending: true }),
      sb.from("attendance").select("*").eq("class_date", date),
    ]);
    if (stuRes.error || attRes.error) {
      box.innerHTML = `<p class="empty">불러오기 실패: ${esc((stuRes.error || attRes.error).message)}<br>(출석 마이그레이션 SQL 실행을 확인하세요)</p>`;
      return;
    }
    attStudents = stuRes.data || [];
    attRecords = {};
    (attRes.data || []).forEach((r) => { attRecords[r.student_id] = r; });
    renderAttendance();
  }

  function renderAttendance() {
    const box = $("#attList");
    if (!attStudents.length) {
      box.innerHTML = `<p class="empty">이 반에 배정된 학생이 없습니다. (🎓 학생/반 배정 탭에서 배정하세요)</p>`;
      $("#attSummary").innerHTML = "";
      return;
    }
    const studentRow = (s) => {
      const st = attRecords[s.id] ? attRecords[s.id].status : "";
      const btn = (k) => `<button class="att-btn att-${k}${st === k ? " on" : ""}" data-att="${s.id}" data-set="${k}">${ATT_STATUS[k]}</button>`;
      return `
      <div class="admin-item att-item">
        <div class="ai-main">
          <h3>${esc(s.student_name_ko || s.child_name || "(이름 없음)")}${s.student_name_en ? ` <span class="muted">(${esc(s.student_name_en)})</span>` : ""}</h3>
          <p class="ai-meta">학년 ${esc(s.current_grade) || "-"}</p>
        </div>
        <div class="att-btns">${btn("present")}${btn("late")}${btn("absent")}</div>
      </div>`;
    };

    if ($("#attClass").value === "__all") {
      // 전체 보기: 반별로 묶어서 표시 (반마다 소계 포함)
      const groups = [
        ...attClasses.map((c) => ({ name: c.name_ko, list: attStudents.filter((s) => s.class_id === c.id) })),
        { name: "🗂 미배정", list: attStudents.filter((s) => !s.class_id) },
      ].filter((g) => g.list.length);
      box.innerHTML = groups.map((g) => {
        const gc = { present: 0, late: 0, absent: 0 };
        g.list.forEach((s) => { const r = attRecords[s.id]; if (r && gc[r.status] != null) gc[r.status]++; });
        return `
        <div class="att-group">
          <div class="att-group-head">
            <h2>${esc(g.name)}</h2>
            <span class="att-group-meta">출석 ${gc.present} · 지각 ${gc.late} · 결석 ${gc.absent} · 총 ${g.list.length}명</span>
          </div>
          ${g.list.map(studentRow).join("")}
        </div>`;
      }).join("");
    } else {
      box.innerHTML = attStudents.map(studentRow).join("");
    }

    const counts = { present: 0, late: 0, absent: 0 };
    attStudents.forEach((s) => { const r = attRecords[s.id]; if (r && counts[r.status] != null) counts[r.status]++; });
    const unchecked = attStudents.length - counts.present - counts.late - counts.absent;
    $("#attSummary").innerHTML = `
      <span class="att-pill att-p">출석 ${counts.present}</span>
      <span class="att-pill att-l">지각 ${counts.late}</span>
      <span class="att-pill att-a">결석 ${counts.absent}</span>
      <span class="att-pill">미체크 ${unchecked}</span>
      <span class="att-pill att-total">총 ${attStudents.length}명</span>`;

    $$("#attList [data-att]").forEach((b) =>
      b.addEventListener("click", () => setAttendance(b.dataset.att, b.dataset.set)));
  }

  async function setAttendance(studentId, status) {
    const date = $("#attDate").value;
    const cur = attRecords[studentId];
    if (cur && cur.status === status) {
      // 같은 버튼 다시 누름 → 체크 해제
      const { error } = await sb.from("attendance").delete().eq("id", cur.id);
      if (error) return toast("저장 실패: " + error.message, true);
      delete attRecords[studentId];
    } else {
      const { data, error } = await sb.from("attendance")
        .upsert({ class_date: date, student_id: studentId, status }, { onConflict: "class_date,student_id" })
        .select().single();
      if (error) return toast("저장 실패: " + error.message, true);
      attRecords[studentId] = data;
    }
    renderAttendance();
  }

  // ── 출석부(월별 표) 보기 ──
  async function loadAttSheet() {
    const month = $("#attMonth").value;   // 예: "2026-07"
    const cls = $("#attClass").value;
    const box = $("#attList");
    $("#attSummary").innerHTML = "";
    if (!month) { box.innerHTML = `<p class="empty">월을 선택하세요.</p>`; return; }
    const [y, m] = month.split("-").map(Number);
    const from = `${month}-01`;
    const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    let q = sb.from("applications").select("*").eq("status", "enrolled");
    if (cls === "__none") q = q.is("class_id", null);
    else if (cls !== "__all") q = q.eq("class_id", cls);
    const [stuRes, attRes] = await Promise.all([
      q.order("student_name_ko", { ascending: true }),
      sb.from("attendance").select("*").gte("class_date", from).lte("class_date", to),
    ]);
    if (stuRes.error || attRes.error) {
      box.innerHTML = `<p class="empty">불러오기 실패: ${esc((stuRes.error || attRes.error).message)}</p>`;
      return;
    }
    const students = stuRes.data || [];
    const recs = attRes.data || [];
    if (!students.length) { box.innerHTML = `<p class="empty">이 반에 배정된 학생이 없습니다.</p>`; return; }

    // 이 달에 출석 기록이 있는 날짜만 열로 표시
    const dates = [...new Set(recs.map((r) => r.class_date))].sort();
    if (!dates.length) { box.innerHTML = `<p class="empty">${y}년 ${m}월에는 출석 기록이 없습니다.</p>`; return; }
    const recMap = {};
    recs.forEach((r) => { recMap[r.student_id + "|" + r.class_date] = r.status; });

    const MARK = { present: ["○", "p"], late: ["△", "l"], absent: ["✕", "a"] };
    const sheetTable = (list) => `
      <div class="att-sheet-wrap"><table class="att-sheet">
        <thead><tr>
          <th class="att-sticky">학생</th>
          ${dates.map((d) => `<th>${+d.slice(5, 7)}/${+d.slice(8, 10)}</th>`).join("")}
          <th class="att-sum-h">요약</th>
        </tr></thead>
        <tbody>${list.map((s) => {
          let p = 0, l = 0, a = 0;
          const cells = dates.map((d) => {
            const st = recMap[s.id + "|" + d];
            if (st === "present") p++; else if (st === "late") l++; else if (st === "absent") a++;
            const mk = MARK[st];
            return `<td class="${mk ? "att-c-" + mk[1] : "att-c-none"}">${mk ? mk[0] : "·"}</td>`;
          }).join("");
          return `<tr>
            <td class="att-sticky att-name">${esc(s.student_name_ko || s.child_name || "(이름 없음)")}</td>
            ${cells}
            <td class="att-sum">○${p} △${l} ✕${a}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>`;

    const legend = `<p class="att-legend">○ 출석 &nbsp; △ 지각 &nbsp; ✕ 결석 &nbsp; · 기록 없음 — 칸을 수정하려면 ✏️ 출석 체크에서 해당 날짜를 선택하세요.</p>`;
    if (cls === "__all") {
      const groups = [
        ...attClasses.map((c) => ({ name: c.name_ko, list: students.filter((s) => s.class_id === c.id) })),
        { name: "🗂 미배정", list: students.filter((s) => !s.class_id) },
      ].filter((g) => g.list.length);
      box.innerHTML = legend + groups.map((g) => `
        <div class="att-group">
          <div class="att-group-head"><h2>${esc(g.name)}</h2></div>
          ${sheetTable(g.list)}
        </div>`).join("");
    } else {
      box.innerHTML = legend + sheetTable(students);
    }
  }

  $("#attDate").addEventListener("change", loadAttendance);
  $("#attMonth").addEventListener("change", loadAttSheet);
  $("#attClass").addEventListener("change", () => (attMode === "check" ? loadAttendance() : loadAttSheet()));
  $("#attAllPresent").addEventListener("click", async () => {
    const date = $("#attDate").value;
    if (!date || !attStudents.length) return;
    const rows = attStudents.filter((s) => !attRecords[s.id])
      .map((s) => ({ class_date: date, student_id: s.id, status: "present" }));
    if (!rows.length) return toast("모든 학생이 이미 체크되어 있어요.");
    const { data, error } = await sb.from("attendance")
      .upsert(rows, { onConflict: "class_date,student_id" }).select();
    if (error) return toast("저장 실패: " + error.message, true);
    (data || []).forEach((r) => { attRecords[r.student_id] = r; });
    toast(`${rows.length}명을 출석 처리했습니다.`);
    renderAttendance();
  });

  // ============================================================
  //  3) 공지사항
  // ============================================================
  async function loadNotices() {
    const { data, error } = await sb.from("notices").select("*").order("notice_date", { ascending: false });
    const box = $("#noticesList");
    if (error) { box.innerHTML = `<p class="empty">불러오기 실패</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="empty">공지가 없습니다. "새 공지"로 추가하세요.</p>`; return; }
    box.innerHTML = data.map((n) => `
      <div class="admin-item">
        <div class="ai-main">
          <div class="ai-meta">${esc(n.notice_date)} · ${esc(n.category_ko || "")} ${n.published ? '<span class="pill pill-on">공개</span>' : '<span class="pill pill-off">비공개</span>'}</div>
          <h3>${esc(n.title_ko)}</h3><p>${esc((n.body_ko || "").slice(0, 100))}</p>
        </div>
        <div class="ai-actions">
          <button class="icon-btn" data-edit="${n.id}">수정</button>
          <button class="icon-btn danger" data-del="${n.id}">삭제</button>
        </div>
      </div>`).join("");
    $$("#noticesList [data-edit]").forEach((b) => b.addEventListener("click", () => noticeModal(data.find((x) => x.id === b.dataset.edit))));
    $$("#noticesList [data-del]").forEach((b) => b.addEventListener("click", () => delRow("notices", b.dataset.del, loadNotices)));
  }
  $("#newNotice").addEventListener("click", () => noticeModal(null));

  function noticeModal(n) {
    n = n || {};
    openModal(n.id ? "공지 수정" : "새 공지", `
      <div class="field-two">
        <div class="field"><label>날짜</label><input type="date" id="m_date" value="${esc(n.notice_date || new Date().toISOString().slice(0,10))}"></div>
        <div class="field"><label>분류 (한국어)</label><input id="m_cat_ko" placeholder="예) 모집" value="${esc(n.category_ko)}"></div>
      </div>
      <div class="field"><label>분류 (영어)</label><input id="m_cat_en" placeholder="e.g. Enrollment" value="${esc(n.category_en)}"></div>
      <div class="field"><label>제목 (한국어)</label><input id="m_title_ko" value="${esc(n.title_ko)}"></div>
      <div class="field"><label>제목 (영어)</label><input id="m_title_en" value="${esc(n.title_en)}"></div>
      <div class="field"><label>내용 (한국어)</label><textarea id="m_body_ko" rows="3">${esc(n.body_ko)}</textarea></div>
      <div class="field"><label>내용 (영어)</label><textarea id="m_body_en" rows="3">${esc(n.body_en)}</textarea></div>
      <label class="check-row"><input type="checkbox" id="m_pub" ${n.published !== false ? "checked" : ""}> 사이트에 공개</label>
    `, async () => {
      const payload = {
        notice_date: $("#m_date").value, category_ko: $("#m_cat_ko").value, category_en: $("#m_cat_en").value,
        title_ko: $("#m_title_ko").value, title_en: $("#m_title_en").value,
        body_ko: $("#m_body_ko").value, body_en: $("#m_body_en").value, published: $("#m_pub").checked,
      };
      if (!payload.title_ko) { toast("한국어 제목은 필수입니다.", true); return false; }
      const res = n.id ? await sb.from("notices").update(payload).eq("id", n.id) : await sb.from("notices").insert(payload);
      if (res.error) { toast("저장 실패: " + res.error.message, true); return false; }
      toast("저장되었습니다."); loadNotices(); return true;
    });
  }

  // ============================================================
  //  4) 수업 / 프로그램
  // ============================================================
  async function loadPrograms() {
    const { data, error } = await sb.from("programs").select("*").order("sort_order", { ascending: true });
    const box = $("#programsList");
    if (error) { box.innerHTML = `<p class="empty">불러오기 실패</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="empty">프로그램이 없습니다.</p>`; return; }
    box.innerHTML = data.map((p) => `
      <div class="admin-item">
        <div class="ai-main">
          <div class="ai-meta">순서 ${p.sort_order} · ${esc(p.tag_ko || "")} ${p.published ? '<span class="pill pill-on">공개</span>' : '<span class="pill pill-off">비공개</span>'}</div>
          <h3>${esc(p.name_ko)}</h3><p>${esc(p.desc_ko)}</p>
        </div>
        <div class="ai-actions">
          <button class="icon-btn" data-edit="${p.id}">수정</button>
          <button class="icon-btn danger" data-del="${p.id}">삭제</button>
        </div>
      </div>`).join("");
    $$("#programsList [data-edit]").forEach((b) => b.addEventListener("click", () => programModal(data.find((x) => x.id === b.dataset.edit))));
    $$("#programsList [data-del]").forEach((b) => b.addEventListener("click", () => delRow("programs", b.dataset.del, loadPrograms)));
  }
  $("#newProgram").addEventListener("click", () => programModal(null));

  function programModal(p) {
    p = p || {};
    openModal(p.id ? "프로그램 수정" : "새 프로그램", `
      <div class="field-two">
        <div class="field"><label>정렬 순서</label><input type="number" id="m_sort" value="${p.sort_order ?? 0}"></div>
        <div class="field"><label>태그 (한국어)</label><input id="m_tag_ko" placeholder="예) 초급" value="${esc(p.tag_ko)}"></div>
      </div>
      <div class="field"><label>태그 (영어)</label><input id="m_tag_en" placeholder="e.g. Beginner" value="${esc(p.tag_en)}"></div>
      <div class="field"><label>반 이름 (한국어)</label><input id="m_name_ko" value="${esc(p.name_ko)}"></div>
      <div class="field"><label>반 이름 (영어)</label><input id="m_name_en" value="${esc(p.name_en)}"></div>
      <div class="field"><label>설명 (한국어)</label><textarea id="m_desc_ko" rows="2">${esc(p.desc_ko)}</textarea></div>
      <div class="field"><label>설명 (영어)</label><textarea id="m_desc_en" rows="2">${esc(p.desc_en)}</textarea></div>
      <div class="field">
        <label>대표 사진 (선택)</label>
        ${p.image_path ? `<div class="pm-current"><img src="${esc(publicUrl(p.image_path))}" alt=""></div>` : ""}
        <input type="file" id="m_img" accept="image/*">
        ${p.image_path ? `<label class="check-row"><input type="checkbox" id="m_img_remove"> 현재 사진 제거</label>` : ""}
      </div>
      <label class="check-row"><input type="checkbox" id="m_pub" ${p.published !== false ? "checked" : ""}> 사이트에 공개</label>
    `, async () => {
      const payload = {
        sort_order: parseInt($("#m_sort").value, 10) || 0, tag_ko: $("#m_tag_ko").value, tag_en: $("#m_tag_en").value,
        name_ko: $("#m_name_ko").value, name_en: $("#m_name_en").value, desc_ko: $("#m_desc_ko").value, desc_en: $("#m_desc_en").value,
        published: $("#m_pub").checked,
      };
      if (!payload.name_ko) { toast("반 이름(한국어)은 필수입니다.", true); return false; }
      // 대표 사진: 새 파일이 있으면 업로드(기존 삭제), '제거' 체크 시 비움, 아니면 유지
      let image_path = p.image_path || null;
      const imgFile = $("#m_img").files[0];
      if (imgFile) {
        const ext = (imgFile.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
        const path = `programs/${Date.now()}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(path, imgFile, { upsert: false });
        if (up.error) { toast("사진 업로드 실패: " + up.error.message, true); return false; }
        if (p.image_path) await sb.storage.from(BUCKET).remove([p.image_path]);
        image_path = path;
      } else if ($("#m_img_remove") && $("#m_img_remove").checked) {
        if (p.image_path) await sb.storage.from(BUCKET).remove([p.image_path]);
        image_path = null;
      }
      payload.image_path = image_path;
      const res = p.id ? await sb.from("programs").update(payload).eq("id", p.id) : await sb.from("programs").insert(payload);
      if (res.error) { toast("저장 실패: " + res.error.message, true); return false; }
      toast("저장되었습니다."); loadPrograms(); return true;
    });
  }

  // ============================================================
  //  5) 갤러리
  // ============================================================
  const BUCKET = "gallery";
  const publicUrl = (p) => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

  async function loadGallery() {
    const { data, error } = await sb.from("gallery").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    const box = $("#galleryList");
    if (error) { box.innerHTML = `<p class="empty">불러오기 실패</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="empty">사진이 없습니다. "사진 추가"로 올려보세요.</p>`; return; }
    box.innerHTML = data.map((g) => `
      <div class="g-admin">
        <img src="${esc(publicUrl(g.image_path))}" alt="${esc(g.caption_ko)}" loading="lazy">
        <div class="g-info">
          <div class="g-cap">${esc(g.caption_ko || "(제목 없음)")}</div>
          <div class="ai-meta">${g.published ? '<span class="pill pill-on">공개</span>' : '<span class="pill pill-off">비공개</span>'}</div>
          <div class="g-act">
            <button class="icon-btn" data-toggle="${g.id}" data-pub="${g.published}">${g.published ? "숨기기" : "공개"}</button>
            <button class="icon-btn danger" data-del="${g.id}" data-path="${esc(g.image_path)}">삭제</button>
          </div>
        </div>
      </div>`).join("");
    $$("#galleryList [data-toggle]").forEach((b) => b.addEventListener("click", async () => {
      const { error } = await sb.from("gallery").update({ published: b.dataset.pub !== "true" }).eq("id", b.dataset.toggle);
      if (error) return toast("변경 실패", true); loadGallery();
    }));
    $$("#galleryList [data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 사진을 삭제할까요?")) return;
      await sb.storage.from(BUCKET).remove([b.dataset.path]);
      const { error } = await sb.from("gallery").delete().eq("id", b.dataset.del);
      if (error) return toast("삭제 실패", true); toast("삭제되었습니다."); loadGallery();
    }));
  }

  $("#newPhoto").addEventListener("click", () => {
    openModal("사진 추가", `
      <div class="field"><label>사진 파일</label><input type="file" id="m_file" accept="image/*"></div>
      <div class="field"><label>설명 (한국어)</label><input id="m_cap_ko" placeholder="예) 여름 문화의 날"></div>
      <div class="field"><label>설명 (영어)</label><input id="m_cap_en" placeholder="e.g. Summer Culture Day"></div>
      <div class="field"><label>정렬 순서</label><input type="number" id="m_sort" value="0"></div>
      <label class="check-row"><input type="checkbox" id="m_pub" checked> 사이트에 공개</label>
    `, async () => {
      const file = $("#m_file").files[0];
      if (!file) { toast("사진 파일을 선택하세요.", true); return false; }
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${Date.now()}-${safe}`;
      const up = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (up.error) { toast("업로드 실패: " + up.error.message, true); return false; }
      const res = await sb.from("gallery").insert({
        image_path: path, caption_ko: $("#m_cap_ko").value, caption_en: $("#m_cap_en").value,
        sort_order: parseInt($("#m_sort").value, 10) || 0, published: $("#m_pub").checked,
      });
      if (res.error) { toast("저장 실패: " + res.error.message, true); return false; }
      toast("사진이 추가되었습니다."); loadGallery(); return true;
    });
  });

  // ============================================================
  //  6) 사이트 이미지 (고정 슬롯)  — 사진은 gallery 버킷 site/ 폴더에 저장
  // ============================================================
  const SITE_SLOTS = [
    { slot: "about_photo", label: "학교 소개 · 사진",  hint: "교실·단체·활동 사진 등. 가로형 배너로 표시됩니다." },
  ];

  // ── 홈 히어로 슬라이드쇼 ──
  async function loadHeroSlides() {
    const box = $("#heroSlideList");
    if (!box) return;
    const { data, error } = await sb.from("hero_slides").select("*")
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (error) { box.innerHTML = `<p class="empty">불러오기 실패 (히어로 마이그레이션 SQL 실행을 확인하세요)</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="empty">아직 슬라이드가 없습니다. "슬라이드 추가"로 사진을 올려보세요.</p>`; return; }
    box.innerHTML = data.map((s, i) => `
      <div class="admin-item si-item">
        <div class="si-thumb"><img src="${esc(publicUrl(s.image_path))}" alt=""></div>
        <div class="ai-main">
          <div class="ai-meta">${i + 1}번째 ${s.published ? '<span class="pill pill-on">공개</span>' : '<span class="pill pill-off">숨김</span>'}</div>
        </div>
        <div class="ai-actions">
          <button class="icon-btn" data-up="${s.id}" ${i === 0 ? "disabled" : ""}>▲</button>
          <button class="icon-btn" data-down="${s.id}" ${i === data.length - 1 ? "disabled" : ""}>▼</button>
          <button class="icon-btn danger" data-del="${s.id}" data-path="${esc(s.image_path)}">삭제</button>
        </div>
      </div>`).join("");
    $$("#heroSlideList [data-up]").forEach((b) => b.addEventListener("click", () => swapHeroSlide(data, b.dataset.up, -1)));
    $$("#heroSlideList [data-down]").forEach((b) => b.addEventListener("click", () => swapHeroSlide(data, b.dataset.down, 1)));
    $$("#heroSlideList [data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 슬라이드를 삭제할까요?")) return;
      await sb.storage.from(BUCKET).remove([b.dataset.path]);
      const { error } = await sb.from("hero_slides").delete().eq("id", b.dataset.del);
      if (error) return toast("삭제 실패", true);
      toast("삭제되었습니다."); loadHeroSlides();
    }));
  }

  async function swapHeroSlide(list, id, dir) {
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    // 두 슬라이드의 순서값을 서로 맞바꿈 (동일하면 인덱스 기준으로 재설정)
    const oa = a.sort_order, ob = b.sort_order;
    const [na, nb] = oa === ob ? [j, i] : [ob, oa];
    await sb.from("hero_slides").update({ sort_order: na }).eq("id", a.id);
    await sb.from("hero_slides").update({ sort_order: nb }).eq("id", b.id);
    loadHeroSlides();
  }

  async function addHeroSlides(files) {
    if (!files || !files.length) return;
    toast("업로드 중…");
    const { data: existing } = await sb.from("hero_slides").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    let next = existing && existing.length ? (existing[0].sort_order + 1) : 0;
    let okCount = 0, lastErr = "";
    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
      const path = `hero/${Date.now()}-${next}.${ext}`;
      const up = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (up.error) { lastErr = up.error.message; continue; }
      const res = await sb.from("hero_slides").insert({ image_path: path, sort_order: next });
      if (res.error) { lastErr = res.error.message; next++; continue; }
      okCount++; next++;
    }
    if (okCount) toast(`슬라이드 ${okCount}장이 추가되었습니다.` + (lastErr ? ` (일부 실패: ${lastErr})` : ""));
    else toast("업로드 실패" + (lastErr ? ": " + lastErr : ""), true);
    loadHeroSlides();
  }

  async function loadSiteImages() {
    const box = $("#siteImgList");
    const { data, error } = await sb.from("site_images").select("*");
    if (error) { box.innerHTML = `<p class="empty">불러오기 실패 (마이그레이션 SQL을 실행했는지 확인하세요)</p>`; return; }
    const map = {};
    (data || []).forEach((r) => { map[r.slot] = r; });
    box.innerHTML = SITE_SLOTS.map((s) => {
      const rec = map[s.slot];
      const thumb = rec
        ? `<img src="${esc(publicUrl(rec.image_path))}" alt="">`
        : `<div class="si-empty" data-ko="사진 없음" data-en="No photo">사진 없음</div>`;
      return `
      <div class="admin-item si-item">
        <div class="si-thumb">${thumb}</div>
        <div class="ai-main">
          <h3>${esc(s.label)}</h3>
          <p class="ai-meta">${esc(s.hint)}</p>
        </div>
        <div class="ai-actions">
          <label class="btn btn-primary btn-sm file-btn">${rec ? "변경" : "사진 올리기"}<input type="file" accept="image/*" hidden data-upload="${s.slot}"></label>
          ${rec ? `<button class="icon-btn danger" data-remove="${s.slot}" data-path="${esc(rec.image_path)}">삭제</button>` : ""}
        </div>
      </div>`;
    }).join("");
    $$("#siteImgList [data-upload]").forEach((inp) =>
      inp.addEventListener("change", () => {
        const file = inp.files[0];   // File 객체를 먼저 확보한 뒤 입력창 초기화
        inp.value = "";
        uploadSiteImage(inp.dataset.upload, file);
      }));
    $$("#siteImgList [data-remove]").forEach((b) =>
      b.addEventListener("click", () => removeSiteImage(b.dataset.remove, b.dataset.path)));
  }

  async function uploadSiteImage(slot, file) {
    if (!file) return;
    toast("업로드 중…");
    const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
    const path = `site/${slot}-${Date.now()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (up.error) { toast("업로드 실패: " + up.error.message, true); return; }
    const { data: prev } = await sb.from("site_images").select("image_path").eq("slot", slot).maybeSingle();
    const res = await sb.from("site_images").upsert({ slot, image_path: path, updated_at: new Date().toISOString() });
    if (res.error) { toast("저장 실패: " + res.error.message, true); return; }
    if (prev && prev.image_path) await sb.storage.from(BUCKET).remove([prev.image_path]);
    toast("저장되었습니다."); loadSiteImages();
  }

  async function removeSiteImage(slot, path) {
    if (!confirm("이 사진을 삭제할까요? 해당 자리는 기본 디자인으로 돌아갑니다.")) return;
    if (path) await sb.storage.from(BUCKET).remove([path]);
    const { error } = await sb.from("site_images").delete().eq("slot", slot);
    if (error) return toast("삭제 실패", true);
    toast("삭제되었습니다."); loadSiteImages();
  }

  // ============================================================
  //  공용: 삭제 / 모달
  // ============================================================
  async function delRow(table, id, reload) {
    if (!confirm("정말 삭제할까요?")) return;
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) return toast("삭제 실패", true);
    toast("삭제되었습니다."); reload();
  }

  let onSave = null;
  function openModal(title, bodyHtml, saveFn) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHtml;
    onSave = saveFn || null;
    $("#modalSave").hidden = !saveFn;            // 읽기 전용(상세보기)이면 저장 버튼 숨김
    $("#modalCancel").textContent = saveFn ? "취소" : "닫기";
    $("#modalOverlay").hidden = false;
  }
  function closeModal() { $("#modalOverlay").hidden = true; onSave = null; }
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalCancel").addEventListener("click", closeModal);
  $("#modalOverlay").addEventListener("click", (e) => { if (e.target === $("#modalOverlay")) closeModal(); });
  $("#modalSave").addEventListener("click", async () => {
    if (!onSave) return;
    const btn = $("#modalSave"); btn.disabled = true;
    const ok = await onSave(); btn.disabled = false;
    if (ok) closeModal();
  });

})();
