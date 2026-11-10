/* C-07 비회원 예약 조회 · 취소
 * 1) 기본: 예약 완료 메일의 조회 링크(?t=토큰)로 들어오면 바로 예약을 보여 준다. 링크는 방문일이 지나면 만료.
 * 2) 링크를 잃어버리면 이메일을 넣어 다시 받는다. 예약이 있든 없든 같은 안내를 보여 준다 (예약 여부를 흘리지 않게).
 * 3) 보조: 예약번호 + 연락처가 모두 맞으면 보여 준다.
 * 취소는 방문 시간 전, 확정 상태일 때만. 기준 시각: BT.TODAY + BT.NOW (하드코딩)
 * 실제 구현: GET /reservations/lookup?t=…, POST /api/reservations/lookup/resend, POST /api/reservations/lookup
 */
(function () {
  const $ = s => document.querySelector(s);
  const card = $('#lk-link'), box = $('#lk-result');
  const digits = s => String(s || '').replace(/\D/g, '');
  const STATUS = { booked: ['예약 확정', 'badge-teal'], visited: ['방문 완료', 'badge-blue'], noshow: ['노쇼 처리됨', 'badge-coral'], cancelled: ['취소됨', 'badge-gray'] };
  let current = null, asking = false, miss = '';

  /* 시연용 기본값: 오늘 날짜로 만든 강태민 님 예약번호 */
  const lkNo = $('#lk-no');
  if (lkNo && lkNo.value === 'BT-20261005-0025') lkNo.value = `BT-${BT.TODAY.replace(/-/g, '')}-0025`;
  const byNo = no => BT.reservations().find(r => r.no === no) || null;
  function find(no, phone) {
    return BT.reservations().find(r => r.no.toUpperCase() === no.trim().toUpperCase() && r.phone && digits(r.phone) === digits(phone)) || null;
  }
  /* 전화번호 자동 하이픈: 화면 입력만 포맷하고 조회 시에는 기존 digits() 비교를 유지 */
  const phoneInput = $('#lk-phone');
  function formatKoreanPhone(value) {
    const raw = String(value || '').trim();
    let d = raw.replace(/\D/g, '');
    if (/^\+82/.test(raw.replace(/[\s()-]/g, '')) && d.startsWith('82')) d = '0' + d.slice(2);
    if (d.startsWith('02')) {
      d = d.slice(0, 10);
      if (d.length <= 2) return d;
      if (d.length <= 5) return d.slice(0, 2) + '-' + d.slice(2);
      if (d.length <= 9) return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
      return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6, 10);
    }
    d = d.slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3);
    if (d.length <= 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7, 11);
  }
  function formatPhoneInput() {
    if (!phoneInput) return;
    const before = phoneInput.value;
    const caret = phoneInput.selectionStart == null ? before.length : phoneInput.selectionStart;
    const digitsBeforeCaret = digits(before.slice(0, caret)).length;
    const after = formatKoreanPhone(before);
    if (after === before) return;
    phoneInput.value = after;
    let pos = 0, seen = 0;
    while (pos < after.length && seen < digitsBeforeCaret) {
      if (/\d/.test(after.charAt(pos))) seen++;
      pos++;
    }
    if (after.charAt(pos) === '-') pos++;
    try { phoneInput.setSelectionRange(pos, pos); } catch (_) {}
  }
  if (phoneInput) {
    phoneInput.addEventListener('input', formatPhoneInput);
    phoneInput.addEventListener('blur', formatPhoneInput);
    formatPhoneInput();
  }

  /* 취소할 수 없으면 이유, 할 수 있으면 null */
  function cancelBlock(r) {
    if (r.status === 'cancelled') return null;
    if (r.status !== 'booked') return '이미 방문 처리된 예약이라 취소할 수 없어요.';
    if (r.date < BT.TODAY || (r.date === BT.TODAY && BT.toMin(r.time) <= BT.toMin(BT.NOW))) return '예약 시간이 지나 온라인으로 취소할 수 없어요. 매장으로 연락해 주세요.';
    return null;
  }

  function render() {
    card.hidden = false;
    if (!current) {
      box.innerHTML = `<p class="notice bad">${miss}</p>`;
      return;
    }
    const r = current, t = BT.findTable(r.table), z = t ? BT.zoneOf(t) : null, s = STATUS[r.status] || STATUS.booked;
    const block = cancelBlock(r);
    box.innerHTML = `
      <div class="row" style="justify-content:space-between"><b class="mono">${BT.esc(r.no)}</b><span class="badge ${s[1]}">${s[0]}</span></div>
      <dl class="kv">
        <dt>예약자</dt><dd>${BT.esc(r.name)}</dd>
        <dt>일시</dt><dd>${BT.fmtDate(r.date)} ${r.time}</dd>
        <dt>인원</dt><dd>${r.party}명</dd>
        <dt>테이블</dt><dd>${t ? `${t.id} · ${t.seats}인석 · ${BT.esc(t.floorName)} ${BT.esc(z ? z.name : '')}` : '-'}</dd>
        <dt>요청사항</dt><dd>${BT.esc(r.request || '없음')}</dd>
      </dl>
      ${r.status === 'cancelled' ? '<p class="notice">취소된 예약입니다. 같은 자리는 다른 손님이 예약할 수 있어요.</p>'
        : block ? `<p class="notice warn">${block}</p>`
        : asking ? `<p class="notice bad">취소하면 되돌릴 수 없어요. 정말 취소할까요?</p>
            <div class="form-row"><button type="button" class="btn btn-danger" data-act="yes">예약 취소 확정</button><button type="button" class="btn btn-ghost" data-act="no">돌아가기</button></div>`
        : '<button type="button" class="btn btn-danger btn-block" data-act="ask">예약 취소</button>'}`;
    const on = (act, fn) => { const b = box.querySelector(`[data-act="${act}"]`); if (b) b.addEventListener('click', fn); };
    on('ask', () => { asking = true; render(); box.querySelector('[data-act="no"]').focus(); });
    on('no', () => { asking = false; render(); });
    on('yes', () => {
      // 저장 직전 재검사
      const fresh = byNo(r.no);
      if (!fresh || cancelBlock(fresh)) { current = fresh; asking = false; render(); return; }
      BT.updateReservation(r.no, { status: 'cancelled' });
      current = byNo(r.no); asking = false; render();
      BT.toast('예약을 취소했어요');
    });
  }

  /* 1) 조회 링크로 들어온 경우 */
  function openToken(t) {
    const r = BT.byToken(t);
    asking = false;
    if (!r) { current = null; miss = '조회 링크가 올바르지 않아요. 아래에서 이메일로 새 링크를 받아 주세요.'; }
    else if (BT.tokenExpired(r)) { current = null; miss = '방문일이 지나 만료된 조회 링크예요. 지난 예약은 매장으로 문의해 주세요.'; }
    else { current = r; $('#lk-resend').hidden = true; }
    render();
  }
  const token = new URLSearchParams(location.search).get('t');
  if (token) openToken(token);

  /* 2) 조회 링크 다시 받기: 결과와 상관없이 같은 안내 */
  $('#rs-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#rs-email').value.trim();
    // 실제 구현: 서버가 이 이메일의 유효한 예약마다 링크를 메일로 보낸다. 화면에는 예약 유무를 알리지 않는다.
    const msg = $('#rs-msg');
    msg.hidden = false;
    msg.textContent = `${email}(으)로 예약이 있다면 조회 링크를 보냈어요. 몇 분 안에 메일이 오지 않으면 주소를 다시 확인해 주세요.`;
  });

  /* 3) 예약번호 + 연락처 */
  $('#lk-form').addEventListener('submit', e => {
    e.preventDefault();
    current = find($('#lk-no').value, $('#lk-phone').value); asking = false;
    miss = '예약번호와 연락처가 맞는 예약이 없어요. 다시 확인해 주세요.';
    render();
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });


})();
