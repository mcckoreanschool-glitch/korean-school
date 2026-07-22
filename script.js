// ===== MCC 한글학교 — 공개 사이트 인터랙션 =====

document.addEventListener('DOMContentLoaded', () => {

  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- 1. 언어 전환 (KO / EN) ---- */
  const langToggle = document.getElementById('langToggle');
  const langOpts = langToggle.querySelectorAll('.lang-opt');
  let currentLang = localStorage.getItem('npks_lang') || 'ko';

  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem('npks_lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-ko]').forEach(el => {
      const val = el.getAttribute('data-' + lang);
      if (val !== null) el.innerHTML = val;
    });
    document.querySelectorAll('[data-ph-ko]').forEach(el => {
      const val = el.getAttribute('data-ph-' + lang);
      if (val !== null) el.placeholder = val;
    });
    langOpts.forEach(o => o.classList.toggle('active', o.dataset.lang === lang));
  }
  langToggle.addEventListener('click', () => applyLang(currentLang === 'ko' ? 'en' : 'ko'));
  applyLang(currentLang);

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
  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.12 })
    : null;

  function observeReveals(els) {
    els.forEach(el => {
      el.setAttribute('data-reveal', '');
      if (io) io.observe(el); else el.classList.add('in');
    });
  }
  observeReveals(document.querySelectorAll(
    '.section-head, .about-grid, .program-grid, .schedule, .admission-form, .steps, .news-item, .g-item, .location-grid'
  ));

  /* ============================================================
     5. Supabase 연동 (설정된 경우에만 동적 로딩 / 실제 저장)
     ============================================================ */
  const sb = (window.getSupabase && window.getSupabase()) || null;

  if (sb) {
    loadHeroSlides();
    loadSiteImages();
    loadPrograms();
    loadNotices();
    loadGallery();
  }
  // sb 가 없으면 index.html 의 기존 데모(정적) 내용이 그대로 보입니다.

  /* 홈 히어로 배경 슬라이드쇼 — 여러 장을 천천히 크로스페이드.
     슬라이드가 없으면 기존 단일 슬롯(hero_bg) → 그것도 없으면 그라데이션 유지 */
  const HERO_INTERVAL = 6000;   // 각 사진 표시 시간(ms)  ※ 페이드는 CSS 2초
  async function loadHeroSlides() {
    const hero = document.getElementById('hero');
    const box = document.getElementById('heroSlides');
    if (!hero || !box) return;
    const { data } = await sb.from('hero_slides').select('*')
      .eq('published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    let paths = (data || []).map(r => r.image_path);
    if (!paths.length) {   // 백워드 호환: 기존 단일 hero_bg 슬롯
      const { data: legacy } = await sb.from('site_images').select('image_path').eq('slot', 'hero_bg').maybeSingle();
      if (legacy && legacy.image_path) paths = [legacy.image_path];
    }
    if (!paths.length) return;   // 사진 없으면 기존 그라데이션 배경 유지
    const urls = paths.map(p => sb.storage.from('gallery').getPublicUrl(p).data.publicUrl);
    box.innerHTML = urls.map((u, i) =>
      `<div class="hero-slide${i === 0 ? ' active' : ''}" style="background-image:url('${u}')"></div>`).join('');
    hero.classList.add('has-bg-image');
    if (urls.length < 2) return;   // 한 장이면 고정 배경
    const slides = Array.from(box.querySelectorAll('.hero-slide'));
    let idx = 0;
    setInterval(() => {
      slides[idx].classList.remove('active');
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add('active');
    }, HERO_INTERVAL);
  }

  /* 사이트 고정 이미지(슬롯): [data-slot] 요소에 DB 사진을 끼워 넣음.
     비어 있으면 기존 디자인이 그대로 유지됩니다. */
  async function loadSiteImages() {
    const { data, error } = await sb.from('site_images').select('*');
    if (error || !data) return;
    const map = {};
    data.forEach(r => { map[r.slot] = r; });
    document.querySelectorAll('[data-slot]').forEach(el => {
      const rec = map[el.dataset.slot];
      if (!rec || !rec.image_path) return;
      const url = sb.storage.from('gallery').getPublicUrl(rec.image_path).data.publicUrl;
      if (el.dataset.slotType === 'bg') {
        el.style.backgroundImage =
          `linear-gradient(rgba(20,16,6,.5), rgba(20,16,6,.42)), url('${url}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.classList.add('has-bg-image');
      } else {
        el.src = url;
        el.alt = (currentLang === 'en' ? rec.alt_en : rec.alt_ko) || '';
        const wrap = el.closest('[data-slot-wrap]');
        if (wrap) wrap.hidden = false; else el.hidden = false;
      }
    });
  }

  async function loadPrograms() {
    const { data, error } = await sb.from('programs').select('*')
      .eq('published', true).order('sort_order', { ascending: true });
    if (error || !data || !data.length) return;
    const grid = document.getElementById('programGrid');
    grid.innerHTML = data.map(p => `
      <div class="program card${p.image_path ? ' has-photo' : ''}">
        ${p.image_path ? `<figure class="program-photo"><img src="${esc(sb.storage.from('gallery').getPublicUrl(p.image_path).data.publicUrl)}" alt="${esc(p.name_ko)}" loading="lazy"></figure>` : ''}
        <span class="program-tag" data-ko="${esc(p.tag_ko)}" data-en="${esc(p.tag_en || p.tag_ko)}">${esc(p.tag_ko)}</span>
        <h3 data-ko="${esc(p.name_ko)}" data-en="${esc(p.name_en || p.name_ko)}">${esc(p.name_ko)}</h3>
        <p data-ko="${esc(p.desc_ko)}" data-en="${esc(p.desc_en || p.desc_ko)}">${esc(p.desc_ko)}</p>
      </div>`).join('');
    applyLang(currentLang);
    observeReveals(grid.querySelectorAll('.program'));
  }

  async function loadNotices() {
    const { data, error } = await sb.from('notices').select('*')
      .eq('published', true).order('notice_date', { ascending: false });
    if (error || !data || !data.length) return;
    const list = document.getElementById('newsList');
    list.innerHTML = data.map(n => {
      const yr = (n.notice_date || '').slice(0, 4);
      const md = (n.notice_date || '').slice(5).replace('-', '.');
      return `
      <article class="news-item card">
        <div class="news-date"><span>${esc(yr)}</span><b>${esc(md)}</b></div>
        <div class="news-body">
          ${n.category_ko ? `<span class="news-badge" data-ko="${esc(n.category_ko)}" data-en="${esc(n.category_en || n.category_ko)}">${esc(n.category_ko)}</span>` : ''}
          <h3 data-ko="${esc(n.title_ko)}" data-en="${esc(n.title_en || n.title_ko)}">${esc(n.title_ko)}</h3>
          <p data-ko="${esc(n.body_ko)}" data-en="${esc(n.body_en || n.body_ko)}">${esc(n.body_ko)}</p>
        </div>
      </article>`;
    }).join('');
    applyLang(currentLang);
    observeReveals(list.querySelectorAll('.news-item'));
  }

  async function loadGallery() {
    const { data, error } = await sb.from('gallery').select('*')
      .eq('published', true).order('sort_order', { ascending: true });
    if (error || !data || !data.length) return;
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = data.map(g => {
      const url = sb.storage.from('gallery').getPublicUrl(g.image_path).data.publicUrl;
      return `<a class="g-item g-photo" href="gallery.html" style="background-image:url('${esc(url)}')">
        ${g.caption_ko ? `<span data-ko="${esc(g.caption_ko)}" data-en="${esc(g.caption_en || g.caption_ko)}">${esc(g.caption_ko)}</span>` : ''}
      </a>`;
    }).join('');
    applyLang(currentLang);
    observeReveals(grid.querySelectorAll('.g-item'));
  }

  /* ---- 6. 신청서 요청 폼 ---- */
  const form = document.getElementById('requestForm');
  const note = document.getElementById('formNote');

  if (window.attachPhoneFormat) window.attachPhoneFormat(document.getElementById('reqPhone'));

  form.addEventListener('submit', async (e) => {
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
        ? '* 이름과 이메일을 입력해 주세요.'
        : '* Please enter your name and email.';
      return;
    }

    const payload = {
      requester_name: form.reqName.value.trim(),
      email:          form.reqEmail.value.trim(),
      phone:          form.reqPhone.value.trim(),
      num_children:   form.reqChildren.value.trim(),
      message:        form.reqMessage.value.trim(),
    };

    if (sb) {
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const { error } = await sb.from('form_requests').insert(payload);
      btn.disabled = false;
      if (error) {
        note.className = 'form-note error';
        note.textContent = currentLang === 'ko'
          ? '전송 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'
          : 'Something went wrong. Please try again shortly.';
        return;
      }
      note.className = 'form-note success';
      note.textContent = currentLang === 'ko'
        ? '✓ 요청이 접수되었습니다! 담당 선생님이 이메일로 신청서를 보내드릴게요.'
        : '✓ Request received! Our teacher will email you the application form.';
      form.reset();
    } else {
      note.className = 'form-note success';
      note.textContent = currentLang === 'ko'
        ? '✓ (데모) 요청 폼 동작 확인 — Supabase 연결 시 실제 저장됩니다.'
        : '✓ (Demo) Form works — connect Supabase to save for real.';
      form.reset();
    }
  });

});
