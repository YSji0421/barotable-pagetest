/* C-06 예약 완료 (좌석 화면에서 고른 값을 표시만 함) */
(function () {
  const d = BT.draft();
  /* 확정된 예약은 예약 목록에 저장돼 있다. 점주가 테이블을 옮겼으면 옮긴 자리를 보여 준다 */
  const saved = d.no ? BT.reservations().find(r => r.no === d.no) : null;
  const r = saved || d;
  const t = BT.findTable(r.table) || BT.findTable('T03'), z = BT.zoneOf(t);
  const no = BT.guestNo(d);
  document.querySelector('#d-no').textContent = no;
  document.querySelector('#d-info').innerHTML = `
    <dt>매장</dt><dd>${BT.esc(BT.store().name)}</dd>
    <dt>일시</dt><dd>${BT.fmtDate(r.date, 'long')} ${r.time}</dd>
    <dt>인원</dt><dd>${r.party}명</dd>
    <dt>예약자</dt><dd>${BT.esc(d.name || '-')}</dd>
    <dt>연락처</dt><dd>${BT.esc(d.phone || '-')}</dd>
    <dt>테이블</dt><dd>${t.id} · ${t.seats}인석 · ${BT.esc(t.floorName)} ${BT.esc(z ? z.name : '')}</dd>
    ${d.request ? `<dt>요청사항</dt><dd>${BT.esc(d.request)}</dd>` : ''}`;
  /* 메일 속 조회 링크와 같은 주소 (시연용 버튼) */
  document.querySelector('#lk-open').setAttribute('href', BT.lookupUrl(no));
})();
