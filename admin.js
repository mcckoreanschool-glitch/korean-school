// ============================================================
//  늘 푸른 한글학교 — 관리자 로직
// ============================================================
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const configWarn = $("#configWarn");
  const loginView  = $("#loginView");
  const dashView   = $("#dashView");

  let sb = null;

  // ---- 시작 ----
  if (!window.isSupabaseConfigured()) {
    configWarn.hidden = false;
    loginView.hidden = false;
    // 설정 전에는 로그인만 막아둠
    $("#loginMsg").textContent = "먼저 config.js에 Supabase 정보를 입력하세요.";
    $("#loginMsg").className = "login-msg error";
    return;
  }

  sb = window.getSupabase();

  // 세션 확인
  sb.auth.getSession().then(({ data }) => {
    if (data.session) showDashboard(data.session.user);
    else loginView.hidden = false;
  });

  // ---- 로그인 ----
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#loginMsg");
    const btn = $("#loginBtn");
    btn.disabled = true; btn.textContent = "로그인 중…";
    msg.textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({
      email: $("#loginEmail").value.trim(),
      password: $("#loginPassword").value,
    });
    btn.disabled = false; btn.textContent = "로그인";
    if (error) {
      msg.className = "login-msg error";
      msg.textContent = "로그인 실패: 이메일 또는 비밀번호를 확인하세요.";
      return;
    }
    showDashboard(data.user);
  });

  // ---- 로그아웃 ----
  $("#logoutBtn").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });

  function showDashboard(user) {
    loginView.hidden = true;
    dashView.hidden = false;
    $("#whoami").textContent = user.email;
    setupTabs();
    loadApplications();
    loadNotices();
    loadGallery();
    loadPrograms();
  }

  // ---- 탭 ----
  function setupTabs() {
    $$(".dash-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".dash-tab").forEach((t) => t.classList.remove("active"));
        $$(".panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $(`.panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
      });
    });
  }

  // ---- Toast ----
  let toastTimer;
  function toast(text, isErr) {
    const t = $("#toast");
    t.textContent = text;
    t.className = "toast" + (isErr ? " err" : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  const esc = (s) =>
    (s == null ? "" : String(s)).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // ============================================================
  //  1) 입학 신청
  // ============================================================
  let appsCache = [];
  const STATUS_LABEL = { new: "신규", contacted: "연락완료", enrolled: "등록완료", archived: "보관" };

  async function loadApplications() {
    const { data, error } = await sb
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { $("#appsBody").innerHTML = `<tr><td colspan="10" class="empty">불러오기 실패: ${esc(error.message)}</td></tr>`; return; }
    appsCache = data || [];
    renderApps();
    const newCount = appsCache.filter((a) => a.status === "new").length;
    const badge = $("#badgeApps");
    badge.textContent = newCount;
    badge.classList.toggle("zero", newCount === 0);
  }

  function renderApps() {
    const filter = $("#appFilter").value;
    const rows = appsCache.filter((a) => !filter || a.status === filter);
    if (!rows.length) { $("#appsBody").innerHTML = `<tr><td colspan="10" class="empty">신청 내역이 없습니다.</td></tr>`; return; }
    $("#appsBody").innerHTML = rows.map((a) => {
      const d = new Date(a.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
      const opts = Object.keys(STATUS_LABEL).map(
        (k) => `<option value="${k}" ${a.status === k ? "selected" : ""}>${STATUS_LABEL[k]}</option>`
      ).join("");
      return `<tr>
        <td>${d}</td>
        <td><b>${esc(a.child_name)}</b></td>
        <td>${esc(a.age_grade)}</td>
        <td>${esc(a.korean_level)}</td>
        <td>${esc(a.parent_name)}</td>
        <td>${esc(a.phone)}</td>
        <td>${esc(a.email)}</td>
        <td class="msg">${esc(a.message)}</td>
        <td><select class="status-select status-${a.status}" data-id="${a.id}">${opts}</select></td>
        <td><button class="row-del" data-id="${a.id}" title="삭제">🗑</button></td>
      </tr>`;
    }).join("");

    $$("#appsBody .status-select").forEach((sel) =>
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const status = e.target.value;
        const { error } = await sb.from("applications").update({ status }).eq("id", id);
        if (error) return toast("상태 변경 실패", true);
        const rec = appsCache.find((x) => x.id === id); if (rec) rec.status = status;
        loadApplications();
        toast("상태가 변경되었습니다.");
      })
    );
    $$("#appsBody .row-del").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("이 신청 내역을 삭제할까요?")) return;
        const { error } = await sb.from("applications").delete().eq("id", btn.dataset.id);
        if (error) return toast("삭제 실패", true);
        toast("삭제되었습니다.");
        loadApplications();
      })
    );
  }

  $("#appFilter").addEventListener("change", renderApps);

  $("#exportApps").addEventListener("click", () => {
    if (!appsCache.length) return toast("내보낼 데이터가 없습니다.", true);
    const head = ["신청일", "자녀이름", "나이/학년", "한국어수준", "보호자", "연락처", "이메일", "문의", "상태"];
    const lines = [head.join(",")];
    appsCache.forEach((a) => {
      const row = [
        new Date(a.created_at).toLocaleString("ko-KR"),
        a.child_name, a.age_grade, a.korean_level, a.parent_name,
        a.phone, a.email, a.message, STATUS_LABEL[a.status] || a.status,
      ].map((v) => `"${(v == null ? "" : String(v)).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "입학신청_내역.csv"; a.click();
    URL.revokeObjectURL(url);
  });

  // ============================================================
  //  2) 공지사항
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
          <h3>${esc(n.title_ko)}</h3>
          <p>${esc((n.body_ko || "").slice(0, 100))}</p>
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
        <div class="field"><label>분류 (한/영)</label><input id="m_cat_ko" placeholder="예) 모집" value="${esc(n.category_ko)}"></div>
      </div>
      <div class="field"><label>분류 (영어)</label><input id="m_cat_en" placeholder="e.g. Enrollment" value="${esc(n.category_en)}"></div>
      <div class="field"><label>제목 (한국어)</label><input id="m_title_ko" value="${esc(n.title_ko)}"></div>
      <div class="field"><label>제목 (영어)</label><input id="m_title_en" value="${esc(n.title_en)}"></div>
      <div class="field"><label>내용 (한국어)</label><textarea id="m_body_ko" rows="3">${esc(n.body_ko)}</textarea></div>
      <div class="field"><label>내용 (영어)</label><textarea id="m_body_en" rows="3">${esc(n.body_en)}</textarea></div>
      <label class="check-row"><input type="checkbox" id="m_pub" ${n.published !== false ? "checked" : ""}> 사이트에 공개</label>
    `, async () => {
      const payload = {
        notice_date: $("#m_date").value,
        category_ko: $("#m_cat_ko").value, category_en: $("#m_cat_en").value,
        title_ko: $("#m_title_ko").value, title_en: $("#m_title_en").value,
        body_ko: $("#m_body_ko").value, body_en: $("#m_body_en").value,
        published: $("#m_pub").checked,
      };
      if (!payload.title_ko) { toast("한국어 제목은 필수입니다.", true); return false; }
      const res = n.id
        ? await sb.from("notices").update(payload).eq("id", n.id)
        : await sb.from("notices").insert(payload);
      if (res.error) { toast("저장 실패: " + res.error.message, true); return false; }
      toast("저장되었습니다.");
      loadNotices();
      return true;
    });
  }

  // ============================================================
  //  3) 수업 / 프로그램
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
          <h3>${esc(p.name_ko)}</h3>
          <p>${esc(p.desc_ko)}</p>
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
        <div class="field"><label>태그 (한/영)</label><input id="m_tag_ko" placeholder="예) 초급" value="${esc(p.tag_ko)}"></div>
      </div>
      <div class="field"><label>태그 (영어)</label><input id="m_tag_en" placeholder="e.g. Beginner" value="${esc(p.tag_en)}"></div>
      <div class="field"><label>반 이름 (한국어)</label><input id="m_name_ko" value="${esc(p.name_ko)}"></div>
      <div class="field"><label>반 이름 (영어)</label><input id="m_name_en" value="${esc(p.name_en)}"></div>
      <div class="field"><label>설명 (한국어)</label><textarea id="m_desc_ko" rows="2">${esc(p.desc_ko)}</textarea></div>
      <div class="field"><label>설명 (영어)</label><textarea id="m_desc_en" rows="2">${esc(p.desc_en)}</textarea></div>
      <label class="check-row"><input type="checkbox" id="m_pub" ${p.published !== false ? "checked" : ""}> 사이트에 공개</label>
    `, async () => {
      const payload = {
        sort_order: parseInt($("#m_sort").value, 10) || 0,
        tag_ko: $("#m_tag_ko").value, tag_en: $("#m_tag_en").value,
        name_ko: $("#m_name_ko").value, name_en: $("#m_name_en").value,
        desc_ko: $("#m_desc_ko").value, desc_en: $("#m_desc_en").value,
        published: $("#m_pub").checked,
      };
      if (!payload.name_ko) { toast("반 이름(한국어)은 필수입니다.", true); return false; }
      const res = p.id
        ? await sb.from("programs").update(payload).eq("id", p.id)
        : await sb.from("programs").insert(payload);
      if (res.error) { toast("저장 실패: " + res.error.message, true); return false; }
      toast("저장되었습니다.");
      loadPrograms();
      return true;
    });
  }

  // ============================================================
  //  4) 갤러리
  // ============================================================
  const BUCKET = "gallery";

  function publicUrl(path) {
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

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
      if (error) return toast("변경 실패", true);
      loadGallery();
    }));
    $$("#galleryList [data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 사진을 삭제할까요?")) return;
      await sb.storage.from(BUCKET).remove([b.dataset.path]);
      const { error } = await sb.from("gallery").delete().eq("id", b.dataset.del);
      if (error) return toast("삭제 실패", true);
      toast("삭제되었습니다.");
      loadGallery();
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
        image_path: path,
        caption_ko: $("#m_cap_ko").value,
        caption_en: $("#m_cap_en").value,
        sort_order: parseInt($("#m_sort").value, 10) || 0,
        published: $("#m_pub").checked,
      });
      if (res.error) { toast("저장 실패: " + res.error.message, true); return false; }
      toast("사진이 추가되었습니다.");
      loadGallery();
      return true;
    });
  });

  // ============================================================
  //  공용: 삭제 / 모달
  // ============================================================
  async function delRow(table, id, reload) {
    if (!confirm("정말 삭제할까요?")) return;
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) return toast("삭제 실패", true);
    toast("삭제되었습니다.");
    reload();
  }

  let onSave = null;
  function openModal(title, bodyHtml, saveFn) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHtml;
    onSave = saveFn;
    $("#modalOverlay").hidden = false;
  }
  function closeModal() { $("#modalOverlay").hidden = true; onSave = null; }
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalCancel").addEventListener("click", closeModal);
  $("#modalOverlay").addEventListener("click", (e) => { if (e.target === $("#modalOverlay")) closeModal(); });
  $("#modalSave").addEventListener("click", async () => {
    if (!onSave) return;
    const btn = $("#modalSave");
    btn.disabled = true;
    const ok = await onSave();
    btn.disabled = false;
    if (ok) closeModal();
  });

})();
