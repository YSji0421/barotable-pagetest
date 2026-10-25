/* O-05 손님 배정 (v2 프로토타입의 "손님 배정"을 옮김)
 * 퀵 배정: 예약 없이 온 손님을 기준 시각(BT.NOW)으로 바로 앉힌다.
 * 전화 예약: 방문 예정 시간을 고르고 연락처를 받아 자리를 잡아 둔다.
 * v2와 다른 점
 *  - 테이블이 비었는지는 고정 목록이 아니라 그 시간 전후 이용 시간이 겹치는지로 판단 (BT.tableClash)
 *  - 전화 예약 시간은 영업시간 안이면서 브레이크가 아닌 슬롯만 고를 수 있다 (v2 버그 수정)
 *  - 인원 · 구역 조건은 손님 화면과 같은 규칙(BT.seatRule), 추천은 조건을 통과한 가장 작은 테이블
 *  - 저장 직전에 같은 검사를 한 번 더 한다
 */
(function () {
  const $ = s => document.querySelector(s);
  const fl = BT.floors(), st = BT.store(), TODAY = BT_DATA.OWNER_TODAY, NOW = BT.toMin(BT.NOW);
  const S = { mode: 'quick', party: 2, time: null, floor: fl[0].id, table: null, confirm: false, del: null };
  const PHONE = /^01[016789]\d{7,8}$/;

  const RES = () => BT.reservations().filter(r => r.date === TODAY);
  const phoneSlots = () => BT.slots().filter(x => !x.break && BT.toMin(x.time) > NOW);
  const atTime = () => S.mode === 'quick' ? BT.NOW : S.time;
  const slotFull = (time, list) => list.filter(r => BT.isActive(r) && r.time === time).length >= st.slotLimit;
  const where = t => { const z = BT.zoneOf(t, fl); return `${t.seats}인 · ${BT.esc(t.floorName)} ${BT.esc(z ? z.name : '')}`; };
  const digits = s => String(s || '').replace(/\D/g, '');
  const fmtPhone = d => d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;

  /* 테이블 상태: 배정 불가면 이유, 가능하면 null */
  function block(t, list) {
    const rule = BT.seatRule(t, S.party, fl);
    if (rule) return { cls: 'rule', sub: '조건 안 맞음', why: rule };
    if (!atTime()) return { cls: 'rule', sub: '시간 없음', why: '오늘은 더 받을 수 있는 예약 시간이 없어요' };
    const c =BT.tableClash(t.id, TODAY, atTime(), list);
    if (c) return { cls: 'reserved', sub: c.status === 'visited' ? '이용 중' : `${c.time} 예약`, why: `${c.time}에 ${c.walkin ? '배정된' : '예약된'} 손님(${c.party}명)과 이용 시간이 겹쳐요` };
    return null;
  }
  const recommend = list => BT.allTables(fl).filter(t => !block(t, list)).sort((a, b) => a.seats - b.seats || a.id.localeCompare(b.id))[0] || null;

  /* 저장 직전 재검사. 문제가 있으면 이유 */
  function recheck(t, list) {
    const b = block(t, list);
    if (b) return b.why;
    if (S.mode === 'phone') {
      if (!S.time) return '방문 시간을 골라 주세요';
      const tc = BT.timeCheck(S.time);
      if (!tc.ok) return tc.reason;
      if (BT.toMin(S.time) <= NOW) return '이미 지난 시간이에요';
      if (slotFull(S.time, list)) return `${S.time}은 시간대별 예약 한도(${st.slotLimit}팀)가 찼어요`;
      if (!PHONE.test(digits($('#g-phone').value))) return '전화번호를 010-0000-0000 형식으로 입력해 주세요';
    }
    return null;
  }

  function render() {
    const list = RES();
    const slots = phoneSlots();
    if (S.mode === 'phone' && (!S.time || !slots.some(x => x.time === S.time))) S.time = (slots.find(x => !slotFull(x.time, list)) || slots[0] || {}).time || null;
    const rec = atTime() ? recommend(list) : null;

    /* 조건 */
    document.querySelectorAll('#mode-tabs .tab').forEach(b => { const on = b.dataset.mode === S.mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $('#g-val').textContent = S.party + '명';
    $('#g-minus').disabled = S.party <= st.minParty;
    $('#g-plus').disabled = S.party >= st.maxParty;
    $('#g-time-now').hidden = S.mode !== 'quick';
    $('#g-time').hidden = S.mode !== 'phone';
    $('#g-phone-row').hidden = S.mode !== 'phone';
    if (S.mode === 'phone') {
      $('#g-time').innerHTML = slots.map(x => `<option value="${x.time}" ${x.time === S.time ? 'selected' : ''} ${slotFull(x.time, list) ? 'disabled' : ''}>${x.time}${slotFull(x.time, list) ? ' (마감)' : ''}</option>`).join('');
      $('#g-time-hint').textContent = `오늘 ${BT.NOW} 이후 · 브레이크 ${st.hours.breakStart}–${st.hours.breakEnd} 제외`;
    } else {
      $('#g-time-hint').textContent = '이미 도착한 손님이라 기준 시각으로 바로 앉힙니다';
    }

    /* 좌석도 */
    $('#floor-tabs').innerHTML = fl.map(f => `<button type="button" role="tab" class="tab ${f.id === S.floor ? 'on' : ''}" data-f="${f.id}" aria-selected="${f.id === S.floor}">${BT.esc(f.name)}</button>`).join('');
    document.querySelectorAll('#floor-tabs .tab').forEach(b => b.addEventListener('click', () => { S.floor = b.dataset.f; render(); }));
    SeatMap.render($('#map'), fl.find(f => f.id === S.floor), {
      selected: S.table,
      recommended: S.table ? null : rec && rec.id,
      statusOf: t => block(t, list) || { cls: 'available' },
      onSelect: t => { S.table = S.table === t.id ? null : t.id; S.confirm = false; render(); }
    });

    /* 시간표 (현재 층) */
    const sel = S.table ? BT.findTable(S.table, fl) : null;
    const ok = sel && !block(sel, list) && atTime();
    Timetable.render($('#timetable'), {
      tables: BT.allTables(fl).filter(t => t.floor === S.floor), reservations: list, date: TODAY, focus: S.table,
      preview: ok ? { table: sel.id, time: atTime(), party: S.party } : null,
      onPick: (r, id) => { S.table = id; S.confirm = false; render(); }
    });

    renderAssign(sel, rec, list);
    renderHistory(list);
  }

  /* ---------- 배정 패널 ---------- */
  function renderAssign(t, rec, list) {
    const box = $('#assign');
    const title = S.mode === 'quick' ? '퀵 배정' : '전화 예약';
    const when = S.mode === 'quick' ? `지금 ${BT.NOW}` : (S.time ? `${S.time} 방문 예정` : '시간 선택 필요');
    if (!t) {
      box.innerHTML = `<span class="eyebrow">${title}</span>
        <div><h2>${S.party}명 · ${when}</h2><p class="card-sub" style="margin-top:4px">좌석도나 시간표에서 테이블을 골라 주세요.</p></div>
        ${rec ? `<div class="notice warn"><b>추천 ${rec.id}</b> · ${where(rec)}<br><span style="font-size:12px">${S.party}명이 앉을 수 있고 ${when.replace(' 방문 예정', '')}부터 ${st.dineMinutes}분 비어 있는 가장 작은 자리예요</span></div>
          <button type="button" class="btn btn-soft btn-sm" data-act="pick-rec" style="align-self:flex-start">추천 자리 고르기</button>`
          : `<p class="notice bad">${S.party}명이 지금 조건으로 앉을 수 있는 자리가 없어요.</p>`}`;
      const b = box.querySelector('[data-act="pick-rec"]');
      if (b) b.addEventListener('click', () => { S.table = rec.id; S.floor = rec.floor; render(); });
      return;
    }
    const b = block(t, list);
    const why = b ? b.why : null;
    box.innerHTML = `<span class="eyebrow">${title}</span>
      <div class="row" style="align-items:baseline;gap:12px"><span class="sel-id">${t.id}</span><b>${where(t)}</b></div>
      <dl class="kv"><dt>인원</dt><dd>${S.party}명</dd><dt>시간</dt><dd>${when}</dd><dt>이용</dt><dd>${st.dineMinutes}분</dd></dl>
      ${why ? `<p class="notice bad">${BT.esc(why)}</p><p class="hint">시간표에서 이 테이블의 예약을 확인할 수 있어요.</p>` : `
        <div class="field"><label for="g-memo">메모 <span class="faint">(선택)</span></label><textarea class="input" id="g-memo" rows="2" placeholder="${S.mode === 'quick' ? '예: 유모차 있음, 아기 의자 필요' : '예: 창가 선호, 생일 케이크 있음'}" style="min-height:0;resize:vertical"></textarea></div>
        ${S.confirm ? `<p class="notice warn">${t.id}에 ${S.party}명을 ${S.mode === 'quick' ? '지금 바로 앉힐까요?' : S.time + ' 방문으로 잡아 둘까요?'}</p>
          <div class="form-row"><button type="button" class="btn btn-primary" data-act="yes">네, 배정</button><button type="button" class="btn btn-ghost" data-act="no">돌아가기</button></div>`
        : `<button type="button" class="btn btn-primary btn-block" data-act="ask">${S.mode === 'quick' ? '지금 바로 배정' : '전화 예약 배정'}</button>`}
        <p class="hint" id="assign-msg" role="alert"></p>`}`;
    const memo = box.querySelector('#g-memo');
    if (memo) { memo.value = S.memo || ''; memo.addEventListener('input', e => { S.memo = e.target.value; }); }
    const on = (act, fn) => { const x = box.querySelector(`[data-act="${act}"]`); if (x) x.addEventListener('click', fn); };
    on('ask', () => {
      const bad = recheck(t, RES());
      if (bad) { $('#assign-msg').textContent = bad; return; }
      S.confirm = true; render(); box.querySelector('[data-act="no"]').focus();
    });
    on('no', () => { S.confirm = false; render(); });
    on('yes', () => {
      const now = RES(), bad = recheck(t, now);
      if (bad) { S.confirm = false; render(); const m = $('#assign-msg'); if (m) m.textContent = bad; else BT.toast(bad); return; }
      const quick = S.mode === 'quick', pre = quick ? 'WK' : 'PH';
      const no = `${pre}-${TODAY.replace(/-/g, '')}-${String(now.filter(r => r.no.startsWith(pre)).length + 1).padStart(2, '0')}`;
      const d = digits($('#g-phone').value);
      BT.addReservation({
        no, date: TODAY, time: atTime(), party: S.party, table: t.id, walkin: true, source: S.mode,
        name: quick ? '워크인' : ($('#g-name').value.trim() || '전화 예약'), phone: quick ? '' : fmtPhone(d), email: '',
        status: quick ? 'visited' : 'booked', request: (S.memo || '').trim()
      });
      BT.toast(quick ? `${t.id}에 ${S.party}명을 바로 배정했어요` : `${t.id}에 ${S.time} 전화 예약을 잡았어요`);
      S.table = null; S.confirm = false; S.memo = '';
      if (!quick) { $('#g-phone').value = ''; $('#g-name').value = ''; }
      render();
    });
  }

  /* ---------- 오늘 배정 목록 ---------- */
  function renderHistory(list) {
    const items = list.filter(r => r.walkin).sort((a, b) => b.time.localeCompare(a.time));
    const box = $('#history');
    box.innerHTML = items.length ? items.map(r => {
      const src = r.source === 'phone' ? '전화 예약' : '퀵 배정';
      const stat = r.status === 'visited' ? '<span class="badge badge-blue">이용 중</span>' : r.status === 'booked' ? '<span class="badge badge-teal">방문 예정</span>'
        : r.status === 'noshow' ? '<span class="badge badge-coral">노쇼</span>' : '<span class="badge badge-gray">취소</span>';
      return `<div class="stack" style="gap:4px;padding:10px 12px;border:1px solid var(--line);border-radius:10px">
        <div class="row" style="justify-content:space-between"><span><b class="mono">${r.table}</b> · ${r.party}명 · ${src} · ${r.time}</span>${stat}</div>
        ${r.phone ? `<span class="hint">${BT.esc(r.name)} · <span class="mono">${r.phone}</span></span>` : ''}
        ${r.request ? `<span class="hint">메모: ${BT.esc(r.request)}</span>` : ''}
        ${S.del === r.no ? `<div class="form-row"><button type="button" class="btn btn-danger btn-sm" data-del-yes="${r.no}">배정 삭제 확정</button><button type="button" class="btn btn-ghost btn-sm" data-del-no>돌아가기</button></div>`
          : `<button type="button" class="btn btn-ghost btn-sm" style="align-self:flex-start" data-del="${r.no}">배정 삭제</button>`}
      </div>`;
    }).join('') : '<p class="hint">아직 배정한 손님이 없어요.</p>';
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { S.del = b.dataset.del; render(); }));
    box.querySelectorAll('[data-del-no]').forEach(b => b.addEventListener('click', () => { S.del = null; render(); }));
    box.querySelectorAll('[data-del-yes]').forEach(b => b.addEventListener('click', () => {
      const r = list.find(x => x.no === b.dataset.delYes);
      BT.removeReservation(r.no); S.del = null;
      BT.toast(`${r.table}의 손님 배정을 지웠어요. 다시 배정할 수 있어요`); render();
    }));
  }

  /* ---------- 입력 ---------- */
  document.querySelectorAll('#mode-tabs .tab').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; S.table = null; S.confirm = false; render(); }));
  $('#g-minus').addEventListener('click', () => { S.party--; S.confirm = false; render(); });
  $('#g-plus').addEventListener('click', () => { S.party++; S.confirm = false; render(); });
  $('#g-time').addEventListener('change', e => { S.time = e.target.value; S.confirm = false; render(); });

  render();
})();
