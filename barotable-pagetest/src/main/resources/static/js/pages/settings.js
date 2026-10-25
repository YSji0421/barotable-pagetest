/* O-04 운영 조건
 * 저장하면 BT.saveStore()로 sessionStorage('bt.store')에 남고, BT.store()를 읽는 모든 화면에 반영된다.
 *   영업시간 · 브레이크 → 손님 시간 선택, 채팅 시간 확인, 손님 배정 전화 예약 시간, 시간표
 *   인원 범위 → 손님 인원 선택, 채팅, 손님 배정 / 이용 시간 → 시간 겹침 판단 전체
 *   시간대별 한도 → 전화 예약 / 노쇼 경고 → 대시보드 / 직접 고르기 → 손님 좌석도 / 알림 → 예약 완료 안내 / AI → 채팅
 * 저장 전에 값을 검사하고, 이미 잡힌 예약이 새 조건에 걸리면 경고만 보여 준다(예약은 그대로 둔다).
 */
(function () {
  const $ = s => document.querySelector(s);
  const D = BT_DATA.STORE;
  let dirty = false, resetArm = false;

  function fill(st) {
    $('#s-open').value = st.hours.open; $('#s-close').value = st.hours.close;
    $('#s-bs').value = st.hours.breakStart; $('#s-be').value = st.hours.breakEnd;
    $('#s-min').value = st.minParty; $('#s-max').value = st.maxParty;
    $('#s-dine').value = String(st.dineMinutes); $('#s-limit').value = st.slotLimit; $('#s-noshow').value = st.noShowWarn;
    $('#s-choice').checked = st.allowSeatChoice; $('#s-n1').checked = st.notify.confirm; $('#s-n2').checked = st.notify.dayBefore;
    const ai = st.ai === 'openai' ? 'external' : st.ai;
    document.querySelectorAll('input[name="s-ai"]').forEach(r => { r.checked = r.value === ai; });
  }
  function read() {
    const num = id => Math.round(+$(id).value);
    return {
      hours: { open: $('#s-open').value, close: $('#s-close').value, breakStart: $('#s-bs').value, breakEnd: $('#s-be').value },
      minParty: num('#s-min'), maxParty: num('#s-max'), dineMinutes: num('#s-dine'), slotLimit: num('#s-limit'), noShowWarn: num('#s-noshow'),
      allowSeatChoice: $('#s-choice').checked, notify: { confirm: $('#s-n1').checked, dayBefore: $('#s-n2').checked },
      ai: (document.querySelector('input[name="s-ai"]:checked') || {}).value || 'local'
    };
  }

  /* 오류(e)는 저장을 막고, 경고(w)는 알려만 준다 */
  function validate(v) {
    const out = [], m = t => t ? BT.toMin(t) : NaN, h = v.hours;
    const [o, c, bs, be] = [m(h.open), m(h.close), m(h.breakStart), m(h.breakEnd)];
    if ([o, c, bs, be].some(isNaN)) out.push(['e', '시간 칸을 모두 채워 주세요']);
    else {
      if ([o, c, bs, be].some(x => x % 30)) out.push(['e', '시간은 30분 단위로 정해 주세요 (예: 11:30, 15:00)']);
      if (o >= c) out.push(['e', '마감 시간이 오픈보다 늦어야 해요']);
      if (bs > be) out.push(['e', '브레이크 끝이 시작보다 늦어야 해요']);
      if (bs < be && (bs <= o || be >= c)) out.push(['e', '브레이크는 영업시간 안쪽이어야 해요']);
    }
    if (!(v.minParty >= 1)) out.push(['e', '최소 인원은 1명 이상이어야 해요']);
    if (!(v.maxParty >= v.minParty)) out.push(['e', '최대 인원은 최소 인원보다 작을 수 없어요']);
    if (v.maxParty > 30) out.push(['e', '최대 인원은 30명까지 정할 수 있어요']);
    if (!(v.slotLimit >= 1)) out.push(['e', '시간대별 예약 한도는 1팀 이상이어야 해요']);
    if (!(v.noShowWarn >= 1)) out.push(['e', '노쇼 경고 기준은 1회 이상이어야 해요']);
    if (out.length) return out;

    const seats = Math.max(...BT.allTables().map(t => t.seats));
    if (v.maxParty > seats) out.push(['w', `가장 큰 테이블이 ${seats}인이라 ${seats + 1}명 이상은 받을 자리가 없어요`]);
    /* 이미 잡힌 예약(오늘 기준 시각 이후 ~ 10월)이 새 조건에 걸리는지 */
    const late = BT.reservations().filter(r => r.status === 'booked' && (r.date > BT.TODAY || (r.date === BT.TODAY && BT.toMin(r.time) > BT.toMin(BT.NOW))));
    const hit = late.filter(r => { const t = BT.toMin(r.time); return t < o || t >= c || (bs < be && t >= bs && t < be) || r.party < v.minParty || r.party > v.maxParty; });
    if (hit.length) out.push(['w', `이미 잡힌 예약 ${hit.length}건이 새 조건에 걸려요 (${hit.slice(0, 3).map(r => `${r.date.slice(5).replace('-', '/')} ${r.time} ${r.table}`).join(', ')}${hit.length > 3 ? ' 외' : ''}). 예약은 그대로 두고, 새 예약부터 적용돼요`]);
    return out;
  }

  function preview() {
    const v = read(), h = v.hours, m = BT.toMin;
    const ok = h.open && h.close && m(h.open) < m(h.close);
    const last = ok ? BT.toHHMM(m(h.close) - 30) : '-';
    const brk = h.breakStart && h.breakEnd && h.breakStart !== h.breakEnd ? ` · 브레이크 ${h.breakStart}–${h.breakEnd} 제외` : ' · 브레이크 없음';
    $('#s-preview').textContent = `손님 화면 예약 시간: ${h.open || '-'} ~ ${last}${brk}`;
    $('#save-state').textContent = dirty ? '저장하지 않은 변경이 있어요' : '저장된 설정';
    $('#save-state').classList.toggle('dirty', dirty);
    $('#s-reset').textContent = resetArm ? '한 번 더 누르면 되돌림' : '기본값으로';
  }

  document.querySelectorAll('main input, main select').forEach(el => {
    el.addEventListener(el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT' ? 'change' : 'input', () => { dirty = true; preview(); });
  });
  $('#s-save').addEventListener('click', () => {
    const v = read(), res = validate(v), errs = res.filter(r => r[0] === 'e');
    if (!errs.length) { BT.saveStore(v); dirty = false; }
    const box = $('#s-result');
    box.hidden = false;
    box.innerHTML = res.concat(errs.length ? [] : [['o', '저장했어요. 손님 예약 화면, 채팅, 손님 배정, 대시보드에 바로 반영됩니다.']])
      .map(([k, t]) => `<li class="${k}">${BT.esc(t)}</li>`).join('');
    preview();
  });
  $('#s-reset').addEventListener('click', () => {
    if (!resetArm) { resetArm = true; preview(); setTimeout(() => { resetArm = false; preview(); }, 3000); return; }
    resetArm = false; BT.resetStore(); fill(D); dirty = false; $('#s-result').hidden = true; preview();
    BT.toast('운영 조건을 기본값으로 되돌렸어요');
  });
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  fill(BT.store()); preview();
})();
