/* =========================================================
 * 좌석도 렌더러 (손님 / 점주 대시보드 공용, 편집기는 editor.js)
 * 1000 x 600 단위 좌표를 % 위치로 바꿔 반응형으로 그린다.
 * ========================================================= */
window.SeatMap = (function () {
  const W = 1000, H = 600;
  const pct = (v, base) => (v / base * 100) + '%';
  function place(el, o) {
    el.style.left = pct(o.x, W); el.style.top = pct(o.y, H);
    el.style.width = pct(o.w, W); el.style.height = pct(o.h, H);
    el.style.setProperty('--rot', (o.rotation || 0) + 'deg');
  }
  /**
   * @param host   컨테이너 요소
   * @param floor  층 데이터
   * @param opt    { statusOf(table) -> {cls, sub, title}, selected, recommended, onSelect(table), zoneFilter }
   */
  function render(host, floor, opt) {
    opt = opt || {};
    host.innerHTML = '';
    const canvas = document.createElement('div');
    canvas.className = 'map-canvas';
    canvas.setAttribute('role', 'group');
    canvas.setAttribute('aria-label', floor.name + ' 좌석도');

    floor.zones.forEach(z => {
      const el = document.createElement('div');
      el.className = 'map-zone zone-' + (z.color || 'slate');
      if (opt.zoneFilter && opt.zoneFilter !== 'all' && opt.zoneFilter !== z.id) el.classList.add('dim');
      place(el, z);
      const rule = [];
      if (z.minParty) rule.push(z.minParty + '인 이상');
      if (z.maxParty) rule.push(z.maxParty + '인 이하');
      el.innerHTML = `<span class="zone-label">${BT.esc(z.name)}${rule.length ? ' <em>' + rule.join(' · ') + '</em>' : ''}</span>`;
      canvas.appendChild(el);
    });
    floor.fixtures.forEach(f => {
      const el = document.createElement('div');
      el.className = 'map-fixture fx-' + f.type;
      place(el, f);
      if (f.label) el.innerHTML = `<span>${BT.esc(f.label)}</span>`;
      canvas.appendChild(el);
    });
    floor.tables.forEach(t0 => {
      const t = Object.assign({ floor: floor.id, floorName: floor.name }, t0);
      const st = opt.statusOf ? opt.statusOf(t) : { cls: 'available' };
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `map-table shape-${t.shape} st-${st.cls}`;
      if (opt.selected === t.id) el.classList.add('is-selected');
      if (opt.recommended === t.id) el.classList.add('is-recommended');
      if (opt.zoneFilter && opt.zoneFilter !== 'all' && opt.zoneFilter !== t.zone) el.classList.add('dim');
      el.dataset.id = t.id;
      place(el, t);
      el.innerHTML = `<strong>${t.id}</strong><span>${t.seats}인</span>${st.sub ? `<small>${BT.esc(st.sub)}</small>` : ''}`;
      el.setAttribute('aria-label', `${t.id} ${t.seats}인석 ${st.title || ''}`);
      el.setAttribute('aria-pressed', opt.selected === t.id ? 'true' : 'false');
      if (opt.onSelect) el.addEventListener('click', () => opt.onSelect(t, st));
      canvas.appendChild(el);
    });
    host.appendChild(canvas);
    return canvas;
  }
  return { render, W, H, place };
})();
