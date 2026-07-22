// ============================================================
//  Supabase 연결 설정
//  아래 두 값을 본인 Supabase 프로젝트 값으로 교체하세요.
//  (Supabase 대시보드 → Project Settings → API 에서 확인)
//
//  - url    : Project URL          (예: https://abcd1234.supabase.co)
//  - anonKey: anon public key      (공개돼도 안전한 키 — service_role 아님!)
//
//  ⚠️ 값을 바꾸기 전까지는 사이트가 기존 데모(정적) 모드로 동작합니다.
// ============================================================
window.SUPABASE_CONFIG = {
  url:     "https://crufkpftjtjfiaeoztrt.supabase.co",
  anonKey: "sb_publishable_eeVcS3dqrGYSb4RVzoPUwg_GRgVL1Uy"
};

// 설정이 실제로 채워졌는지 확인하는 헬퍼
window.isSupabaseConfigured = function () {
  const c = window.SUPABASE_CONFIG || {};
  return c.url &&
         c.anonKey &&
         !c.url.includes("YOUR-PROJECT") &&
         !c.anonKey.includes("YOUR-ANON");
};

// 공용 Supabase 클라이언트 생성 (설정됐을 때만)
window.getSupabase = function () {
  if (!window.isSupabaseConfigured() || !window.supabase) return null;
  if (!window._sbClient) {
    window._sbClient = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );
  }
  return window._sbClient;
};

// ── 미국식 전화번호 서식: 9495258720 → (949) 525-8720 ──
window.formatUSPhone = function (v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  if (d.length < 4) return "(" + d;
  if (d.length < 7) return "(" + d.slice(0, 3) + ") " + d.slice(3);
  return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
};

// 전화 입력칸에 자동 서식 연결 (입력할 때마다 정리)
window.attachPhoneFormat = function (input) {
  if (!input) return;
  input.setAttribute("inputmode", "tel");
  input.setAttribute("maxlength", "16");
  input.addEventListener("input", () => { input.value = window.formatUSPhone(input.value); });
  if (input.value) input.value = window.formatUSPhone(input.value);
};
