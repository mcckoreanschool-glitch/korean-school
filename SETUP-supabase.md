# Supabase 연결 가이드 (DB + 관리자 페이지)

이 문서대로 하면 **입학 신청 저장 · 공지/갤러리/프로그램 관리 · 관리자 로그인**이 실제로 동작합니다.
소요 시간: 약 15분.

---

## 1단계 · Supabase 프로젝트 만들기
1. https://supabase.com → **Start your project** → 가입(무료)
2. **New project**
   - Name: `mcc-korean-school`
   - Database Password: 강한 비밀번호 (어딘가 저장!)
   - Region: **학교와 가까운 미국 지역**을 고르세요 (방문자 접속 속도에 영향):
     - 서부(캘리포니아·오리건·워싱턴 등) → `West US (North California)` 또는 `West US (Oregon)`
     - 중부·동부 → `East US (North Virginia)` 또는 `East US (Ohio)`
3. 생성 완료까지 1~2분 대기

## 2단계 · 데이터베이스 만들기 (SQL 실행)
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) **전체 내용**을 붙여넣기
3. 오른쪽 아래 **RUN** 클릭 → "Success" 뜨면 완료
   - 테이블 4개(applications, notices, gallery, programs)와 보안정책(RLS),
     샘플 공지·프로그램이 생성됩니다.

## 3단계 · 사진 저장소(Storage) 만들기
1. 왼쪽 메뉴 **Storage** → **New bucket**
   - Name: `gallery`
   - **Public bucket** 체크 ✅ (방문자가 사진을 볼 수 있어야 하므로)
   - **Save**
2. 업로드 권한 정책 추가: **Storage → Policies → gallery → New policy**
   - 템플릿 중 **"Allow access to authenticated users only"** 계열을 선택하거나,
     아래 SQL을 **SQL Editor**에서 실행:
   ```sql
   -- 로그인한 관리자만 사진 업로드/삭제 가능 (읽기는 Public 버킷이라 자동 허용)
   create policy "admins upload gallery"
     on storage.objects for insert to authenticated
     with check (bucket_id = 'gallery');
   create policy "admins delete gallery"
     on storage.objects for delete to authenticated
     using (bucket_id = 'gallery');
   ```

## 4단계 · 관리자 계정 만들기
1. 왼쪽 메뉴 **Authentication** → **Users** → **Add user** → **Create new user**
   - Email: 관리자 이메일 (예: `admin@mcckoreanschool.org`)
   - Password: 로그인에 쓸 비밀번호
   - **Auto Confirm User** 체크 ✅ (이메일 인증 생략)
   - **Create user**
2. 이 이메일/비번으로 나중에 `admin.html`에 로그인합니다.
   (관리자를 더 추가하려면 여기서 사용자를 더 만들면 돼요.)

## 5단계 · 사이트에 연결 정보 넣기
1. 왼쪽 메뉴 **Project Settings → API** 에서 복사:
   - **Project URL**
   - **anon public** key
2. 이 저장소의 [`config.js`](config.js) 파일을 열어 두 값을 교체:
   ```js
   window.SUPABASE_CONFIG = {
     url:     "https://여기에-내-프로젝트.supabase.co",
     anonKey: "여기에-anon-public-key"
   };
   ```
3. 저장 → GitHub에 반영(push 또는 웹에서 파일 수정)

> 🔒 `anon public` key는 공개돼도 안전합니다. 보안은 DB의 RLS 정책이 지켜줘요.
> `service_role` key는 **절대 config.js에 넣지 마세요.**

---

## ✅ 확인
- `https://mcckoreanschool.org` → 입학 신청서 작성 후 제출
- `https://mcckoreanschool.org/admin.html` → 관리자 로그인 → 방금 넣은 신청이 보이면 성공! 🎉
- 공지/갤러리/프로그램도 Admin에서 추가하면 홈페이지에 바로 반영됩니다.

## 문제 해결
- **로그인 안 됨**: 4단계에서 "Auto Confirm User"를 체크했는지 확인
- **신청이 저장 안 됨**: 2단계 SQL(RLS 정책)이 실행됐는지 확인
- **사진 업로드 실패**: 3단계 Storage 버킷/정책 확인
- 브라우저 개발자도구(F12) → Console 의 빨간 오류 메시지를 보면 원인 파악에 도움돼요.
