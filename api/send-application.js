// ============================================================
//  Vercel Serverless Function — 신청서 링크 이메일 발송
//  POST /api/send-application
//  - 관리자(로그인된 Supabase 세션)만 호출 가능하도록 검증
//  - Resend API 로 신청자에게 개인 작성 링크 발송
//  환경변수(Vercel → Settings → Environment Variables):
//    RESEND_API_KEY  (필수, 비밀)
//    FROM_EMAIL      (선택, 기본 onboarding@resend.dev)
//    SITE_URL        (선택, 기본 https://www.mcckoreanschool.org)
// ============================================================

const SUPABASE_URL  = "https://crufkpftjtjfiaeoztrt.supabase.co";
const SUPABASE_ANON = "sb_publishable_eeVcS3dqrGYSb4RVzoPUwg_GRgVL1Uy"; // 공개 키(안전)

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
  const { email, name, applyToken } = body || {};
  if (!email || !applyToken) return res.status(400).json({ error: "Missing email or token" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const SITE_URL = process.env.SITE_URL || "https://www.mcckoreanschool.org";
  if (!RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

  const link = `${SITE_URL}/apply?token=${encodeURIComponent(applyToken)}`;
  const safeName = String(name || "").replace(/[<>]/g, "");

  const html = `
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
