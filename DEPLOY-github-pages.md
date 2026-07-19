# GitHub Pages 배포 + Namecheap 도메인 연결 가이드

> 목표: 이 사이트를 GitHub Pages에 무료로 올리고, Namecheap에서 산 도메인으로 접속되게 만들기

---

## 1단계 · GitHub 저장소(repository) 만들기
1. https://github.com 에서 로그인 (계정 없으면 무료 가입)
2. 오른쪽 위 **+** → **New repository**
3. 설정:
   - **Repository name**: 아무거나 (예: `korean-school`)
   - **Public** 선택 (무료 Pages는 Public 필요)
   - "Add a README" 등은 체크 안 해도 됨
4. **Create repository**

## 2단계 · 사이트 파일 올리기 (드래그&드롭)
1. 방금 만든 저장소 화면에서 **uploading an existing file** 링크 클릭
   (또는 **Add file → Upload files**)
2. **`korean-school` 폴더 "안의" 파일들**을 전부 드래그해서 올리세요:
   - `index.html`, `styles.css`, `script.js`, `.nojekyll`, `CNAME`, `images` 폴더
   - ⚠️ `korean-school` 폴더 자체가 아니라 **그 안의 내용물**을 올려야 해요.
     (index.html이 저장소 맨 위에 있어야 함)
   - 💡 `CNAME` 파일에 이미 `mcckoreanschool.org` 가 들어있어서,
     이 파일을 올리면 GitHub이 도메인을 자동 인식합니다.
3. 아래 **Commit changes** 클릭

## 3단계 · GitHub Pages 켜기
1. 저장소 상단 **Settings** → 왼쪽 메뉴 **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` / 폴더 `/ (root)` 선택 → **Save**
4. 1~2분 뒤 새로고침하면 `https://<사용자명>.github.io/korean-school/` 주소가 생겨요.
   (여기까지 하면 이미 인터넷에서 접속 가능! 도메인은 다음 단계)

---

## 4단계 · 내 도메인 연결하기

### (A) GitHub 쪽 설정
1. **Settings → Pages → Custom domain** 칸을 확인하세요.
   - `CNAME` 파일을 함께 올렸다면 이미 `mcckoreanschool.org` 가 채워져 있을 거예요.
   - 비어 있으면 `mcckoreanschool.org` 를 입력하고 **Save**.

### (B) Namecheap 쪽 DNS 설정
1. Namecheap 로그인 → **Domain List** → `mcckoreanschool.org` 옆 **Manage**
2. 상단 탭에서 **Advanced DNS** 클릭
3. 기본으로 들어있는 **CNAME(www → parkingpage)** 와 **URL Redirect** 레코드는 **삭제**
4. 아래 레코드를 추가 (**Add New Record**):

| Type  | Host | Value                     | TTL       |
|-------|------|---------------------------|-----------|
| A     | @    | 185.199.108.153           | Automatic |
| A     | @    | 185.199.109.153           | Automatic |
| A     | @    | 185.199.110.153           | Automatic |
| A     | @    | 185.199.111.153           | Automatic |
| CNAME | www  | `<사용자명>.github.io`     | Automatic |

- `@` = 도메인 자체(`mcckoreanschool.org`)
- `<사용자명>` = 본인 GitHub 아이디 (뒤에 `.github.io` 붙이고 끝에 점 없음)
  - 예) 아이디가 `mcckorea` 라면 → `mcckorea.github.io`

### (C) HTTPS 켜기
- DNS가 반영되면(수십 분~최대 24시간) GitHub **Settings → Pages** 아래
  **Enforce HTTPS** 체크박스를 켜세요. → `https://`로 안전하게 접속됩니다.

---

## ✅ 확인
- `https://mcckoreanschool.org` 과 `https://www.mcckoreanschool.org` 둘 다 접속되는지 확인
- 안 되면 보통 **DNS 반영 대기** 때문이에요. 30분~몇 시간 기다린 뒤 다시 확인하세요.
- 반영 상태는 https://dnschecker.org 에서 도메인 검색으로 볼 수 있어요.

## 🔁 나중에 내용 수정할 때
- 파일을 고친 뒤, GitHub 저장소에서 같은 방식으로 **Upload files**로 덮어쓰면
  1~2분 뒤 자동으로 사이트에 반영됩니다.
