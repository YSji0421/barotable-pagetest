/* =========================================================
 * 테이블별 시간표 (점주 대시보드 · 손님 배정 공통)
 * v2 프로토타입의 "오늘 테이블 시간표"를 옮긴 것. 차이점:
 *  - 기준 시각은 실제 시계가 아니라 BT.NOW (하드코딩 19:00)
 *  - 블록은 BT.reservations() 에서 만든다 (취소 · 노쇼는 빠짐)
 *  - 브레이크 타임을 회색 띠로 표시한다 (v2에는 없음)
 * ========================================================= */
window.Timetable = (function () {
  const st = () => BT.store();
  function kind(r) {
    if (r.status === 'visited') return BT.toMin(BT.NOW) >= BT.toMin(r.time) + st().dineMinutes ? 'done' : (r.walkin ? 'walkin' : 'seated');
    return r.walkin ? 'phone' : 'reserved';
  }
  const LABEL = { done: '완료', seated: '이용', walkin: '워크인', phone: '전화', reserved: '예약' };

  /**
   * @param host  비울 컨테이너
   * @param opt   { tables, reservations, date, focus(tableId), soon(true면 30분 이내 강조), preview:{table,time,party}, onPick(reservation|null, table) }
   */
  function render(host, opt) {
    const h = st().hours, dayOpen = BT.toMin(h.open), dayClose = BT.toMin(h.close);
    const open = opt.window ? Math.max(dayOpen,opt.window.start) : dayOpen;
    const close = opt.window ? Math.min(dayClose,opt.window.end) : dayClose;
    const span = Math.max(1,close-open);
    const now = BT.toMin(BT.NOW), dine = st().dineMinutes;
    const pos = m => ((Math.max(open, Math.min(close, m)) - open) / span * 100);
    const list = opt.reservations.filter(r => r.date === opt.date && BT.isActive(r));

    let ticks = '';
    const step = opt.compact ? 60 : 30;
    for (let m = Math.ceil(open/step)*step; m <= close; m += step) {
      ticks += `<span class="tt-tick ${m % 60 ? 'half' : ''}" style="left:${pos(m)}%">${m % 60 ? '' : BT.toHHMM(m)}</span>`;
    }
    const breakStart=BT.toMin(h.breakStart), breakEnd=BT.toMin(h.breakEnd);
    const brk = breakEnd > open && breakStart < close ? `<span class="tt-break" style="left:${pos(breakStart)}%;width:${pos(breakEnd) - pos(breakStart)}%" aria-hidden="true"></span>` : '';

    let prevFloor = null;
    const rows = opt.tables.map(t => {
      const mine = list.filter(r => r.table === t.id && BT.toMin(r.time)<close && BT.toMin(r.time)+dine>open);
      const soon = opt.soon ? mine.filter(r => r.status === 'booked' && BT.toMin(r.time) >= now && BT.toMin(r.time) - now <= 30) : [];
      const blocks = mine.map(r => {
        const s = BT.toMin(r.time), k = kind(r), diff = s - now;
        const cls = soon.includes(r) ? (diff <= 10 ? 'urgent' : 'soon') : '';
        return `<button type="button" class="tt-block k-${k} ${cls}" data-no="${r.no}" style="left:${pos(s)}%;width:${pos(s + dine) - pos(s)}%"
          title="${t.id} · ${r.time}–${BT.toHHMM(Math.min(close, s + dine))} · ${BT.esc(r.name)} ${r.party}명">${LABEL[k]} ${r.party}명</button>`;
      }).join('');
      const pv = opt.preview && opt.preview.table === t.id
        ? `<span class="tt-preview" style="left:${pos(BT.toMin(opt.preview.time))}%;width:${pos(BT.toMin(opt.preview.time) + dine) - pos(BT.toMin(opt.preview.time))}%">배정 예정 ${opt.preview.party}명</span>` : '';
      const group = prevFloor !== null && prevFloor !== t.floor ? 'group-start' : '';
      prevFloor = t.floor;
      return `<div class="tt-row ${group} ${opt.focus === t.id ? 'focused' : ''} ${soon.length ? 'has-soon' : ''}" data-table="${t.id}">
        <button type="button" class="tt-name" data-table="${t.id}"><b class="mono">${t.id}</b><span>${BT.esc(t.floorName)} · ${t.seats}인</span></button>
        <div class="tt-track">${brk}${blocks}${pv}</div></div>`;
    }).join('');

    const nowIn = now >= open && now <= close;
    host.innerHTML = `<div class="tt ${opt.compact ? 'tt-compact' : ''}" style="--tt-now:${pos(now)}">
      <div class="tt-head"><span class="tt-name-h">테이블</span><div class="tt-scale">${ticks}</div></div>
      <div class="tt-body">${rows}</div>
      ${nowIn ? `<div class="tt-now" aria-hidden="true"><span>${BT.NOW}</span></div>` : ''}
    </div>`;

    if (opt.onPick) {
      host.querySelectorAll('.tt-block').forEach(b => b.addEventListener('click', () => {
        const r = list.find(x => x.no === b.dataset.no); opt.onPick(r, r.table);
      }));
      host.querySelectorAll('.tt-name').forEach(b => b.addEventListener('click', () => opt.onPick(null, b.dataset.table)));
    }
    const f = host.querySelector('.tt-row.focused');
    if (f && opt.scrollFocus) f.scrollIntoView({ block: 'nearest' });
  }

  /* 30분 이내 도착 예정 예약 요약 (대시보드 상단 문구) */
  function soonSummary(reservations, date) {
    const now = BT.toMin(BT.NOW);
    const up = reservations.filter(r => r.date === date && r.status === 'booked' && BT.toMin(r.time) >= now && BT.toMin(r.time) - now <= 30)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (!up.length) return { text: '30분 이내 도착 예정 없음', soon: false };
    const n = up[0], diff = BT.toMin(n.time) - now;
    return { text: diff === 0 ? `${n.table} · ${n.time} 도착 시간` : diff <= 10 ? `${n.table} · ${n.time} 도착 ${diff}분 전` :`30분 이내 도착 ${up.length}건 · 다음 ${n.table} ${n.time}`, soon: true };
  }

  return { render, soonSummary };
})();
