/* =========================================================
 * C-AI 채팅 예약 (좌석 선택 화면 팝업)
 * 화면 확인용: 서버 없이 규칙 기반 추출기(mockExtract)로 흉내 낸다.
 * 실제 서비스의 AI 해석 기본값은 로컬 LLM(Ollama)이고, 외부 API는 점주가 고를 때만 쓴다.
 * 실제 구현: POST /api/chat/extract  { message, context } -> { date, time, party, requests[] }
 * 원칙: 정해진 항목만 채우고, 없는 정보는 지어내지 않으며, 배정은 하지 않는다.
 * ========================================================= */
(function () {
  const $ = s => document.querySelector(s);
  const pop = $('#chat-pop'), fab = $('#ai-fab'), body = $('#chat-body'), input = $('#chat-text');
  if (!pop || !fab) return;
  const st = BT.store();
  /* 운영 조건의 AI 설정: 사용 안 함이면 채팅 버튼을 숨기고, 2단계 해석기 이름을 설정에 맞춘다 */
  if (st.ai === 'off') { fab.hidden = true; return; }
  const LLM = st.ai === 'external' || st.ai === 'openai' ? '외부 API' : '로컬 LLM';
  const LLM_BY = LLM === '외부 API' ? '외부 API가' : '로컬 LLM이';
  const slot = { date: null, time: null, party: null, requests: [], prefs: [] };
  let misses = 0, greeted = false;

  const SUGGEST = ['이번 토요일 저녁 7시쯤 4명이고 아이 의자가 필요해요', '내일 점심 12시 반 둘이요, 창가 자리', '10월 17일 6명 2층 룸', '오늘 3시에 2명', '금요일 퇴근하고 커플로 갈게요'];

  /* ---------- 열기 / 닫기 ---------- */
  function open() {
    pop.hidden = false; fab.setAttribute('aria-expanded', 'true');
    if (!greeted) {
      greeted = true;
      bot('안녕하세요, 바로키친 성수점 예약 도우미예요.\n원하시는 날짜, 시간, 인원을 편하게 적어 주세요. 10월 중 예약할 수 있어요.');
    }
    setTimeout(() => input.focus(), 50);
  }
  function close() { pop.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
  fab.addEventListener('click', () => (pop.hidden ? open() : close()));
  $('#chat-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) close(); });
  $('#chat-suggest').innerHTML = SUGGEST.map(s => `<button type="button">${BT.esc(s)}</button>`).join('');
  $('#chat-suggest').querySelectorAll('button').forEach(b => b.addEventListener('click', () => send(b.textContent)));

  /* ---------- 메시지 ---------- */
  function add(el) { body.appendChild(el); body.scrollTop = body.scrollHeight; return el; }
  function bot(text, cls) { const el = document.createElement('div'); el.className = 'msg bot ' + (cls || ''); el.textContent = text; return add(el); }
  function user(text) { const el = document.createElement('div'); el.className = 'msg user'; el.textContent = text; return add(el); }

  $('#chat-form').addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (v) send(v); });

  function send(text) {
    input.value = '';
    user(text);
    const typing = bot('정리하는 중…', 'typing');
    setTimeout(() => { typing.remove(); handle(text); }, 450);
  }

  /* ---------- 하이브리드 해석 ----------
   * 1단계 규칙 파서(mockExtract): 모든 문장을 먼저 정규식으로 읽는다.
   * 2단계 로컬 LLM(mockLocalLLM): 1단계 뒤에도 날짜·시간·인원 중 빈 칸이 남을 때만 부른다.
   * 테이블 선정은 어느 단계에서도 하지 않는다. */

  /* ---------- 1단계: 규칙 파서 ---------- */
  const NUM = { '한': 1, '혼자': 1, '두': 2, '둘': 2, '세': 3, '셋': 3, '네': 4, '넷': 4, '다섯': 5, '여섯': 6, '일곱': 7, '여덟': 8, '아홉': 9, '열': 10, '열한': 11, '열두': 12 };
  const DOW = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
  const REQ = [
    [/아이\s*의자|유아\s*의자|아기\s*의자|하이\s*체어/, '아이 의자'],
    [/창가|창문/, '창가 자리', '창가'],
    [/조용/, '조용한 자리', '조용함'],
    [/2\s*층|이층/, '2층 선호', '2층'],
    [/1\s*층|일층/, '1층 선호', '1층'],
    [/룸|단체실|프라이빗/, '룸 선호', '룸'],
    [/테라스|야외/, '테라스 선호', '야외'],
    [/바\s*(좌석|자리|석)|카운터/, '바 좌석', '바'],
    [/휠체어/, '휠체어 이용'],
    [/유모차/, '유모차 보관'],
    [/생일|기념일/, '기념일'],
    [/알레르기|알러지/, '알레르기 (매장 확인 필요)']
  ];

  function mockExtract(raw) {
    let s = ' ' + raw.replace(/\s+/g, ' ') + ' ';
    const out = { problems: [] };
    const cut = re => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };

    // 개인정보는 추출하지 않는다
    if (cut(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/)) out.phone = true;
    cut(/[\w.+-]+@[\w-]+\.[\w.]+/) && (out.phone = true);

    // ----- 날짜 -----
    const monday = BT.parseDate(BT.TODAY); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    let m;
    const setMD = (mo, d) => {
      if (mo !== BT.MONTH) { out.problems.push({ k: 'date', msg: `${mo}월은 아직 예약을 받지 않아요. 10월 날짜로 알려 주세요.` }); return; }
      const last = new Date(BT.YEAR, BT.MONTH, 0).getDate();
      if (d < 1 || d > last) { out.problems.push({ k: 'date', msg: `10월 ${d}일은 없는 날짜예요.` }); return; }
      out.date = `${BT.YEAR}-${BT.pad(mo)}-${BT.pad(d)}`;
    };
    if ((m = cut(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) setMD(+m[1], +m[2]);
    else if ((m = cut(/(?:^|\s)(\d{1,2})[\/.](\d{1,2})(?=\s|$|[^\d])/))) setMD(+m[1], +m[2]);
    else if ((m = cut(/오늘|내일|낼|모레|글피/))) {
      const add = { '오늘': 0, '내일': 1, '낼': 1, '모레': 2, '글피': 3 }[m[0]];
      const dt = BT.parseDate(BT.TODAY); dt.setDate(dt.getDate() + add);
      setMD(dt.getMonth() + 1, dt.getDate());
    } else if ((m = s.match(/(이번\s*주?|다음\s*주|담주|다다음\s*주)?\s*(주말|[월화수목금토일])(요일|욜)/) || s.match(/(이번\s*주?|다음\s*주|담주|다다음\s*주)?\s*(주말)()/)) && cut(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) {
      const idx = m[2] === '주말' ? 5 : DOW[m[2]];
      const dt = new Date(monday); dt.setDate(monday.getDate() + idx);
      const w = (m[1] || '').replace(/\s/g, '');
      if (w === '다음주' || w === '담주') dt.setDate(dt.getDate() + 7);
      else if (w === '다다음주') dt.setDate(dt.getDate() + 14);
      else if (BT.iso(dt) < BT.TODAY) dt.setDate(dt.getDate() + 7);
      setMD(dt.getMonth() + 1, dt.getDate());
    } else if ((m = cut(/(\d{1,2})\s*일(?!요)/))) setMD(BT.MONTH, +m[1]);
    if (out.date && out.date < BT.TODAY) { out.problems.push({ k: 'date', msg: `${BT.fmtDate(out.date, 'short')}은 이미 지난 날짜예요.` }); delete out.date; }

    // ----- 시간 -----
    const q = { am: /오전|아침/.test(s), pm: /오후|저녁|밤/.test(s), lunch: /점심|낮/.test(s) };
    let h = null, min = 0;
    if ((m = cut(/(\d{1,2}):(\d{2})/))) { h = +m[1]; min = +m[2]; }
    else if ((m = cut(/(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/))) { h = +m[1]; min = m[2] === '반' ? 30 : (m[3] ? +m[3] : 0); }
    else if ((m = cut(/(열한|열두|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*시\s*(반)?/))) { h = NUM[m[1]]; min = m[2] ? 30 : 0; }
    if (h !== null) {
      if (q.am) { if (h === 12) h = 0; }
      else if (q.pm) { if (h < 12) h += 12; }
      else if (q.lunch) { if (h <= 5) h += 12; }
      else if (h >= 1 && h <= 10) h += 12; // "7시" → 저녁 7시 로 해석 (식당 영업시간 기준)
      if (min < 15) min = 0; else if (min < 45) min = 30; else { min = 0; h += 1; }
      const t = BT.pad(h % 24) + ':' + BT.pad(min);
      const c = BT.timeCheck(t, st);
      if (c.ok) out.time = t;
      else out.problems.push({ k: 'time', msg: `${t}은 예약할 수 없어요. ${c.reason}.\n점심 ${st.hours.open}–${prevSlot(st.hours.breakStart)}, 저녁 ${st.hours.breakEnd}–${prevSlot(st.hours.close)} 중에서 골라 주세요.` });
    } else if (q.lunch) out.timeHint = 'lunch';
    else if (q.pm) out.timeHint = 'dinner';

    // ----- 인원 -----
    if ((m = cut(/(\d{1,2})\s*(명|인|분|사람)/))) out.party = +m[1];
    else if ((m = cut(/(혼자)|(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(명|분|사람)/))) out.party = NUM[m[1] || m[2]];
    else if ((m = cut(/(둘|셋|넷)(이서|이요|이에요|이|\s|$)/))) out.party = NUM[m[1]];
    if (out.party != null && (out.party < st.minParty || out.party > st.maxParty)) {
      out.problems.push({ k: 'party', msg: `${out.party}명은 온라인 예약 범위(${st.minParty}–${st.maxParty}명)를 벗어나요. ${st.maxParty}명 초과는 매장으로 문의해 주세요.` });
      delete out.party;
    }

    // ----- 요청사항 (정해진 목록만) -----
    out.requests = []; out.prefs = [];
    REQ.forEach(([re, label, pref]) => { if (re.test(raw)) { out.requests.push(label); if (pref) out.prefs.push(pref); } });
    return out;
  }
  function prevSlot(t) { return BT.toHHMM(BT.toMin(t) - (st.slotMinutes || 30)); }

  /* ---------- 2단계: 로컬 LLM (프로토타입: 고정 응답) ----------
   * 실제 구현: 서버가 Ollama 소형 모델에 문장과 빈 항목을 넘기고 { date, time, party } JSON만 받는다.
   * 받은 값은 규칙 파서 결과와 똑같이 코드로 다시 검사한다(10월 여부, 영업시간, 인원 범위).
   * 여기서는 서버가 없으므로 아래 표에 있는 문장만 정해진 값을 돌려주고, 나머지는 빈 응답으로 둔다. */
  const LLM_FIXED = {
    '금요일 퇴근하고 커플로 갈게요': { party: 2 }
  };
  function mockLocalLLM(raw, keys) {
    const res = LLM_FIXED[raw.trim()] || {};
    const out = {};
    keys.forEach(k => { if (res[k] != null) out[k] = res[k]; });
    if (out.date && (out.date < BT.TODAY || +out.date.slice(5, 7) !== BT.MONTH)) delete out.date;
    if (out.time && !BT.timeCheck(out.time, st).ok) delete out.time;
    if (out.party != null && (out.party < st.minParty || out.party > st.maxParty)) delete out.party;
    return out;
  }

  /* ---------- 대화 처리 ---------- */
  let via = 'rule';
  function handle(text) {
    const r = mockExtract(text);
    // 규칙 파서가 읽었지만 값이 잘못된 항목은 LLM에 다시 묻지 않는다
    const gaps = ['date', 'time', 'party'].filter(k => slot[k] == null && r[k] == null && !r.problems.some(p => p.k === k));
    via = gaps.length ? 'llm' : 'rule';
    if (gaps.length) Object.assign(r, mockLocalLLM(text, gaps));
    if (r.phone) bot('연락처나 이메일은 채팅에 저장하지 않아요. 다음 단계 입력칸에서 따로 받을게요.', 'warn');
    let got = false;
    ['date', 'time', 'party'].forEach(k => { if (r[k] != null) { slot[k] = r[k]; got = true; } });
    // 오늘은 기준 시각(BT.NOW) 이후만 받는다
    if (slot.date === BT.TODAY && slot.time && BT.toMin(slot.time) <= BT.toMin(BT.NOW)) { bot(`오늘은 ${BT.NOW} 이후로만 예약할 수 있어요. 다른 시간을 알려 주세요.`, 'warn'); slot.time = null; got = true; }
    r.requests.forEach(x => { if (!slot.requests.includes(x)) { slot.requests.push(x); got = true; } });
    r.prefs.forEach(x => { if (!slot.prefs.includes(x)) slot.prefs.push(x); });
    r.problems.forEach(p => { bot(p.msg, 'warn'); got = true; });

    if (!got && !r.phone) {
      misses++;
      if (misses >= 2) { fallback(); return; }
      bot((via === 'llm' ? `규칙 파서와 ${LLM} 모두 예약 정보를 찾지 못했어요.` : '죄송해요, 예약 정보를 찾지 못했어요.') + '\n"10월 10일 저녁 7시 4명"처럼 날짜·시간·인원을 알려 주세요.');
      return;
    }
    misses = 0;
    const missing = ['date', 'time', 'party'].filter(k => slot[k] == null);
    card(missing);
    if (missing.length) {
      const k = missing[0];
      if (k === 'date') bot('언제 방문하실까요? 10월 중 날짜로 알려 주세요.');
      if (k === 'time' && slot.date === BT.TODAY) bot(`오늘은 ${BT.toHHMM(BT.toMin(BT.NOW) + (st.slotMinutes || 30))}–${prevSlot(st.hours.close)} 사이에 예약돼요. 몇 시쯤 오실까요?`);
      else if (k === 'time') bot(r.timeHint === 'lunch' ? `점심은 ${st.hours.open}–${prevSlot(st.hours.breakStart)} 사이에 예약돼요. 몇 시쯤 오실까요?`
        : r.timeHint === 'dinner' ? `저녁은 ${st.hours.breakEnd}–${prevSlot(st.hours.close)} 사이에 예약돼요. 몇 시쯤 오실까요?`
        : `몇 시쯤 오실까요? 점심 ${st.hours.open}–${prevSlot(st.hours.breakStart)}, 저녁 ${st.hours.breakEnd}–${prevSlot(st.hours.close)} 사이로 골라 주세요.`);
      if (k === 'party') bot('몇 분이 오시나요?');
    }
  }

  function card(missing) {
    const done = !missing.length;
    const el = document.createElement('div'); el.className = 'extract';
    const cell = (label, val) => `<div class="extract-cell ${val == null ? 'missing' : ''}"><span>${label}</span><b>${val == null ? '확인 필요' : BT.esc(val)}</b></div>`;
    el.innerHTML = `
      <div class="row" style="justify-content:space-between"><b style="font-size:13.5px">${done ? '예약 정보를 정리했어요' : '지금까지 정리한 내용'}</b><span class="badge badge-indigo">정해진 항목만 추출</span></div>
      <div class="row"><span class="badge ${via === 'llm' ? 'badge-amber' : 'badge-teal'}" title="${via === 'llm' ? '규칙으로 읽지 못한 항목을 ' + LLM + '에 맡겼어요' : '규칙 파서만으로 읽었어요'}">${via === 'llm' ? LLM_BY + ' 해석' : '규칙 파서로 해석'}</span></div>
      <div class="extract-grid">
        ${cell('날짜', slot.date ? BT.fmtDate(slot.date) : null)}
        ${cell('시간', slot.time)}
        ${cell('인원', slot.party ? slot.party + '명' : null)}
        <div class="extract-cell"><span>요청사항</span><b>${slot.requests.length ? BT.esc(slot.requests.join(', ')) : '없음'}</b></div>
      </div>`;
    if (done) el.insertAdjacentHTML('beforeend', `<p class="hint">확인 후 좌석도에서 테이블을 직접 고릅니다.</p>
      <div class="form-row"><button type="button" class="btn btn-primary btn-sm" data-act="go">예약 계속하기</button><button type="button" class="btn btn-ghost btn-sm" data-act="edit">수정하기</button></div>`);
    add(el);
    const go = el.querySelector('[data-act="go"]');
    if (go) go.addEventListener('click', () => {
      window.ReservePage.apply({ date: slot.date, time: slot.time, party: slot.party, request: slot.requests.join(', '), prefs: slot.prefs.slice() });
      bot('좌석도에 조건을 적용했어요. 테이블을 직접 골라 주세요.');
      close();
      BT.toast('AI가 정리한 조건을 좌석도에 적용했어요');
    });
    const ed = el.querySelector('[data-act="edit"]');
    if (ed) ed.addEventListener('click', () => { bot('바꿀 내용을 알려 주세요. 예) "5명으로", "8시로", "다음 주 금요일"'); input.focus(); });
  }

  function fallback() {
    misses = 0;
    const el = document.createElement('div'); el.className = 'extract';
    el.innerHTML = `<b style="font-size:13.5px">요청을 이해하지 못했어요</b><p class="hint">채팅 대신 화면에서 날짜·시간·인원을 직접 고를 수 있어요.</p>
      <button type="button" class="btn btn-ghost btn-sm">일반 예약 화면으로</button>`;
    add(el);
    el.querySelector('button').addEventListener('click', () => { close(); document.querySelector('#date-strip').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }

  window.BTChat = { mockExtract, mockLocalLLM, open };
})();
