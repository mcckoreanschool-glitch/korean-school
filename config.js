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
  url:     "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-ANON-PUBLIC-KEY"
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
