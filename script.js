// ===== 늘 푸른 한글학교 — 인터랙션 =====

document.addEventListener('DOMContentLoaded', () => {

  /* ---- 1. 언어 전환 (KO / EN) ---- */
  const langToggle = document.getElementById('langToggle');
  const langOpts = langToggle.querySelectorAll('.lang-opt');
  let currentLang = 'ko';

  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;

    // 텍스트 전환
    document.querySelectorAll('[data-ko]').forEach(el => {
      const val = el.getAttribute('data-' + lang);
      if (val !== null) el.innerHTML = val;
    });

    // placeholder 전환
    document.querySelectorAll('[data-ph-ko]').forEach(el => {
      const val = el.getAttribute('data-ph-' + lang);
      if (val !== null) el.placeholder = val;
    });

    // 토글 UI
    langOpts.forEach(o => o.classList.toggle('active', o.dataset.lang === lang));
  }

  langToggle.addEventListener('click', () => {
    applyLang(currentLang === 'ko' ? 'en' : 'ko');
  });

  /* ---- 2. 모바일 메뉴 ---- */
  const menuBtn = document.getElementById('menuBtn');
  const navLinks = document.getElementById('navLinks');
  menuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    menuBtn.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuBtn.classList.remove('open');
    })
  );

  /* ---- 3. 헤더 스크롤 그림자 ---- */
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- 4. 등장 애니메이션 ---- */
  const revealTargets = document.querySelectorAll(
    '.section-head, .about-grid, .program-grid, .schedule, .admission-form, .steps, .news-item, .g-item, .location-grid'
  );
  revealTargets.forEach(el => el.setAttribute('data-reveal', ''));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('in'));
  }

  /* ---- 5. 입학 신청 폼 ---- */
  // 실제 접수를 받으려면 아래 중 하나로 연결하세요:
  //  (A) Formspree: form에 action="https://formspree.io/f/XXXX" method="POST" 추가
  //  (B) Google Forms: 폼을 만든 뒤 응답을 받는 방식으로 교체
  //  현재는 데모용으로 화면에 확인 메시지만 표시합니다.
  const form = document.getElementById('admissionForm');
  const note = document.getElementById('formNote');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const required = form.querySelectorAll('[required]');
    let ok = true;
    required.forEach(f => {
      if (!f.value.trim()) { f.style.borderColor = '#e74c3c'; ok = false; }
      else { f.style.borderColor = ''; }
    });

    if (!ok) {
      note.className = 'form-note error';
      note.textContent = currentLang === 'ko'
        ? '* 필수 항목을 모두 입력해 주세요.'
        : '* Please fill in all required fields.';
      return;
    }

    note.className = 'form-note success';
    note.textContent = currentLang === 'ko'
      ? '✓ 신청이 접수되었습니다! 곧 연락드리겠습니다. (데모 — 실제 전송은 접수 서비스 연결 필요)'
      : '✓ Application received! We will be in touch soon. (Demo — connect a form service to send)';
    form.reset();
  });

});
