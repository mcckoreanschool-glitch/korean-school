# Vercel 배포 + 도메인 연결 가이드

> GitHub Pages → Vercel 로 호스팅 이전. 저장소/코드/Supabase는 그대로 재사용합니다.
> 정적 사이트라 **빌드 설정 필요 없음.** 약 10분.

---

## 1단계 · Vercel 가입 & 저장소 가져오기
1. https://vercel.com → **Sign Up** → **Continue with GitHub**
   - ⚠️ `mcckoreanschool-glitch` 계정으로 로그인된 상태에서 진행 (저장소가 그 계정에 있음)
2. 대시보드 → **Add New… → Project**
3. **Import Git Repository** 목록에서 `korean-school` 옆 **Import** 클릭
   - Vercel이 저장소 접근 권한을 요청하면 허용
4. 설정 화면:
   - **Framework Preset**: `Other` (자동 감지됨)
   - **Build Command / Output**: 비워두기 (정적 사이트라 불필요)
   - **Deploy** 클릭
5. 1분 뒤 `xxxx.vercel.app` 주소로 사이트가 뜹니다 → 잘 나오는지 확인
   - (공지·프로그램이 보이면 Supabase 연결도 정상)

## 2단계 · 도메인 연결
1. 방금 만든 프로젝트 → **Settings → Domains**
2. `mcckoreanschool.org` 입력 → **Add**
3. `www.mcckoreanschool.org` 도 입력 → **Add**
   (보통 www → apex 로 자동 리다이렉트 설정을 제안해줘요. 권장대로 두면 됨)
4. Vercel이 **어떤 DNS 레코드를 넣으라고 화면에 표시**해줍니다. 보통:

| Type  | Host / Name | Value               |
|-------|-------------|---------------------|
| A     | `@`         | `76.76.21.21`       |
| CNAME | `www`       | `cname.vercel-dns.com` |

> ⚠️ **정확한 값은 Vercel 화면에 나오는 걸 그대로** 쓰세요. (가끔 다를 수 있어요)

## 3단계 · Namecheap DNS 수정
1. Namecheap → **Domain List** → `mcckoreanschool.org` **Manage** → **Advanced DNS**
2. **기존 GitHub Pages A 레코드 4개(185.199.x.x) 는 삭제**
3. 위 2단계에서 Vercel이 알려준 레코드로 교체:
   - A `@` → `76.76.21.21`
   - CNAME `www` → `cname.vercel-dns.com`
4. 저장

## 4단계 · 마무리
- DNS 반영(수십 분~몇 시간) 후 Vercel Domains 화면에 **"Valid Configuration" ✅** 표시
- **HTTPS(🔒)는 Vercel이 자동 발급** — 따로 켤 필요 없음
- `https://mcckoreanschool.org` 및 `/admin.html` 접속 확인

---

## GitHub Pages 정리 (선택)
- 이전이 끝나면 GitHub 저장소 **Settings → Pages** 에서 custom domain 을 비우거나 Pages 를 꺼도 됩니다. (안 해도 DNS가 Vercel을 가리키면 자연히 Vercel이 서비스함)
- 저장소의 `CNAME`, `.nojekyll` 파일은 Vercel에서 무시되므로 남겨둬도 무방합니다.

## 앞으로 (Vercel의 장점 활용)
- 이제 `git push` 하면 **자동 재배포** + **미리보기 URL** 제공
- 나중에 서버 기능(예: 신청 시 자동 이메일)은 `/api` 폴더에 **Serverless Function** 추가로 구현 가능
