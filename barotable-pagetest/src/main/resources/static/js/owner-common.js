/* 점주 화면 공통: 사이드바 + 대시보드 섹션 바로가기 */
(function () {
  const side = document.getElementById('owner-side');
  if (!side) return;
  const current = document.body.dataset.screen;
  const nav = [
    ['owner-dashboard', '대시보드', 'grid'],
    ['owner-guests', '손님 배정', 'users'],
    ['owner-editor', '좌석도 편집', 'layout'],
    ['owner-settings', '운영 조건', 'sliders']
  ];
  const icons = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    layout:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    sliders:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.2" fill="white"/><circle cx="16" cy="17" r="2.2" fill="white"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chair:'<rect x="5" y="4" width="14" height="10" rx="3"/><path d="M5 14v5M19 14v5M5 16h14"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'
  };
  const icon = n => `<svg class="side-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n]}</svg>`;
  const menuItem = ([id, title, glyph]) => `<a data-go="${id}" href="${BT.url(id)}" class="${id===current?'on':''}" ${id===current?'aria-current="page"':''}>${icon(glyph)}<span>${title}</span></a>`;
  const shortcuts = current === 'owner-dashboard' ? `
    <div class="side-section-title">오늘 운영</div>
    <a class="side-shortcut" href="#owner-timetable">${icon('clock')}<span>예약 시간표</span></a>
    <a class="side-shortcut" href="#owner-seats">${icon('chair')}<span>실시간 좌석도</span></a>
    <a class="side-shortcut" href="#owner-reservations">${icon('list')}<span>예약 목록</span></a>
    <a class="side-shortcut" href="#walkin">${icon('plus')}<span>워크인 접수</span></a>` : '';
  side.innerHTML = `
    <div class="side-identity"><a class="brand" data-go="owner-dashboard" href="${BT.url('owner-dashboard')}">바로테이블<span class="side-brand-dot">.</span></a>
       <span class="side-role">OWNER CONSOLE</span></div>
    <div class="side-store"><span class="side-avatar">B</span><span class="side-store-text"><b>${BT.esc(BT.store().name)}</b><small>매장 관리자</small></span></div>
    <div class="side-section-title">점주 메뉴</div>
    <nav class="side-nav" aria-label="점주 주요 메뉴">${nav.map(menuItem).join('')}</nav>
    ${shortcuts}
    <span class="grow"></span>
    <div class="side-bottom"><a data-go="index" href="${BT.url('index')}">${icon('eye')}<span>손님 화면 보기</span></a>
      <a data-go="owner-login" href="${BT.url('owner-login')}">${icon('logout')}<span>로그아웃</span></a></div>
    <div class="side-who">owner@example.com</div>`;
  // Quick links are real in-page anchors. Keep them within the embedded document.
  side.querySelectorAll('.side-shortcut').forEach(a => a.addEventListener('click', e => {
    const target=document.getElementById(a.getAttribute('href').slice(1));
    if(!target)return;
    e.preventDefault(); target.scrollIntoView({behavior:'smooth',block:'start'});
    side.querySelectorAll('.side-shortcut').forEach(x=>x.classList.toggle('active',x===a));
  }));
})();
