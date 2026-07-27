// ============================================================
//  Vercel Serverless Function — 신청서 링크 이메일 발송
//  POST /api/send-application
//  - 관리자(로그인된 Supabase 세션)만 호출 가능하도록 검증
//  - Resend API 로 신청자에게 개인 작성 링크 발송
//  - body.preview === true 면 발송하지 않고 이메일 HTML만 반환 (미리보기)
//    · preview 시 extra_ko / extra_en 을 넘기면 그 값으로 안내문 렌더링
//      (저장 전 편집 중인 내용도 미리볼 수 있음)
//  환경변수(Vercel → Settings → Environment Variables):
//    RESEND_API_KEY  (필수, 비밀 — preview에는 불필요)
//    FROM_EMAIL      (선택, 기본 onboarding@resend.dev)
//    SITE_URL        (선택, 기본 https://www.mcckoreanschool.org)
// ============================================================

const SUPABASE_URL  = "https://crufkpftjtjfiaeoztrt.supabase.co";
const SUPABASE_ANON = "sb_publishable_eeVcS3dqrGYSb4RVzoPUwg_GRgVL1Uy"; // 공개 키(안전)

const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// admin 서식 편집기에서 온 HTML 정리 — 위험한 태그/속성 제거 (관리자 전용 입력이지만 안전망)
function sanitizeHtml(html) {
  return String(html)
    .replace(/<(script|style|iframe|object|embed|form|link|meta)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|link|meta)[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, "");
}

// 고정 안내문(📌) 블록 — ko/en 둘 다 비어 있으면 빈 문자열
function buildExtraBlock(ko, en) {
  ko = (ko || "").trim(); en = (en || "").trim();
  if (!ko && !en) return "";
  // 서식 편집기 값(HTML)은 정리 후 그대로, 예전 일반 텍스트는 이스케이프 + 줄바꿈 변환
  const toHtml = (t) => (/<[a-z][^>]*>/i.test(t) ? sanitizeHtml(t) : escHtml(t).replace(/\n/g, "<br>"));
  return `
      <div style="background:#fcf6e3;border:1px solid #f0e4bd;border-radius:12px;padding:16px 18px;margin:4px 0 18px">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#8a6a0c">📌 안내사항 · Notes</p>
        ${ko ? `<p style="margin:0;font-size:14px;line-height:1.8;color:#55503f">${toHtml(ko)}</p>` : ""}
        ${en ? `<p style="margin:${ko ? "10px" : "0"} 0 0;font-size:12.5px;line-height:1.7;color:#8a8471">${toHtml(en)}</p>` : ""}
      </div>`;
}

// 이메일 본문 전체 — 발송과 미리보기가 동일한 템플릿을 사용
function buildEmailHtml(safeName, link, extraBlock) {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#221e13">
    <div style="background:#f2ce54;padding:22px 24px;border-radius:14px 14px 0 0">
      <h1 style="margin:0;font-size:20px;color:#33290a">MCC 한글학교</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#5c4a12">MCC Korean School</p>
    </div>
    <div style="border:1px solid #ece7d8;border-top:none;border-radius:0 0 14px 14px;padding:26px 24px">
      <p style="font-size:16px">${safeName}님, 안녕하세요! 👋</p>
      <p style="font-size:15px;line-height:1.7;color:#55503f">
        입학 신청서를 요청해 주셔서 감사합니다. 아래 버튼을 눌러 온라인 신청서를 작성해 주세요.<br>
        <span style="color:#8a8471;font-size:13px">Thank you for your interest! Please click below to complete your enrollment application.</span>
      </p>
${extraBlock}
      <p style="text-align:center;margin:26px 0">
        <a href="${link}" style="background:#23895e;background:#b8890f;color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:600;display:inline-block">
          신청서 작성하기 · Open Application
        </a>
      </p>
      <p style="font-size:12px;color:#8a8471;line-height:1.6">
        버튼이 안 보이면 이 링크를 복사해 열어주세요 / If the button doesn't work, copy this link:<br>
        <a href="${link}" style="color:#8a6a0c;word-break:break-all">${link}</a>
      </p>
      <p style="font-size:12px;color:#b3aa8f;margin-top:22px">이 링크는 1회용입니다. / This link can be used once.</p>
    </div>
  </div>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── 1) 관리자 인증 확인 (Supabase 세션 토큰) ──
  const authHeader = req.headers.authorization || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return res.status(401).json({ error: "No auth token" });

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` },
    });
    if (!userRes.ok) return res.status(401).json({ error: "Unauthorized" });
  } catch (e) {
    return res.status(401).json({ error: "Auth check failed" });
  }

  // ── 2) 입력 파싱 ──
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { email, name, applyToken, preview } = body || {};

  const SITE_URL = process.env.SITE_URL || "https://www.mcckoreanschool.org";

  // ── 2-A) 미리보기 모드: 발송 없이 HTML만 반환 ──
  if (preview) {
    const safeName = String(name || "홍길동").replace(/[<>]/g, "");
    const link = `${SITE_URL}/apply?token=(발송-시-자동-생성)`;
    const extraBlock = buildExtraBlock(body.extra_ko, body.extra_en);
    return res.status(200).json({ ok: true, html: buildEmailHtml(safeName, link, extraBlock) });
  }

  if (!email || !applyToken) return res.status(400).json({ error: "Missing email or token" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
  if (!RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

  const link = `${SITE_URL}/apply?token=${encodeURIComponent(applyToken)}`;
  const safeName = String(name || "").replace(/[<>]/g, "");

  // ── 2-B) 고정 안내문 조회 (admin에서 편집, site_settings 테이블) ──
  // 실패해도 이메일 발송은 계속 진행 (안내문 없이)
  let extraBlock = "";
  try {
    const setRes = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?select=key,value&key=in.(email_extra_ko,email_extra_en)`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` } }
    );
    if (setRes.ok) {
      const rows = await setRes.json();
      const map = {};
      rows.forEach((r) => { map[r.key] = r.value || ""; });
      extraBlock = buildExtraBlock(map.email_extra_ko, map.email_extra_en);
    }
  } catch (e) { /* 안내문 조회 실패는 무시 */ }

  const html = buildEmailHtml(safeName, link, extraBlock);

  // ── 3) Resend 로 발송 ──
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `MCC 한글학교 <${FROM_EMAIL}>`,
        to: [email],
        subject: "[MCC 한글학교] 입학 신청서 안내 / Enrollment Application",
        html,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Email send failed", detail });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: "Email send error", detail: String(e) });
  }
};
