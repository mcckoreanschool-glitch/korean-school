# MCC 한글학교 웹사이트

늘 푸른 선교 교회 부설 한글학교를 위한 이중언어(한국어/English) 한 페이지 웹사이트입니다.

## 📁 파일 구성
- `index.html` — 페이지 내용 (모든 텍스트)
- `styles.css` — 디자인 / 색상 / 레이아웃
- `script.js` — 언어 전환, 모바일 메뉴, 애니메이션, 신청 폼
- `images/` — 갤러리·로고 사진을 넣는 폴더

## 👀 미리 보기
파일 `index.html`을 브라우저에서 열면 됩니다. (더블클릭)

## ✏️ 내용 수정하는 법
모든 텍스트는 `index.html` 안에 있고, 이중언어는 이렇게 되어 있어요:
```html
<h3 data-ko="한국어 문구" data-en="English text">한국어 문구</h3>
```
- `data-ko` = 한국어 / `data-en` = 영어 → 둘 다 바꿔주세요.

### 꼭 바꿔야 할 곳 (현재 예시로 채워둠)
1. **오시는 길** — 실제 주소 / 전화 / 이메일 (`#location` 섹션)
2. **교장 인사말** — `#about` 섹션의 인용문
3. **공지사항** — `#news` 섹션의 날짜·내용
4. **수업 시간** — `#programs` 섹션의 시간표

## 🗺️ 지도 넣기
`#location`의 `.map-placeholder` 부분을 Google 지도 임베드 코드로 교체:
1. Google Maps에서 위치 검색 → 공유 → 지도 퍼가기 → HTML 복사
2. `<div class="map-placeholder">...</div>`를 복사한 `<iframe>`으로 교체

## 📝 입학 신청 폼 실제로 받으려면
현재는 데모(화면 확인만)입니다. 실제 접수를 받으려면 둘 중 하나:
- **Formspree (쉬움/무료)**: https://formspree.io 가입 → `index.html`의 `<form id="admissionForm">`에 `action="https://formspree.io/f/본인코드" method="POST"` 추가
- **Google Forms**: 폼을 만들어 링크 버튼으로 연결

## 🖼️ 갤러리 사진 넣기
`images/` 폴더에 사진을 넣고, `#gallery`의 각 `<figure>`를 이미지로 교체하면 됩니다.

## 🌐 인터넷에 올리기 (배포)
무료로 올리는 방법:
- **Netlify Drop**: https://app.netlify.com/drop 에 이 폴더를 드래그
- **GitHub Pages**, **Vercel** 등도 가능
