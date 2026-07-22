# 신청서 요청 흐름 · 이메일 발송 설정 가이드

새 흐름: **방문자 요청 → 관리자가 "신청서 보내기" → 신청자에게 자동 이메일(작성 링크) → 신청자가 상세 신청서 작성 → 관리자 확인**

작동시키려면 두 가지 설정이 필요해요: **① DB 마이그레이션**, **② 이메일(Resend) 연동**.

---

## ① DB 마이그레이션 (필수)
1. Supabase → **SQL Editor** → **New query**
2. [`supabase/migration-request-flow.sql`](supabase/migration-request-flow.sql) 전체 복사 → 붙여넣기 → **RUN**
   - `form_requests` 테이블 + 신청서 상세 컬럼 + 보안 함수(토큰 검증/제출)가 생성됩니다.

> 이것만 해도 **요청 접수**와 **상세 신청서 저장**은 작동해요. (이메일 자동발송만 아래 ② 설정 후 동작)

---

## ② 이메일 발송 (Resend) 설정

### 2-1. Resend 가입 & API 키
1. https://resend.com → **Sign Up** (GitHub으로)
2. **API Keys** → **Create API Key** → 이름 아무거나 → 생성
3. `re_...` 로 시작하는 키를 **복사** (이건 **비밀 키** — 이 키만 있으면 메일 발송 가능하니 유출 주의)

### 2-2. Vercel 환경변수에 넣기 (코드에 넣지 않음!)
1. Vercel → 프로젝트 `korean-school` → **Settings** → **Environment Variables**
2. 아래를 추가 (Environments: **Production, Preview, Development** 모두 체크):

| Key | Value |
|-----|-------|
| `RESEND_API_KEY` | 방금 복사한 `re_...` 키 |
| `FROM_EMAIL` | (도메인 인증 전) `onboarding@resend.dev` / (인증 후) `noreply@mcckoreanschool.org` |
| `SITE_URL` | `https://www.mcckoreanschool.org` |

3. 저장 후 **재배포**해야 적용돼요: Vercel → **Deployments** → 최신 배포의 **⋯ → Redeploy** (또는 코드를 한 번 더 push)

### 2-3. (테스트) 도메인 인증 전
- `FROM_EMAIL=onboarding@resend.dev` 상태에서는 Resend 정책상 **본인(Resend 가입) 이메일로만** 발송돼요.
- 그래서 먼저 **본인 이메일로 요청 → 신청서 보내기**를 눌러 전체 흐름을 테스트하기 좋아요.

### 2-4. (실사용) 학교 도메인으로 발송하기
학부모 등 아무 이메일로 보내려면 발송 도메인 인증이 필요해요:
1. Resend → **Domains** → **Add Domain** → `mcckoreanschool.org`
2. Resend가 보여주는 **DNS 레코드(SPF/DKIM 등)** 를 Namecheap **Advanced DNS**에 추가
3. Resend에서 **Verified ✅** 되면, Vercel의 `FROM_EMAIL` 을 `noreply@mcckoreanschool.org` (또는 `info@...`)로 바꾸고 재배포

---

## ✅ 전체 테스트 순서
1. 홈페이지 → **신청서 요청하기** → 본인 정보로 요청 제출
2. `admin.html` → **📨 신청서 요청** 탭 → 방금 요청 확인 → **신청서 보내기** 클릭
3. 이메일 확인 → 링크 클릭 → 상세 신청서 작성 → 제출
4. `admin.html` → **📋 제출된 신청서** 탭 → 방금 제출 확인 (상세보기·CSV)

## 문제 해결
- **메일이 안 옴**: Vercel 환경변수 `RESEND_API_KEY` 확인 + 재배포 했는지 / 도메인 인증 전이면 본인 이메일로만 옴 / Resend 대시보드 **Logs** 확인
- **요청/제출이 저장 안 됨**: ① 마이그레이션 SQL 실행했는지 확인
- **관리자에서 "불러오기 실패"**: 마찬가지로 마이그레이션 확인
