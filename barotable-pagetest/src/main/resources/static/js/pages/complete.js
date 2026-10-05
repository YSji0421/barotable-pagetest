/* C-06 예약 완료 (좌석 화면에서 고른 값을 표시만 함) */
(function () {
  const d = BT.draft(), t = BT.findTable(d.table) || BT.findTable('T03'), z = BT.zoneOf(t);
  const no = BT.guestNo(d);
  document.querySelector('#d-no').textContent = no;
  document.querySelector('#d-info').innerHTML = `
    <dt>매장</dt><dd>${BT.esc(BT.store().name)}</dd>
    <dt>일시</dt><dd>${BT.fmtDate(d.date, 'long')} ${d.time}</dd>
    <dt>인원</dt><dd>${d.party}명</dd>
    <dt>테이블</dt><dd>${t.id} · ${t.seats}인석 · ${BT.esc(t.floorName)} ${BT.esc(z ? z.name : '')}</dd>
    ${d.request ? `<dt>요청사항</dt><dd>${BT.esc(d.request)}</dd>` : ''}`;
  /* 운영 조건의 알림 설정에 따라 이메일 안내를 보이거나 숨긴다 */
  const nt = BT.store().notify;
  const n1 = document.querySelector('#n-confirm'), n2 = document.querySelector('#n-daybefore');
  if (n1) n1.hidden = !nt.confirm;
  if (n2) n2.hidden = !nt.dayBefore;
  /* 메일 속 조회 링크와 같은 주소 (시연용 버튼) */
  document.querySelector('#lk-open').setAttribute('href', BT.lookupUrl(no));
})();
