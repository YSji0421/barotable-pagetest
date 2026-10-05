/* C-04 / C-05 예약 내용 확인 (좌석 화면에서 고른 값을 표시만 함) */
(function () {
  const $ = s => document.querySelector(s);
  const fl = BT.floors(), d = BT.draft();
  const t = BT.findTable(d.table, fl) || BT.findTable('T03', fl);
  const z = BT.zoneOf(t, fl);
  $('#c-req').value = d.request || '';
  $('#summary').innerHTML = `
    <dt>매장</dt><dd>${BT.esc(BT.store().name)}</dd>
    <dt>일시</dt><dd>${BT.fmtDate(d.date)} ${d.time}</dd>
    <dt>인원</dt><dd>${d.party}명</dd>
    <dt>선택 테이블</dt><dd>${t.id} · ${t.seats}인석 · ${BT.esc(t.floorName)} ${BT.esc(z ? z.name : '')}</dd>`;
  const floor = fl.find(f => f.id === t.floor);
  SeatMap.render($('#mini-map'), floor, { selected: t.id, statusOf: x => ({ cls: x.id === t.id ? 'available' : 'empty' }) });
  $('#mini-map').querySelectorAll('.map-table').forEach(b => { b.tabIndex = -1; });
})();
