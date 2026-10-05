/* =========================================================
 * 화면 구성도 패널 (발표용)
 * 상단 PAGE TEST 바의 "화면 구성도" 버튼 또는 M 키로 연다.
 *  - 전체 흐름: 손님 / 점주 / 관리자 화면이 어떻게 이어지는지, 지금 화면 강조, 누르면 이동
 *  - 이 화면 구성: 영역별 번호와 설명, 실제 화면 위에 같은 번호 표시
 *  - 화면 사이 데이터 연결: 한 화면에서 바꾼 것이 어디에 반영되는지
 *  - 휴대폰 탭: 지금 화면을 390 x 844 휴대폰 틀 안에 같이 띄우고, 미리보기 주소 QR(크게 보기)을 보여 준다
 * 열림 상태 · 탭 · 번호 표시 여부는 sessionStorage('bt.smap')에 남아 화면을 옮겨도 유지된다.
 * common.js가 모든 화면에서 이 파일을 불러온다. 실제 서비스 화면에는 넣지 않는다.
 * ========================================================= */
(function () {
  /* 휴대폰 틀 안에 띄운 화면에서는 패널을 만들지 않는다 (틀 안에 패널이 또 열리는 것 방지) */
  if (window.self !== window.top) {
    /* 휴대폰 틀 안에서는 실제 휴대폰처럼 스크롤바를 숨긴다 */
    const st = document.createElement('style');
    st.textContent = 'html{scrollbar-width:none}html::-webkit-scrollbar{display:none}';
    document.head.appendChild(st);
    return;
  }
  const PREVIEW_URL = 'https://aceoberon.github.io/barotable-pagetest/';
  const PHONE = { w: 390, h: 844 };
  const FB = {
    1: '피드백 1 · 규칙 파서 → 로컬 LLM',
    2: '피드백 2 · 테이블은 규칙 엔진',
    3: '피드백 3 · 채팅 팝업 · 층별 구역'
  };
  /* [선택자, 제목, 설명, 관련 피드백 번호] */
  const SCREENS = {
    'index': { code: 'C-01', name: '매장 입장', who: '손님', purpose: '매장 정보를 보고 새 예약이나 예약 조회로 들어갑니다. 회원가입 없이 전화번호로 예약합니다.', regions: [
      ['.hero-store', '매장 정보', '영업시간과 브레이크는 운영 조건(O-04) 값을 그대로 보여 줍니다.'],
      ['section[aria-labelledby="guest-title"]', '예약 시작', '전화번호(첫 방문은 이름도)를 받고 새 예약 또는 예약 조회로 이동합니다.']
    ]},
    'reserve': { code: 'C-03', name: '좌석 선택 · AI 채팅', who: '손님', purpose: '날짜·시간·인원을 고르고 실제 좌석도에서 테이블을 직접 고릅니다. 채팅은 이 화면의 팝업입니다.', regions: [
      ['nav[aria-label="예약 단계"]', '예약 단계', '좌석 선택 → 정보 확인 → 완료 3단계 중 현재 위치.'],
      ['#date-strip', '날짜', '10월만 예약. 지난 날짜는 막힙니다.'],
      ['#time-groups', '시간', '영업시간 안 30분 단위. 브레이크와 오늘 지난 시간은 고를 수 없습니다.'],
      ['.cond .stepper', '인원', '운영 조건의 최소~최대 인원 안에서만 바뀝니다.'],
      ['section[aria-label="좌석도"]', '층별 좌석도', '층 탭과 구역 필터로 나눠 봅니다. 같은 시간대에 이용 시간이 겹치는 예약이 있으면 빗금으로 막힙니다. "좌석도 크게 보기"로 전체 화면에서 확대해 고를 수 있습니다(휴대폰 뒤로가기로 닫힘).', 3],
      ['#sel-panel', '선택 · 추천 패널', '좌석 수 · 구역 인원 조건 · 시간 겹침을 통과한 자리 중 요청과 맞는 가장 작은 테이블을 추천합니다. 고르기 직전에 다시 검사합니다.', 2],
      ['#ai-fab', 'AI 채팅 버튼', '문장을 날짜·시간·인원·요청사항으로 정리만 합니다. 규칙 파서가 먼저 읽고, 못 읽은 부분만 로컬 LLM이 해석합니다.', 1],
      ['.seat-bar', '휴대폰 하단 바', '휴대폰에서만 보입니다. 추천·선택한 테이블과 "좌석도 크게" · "다음"을 화면 아래에 고정해 스크롤을 줄입니다.']
    ]},
    'confirm': { code: 'C-04/05', name: '정보 · 최종 확인', who: '손님', purpose: '예약자 정보와 개인정보 동의를 받고, 고른 테이블을 한 번 더 보여 줍니다.', regions: [
      ['section[aria-labelledby="info-title"]', '예약자 정보 · 동의', '이름·연락처는 첫 화면 값을 쓰고, 이메일과 요청사항을 받습니다. 수집 항목과 보관 기간을 밝힙니다.'],
      ['section[aria-labelledby="sum-title"]', '예약 내용 · 미니 좌석도', '고른 테이블을 좌석도에서 다시 보여 주고 예약을 확정합니다.']
    ]},
    'complete': { code: 'C-06', name: '예약 완료', who: '손님', purpose: '예약번호와 QR을 보여 주고 알림 안내를 합니다.', regions: [
      ['#done-card', '예약번호 · QR · 알림', '이메일 안내는 운영 조건의 알림 설정을 따릅니다.'],
      ['section[aria-labelledby="lk-title"]', '조회 링크', '예약마다 무작위 토큰이 든 조회 링크를 메일로 보냅니다. 링크는 방문일이 지나면 만료됩니다.']
    ]},
    'lookup': { code: 'C-07', name: '비회원 조회 · 취소', who: '손님', purpose: '메일 속 조회 링크로 예약을 보여 주고 취소를 받습니다. 예약번호 + 연락처 조회는 보조로 남깁니다.', regions: [
      ['#lk-link', '조회 결과 · 취소', '링크 토큰이 맞고 만료 전이면 바로 보입니다. 예약 시간 전 확정 예약만 2단계 확인 뒤 취소됩니다.'],
      ['#lk-resend', '링크 다시 받기', '이메일을 넣으면 예약이 있든 없든 같은 안내를 보여 줍니다 (예약 여부 노출 방지).'],
      ['#lk-alt', '보조 조회', '예약번호 + 연락처 두 가지가 모두 맞아야 합니다.']
    ]},
    'owner-login': { code: 'A-01', name: '점주 · 관리자 로그인', who: '점주', purpose: '점주와 서비스 관리자가 같은 화면에서 역할을 골라 로그인합니다.', regions: [
      ['.card-dark', '안내', '점주 계정은 서비스 관리자 승인 뒤 사용합니다. 손님은 로그인하지 않습니다.'],
      ['#role-tabs', '역할 선택', '점주 / 서비스 관리자. 실제 구현은 Spring Security 역할로 나눕니다.'],
      ['#lg-go', '로그인', '역할에 따라 대시보드(O-02) 또는 관리자 화면(A-02)으로 갑니다.']
    ]},
    'owner-dashboard': { code: 'O-02', name: '점주 대시보드', who: '점주', purpose: '오늘 예약과 실제 좌석 상태를 한 화면에서 보고 처리합니다. 기준 시각은 19:00 고정입니다.', regions: [
      ['#owner-side', '점주 메뉴', '대시보드 · 손님 배정 · 좌석도 관리 · 운영 조건.'],
      ['#stats', '요약', '확정 · 방문 완료 · 대기 · 노쇼 건수.'],
      ['#timetable', '테이블별 시간표', '테이블 × 영업시간 축. 브레이크 빗금, 30분 이내 도착 강조. 블록을 누르면 그 예약을 선택합니다.'],
      ['section[aria-label="현재 좌석도"]', '현재 좌석도', '층별로 지금 앉은 손님 · 곧 도착 · 빈자리를 색으로 구분합니다.', 3],
      ['#list', '예약 목록', '상태 필터, 노쇼 이력 경고.'],
      ['#detail', '선택한 예약', '방문 완료, 노쇼 처리·되돌리기, 테이블 옮기기. 옮길 자리는 좌석 수 · 구역 조건 · 시간 겹침 규칙으로만 고릅니다.', 2],
      ['#walkin', '워크인 빠른 배정', '인원만 넣으면 지금부터 비어 있는 자리 중 가장 작은 테이블을 추천합니다.', 2]
    ]},
    'owner-guests': { code: 'O-05', name: '손님 배정', who: '점주', purpose: '예약 없이 온 손님(퀵 배정)과 전화 예약 손님을 자리에 배정합니다.', regions: [
      ['section[aria-label="배정 조건"]', '배정 조건', '방식(퀵 / 전화), 인원, 시간, 연락처. 전화 예약 시간은 브레이크와 지난 시간이 빠집니다.'],
      ['section[aria-label="좌석도"]', '배정 가능 좌석', '그 시간에 이용 시간이 겹치거나 조건이 안 맞는 자리는 막히고, 가장 작은 빈 테이블을 추천합니다.', 2],
      ['#timetable', '시간표', '점선 칸이 지금 배정하려는 자리와 시간입니다.'],
      ['#assign', '배정', '2단계 확인, 저장 직전 재검사. 배정 결과는 대시보드와 손님 좌석도에 반영됩니다.', 2],
      ['#history', '오늘 배정 목록', '배정 삭제 가능.']
    ]},
    'owner-editor': { code: 'O-03', name: '좌석도 편집', who: '점주', purpose: '층과 구역을 나누고 테이블·시설을 배치합니다. 저장하면 손님 좌석도에 그대로 쓰입니다.', regions: [
      ['section[aria-label="층 관리"]', '층 관리', '층 추가 · 이름 변경 · 삭제. 예약이 걸린 테이블이 있는 층은 지울 수 없습니다.', 3],
      ['.palette', '팔레트', '구역, 테이블(2·4·6인, 바, 룸), 시설(창문·벽·입구·주방·화장실·계단). 누르거나 끌어다 놓습니다.'],
      ['.ed-canvas', '캔버스', '끌어서 이동, 모서리로 크기, 45° 회전, 확대/축소. 테이블은 놓인 구역에 자동으로 묶입니다.', 3],
      ['#props', '속성', '번호 · 좌석 수 · 모양 · 태그. 예약이 걸린 테이블은 번호 변경과 삭제가 막힙니다.'],
      ['.ed-savebar', '저장 전 검사', '번호 중복은 오류, 겹침·구역 밖은 경고. 저장하면 손님 좌석도와 대시보드에 반영됩니다.']
    ]},
    'owner-settings': { code: 'O-04', name: '운영 조건', who: '점주', purpose: '예약 규칙의 기준값을 정합니다. 저장하면 손님 화면·채팅·손님 배정·대시보드가 모두 따릅니다.', regions: [
      ['section[aria-labelledby="s1"]', '영업시간 · 브레이크', '손님이 고를 수 있는 시간대가 여기서 정해집니다.'],
      ['section[aria-labelledby="s2"]', '인원 · 이용 시간 · 한도', '이용 시간은 자리 겹침 판단의 기준입니다.', 2],
      ['section[aria-labelledby="s3"]', '예약 방식 · 알림', '자리 직접 고르기를 끄면 규칙 엔진이 고른 자리로 자동 배정합니다.', 2],
      ['section[aria-labelledby="s4"]', 'AI 채팅 해석', '기본은 로컬 LLM, 외부 API는 선택, 끄면 채팅 버튼이 사라집니다.', 1],
      ['section[aria-label="저장"]', '저장 · 검사', '잘못된 값은 저장을 막고, 이미 잡힌 예약과 충돌하면 경고합니다.']
    ]},
    'admin': { code: 'A-02', name: '서비스 관리자', who: '관리자', purpose: '신규 점주 계정을 승인하고 서비스 상태를 봅니다.', regions: [
      ['#stats', '서비스 요약', '등록 매장 · 승인 대기 · 오늘 예약 · AI 해석 방식.'],
      ['#approvals', '점주 계정 승인', '상세를 보고 2단계 확인 뒤 승인합니다.'],
      ['#services', '서비스 상태', '웹 예약 · 좌석도 · AI 도우미 상태.'],
      ['#ai-box', 'AI 처리 방식', '매장 설정을 읽어 "규칙 파서 → 로컬 LLM"으로 표시합니다.', 1],
      ['#activity', '최근 활동', '승인하면 여기에 바로 추가됩니다.']
    ]}
  };
  const LANES = [
    ['손님', ['index', 'reserve', 'confirm', 'complete', 'lookup']],
    ['점주', ['owner-login', 'owner-dashboard', 'owner-guests', 'owner-editor', 'owner-settings']],
    ['관리자', ['owner-login', 'admin']]
  ];
  const LINKS = [
    ['O-03 좌석도 저장', 'C-03 · O-02 · O-05 좌석도'],
    ['O-04 운영 조건 저장', 'C-03 시간·인원 · 채팅 · O-05 · 시간표'],
    ['O-05 전화 예약 · O-02 테이블 이동 · C-07 취소', 'C-03 막힌 자리'],
    ['C-03 채팅 요청(창가·바 등)', 'C-03 좌석 추천'],
    ['A-02 점주 계정 승인', 'A-01 점주 로그인']
  ];

  const cur = document.body.dataset.screen, spec = SCREENS[cur];
  const KEY = 'bt.smap';
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = v => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const S = Object.assign({ open: false, marks: true, tab: 'map' }, load());
  const STATIC = document.body.dataset.server === 'true' ? '/' : '../'.repeat(Number(document.body.dataset.depth || 0) + 1) + 'static/';
  const esc = BT.esc;

  /* ---------- 패널 ---------- */
  const panel = document.createElement('aside');
  panel.className = 'smap'; panel.setAttribute('aria-label', '화면 구성도'); panel.hidden = true;
  const lane = ([who, keys]) => `<div class="smap-lane"><b>${who}</b>${keys.map(k => {
    const s = SCREENS[k];
    return `<button type="button" class="smap-node ${k === cur ? 'on' : ''}" data-go-screen="${k}" ${k === cur ? 'aria-current="page"' : ''}><span class="mono">${s.code}</span>${esc(s.name)}</button>`;
  }).join('<i class="smap-arrow" aria-hidden="true">↓</i>')}</div>`;
  panel.innerHTML = `
    <div class="smap-head">
      <div><span class="smap-eyebrow">화면 구성도</span><h2>${spec ? `<span class="mono">${spec.code}</span> ${esc(spec.name)}` : '바로테이블'}</h2></div>
      <button type="button" class="smap-x" aria-label="화면 구성도 닫기">×</button>
    </div>
    <div class="smap-tabs" role="tablist" aria-label="패널 보기">
      <button type="button" role="tab" data-tab="map">화면 구성</button>
      <button type="button" role="tab" data-tab="phone">휴대폰 · QR</button>
    </div>
    <div class="smap-body" data-pane="phone" hidden>
      <section>
        <h3>휴대폰 화면 <span class="smap-who">${PHONE.w} × ${PHONE.h}</span></h3>
        <div class="smap-phone-wrap"><div class="smap-phone"><iframe title="휴대폰 화면 미리보기" tabindex="0"></iframe></div></div>
        <div class="smap-row"><button type="button" class="smap-small" data-act="reload">지금 화면 다시 불러오기</button><span class="smap-who">틀 안에서 눌러 보며 시연할 수 있어요</span></div>
      </section>
      <section>
        <h3>휴대폰으로 직접 열기</h3>
        <div class="smap-qr-card">
          <img src="${STATIC}img/preview-qr.svg" alt="미리보기 주소 QR 코드" width="132" height="132">
          <div><p>휴대폰 카메라로 찍으면 미리보기가 열려요.</p><p class="mono smap-url">${PREVIEW_URL.replace('https://', '')}</p>
          <button type="button" class="smap-small" data-act="qr-big">QR 크게 보기</button></div>
        </div>
      </section>
    </div>
    <div class="smap-body" data-pane="map">
      ${spec ? `<section>
        <h3>이 화면 구성 <span class="smap-who">${esc(spec.who)} 화면</span></h3>
        <p class="smap-purpose">${esc(spec.purpose)}</p>
        <label class="smap-toggle"><input type="checkbox" id="smap-marks" ${S.marks ? 'checked' : ''}> 화면 위에 번호 표시</label>
        <ol class="smap-regions">${spec.regions.map(([sel, t, d, fb], i) => `
          <li data-i="${i}" tabindex="0"><span class="smap-num">${i + 1}</span><div><b>${esc(t)}</b><p>${esc(d)}</p>${fb ? `<span class="smap-fb">${FB[fb]}</span>` : ''}<span class="smap-hidden" hidden>지금은 화면에 보이지 않아요</span></div></li>`).join('')}</ol>
      </section>` : ''}
      <section>
        <h3>전체 화면 흐름 <span class="smap-who">누르면 이동</span></h3>
        <div class="smap-lanes">${LANES.map(lane).join('')}</div>
      </section>
      <section>
        <h3>화면 사이 데이터 연결</h3>
        <ul class="smap-links">${LINKS.map(([a, b]) => `<li><span>${esc(a)}</span><i aria-hidden="true">→</i><span>${esc(b)}</span></li>`).join('')}</ul>
      </section>
      <p class="smap-foot">M 키로 열고 닫습니다. 발표용 안내라 실제 서비스 화면에는 없습니다.</p>
    </div>`;
  document.body.appendChild(panel);

  /* ---------- 탭 · 휴대폰 화면 · QR ---------- */
  const frame = panel.querySelector('.smap-phone iframe'), phone = panel.querySelector('.smap-phone'), wrap = panel.querySelector('.smap-phone-wrap');
  function fitPhone() {
    if (panel.hidden || S.tab !== 'phone') return;
    const avW = wrap.clientWidth, avH = Math.max(320, innerHeight - wrap.getBoundingClientRect().top - 24);
    const k = Math.min(1, avW / (PHONE.w + 20), avH / (PHONE.h + 20));
    phone.style.transform = `translateX(-50%) scale(${k})`;
    wrap.style.height = Math.round((PHONE.h + 20) * k) + 'px';
  }
  function loadPhone(force) {
    const src = location.pathname + location.search;
    if (force || !frame.getAttribute('src')) frame.src = src;
  }
  function setTab(t) {
    S.tab = t; save(S);
    panel.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    panel.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t; });
    if (t === 'phone') { loadPhone(false); fitPhone(); }
    place();
  }
  panel.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  panel.querySelector('[data-act="reload"]').addEventListener('click', () => loadPhone(true));
  addEventListener('resize', fitPhone);

  /* 뒤쪽 자리에서도 찍을 수 있게 QR을 화면 가운데에 크게 */
  const big = document.createElement('div');
  big.className = 'smap-qr-big'; big.hidden = true;
  big.setAttribute('role', 'dialog'); big.setAttribute('aria-modal', 'true'); big.setAttribute('aria-label', '미리보기 QR 크게 보기');
  big.innerHTML = `<div class="smap-qr-big-card"><img src="${STATIC}img/preview-qr.svg" alt="미리보기 주소 QR 코드">
    <p>휴대폰 카메라로 찍어 직접 예약해 보세요</p><p class="mono">${PREVIEW_URL.replace('https://', '')}</p>
    <button type="button" class="smap-small" data-act="qr-close">닫기 (Esc)</button></div>`;
  document.body.appendChild(big);
  const closeBig = () => { big.hidden = true; panel.querySelector('[data-act="qr-big"]').focus(); };
  panel.querySelector('[data-act="qr-big"]').addEventListener('click', () => { big.hidden = false; big.querySelector('[data-act="qr-close"]').focus(); });
  big.querySelector('[data-act="qr-close"]').addEventListener('click', closeBig);
  big.addEventListener('click', e => { if (e.target === big) closeBig(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !big.hidden) closeBig(); });

  /* ---------- 화면 위 번호 표시 ---------- */
  const layer = document.createElement('div');
  layer.className = 'smap-layer'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const marks = spec ? spec.regions.map((r, i) => {
    const m = document.createElement('div'); m.className = 'smap-mark';
    m.innerHTML = `<span>${i + 1}</span>`; layer.appendChild(m); return m;
  }) : [];
  let raf = 0;
  function place() {
    raf = 0;
    if (!spec || panel.hidden || !S.marks || S.tab !== 'map') { layer.hidden = true; return; }
    layer.hidden = false;
    spec.regions.forEach(([sel], i) => {
      const el = document.querySelector(sel), m = marks[i];
      const r = el && el.getBoundingClientRect();
      const shown = !!(r && r.width && r.height && !el.closest('[hidden]'));
      m.hidden = !shown;
      const hint = panel.querySelector(`li[data-i="${i}"] .smap-hidden`);
      if (hint) hint.hidden = shown;
      if (!shown) return;
      m.style.cssText = `top:${r.top + scrollY}px;left:${r.left + scrollX}px;width:${r.width}px;height:${r.height}px`;
    });
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
  addEventListener('scroll', queue, true); addEventListener('resize', queue);
  /* 화면 내용이 다시 그려지면 위치를 다시 잡는다. 패널과 번호 표시 자체의 변화는 무시 */
  new MutationObserver(muts => { if (muts.some(m => !layer.contains(m.target) && !panel.contains(m.target))) queue(); })
    .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });

  /* ---------- 열기 / 닫기 ---------- */
  function setOpen(v) {
    S.open = v; save(S);
    panel.hidden = !v; document.body.classList.toggle('smap-open', v);
    if (btn) { btn.setAttribute('aria-pressed', v); btn.classList.toggle('on', v); }
    place(); setTimeout(place, 60);
    if (v && S.tab === 'phone') { loadPhone(false); setTimeout(fitPhone, 60); }
  }
  const bar = document.querySelector('.proto-bar');
  let btn = null;
  if (bar) {
    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'proto-reset smap-btn'; btn.textContent = '화면 구성도';
    btn.title = '화면 구성도 열기/닫기 (M)';
    btn.addEventListener('click', () => setOpen(panel.hidden));
    bar.insertBefore(btn, bar.querySelector('.proto-jump'));
  }
  panel.querySelector('.smap-x').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => {
    if ((e.key === 'm' || e.key === 'M' || e.key === 'ㅡ') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      e.preventDefault(); setOpen(panel.hidden);
    }
  });
  panel.querySelectorAll('[data-go-screen]').forEach(b => b.addEventListener('click', () => { if (b.dataset.goScreen !== cur) BT.go(b.dataset.goScreen); }));
  const mk = panel.querySelector('#smap-marks');
  if (mk) mk.addEventListener('change', () => { S.marks = mk.checked; save(S); place(); });
  /* 목록 항목을 가리키면 해당 영역 강조, 누르면 그 영역으로 스크롤 */
  panel.querySelectorAll('.smap-regions li').forEach(li => {
    const i = +li.dataset.i, hot = v => { if (marks[i]) marks[i].classList.toggle('hot', v); li.classList.toggle('hot', v); };
    li.addEventListener('mouseenter', () => hot(true)); li.addEventListener('mouseleave', () => hot(false));
    li.addEventListener('focus', () => hot(true)); li.addEventListener('blur', () => hot(false));
    const go = () => {
      const el = document.querySelector(spec.regions[i][0]);
      if (!el) return;
      el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      if (marks[i]) { marks[i].classList.remove('pulse'); void marks[i].offsetWidth; marks[i].classList.add('pulse'); }
    };
    li.addEventListener('click', go);
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  setTab(S.tab === 'phone' ? 'phone' : 'map');
  setOpen(!!S.open);
})();
