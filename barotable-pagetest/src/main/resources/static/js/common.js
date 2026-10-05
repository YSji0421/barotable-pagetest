/* =========================================================
 * 바로테이블 화면 설계 확인용 - 공통
 * 구현 기능: 화면 이동, 10월 날짜 / 영업시간 슬롯 생성, (AI 채팅용) 시간 확인, 예약 상태 변경 · 좌석 규칙
 * 나머지 데이터는 모두 하드코딩
 * ========================================================= */
window.BT = (function () {
  const D = window.BT_DATA;
  const YEAR = 2026, MONTH = 10;
  const TODAY = '2026-10-05';
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  function sget(key, fallback) { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function sset(key, val) { try { sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  /* 운영 조건(O-04)에서 저장한 값('bt.store')이 있으면 하드코딩 값 위에 덮어쓴다.
   * 실제 구현: PUT /api/owner/settings -> GET /api/stores/{slug} */
  function store() {
    const o = sget('bt.store', null);
    if (!o) return D.STORE;
    return Object.assign({}, D.STORE, o, { hours: Object.assign({}, D.STORE.hours, o.hours), notify: Object.assign({}, D.STORE.notify, o.notify) });
  }
  const saveStore = o => sset('bt.store', o);
  const resetStore = () => { try { sessionStorage.removeItem('bt.store'); } catch (e) {} };
  /* 좌석도 편집기(editor.js)에서 저장한 배치('bt.floors')가 있으면 그것을, 없으면 하드코딩 배치를 쓴다.
   * 실제 구현: PUT /api/owner/layout -> GET /api/stores/{slug}/layout */
  const floors = () => JSON.parse(JSON.stringify(sget('bt.floors', null) || D.FLOORS));
  function allTables(fl) {
    const out = [];
    (fl || floors()).forEach(f => f.tables.forEach(t => out.push(Object.assign({ floor: f.id, floorName: f.name }, t))));
    return out;
  }
  const findTable = (id, fl) => allTables(fl).find(t => t.id === id) || null;
  function zoneOf(t, fl) { const f = (fl || floors()).find(x => x.id === t.floor); return f ? f.zones.find(z => z.id === t.zone) || null : null; }

  /* ---------- 화면 이동 ---------- */
  const ROUTES = {
    'index': ['index.html', '/'], 'reserve': ['reserve.html', '/reserve'], 'confirm': ['confirm.html', '/reserve/confirm'],
    'complete': ['complete.html', '/reserve/complete'], 'lookup': ['lookup.html', '/reservations/lookup'], 'admin': ['admin/dashboard.html', '/admin'],
    'owner-login': ['owner/login.html', '/owner/login'], 'owner-dashboard': ['owner/dashboard.html', '/owner/dashboard'],
    'owner-editor': ['owner/editor.html', '/owner/seat-map'], 'owner-settings': ['owner/settings.html', '/owner/settings'],
    'owner-guests': ['owner/guests.html', '/owner/guests']
  };
  function url(name) {
    const r = ROUTES[name];
    if (document.body.dataset.server === 'true') return r[1];
    const depth = Number(document.body.dataset.depth || 0);
    return '../'.repeat(depth) + r[0];
  }
  const go = name => { location.href = url(name); };

  /* 화면 사이에 고른 날짜·시간·인원·테이블만 넘겨서 표시 */
  const DEFAULT_DRAFT = { date: '2026-10-10', time: '19:00', party: 4, table: 'T03', request: '아이 의자' };
  const draft = () => Object.assign({}, DEFAULT_DRAFT, sget('bt.draft', {}));
  const saveDraft = p => { const d = Object.assign(draft(), p); sset('bt.draft', d); return d; };

  /* ---------- 예약 상태 ----------
   * 원본은 BT_DATA.OWNER_RESERVATIONS + 손님 화면에서 만든 예약(draft) 하나.
   * 취소·노쇼·방문·테이블 이동·워크인처럼 바뀐 부분만 sessionStorage('bt.res')에 쌓는다.
   * 실제 구현: GET/PATCH /api/owner/reservations, POST /api/reservations/lookup */
  const NOW = D.OWNER_NOW;
  const guestNo = d => 'BT-' + d.date.replace(/-/g, '') + '-0031';
  const resLog = () => sget('bt.res', { patch: {}, added: [] });
  function reservations() {
    const log = resLog(), d = draft();
    const base = D.OWNER_RESERVATIONS.map(r => Object.assign({ date: D.OWNER_TODAY }, r));
    const mine = { no: guestNo(d), date: d.date, time: d.time, name: '홍길동', phone: '010-0000-0000', email: 'hello@example.com', party: d.party, table: d.table, status: 'booked', request: d.request || '' };
    if (!base.some(r => r.no === mine.no)) base.push(mine);
    return base.concat(log.added).map(r => Object.assign({}, r, log.patch[r.no]));
  }
  function updateReservation(no, change) { const log = resLog(); log.patch[no] = Object.assign(log.patch[no] || {}, change); sset('bt.res', log); }
  function addReservation(r) { const log = resLog(); log.added.push(r); sset('bt.res', log); }
  /* 점주가 직접 만든 배정(워크인 · 전화 예약)만 지울 수 있다 */
  function removeReservation(no) { const log = resLog(); log.added = log.added.filter(r => r.no !== no); delete log.patch[no]; sset('bt.res', log); }
  function resetReservations() { try { sessionStorage.removeItem('bt.res'); } catch (e) {} }
  const isActive = r => r.status !== 'noshow' && r.status !== 'cancelled';

  /* ---------- 예약 조회 링크 (C-07) ----------
   * 예약 완료 메일에 조회 링크(lookup?t=토큰)를 넣고, 링크만으로 예약을 보여 준다.
   * 프로토타입은 예약번호로 토큰을 흉내 내서 만든다 (같은 예약이면 늘 같은 값).
   * 실제 구현: 예약 저장 때 SecureRandom 128비트 이상 무작위 값을 만들어 예약.조회토큰(UK)에 저장,
   *            토큰_만료일시 = 방문일 다음 날 0시. 조회 전용이며 다른 용도로 쓰지 않는다. */
  function tokenOf(no) {
    const ABC = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let h = 2166136261, out = '';
    for (let i = 0; i < 22; i++) {
      for (const c of no + ':' + i) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
      out += ABC[h % ABC.length];
    }
    return out;
  }
  const byToken = t => (t ? reservations().find(r => tokenOf(r.no) === t) : null) || null;
  /* 방문일이 지나면 만료 (방문 당일까지 유효) */
  const tokenExpired = r => r.date < TODAY;
  const lookupUrl = no => url('lookup') + '?t=' + tokenOf(no);

  /* ---------- 좌석 규칙 (손님 추천 · 워크인 · 테이블 이동 공통) ----------
   * 좌석 수와 구역 인원 조건 위반이면 이유 문자열, 괜찮으면 null */
  function seatRule(t, party, fl) {
    if (t.seats < party) return `${t.seats}인 테이블이라 ${party}명은 앉을 수 없어요`;
    const z = zoneOf(t, fl);
    if (z && z.minParty && party < z.minParty) return `${z.name}은 ${z.minParty}명 이상만 받아요`;
    if (z && z.maxParty && party > z.maxParty) return `${z.name}은 ${z.maxParty}명까지만 받아요`;
    return null;
  }
  /* 같은 날 같은 테이블에서 이용 시간이 겹치는 유효 예약 (except: 자기 자신 예약번호) */
  function tableClash(tableId, date, time, list, except) {
    const dine = store().dineMinutes;
    return list.find(r => r.no !== except && isActive(r) && r.table === tableId && r.date === date && Math.abs(toMin(r.time) - toMin(time)) < dine) || null;
  }

  /* ---------- 날짜 / 시간 ---------- */
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toHHMM = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  const iso = dt => dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  function fmtDate(s, opt) {
    const dt = parseDate(s), w = WEEK[dt.getDay()];
    if (opt === 'long') return `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${w}요일`;
    if (opt === 'short') return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${w})`;
    return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())} (${w})`;
  }
  /* 2026년 10월 1일 ~ 31일, 오늘(10/5) 이전은 선택 불가 */
  function octoberDays() {
    const out = [], last = new Date(YEAR, MONTH, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const s = `${YEAR}-${pad(MONTH)}-${pad(d)}`, dt = parseDate(s);
      out.push({ iso: s, day: d, dow: dt.getDay(), week: WEEK[dt.getDay()], past: s < TODAY, today: s === TODAY });
    }
    return out;
  }
  /* 오픈 ~ 마감 30분 전까지 30분 단위, 브레이크는 선택 불가 (기본 11:30–21:30, 브레이크 15:00–17:00) */
  function slots() {
    const h = store().hours, out = [];
    for (let m = toMin(h.open); m < toMin(h.close); m += 30) {
      const br = m >= toMin(h.breakStart) && m < toMin(h.breakEnd);
      out.push({ time: toHHMM(m), break: br, period: m < toMin(h.breakStart) ? 'lunch' : (br ? 'break' : 'dinner') });
    }
    return out;
  }
  function timeCheck(time) {
    const h = store().hours, m = toMin(time);
    if (m < toMin(h.open) || m >= toMin(h.close)) return { ok: false, reason: `영업시간(${h.open}–${h.close}) 밖이에요` };
    if (m >= toMin(h.breakStart) && m < toMin(h.breakEnd)) return { ok: false, reason: `${h.breakStart}–${h.breakEnd}은 브레이크 타임이에요` };
    return { ok: true };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(msg) {
    let box = document.querySelector('.toast-box');
    if (!box) { box = document.createElement('div'); box.className = 'toast-box'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2400); setTimeout(() => el.remove(), 2800);
  }

  /* ---------- 진단 표시 (?debug) ----------
   * 실제 휴대폰에서만 생기는 문제를 보기 위한 것. 브라우저 정보, 불러온 CSS · JS 주소, 오류를 화면에 띄운다 */
  const ERRS = [];
  addEventListener('error', e => { ERRS.push((e.message || 'error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); paintDebug(); });
  addEventListener('unhandledrejection', e => { ERRS.push('promise: ' + (e.reason && e.reason.message || e.reason)); paintDebug(); });
  let dbg = null;
  function showDebug() {
    dbg = document.createElement('pre');
    dbg.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top, 0px));z-index:99;max-height:32vh;pointer-events:none;opacity:.92;overflow:auto;margin:0;padding:10px;font:11px/1.4 monospace;white-space:pre-wrap;word-break:break-all;background:rgba(16,43,59,.94);color:#e6eef2;border-radius:10px';
    document.body.appendChild(dbg); paintDebug();
    setInterval(paintDebug, 1500);
  }
  function paintDebug() {
    if (!dbg) return;
    const files = [...document.querySelectorAll('link[rel=stylesheet],script[src]')].map(el => (el.href || el.src).split('/').pop()).filter(x => /\.(css|js)/.test(x));
    const full = document.querySelector('.seat-full');
    dbg.textContent = [
      'UA: ' + navigator.userAgent,
      'viewport: ' + innerWidth + 'x' + innerHeight + ' · dpr ' + devicePixelRatio,
      'files: ' + files.join(', '),
      'supports inset/dvh: ' + CSS.supports('inset', '0') + ' / ' + CSS.supports('height', '100dvh'),
      full ? 'seat-full: hidden=' + full.hidden + ' position=' + getComputedStyle(full).position + ' top=' + Math.round(full.getBoundingClientRect().top) : 'seat-full: (없음)',
      'errors: ' + (ERRS.length ? '\n - ' + ERRS.join('\n - ') : '없음')
    ].join('\n');
  }

  /* ---------- 화면 목록 바 ---------- */
  const SCREENS = [
    ['index', 'C-01', '매장 입장'], ['reserve', 'C-03', '좌석도 선택 · AI 채팅'], ['confirm', 'C-04/05', '정보·확인'],
    ['complete', 'C-06', '예약 완료'], ['lookup', 'C-07', '비회원 조회'], ['owner-login', 'A-01', '점주·관리자 로그인'],
    ['owner-dashboard', 'O-02', '점주 대시보드'], ['owner-guests', 'O-05', '손님 배정'], ['owner-editor', 'O-03', '좌석도 편집'], ['owner-settings', 'O-04', '운영 조건']
  ];
  SCREENS.push(['admin', 'A-02', '서비스 관리자']);
  document.addEventListener('DOMContentLoaded', () => {
    const cur = document.body.dataset.screen;
    const bar = document.createElement('div'); bar.className = 'proto-bar';
    bar.innerHTML = `<span class="proto-tag">화면 둘러보기</span><span class="proto-note">고객 · 점주 · 관리자 화면</span>
      <label class="proto-jump"><span class="sr-only">화면 이동</span><select id="proto-jump">${SCREENS.map(s => `<option value="${s[0]}" ${s[0] === cur ? 'selected' : ''}>${s[1]}  ${s[2]}</option>`).join('')}</select></label>`;
    document.body.prepend(bar);
    if (/[?&]debug\b/.test(location.search)) showDebug();
    /* 발표용 화면 구성도 패널 (static/js/screen-map.js) */
    const sm = document.createElement('script');
    sm.src = document.body.dataset.server === 'true' ? '/js/screen-map.js?v=20261025a' : '../'.repeat(Number(document.body.dataset.depth || 0) + 1) + 'static/js/screen-map.js?v=20261025a';
    document.body.appendChild(sm);
    /* 매장 입장 화면의 영업시간 표시도 운영 조건을 따른다 */
    const ho = document.getElementById('h-open'), hb = document.getElementById('h-break'), h = store().hours;
    if (ho) ho.textContent = `${h.open} – ${h.close}`;
    if (hb) hb.textContent = h.breakStart === h.breakEnd ? '없음' : `${h.breakStart} – ${h.breakEnd}`;
    bar.querySelector('#proto-jump').addEventListener('change', e => go(e.target.value));
    document.querySelectorAll('[data-go]').forEach(a => {
      if (a.tagName === 'A') a.setAttribute('href', url(a.dataset.go));
      else a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.go); });
    });
  });

  return { YEAR, MONTH, TODAY, NOW, store, saveStore, resetStore, floors, allTables, findTable, zoneOf, url, go, draft, saveDraft,
    guestNo, reservations, updateReservation, addReservation, removeReservation, resetReservations, isActive, tokenOf, byToken, tokenExpired, lookupUrl, seatRule, tableClash, sget, sset, pad, toMin, toHHMM, parseDate, iso, fmtDate, octoberDays, slots, timeCheck, esc, toast };
})();
