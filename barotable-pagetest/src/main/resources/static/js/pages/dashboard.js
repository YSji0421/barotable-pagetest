/* O-02 점주 대시보드 (기준 시각 BT.NOW = 19:00 하드코딩)
 * 동작: 층 탭, 상태 필터, 예약 선택(목록 · 좌석도 · 시간표), 방문 완료, 노쇼 처리/되돌리기, 테이블 옮기기, 워크인 배정
 * 바뀐 내용은 BT.updateReservation / BT.addReservation 으로 sessionStorage에 저장된다.
 * 자리 판단은 규칙으로만 한다: 좌석 수 · 구역 인원 조건(BT.seatRule) + 이용 시간 겹침(BT.tableClash)
 */
(function () {
  const $ = s => document.querySelector(s);
  // 시간표는 기본적으로 현재 전후 몇 시간과 첫 번째 층만 보여 줍니다.
  // 예약 필터/선택과 독립적으로 유지되며 전체 시간으로 확장할 수 있습니다.
  const timelineView = { period: 'around', floor: null, page: 0, pageSize: 6 };
  function timeWindow() {
    const hours = BT.store().hours;
    const opening = BT.toMin(hours.open), closing = BT.toMin(hours.close);
    let from=opening, to=closing;
    if (timelineView.period === 'around') { from=Math.max(opening,Math.min(closing-240,NOW-90)); to=Math.min(closing,from+240); }
    if (timelineView.period === 'lunch') { from=Math.max(opening,11*60); to=Math.min(closing,15*60); }
    if (timelineView.period === 'dinner') { from=Math.max(opening,17*60); to=Math.min(closing,22*60); }
    if (to<=from) { from=opening; to=closing; }
    return { start:from, end:to };
  }
  function renderTimeControls() {
    if (!timelineView.floor) timelineView.floor = fl[0] && fl[0].id || 'all';
    const periods = document.querySelectorAll('#tt-period [data-period]');
    periods.forEach(b => { const active = b.dataset.period === timelineView.period; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); });
    const floor=$('#tt-floor');
    const wanted=floor.value || timelineView.floor;
    floor.innerHTML=`<option value="all">전체 층</option>${fl.map(f=>`<option value="${f.id}">${BT.esc(f.name)}</option>`).join('')}`;
    floor.value=timelineView.floor;
    const win=timeWindow();
    $('#tt-range-label').textContent=BT.toHHMM(win.start)+'–'+BT.toHHMM(win.end);
    return win;
  }

  const D = BT_DATA, fl = BT.floors(), st = BT.store();
  const TODAY = D.OWNER_TODAY, NOW = BT.toMin(BT.NOW), DINE = st.dineMinutes;
  const S = { floor: fl[0].id, filter: 'all', sel: 'BT-20261005-0021', walk: 2, walkOpen: false, listExpanded: false, mapExpanded: false };

  const list = () => BT.reservations().filter(r => r.date === TODAY).sort((a, b) => a.time.localeCompare(b.time));
  const view = r => r.status === 'cancelled' ? 'cancelled' : r.status === 'noshow' ? 'noshow' : r.status === 'visited' ? 'visited'
    : (BT.toMin(r.time) <= NOW ? 'booked' : 'waiting');
  const LABEL = { booked: ['확정', 'badge-teal'], visited: ['방문 완료', 'badge-blue'], waiting: ['대기', 'badge-amber'], noshow: ['노쇼', 'badge-coral'], cancelled: ['취소', 'badge-gray'] };
  const pill = r => { const v = view(r); return `<span class="badge ${LABEL[v][1]}">${LABEL[v][0]}</span>`; };
  const noshowCount = (phone, RES) => phone ? (D.NOSHOW_HISTORY[phone] || 0) + RES.filter(x => x.phone === phone && x.status === 'noshow').length : 0;
  const where = t => { const z = BT.zoneOf(t, fl); return `${t.seats}인 · ${BT.esc(t.floorName)} ${BT.esc(z ? z.name : '')}`; };
  const inUse = r => BT.toMin(r.time) <= NOW && NOW < BT.toMin(r.time) + DINE;

  function tableState(id, RES) {
    const act = RES.filter(r => r.table === id && BT.isActive(r));
    const cur = act.find(inUse);
    if (cur) return { cls: cur.status === 'visited' ? 'visited' : 'booked', sub: `${cur.time} · ${cur.party}명` };
    const next = act.find(r => BT.toMin(r.time) > NOW && BT.toMin(r.time) - NOW <= 60);
    if (next) return { cls: 'waiting', sub: `${next.time} 도착 예정` };
    if (RES.some(r => r.table === id && r.status === 'noshow' && inUse(r))) return { cls: 'empty', sub: '노쇼로 비움' };
    return { cls: 'empty' };
  }
  /* 좌석도에서 테이블을 누르면: 지금 앉은 예약 → 곧 올 예약 → 없음 */
  function resForTable(id, RES) {
    const act = RES.filter(r => r.table === id && BT.isActive(r));
    return act.find(inUse) || act.find(r => BT.toMin(r.time) > NOW) || null;
  }

  function render() {
    const RES = list();
    const sel = RES.find(r => r.no === S.sel) || null;

    /* 요약 */
    const c = { booked: 0, visited: 0, waiting: 0, noshow: 0, cancelled: 0 };
    RES.forEach(r => c[view(r)]++);
    const tile = (k, label, desc, n) => `<div class="stat"><span class="k"><span class="dot c-${k}"></span>${label}</span><span class="v">${n}</span><span class="d">${desc}</span></div>`;
    $('#stats').innerHTML = tile('booked', '확정', '도착 시간이 된 예약', c.booked) + tile('visited', '방문 완료', '입장 처리된 테이블', c.visited) +
      tile('waiting', '대기', '시간이 남은 예약', c.waiting) + tile('noshow', '노쇼', '빈자리로 돌린 예약', c.noshow);

    /* 좌석도 */
    $('#floor-tabs').innerHTML = fl.map(f => `<button type="button" role="tab" class="tab ${f.id === S.floor ? 'on' : ''}" data-f="${f.id}" aria-selected="${f.id === S.floor}">${BT.esc(f.name)}</button>`).join('');
    document.querySelectorAll('#floor-tabs .tab').forEach(b => b.addEventListener('click', () => { S.floor = b.dataset.f; render(); }));
    SeatMap.render($('#map'), fl.find(f => f.id === S.floor), {
      selected: sel ? sel.table : null,
      statusOf: t => tableState(t.id, RES),
      onSelect: t => { const r = resForTable(t.id, RES); S.sel = r ? r.no : 'table:' + t.id; render(); }
    });

    /* 목록 */
    const TABS = [['all', '전체'], ['booked', '확정'], ['waiting', '대기'], ['visited', '방문 완료'], ['noshow', '노쇼']];
    $('#list-tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" class="tab ${S.filter === k ? 'on' : ''}" data-k="${k}" aria-selected="${S.filter === k}">${l}${k !== 'all' ? ` <span class="count">${c[k]}</span>` : ''}</button>`).join('');
    document.querySelectorAll('#list-tabs .tab').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.k; render(); }));
    const rows = RES.filter(r => S.filter === 'all' || view(r) === S.filter);
    const visibleRows = S.listExpanded ? rows : rows.slice(0, 5);
    const moreBtn = $('#res-show-all');
    moreBtn.hidden = rows.length <= 5;
    moreBtn.textContent = S.listExpanded ? '간단히 보기' : `전체 ${rows.length}건 보기 →`;
    moreBtn.setAttribute('aria-expanded', String(S.listExpanded));
    $('#res-list-summary').textContent = rows.length > 5 && !S.listExpanded ? `최근 ${visibleRows.length}건 표시 · 나머지 ${rows.length - visibleRows.length}건은 전체 보기에서 확인` : `${rows.length}건 표시`;
    $('#res-rows').innerHTML = rows.length ? visibleRows.map(r => {
      const n = noshowCount(r.phone, RES);
      return `<tr class="${r.no === S.sel ? 'on' : ''} ${BT.isActive(r) ? '' : 'dimmed'}" data-no="${r.no}" tabindex="0"><td class="mono">${r.time}</td>
        <td>${BT.esc(r.name)} ${n >= st.noShowWarn ? `<span class="badge badge-coral">노쇼 ${n}회</span>` : ''}</td>
        <td>${r.party}명</td><td class="mono">${r.table}</td><td>${pill(r)}</td><td class="muted">${BT.esc(r.request || '-')}</td></tr>`;
    }).join('') : `<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">해당하는 예약이 없어요</td></tr>`;
    document.querySelectorAll('#res-rows tr[data-no]').forEach(tr => {
      const pick = () => { S.sel = tr.dataset.no; const r = RES.find(x => x.no === S.sel), t = BT.findTable(r.table, fl); if (t) S.floor = t.floor; render(); };
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });

    /* 시간표 */
    const focus = sel ? sel.table : String(S.sel || '').replace('table:', '') || null;
    const timeRange = renderTimeControls();
    const filteredTables = BT.allTables(fl).filter(t => timelineView.floor === 'all' || t.floor === timelineView.floor);
    const pageCount = Math.max(1, Math.ceil(filteredTables.length / timelineView.pageSize));
    timelineView.page = Math.min(pageCount - 1, timelineView.page);
    const firstRow = timelineView.page * timelineView.pageSize;
    const shownTables = filteredTables.slice(firstRow, firstRow + timelineView.pageSize);
    $('#tt-page-summary').textContent = `${filteredTables.length ? firstRow + 1 : 0}–${Math.min(firstRow + shownTables.length, filteredTables.length)} / ${filteredTables.length} 테이블`;
    $('#tt-prev').disabled = timelineView.page === 0;
    $('#tt-next').disabled = timelineView.page >= pageCount - 1;
    Timetable.render($('#timetable'), {
      tables: shownTables,
      reservations: RES, date: TODAY, focus, soon: true, window: timeRange, compact: true,
      onPick: (r, tableId) => {
        const t = BT.findTable(tableId, fl);
        if (t) S.floor = t.floor;
        if (r) S.sel = r.no;
        else { const x = resForTable(tableId, RES); S.sel = x ? x.no : 'table:' + tableId; }
        render();
      }
    });
    const ss = Timetable.soonSummary(RES, TODAY);
    $('#soon-status').textContent = ss.text; $('#soon-status').classList.toggle('on', ss.soon);

    renderDetail(sel, RES);
    renderWalkin(RES);
  }

  /* ---------- 선택한 예약 ---------- */
  function renderDetail(r, RES) {
    const box = $('#detail');
    if (!r) {
      const tid = String(S.sel || '').replace('table:', ''), t = BT.findTable(tid, fl);
      box.innerHTML = t ? `<span class="eyebrow">선택 테이블</span><div class="row" style="align-items:baseline;gap:12px"><span class="sel-id">${t.id}</span><b>${where(t)}</b></div>
        <p class="notice">지금 앉은 손님이나 남은 예약이 없어요. 워크인 손님은 아래에서 배정하세요.</p>`
        : `<span class="eyebrow">선택한 예약</span><p class="notice">목록이나 좌석도에서 예약을 골라 주세요.</p>`;
      return;
    }
    const t = BT.findTable(r.table, fl), v = view(r);
    const moves = BT.isActive(r) && v !== 'visited' ? BT.allTables(fl).filter(x => x.id !== r.table && !BT.seatRule(x, r.party, fl) && !BT.tableClash(x.id, r.date, r.time, RES, r.no)).sort((a, b) => a.seats - b.seats) : [];
    let actions = '';
    if (v === 'booked' || v === 'waiting') {
      actions = `<div class="form-row"><button class="btn btn-primary btn-sm" type="button" data-act="visit">방문 완료</button>
        <button class="btn btn-danger btn-sm" type="button" data-act="noshow" ${v === 'waiting' ? 'disabled' : ''}>노쇼 처리</button></div>
        ${v === 'waiting' ? '<p class="hint">예약 시간 전이라 노쇼 처리는 아직 할 수 없어요.</p>' : ''}
        <hr class="divider">
        <label class="field-label" for="move-sel">다른 테이블로 옮기기</label>
        ${moves.length ? `<div class="row" style="flex-wrap:nowrap"><select class="select" id="move-sel" style="min-height:38px">${moves.map(x => `<option value="${x.id}">${x.id} · ${where(x)}</option>`).join('')}</select><button class="btn btn-ghost btn-sm" type="button" data-act="move">옮기기</button></div>
          <p class="hint">${r.party}명이 앉을 수 있고 ${r.time} 전후 ${DINE}분 안에 다른 예약이 없는 테이블만 보여요.</p>`
          : '<p class="notice">옮길 수 있는 빈 테이블이 없어요.</p>'}`;
    } else if (v === 'noshow') {
      actions = `<p class="notice bad">노쇼로 처리돼 자리를 비웠어요.</p><button class="btn btn-ghost btn-sm" type="button" data-act="undo">노쇼 되돌리기</button>`;
    } else if (v === 'cancelled') {
      actions = '<p class="notice">손님이 취소한 예약이에요.</p>';
    }
    const n = noshowCount(r.phone, RES);
    box.innerHTML = `
      <div class="row" style="justify-content:space-between"><span class="eyebrow">${r.walkin ? '워크인' : '선택한 예약'}</span>${pill(r)}</div>
      <div class="row" style="align-items:baseline;gap:12px"><span class="sel-id">${r.table}</span><b>${r.time} · ${r.party}명</b></div>
      <dl class="kv">
        <dt>예약자</dt><dd>${BT.esc(r.name)} ${n >= st.noShowWarn ? `<span class="badge badge-coral">노쇼 ${n}회</span>` : ''}</dd>
        ${r.phone ? `<dt>연락처</dt><dd class="mono">${r.phone}</dd>` : ''}
        <dt>예약번호</dt><dd class="mono" style="font-size:12.5px">${r.no}</dd>
        <dt>위치</dt><dd>${t ? where(t) : '-'}</dd>
        <dt>요청사항</dt><dd>${BT.esc(r.request || '없음')}</dd>
      </dl>${actions}`;

    const on = (act, fn) => { const b = box.querySelector(`[data-act="${act}"]`); if (b) b.addEventListener('click', fn); };
    on('visit', () => { BT.updateReservation(r.no, { status: 'visited' }); BT.toast(`${r.table} 방문 완료로 바꿨어요`); render(); });
    on('noshow', () => {
      if (BT.toMin(r.time) > NOW) return; // 재검사
      BT.updateReservation(r.no, { status: 'noshow' }); BT.toast(`${r.name} 님 예약을 노쇼로 처리하고 ${r.table}을 비웠어요`); render();
    });
    on('undo', () => {
      // 비운 자리에 워크인을 앉혔으면 되돌릴 수 없다
      const clash = BT.tableClash(r.table, r.date, r.time, list(), r.no);
      if (clash) { BT.toast(`${r.table}에 이미 ${clash.name} 손님이 있어 되돌릴 수 없어요`); return; }
      BT.updateReservation(r.no, { status: 'booked' }); render();
    });
    on('move', () => {
      const to = $('#move-sel').value, x = BT.findTable(to, fl);
      // 저장 직전 재검사: 좌석 수 · 구역 조건 · 시간 겹침
      const bad = BT.seatRule(x, r.party, fl) || (BT.tableClash(to, r.date, r.time, list(), r.no) ? '그 사이 다른 예약이 들어왔어요' : null);
      if (bad) { BT.toast(bad); render(); return; }
      BT.updateReservation(r.no, { table: to }); S.floor = x.floor; BT.toast(`${r.table} → ${to}로 옮겼어요`); render();
    });
  }

  /* ---------- 워크인 ---------- */
  function walkCandidates(RES) {
    return BT.allTables(fl).filter(t => !BT.seatRule(t, S.walk, fl) && !BT.tableClash(t.id, TODAY, BT.NOW, RES))
      .sort((a, b) => a.seats - b.seats || a.id.localeCompare(b.id));
  }
  function renderWalkin(RES) {
    $('#wk-val').textContent = S.walk + '명';
    $('#wk-minus').disabled = S.walk <= st.minParty;
    $('#wk-plus').disabled = S.walk >= st.maxParty;
    const box = $('#wk-list');
    if (!S.walkOpen) { box.innerHTML = ''; return; }
    const cand = walkCandidates(RES).slice(0, 4);
    box.innerHTML = cand.length ? cand.map((t, i) => `<div class="row" style="justify-content:space-between;flex-wrap:nowrap;padding:10px 12px;border-radius:10px;${i === 0 ? 'background:var(--amber-soft)' : 'border:1px solid var(--line)'}">
        <span><b class="mono">${t.id}</b> · ${where(t)} ${i === 0 ? '<span class="badge badge-amber">추천</span>' : ''}</span>
        <button class="btn btn-soft btn-sm" type="button" data-t="${t.id}">배정</button></div>`).join('') +
        `<p class="hint">${BT.NOW}부터 ${DINE}분 동안 예약이 없는 테이블 중 작은 자리부터 보여요.</p>`
      : `<p class="notice bad">지금 ${S.walk}명이 앉을 수 있는 빈 테이블이 없어요.</p>`;
    box.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
      const t = BT.findTable(b.dataset.t, fl), now = list();
      // 저장 직전 재검사
      if (BT.seatRule(t, S.walk, fl) || BT.tableClash(t.id, TODAY, BT.NOW, now)) { BT.toast('그 사이 자리가 찼어요. 다시 찾아 주세요'); render(); return; }
      const no = 'WK-' + TODAY.replace(/-/g, '') + '-' + String(now.filter(r => r.walkin).length + 1).padStart(2, '0');
      BT.addReservation({ no, date: TODAY, time: BT.NOW, name: '워크인', phone: '', email: '', party: S.walk, table: t.id, status: 'visited', request: '', walkin: true });
      S.sel = no; S.floor = t.floor; S.walkOpen = false;
      BT.toast(`워크인 ${S.walk}명을 ${t.id}에 배정했어요`); render();
    }));
  }
  $('#wk-minus').addEventListener('click', () => { S.walk--; render(); });
  $('#wk-plus').addEventListener('click', () => { S.walk++; render(); });
  $('#wk-find').addEventListener('click', () => { S.walkOpen = true; render(); });
  $('#demo-reset').addEventListener('click', () => { BT.resetReservations(); S.sel = 'BT-20261005-0021'; S.walkOpen = false; BT.toast('시연 데이터를 처음 상태로 되돌렸어요'); render(); });

  $('#tt-period').addEventListener('click',e => {
    const btn = e.target.closest('[data-period]');
    if(!btn)return;
    timelineView.period=btn.dataset.period;
    render();
  });
  $('#tt-floor').addEventListener('change',e => {timelineView.floor=e.target.value;timelineView.page=0;render();});
  $('#tt-prev').addEventListener('click',()=>{timelineView.page=Math.max(0,timelineView.page-1);render();});
  $('#tt-next').addEventListener('click',()=>{timelineView.page++;render();});
  $('#res-show-all').addEventListener('click',()=>{S.listExpanded=!S.listExpanded;render();});
  $('#seat-toggle').addEventListener('click',()=>{
    S.mapExpanded=!S.mapExpanded;
    document.querySelector('#owner-seats').classList.toggle('is-expanded',S.mapExpanded);
    const button=$('#seat-toggle');
    button.textContent=S.mapExpanded?'작게 보기 ↙':'크게 보기 ↗';
    button.setAttribute('aria-expanded', String(S.mapExpanded));
  });

  $('#today-label').textContent = BT.fmtDate(TODAY);
  render();
})();
