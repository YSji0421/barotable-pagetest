/* C-04 / C-05 예약 내용 확인 (좌석 화면에서 고른 값을 표시만 함) */
(function () {
  const $ = s => document.querySelector(s);
  const fl = BT.floors(), d = BT.draft();
  /* 화면 목록으로 바로 들어와 고른 좌석이 없으면 T03으로 화면만 보여 준다. 확정은 막는다 */
  const picked = BT.findTable(d.table, fl);
  const t = picked || BT.findTable('T03', fl);
  const z = BT.zoneOf(t, fl);
  /* 회원으로 로그인했으면 아직 입력하지 않은 칸을 회원 정보로 채운다 */
  const me = window.Member && Member.current();
  $('#c-name').value = d.name || (me ? me.name : '');
  $('#c-phone').value = d.phone || (me ? me.phone : '');
  $('#c-email').value = d.email || (me ? me.email : '');
  $('#c-req').value = d.request || '';
  $('#summary').innerHTML = `
    <dt>매장</dt><dd>${BT.esc(BT.store().name)}</dd>
    <dt>일시</dt><dd>${BT.fmtDate(d.date)} ${d.time}</dd>
    <dt>인원</dt><dd>${d.party}명</dd>
    <dt>선택 테이블</dt><dd>${t.id} · ${t.seats}인석 · ${BT.esc(t.floorName)} ${BT.esc(z ? z.name : '')}</dd>`;
  const floor = fl.find(f => f.id === t.floor);
  SeatMap.render($('#mini-map'), floor, { selected: t.id, statusOf: x => ({ cls: x.id === t.id ? 'available' : 'empty' }) });
  $('#mini-map').querySelectorAll('.map-table').forEach(b => { b.tabIndex = -1; });
  const form = $('#booking-contact-form');
  const error = $('#contact-error');
  const phoneInput = $('#c-phone');
  phoneInput.addEventListener('input', () => {
    const digits = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    phoneInput.value = digits.length > 7 ? `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
      : digits.length > 3 ? `${digits.slice(0,3)}-${digits.slice(3)}` : digits;
  });
  const fail = (input, message) => {
    error.hidden = false; error.textContent = message; input.focus();
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    const name = $('#c-name').value.trim();
    const phone = phoneInput.value.trim();
    const digits = phone.replace(/\D/g, '');
    const email = $('#c-email').value.trim();
    if (name.length < 2) return fail($('#c-name'), '예약자 이름을 두 글자 이상 입력해 주세요.');
    if (!/^01[016789]\d{7,8}$/.test(digits)) return fail(phoneInput, '올바른 휴대전화 번호를 입력해 주세요.');
    if (email && !$('#c-email').checkValidity()) return fail($('#c-email'), '올바른 이메일 주소를 입력해 주세요.');
    if (!$('#c-agree').checked) return fail($('#c-agree'), '개인정보 수집·이용 동의가 필요합니다.');
    const request = $('#c-req').value.trim();
    /* 이미 확정한 예약을 새로고침 · 뒤로가기로 다시 보낸 경우: 새로 만들지 않고 완료 화면으로 */
    if (d.confirmed && d.no && BT.reservations().some(r => r.no === d.no)) { BT.go('complete'); return; }
    if (!picked) {
      error.hidden = false;
      error.innerHTML = `좌석을 먼저 골라 주세요. <a href="${BT.url('reserve')}">좌석 고르기</a>`;
      return;
    }
    /* 저장 직전 재검사: 좌석도를 본 뒤 점주가 전화 예약을 넣었거나 시간이 지났을 수 있다 */
    const bad = BT.checkSeat(t, { date: d.date, time: d.time, party: d.party }, BT.reservations(), fl);
    if (bad) {
      error.hidden = false;
      error.innerHTML = `${BT.esc(t.id)} 자리는 지금 예약할 수 없어요. ${BT.esc(bad.reason)}. <a href="${BT.url('reserve')}">좌석 다시 고르기</a>`;
      BT.saveDraft({ table: null });
      return;
    }
    const no = BT.newGuestNo(d.date);
    BT.addReservation({ no, date: d.date, time: d.time, name, phone, email, party: d.party, table: t.id, status: 'booked', request });
    BT.saveDraft({ name, phone, email, request, confirmed: true, no });
    BT.go('complete');
  });
})();
