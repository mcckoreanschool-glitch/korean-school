// ============================================================
//  늘 푸른 한글학교 — 관리자 로직
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
  }

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

  async function sendApplication(id, btn) {
    const r = reqCache.find((x) => x.id === id);
    if (!r) return;
    if (!confirm(`${r.requester_name}님(${r.email})에게 신청서 작성 링크를 이메일로 보낼까요?`)) return;
    if (btn) { btn.disabled = true; btn.textContent = "보내는 중…"; }

    // 상태를 sent 로 (토큰이 유효해짐)
    const { error: upErr } = await sb.from("form_requests")
      .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (upErr) { toast("상태 변경 실패", true); if (btn) { btn.disabled = false; btn.textContent = "📨 신청서 보내기"; } return; }

    // 이메일 발송 (서버리스 함수)
    try {
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch("/api/send-application", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: r.email, name: r.requester_name, applyToken: r.token }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) toast("메일 발송 실패: " + (j.error || resp.status) + " (상태는 '발송됨'으로 표시됨)", true);
      else toast("✓ 신청서를 이메일로 보냈어요!");
    } catch (e) {
      toast("메일 발송 오류 (로컬에서는 발송 안 됨). 실제 도메인에서 동작해요.", true);
    }
    loadRequests();
  }

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
      loadApplications(); toast("상태가 변경되었습니다.");
    }));
    $$("#appsList [data-detail]").forEach((b) => b.addEventListener("click", () => showAppDetail(appsCache.find((x) => x.id === b.dataset.detail))));
    $$("#appsList [data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 신청서를 삭제할까요?")) return;
      const { error } = await sb.from("applications").delete().eq("id", b.dataset.del);
      if (error) return toast("삭제 실패", true);
      toast("삭제되었습니다."); loadApplications();
    }));
  }

  function showAppDetail(a) {
    if (!a) return;
    const row = (label, val) => `<div class="dl-row"><dt>${label}</dt><dd>${esc(val) || "-"}</dd></div>`;
    const yn = (v) => (v ? "✓ 동의" : "✗ 미동의");
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
    openModal(`신청서 · ${esc(a.student_name_ko || "")}`, `<dl class="detail-dl">${html}</dl>`, null);
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
      <label class="check-row"><input type="checkbox" id="m_pub" ${p.published !== false ? "checked" : ""}> 사이트에 공개</label>
    `, async () => {
      const payload = {
        sort_order: parseInt($("#m_sort").value, 10) || 0, tag_ko: $("#m_tag_ko").value, tag_en: $("#m_tag_en").value,
        name_ko: $("#m_name_ko").value, name_en: $("#m_name_en").value, desc_ko: $("#m_desc_ko").value, desc_en: $("#m_desc_en").value,
        published: $("#m_pub").checked,
      };
      if (!payload.name_ko) { toast("반 이름(한국어)은 필수입니다.", true); return false; }
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
