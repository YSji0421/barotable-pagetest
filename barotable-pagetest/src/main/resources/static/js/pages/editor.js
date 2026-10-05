/* O-03 좌석도 편집
 * 구현: 층 추가 · 이름 변경 · 삭제, 구역 추가 · 이동 · 크기 조절 · 이름/색 변경 · 삭제
 *       테이블 · 시설 추가(누르기 또는 끌어다 놓기) · 이동 · 크기 조절 · 회전(45°) · 속성 수정 · 복제 · 삭제
 *       확대/축소, 저장 전 검사, 저장(sessionStorage → 손님 좌석도와 대시보드에 반영)
 * v2 프로토타입의 드래그 · 줌 · 회전 · 크기 조절을 옮겨 왔고, 좌표는 기존 1000 x 600 단위를 그대로 쓴다.
 */
(function () {
  const $ = s => document.querySelector(s);
  const W = 1000, H = 600, GRID = 10, ZMIN = 0.5, ZMAX = 2;
  let FL = BT.floors();
  const S = { floor: FL[0].id, sel: null, zoom: 1, dirty: false };
  const COLORS = ['teal', 'slate', 'amber', 'indigo', 'coral'];
  let delArm = false, resetArm = false;

  const PRESET = {
    round2: { seats: 2, shape: 'round', w: 90, h: 90 }, rect4: { seats: 4, shape: 'rect', w: 150, h: 80 },
    rect6: { seats: 6, shape: 'rect', w: 230, h: 80 }, bar2: { seats: 2, shape: 'bar', w: 140, h: 54 },
    room8: { seats: 8, shape: 'room', w: 272, h: 200 },
    window: { type: 'window', label: '창문', w: 220, h: 14 }, wall: { type: 'wall', label: '', w: 180, h: 10 },
    entrance: { type: 'entrance', label: '입구', w: 160, h: 30 }, kitchen: { type: 'kitchen', label: '주방', w: 200, h: 120 },
    restroom: { type: 'restroom', label: '화장실', w: 110, h: 110 }, stairs: { type: 'stairs', label: '계단', w: 110, h: 120 }
  };
  const FX_NAME = { window: '창문', wall: '벽', entrance: '입구', kitchen: '주방', restroom: '화장실', stairs: '계단' };
  const SHAPES = [['round', '원형'], ['rect', '사각'], ['bar', '바'], ['room', '룸']];
  /* 예약이 걸렸거나 지금 손님이 앉아 있는 테이블은 지우거나 번호를 바꿀 수 없다 (예약이 가리키는 자리가 사라지므로)
   * - 방문 예정(booked): 오늘 이후 예약
   * - 방문 완료(visited): 오늘, 기준 시각이 이용 시간(dineMinutes) 안에 있을 때 (워크인 포함) */
  const DINE = BT.store().dineMinutes;
  const holds = r => r.status === 'booked' ? r.date >= BT.TODAY
    : r.status === 'visited' && r.date === BT.TODAY && BT.toMin(BT.NOW) < BT.toMin(r.time) + DINE;
  const BOOKED = new Set(BT.reservations().filter(holds).map(r => r.table));

  const floor = () => FL.find(f => f.id === S.floor);
  const snap = v => Math.round(v / GRID) * GRID;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pct = (v, b) => (v / b * 100) + '%';
  const place = (el, o) => {
    el.style.left = pct(o.x, W); el.style.top = pct(o.y, H); el.style.width = pct(o.w, W); el.style.height = pct(o.h, H);
    el.style.setProperty('--rot', (o.rotation || 0) + 'deg');
  };
  const uid = p => p + Math.random().toString(36).slice(2, 7);
  const listOf = k => k === 'zone' ? floor().zones : k === 'table' ? floor().tables : floor().fixtures;
  const selObj = () => S.sel ? listOf(S.sel.k).find(o => o.id === S.sel.id) || null : null;
  const MIN = { zone: 40, table: 40, fixture: 8 };
  function zoneAt(f, t) {
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const z = f.zones.slice().reverse().find(z => cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h);
    return z ? z.id : null;
  }
  const regroup = f => f.tables.forEach(t => { t.zone = zoneAt(f, t); });
  const allTableIds = () => FL.flatMap(f => f.tables.map(t => t.id));
  function nextTableId(prefix) {
    const used = new Set(allTableIds());
    for (let n = 1; n < 1000; n++) { const id = prefix + String(n).padStart(2, '0'); if (!used.has(id)) return id; }
    return uid(prefix);
  }
  function touch() { S.dirty = true; renderSave(); }

  /* ---------- 층 ---------- */
  function renderFloors() {
    $('#floor-tabs').innerHTML = FL.map(f => `<button type="button" role="tab" class="tab ${f.id === S.floor ? 'on' : ''}" data-f="${f.id}" aria-selected="${f.id === S.floor}">${BT.esc(f.name)}<span class="count">테이블 ${f.tables.length}</span></button>`).join('');
    document.querySelectorAll('#floor-tabs .tab').forEach(b => b.addEventListener('click', () => { S.floor = b.dataset.f; S.sel = null; delArm = false; render(); }));
    if (document.activeElement !== $('#floor-name')) $('#floor-name').value = floor().name;
    const hasBooked = floor().tables.some(t => BOOKED.has(t.id));
    $('#del-floor').disabled = FL.length <= 1 || hasBooked;
    $('#del-floor').title = hasBooked ? '예약이 걸린 테이블이 있는 층은 지울 수 없어요' : '';
    $('#del-floor').textContent = delArm ? '한 번 더 누르면 삭제' : '이 층 삭제';
    $('#canvas-title').textContent = floor().name + ' 캔버스';
  }
  $('#floor-name').addEventListener('input', e => { floor().name = e.target.value; renderFloors(); touch(); });
  $('#add-floor').addEventListener('click', () => {
    const f = { id: uid('F'), name: (FL.length + 1) + '층', zones: [{ id: uid('z-'), name: '홀', x: 30, y: 36, w: 800, h: 520, color: 'slate' }], fixtures: [{ id: uid('fx'), type: 'stairs', label: '계단', x: 860, y: 36, w: 110, h: 120 }], tables: [] };
    FL.push(f); S.floor = f.id; S.sel = { k: 'zone', id: f.zones[0].id }; render(); touch();
    BT.toast(`${f.name}을 추가했어요. 테이블을 놓아 보세요`);
  });
  $('#del-floor').addEventListener('click', () => {
    if ($('#del-floor').disabled) return;
    if (!delArm) { delArm = true; renderFloors(); setTimeout(() => { delArm = false; renderFloors(); }, 3000); return; }
    FL = FL.filter(f => f.id !== S.floor); S.floor = FL[0].id; S.sel = null; delArm = false; render(); touch();
  });

  /* ---------- 추가 ---------- */
  $('#add-zone').addEventListener('click', () => {
    const f = floor(), n = f.zones.length;
    const z = { id: uid('z-'), name: '새 구역 ' + (n + 1), x: 300 + (n % 4) * 30, y: 200 + (n % 4) * 30, w: 260, h: 180, color: COLORS[n % COLORS.length] };
    f.zones.push(z); S.sel = { k: 'zone', id: z.id }; regroup(f); render(); touch();
  });
  function addObject(kind, key, cx, cy) {
    const p = PRESET[key], f = floor();
    if (cx == null) { const n = (kind === 'table' ? f.tables : f.fixtures).length % 5; cx = W / 2 + n * 20; cy = H / 2 + n * 20; }
    const box = { x: clamp(snap(cx - p.w / 2), 0, W - p.w), y: clamp(snap(cy - p.h / 2), 0, H - p.h), w: p.w, h: p.h, rotation: 0 };
    let o;
    if (kind === 'table') {
      o = Object.assign({ id: nextTableId(p.shape === 'room' ? 'R' : 'T'), seats: p.seats, shape: p.shape, tags: [], combinable: false }, box);
      f.tables.push(o); regroup(f);
    } else {
      o = Object.assign({ id: uid('fx'), type: p.type, label: p.label }, box);
      f.fixtures.push(o);
    }
    S.sel = { k: kind, id: o.id }; render(); touch();
    BT.toast(kind === 'table' ? `${o.id} (${o.seats}인)을 놓았어요` : `${FX_NAME[o.type]}을 놓았어요`);
  }
  document.querySelectorAll('.palette [data-add]').forEach(b => {
    b.addEventListener('click', () => addObject(b.dataset.add, b.dataset.preset));
    b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', b.dataset.add + ':' + b.dataset.preset); e.dataTransfer.effectAllowed = 'copy'; });
  });

  /* ---------- 캔버스 ---------- */
  function renderCanvas() {
    const f = floor(), host = $('#canvas'); host.innerHTML = '';
    const cv = document.createElement('div'); cv.className = 'map-canvas'; cv.setAttribute('aria-label', f.name + ' 편집 캔버스');
    cv.style.width = (S.zoom * 100) + '%'; cv.style.minWidth = (600 * S.zoom) + 'px';
    const isSel = (k, id) => S.sel && S.sel.k === k && S.sel.id === id;
    f.zones.forEach(z => {
      const sel = isSel('zone', z.id);
      const el = document.createElement('div'); el.className = `map-zone zone-${z.color} ed-item ${sel ? 'ed-sel' : ''}`; place(el, z);
      const rule = [z.minParty ? z.minParty + '인 이상' : '', z.maxParty ? z.maxParty + '인 이하' : ''].filter(Boolean).join(' · ');
      el.innerHTML = `<span class="zone-label">${BT.esc(z.name)}${rule ? ' <em>' + rule + '</em>' : ''}</span>${sel ? '<span class="ed-handle" data-resize="1"></span>' : ''}`;
      bindDrag(el, z, 'zone'); cv.appendChild(el);
    });
    f.fixtures.forEach(x => {
      const sel = isSel('fixture', x.id);
      const el = document.createElement('div'); el.className = `map-fixture fx-${x.type} ed-item ${sel ? 'ed-sel' : ''}`; place(el, x);
      el.innerHTML = `${x.label ? `<span>${BT.esc(x.label)}</span>` : ''}${sel ? '<span class="ed-handle" data-resize="1"></span>' : ''}`;
      el.title = FX_NAME[x.type] || x.type;
      bindDrag(el, x, 'fixture'); cv.appendChild(el);
    });
    f.tables.forEach(t => {
      const sel = isSel('table', t.id);
      const el = document.createElement('div'); el.className = `map-table shape-${t.shape} st-available ed-item ${sel ? 'ed-sel' : ''}`; place(el, t);
      el.innerHTML = `<strong>${BT.esc(t.id)}</strong><span>${t.seats}인</span>${sel ? '<span class="ed-handle" data-resize="1"></span>' : ''}`;
      bindDrag(el, t, 'table'); cv.appendChild(el);
    });
    cv.addEventListener('pointerdown', e => { if (e.target === cv) { S.sel = null; render(); } });
    /* 팔레트에서 끌어다 놓기 */
    cv.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; cv.classList.add('ed-drop'); });
    cv.addEventListener('dragleave', () => cv.classList.remove('ed-drop'));
    cv.addEventListener('drop', e => {
      e.preventDefault(); cv.classList.remove('ed-drop');
      const [kind, key] = (e.dataTransfer.getData('text/plain') || '').split(':');
      if (!PRESET[key]) return;
      const r = cv.getBoundingClientRect();
      addObject(kind, key, (e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    });
    host.appendChild(cv);
    $('#zoom-val').textContent = Math.round(S.zoom * 100) + '%';
    $('#zoom-out').disabled = S.zoom <= ZMIN; $('#zoom-in').disabled = S.zoom >= ZMAX;
  }
  /* 누르면 바로 선택하고 같은 동작으로 끌기까지 이어진다 */
  function bindDrag(el, o, kind) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const resize = !!e.target.dataset.resize;
      const already = S.sel && S.sel.k === kind && S.sel.id === o.id;
      S.sel = { k: kind, id: o.id };
      if (!already) { document.querySelectorAll('#canvas .ed-sel').forEach(x => x.classList.remove('ed-sel')); el.classList.add('ed-sel'); }
      const rect = el.parentElement.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, s0 = { x: o.x, y: o.y, w: o.w, h: o.h };
      let moved = false;
      el.setPointerCapture(e.pointerId);
      const move = ev => {
        const dx = (ev.clientX - sx) / rect.width * W, dy = (ev.clientY - sy) / rect.height * H;
        if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        moved = true;
        if (resize) { o.w = clamp(snap(s0.w + dx), MIN[kind], W - o.x); o.h = clamp(snap(s0.h + dy), MIN[kind], H - o.y); }
        else { o.x = clamp(snap(s0.x + dx), 0, W - o.w); o.y = clamp(snap(s0.y + dy), 0, H - o.h); }
        place(el, o);
      };
      const up = () => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (moved) { regroup(floor()); touch(); }
        render();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }

  /* ---------- 확대 / 축소 ---------- */
  function setZoom(z) { S.zoom = clamp(Math.round(z * 4) / 4, ZMIN, ZMAX); renderCanvas(); }
  $('#zoom-in').addEventListener('click', () => setZoom(S.zoom + 0.25));
  $('#zoom-out').addEventListener('click', () => setZoom(S.zoom - 0.25));
  $('#zoom-fit').addEventListener('click', () => setZoom(1));
  $('#canvas-scroll').addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(S.zoom + (e.deltaY < 0 ? 0.25 : -0.25)); }, { passive: false });

  /* ---------- 키보드: 방향키 이동, Delete 삭제 ---------- */
  document.addEventListener('keydown', e => {
    const o = selObj();
    if (!o || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const step = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0], ArrowUp: [0, -GRID], ArrowDown: [0, GRID] }[e.key];
    if (step) {
      e.preventDefault();
      o.x = clamp(o.x + step[0], 0, W - o.w); o.y = clamp(o.y + step[1], 0, H - o.h);
      regroup(floor()); touch(); renderCanvas(); renderSide();
    } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
  });

  function removeSel() {
    const o = selObj(); if (!o) return;
    const f = floor(), k = S.sel.k;
    if (k === 'table' && BOOKED.has(o.id)) { BT.toast(`${o.id}에는 예약이나 이용 중인 손님이 있어 지울 수 없어요`); return; }
    if (k === 'zone') f.zones = f.zones.filter(x => x !== o);
    else if (k === 'table') f.tables = f.tables.filter(x => x !== o);
    else f.fixtures = f.fixtures.filter(x => x !== o);
    regroup(f); S.sel = null; render(); touch();
  }
  function duplicateSel() {
    const o = selObj(); if (!o) return;
    const f = floor(), k = S.sel.k;
    const c = JSON.parse(JSON.stringify(o));
    c.x = clamp(o.x + 30, 0, W - o.w); c.y = clamp(o.y + 30, 0, H - o.h);
    if (k === 'table') { c.id = nextTableId(o.shape === 'room' ? 'R' : 'T'); f.tables.push(c); regroup(f); }
    else { c.id = uid('fx'); f.fixtures.push(c); }
    S.sel = { k, id: c.id }; render(); touch();
  }

  /* ---------- 속성 패널 ---------- */
  function sizeAndRotate(o, kind) {
    return `<div class="form-row">
        <div class="field"><label for="p-w">너비</label><input class="input" type="number" id="p-w" min="${MIN[kind]}" max="${W}" step="10" value="${o.w}"></div>
        <div class="field"><label for="p-h">높이</label><input class="input" type="number" id="p-h" min="${MIN[kind]}" max="${H}" step="10" value="${o.h}"></div>
      </div>
      <div class="field"><span class="field-label">회전 <b class="mono">${o.rotation || 0}°</b></span>
        <div class="rot-row"><button class="btn btn-ghost btn-sm" type="button" data-rot="-45">↶ 45°</button><button class="btn btn-ghost btn-sm" type="button" data-rot="45">↷ 45°</button><button class="btn btn-ghost btn-sm" type="button" data-rot="0">0°로</button></div></div>
      <p class="hint mono">위치 X ${o.x} · Y ${o.y}</p>
      <div class="form-row"><button class="btn btn-soft btn-sm" type="button" id="p-dup">복제</button><button class="btn btn-danger btn-sm" type="button" id="p-del">삭제</button></div>`;
  }
  function bindCommon(o, kind) {
    const p = $('#props');
    const num = (id, key) => p.querySelector(id).addEventListener('change', e => {
      const v = clamp(snap(+e.target.value || 0), MIN[kind], key === 'w' ? W - o.x : H - o.y);
      o[key] = v; e.target.value = v; regroup(floor()); touch(); renderCanvas();
    });
    num('#p-w', 'w'); num('#p-h', 'h');
    p.querySelectorAll('[data-rot]').forEach(b => b.addEventListener('click', () => {
      const d = +b.dataset.rot; o.rotation = d === 0 ? 0 : (((o.rotation || 0) + d) % 360 + 360) % 360; touch(); render();
    }));
    p.querySelector('#p-dup').addEventListener('click', duplicateSel);
    p.querySelector('#p-del').addEventListener('click', removeSel);
  }

  function renderSide() {
    const f = floor(), p = $('#props');
    $('#zone-chips').innerHTML = f.zones.map(z => `<button type="button" class="chip ${S.sel && S.sel.id === z.id ? 'on' : ''}" data-z="${z.id}"><span class="zone-swatch sw-${z.color}"></span>${BT.esc(z.name)} <span class="faint">${f.tables.filter(t => t.zone === z.id).length}</span></button>`).join('');
    document.querySelectorAll('#zone-chips [data-z]').forEach(b => b.addEventListener('click', () => { S.sel = { k: 'zone', id: b.dataset.z }; render(); }));
    const o = selObj();
    if (!o) {
      p.innerHTML = `<h2 style="font-size:16px">${BT.esc(f.name)}</h2>
        <p class="hint">테이블 ${f.tables.length}개 · 좌석 ${f.tables.reduce((s, t) => s + t.seats, 0)}석 · 시설 ${f.fixtures.length}개</p>
        <div class="zone-list">${f.zones.map(z => `<div class="zone-item" data-z="${z.id}" tabindex="0"><span class="zone-swatch sw-${z.color}"></span>${BT.esc(z.name)}<span class="cnt">테이블 ${f.tables.filter(t => t.zone === z.id).length}</span></div>`).join('') || '<p class="muted">아직 구역이 없어요. 왼쪽에서 구역을 추가하세요.</p>'}</div>
        <p class="hint">테이블은 놓인 구역에 자동으로 묶입니다. 구역에 인원 조건이 있으면 손님 추천에도 그대로 쓰입니다.</p>`;
      p.querySelectorAll('[data-z]').forEach(el => el.addEventListener('click', () => { S.sel = { k: 'zone', id: el.dataset.z }; render(); }));
      return;
    }
    if (S.sel.k === 'zone') {
      const z = o, inside = f.tables.filter(t => t.zone === z.id);
      p.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="font-size:16px">구역 속성</h2><span class="badge badge-indigo">${BT.esc(f.name)}</span></div>
        <div class="field"><label for="pz-name">구역 이름</label><input class="input" id="pz-name" value="${BT.esc(z.name)}" maxlength="12"></div>
        <div class="field"><span class="field-label">색상</span><div class="color-pick">${COLORS.map(c => `<button type="button" class="sw-${c} ${z.color === c ? 'on' : ''}" data-c="${c}" aria-label="${c}"></button>`).join('')}</div></div>
        <div class="field"><span class="field-label">포함된 테이블 ${inside.length}개</span><div class="tags">${inside.map(t => `<span class="badge badge-gray">${BT.esc(t.id)} · ${t.seats}인</span>`).join('') || '<span class="faint">없음</span>'}</div></div>
        <button class="btn btn-danger btn-sm" id="pz-del" type="button">구역 삭제</button>`;
      $('#pz-name').addEventListener('input', e => { z.name = e.target.value; touch(); renderCanvas(); });
      p.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { z.color = b.dataset.c; touch(); render(); }));
      $('#pz-del').addEventListener('click', removeSel);
      return;
    }
    if (S.sel.k === 'table') {
      const t = o, z = f.zones.find(x => x.id === t.zone), locked = BOOKED.has(t.id);
      p.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="font-size:16px">테이블 속성</h2><span class="badge badge-indigo">${BT.esc(f.name)} · ${BT.esc(z ? z.name : '구역 밖')}</span></div>
        <div class="field"><label for="p-id">테이블 번호</label><input class="input mono" id="p-id" value="${BT.esc(t.id)}" maxlength="5" ${locked ? 'readonly' : ''}>
          ${locked ? '<span class="hint">예약이 있거나 손님이 이용 중이라 번호를 바꾸거나 지울 수 없어요.</span>' : '<span class="hint" id="p-id-msg"></span>'}</div>
        <div class="form-row">
          <div class="field"><label for="p-seats">좌석 수</label><input class="input" type="number" id="p-seats" min="1" max="20" value="${t.seats}"></div>
          <div class="field"><label for="p-shape">모양</label><select class="select" id="p-shape">${SHAPES.map(([v, l]) => `<option value="${v}" ${t.shape === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="p-tags">특징 태그</label><input class="input" id="p-tags" value="${BT.esc(t.tags.join(', '))}" placeholder="예: 창가, 조용함"></div>
        <label class="check" style="padding:8px 10px"><input type="checkbox" id="p-comb" ${t.combinable ? 'checked' : ''}><span>옆 테이블과 붙일 수 있음</span></label>
        ${sizeAndRotate(t, 'table')}`;
      if (!locked) $('#p-id').addEventListener('change', e => {
        const v = e.target.value.trim().toUpperCase(), msg = $('#p-id-msg');
        if (!/^[A-Z]{1,2}\d{1,3}$/.test(v)) { msg.textContent = '영문 1–2자 + 숫자로 적어 주세요 (예: T12)'; e.target.value = t.id; return; }
        if (v !== t.id && allTableIds().includes(v)) { msg.textContent = `${v}는 이미 있어요`; e.target.value = t.id; return; }
        t.id = v; S.sel.id = v; msg.textContent = ''; touch(); renderCanvas(); renderFloors();
      });
      $('#p-seats').addEventListener('change', e => { t.seats = clamp(Math.round(+e.target.value || 1), 1, 20); e.target.value = t.seats; touch(); renderCanvas(); renderFloors(); });
      $('#p-shape').addEventListener('change', e => { t.shape = e.target.value; touch(); renderCanvas(); });
      $('#p-tags').addEventListener('input', e => { t.tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean); touch(); });
      $('#p-comb').addEventListener('change', e => { t.combinable = e.target.checked; touch(); });
      bindCommon(t, 'table');
      if (locked) { $('#p-del').disabled = true; $('#p-del').title = '예약 또는 이용 중인 테이블'; }
      return;
    }
    const x = o;
    p.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="font-size:16px">시설 속성</h2><span class="badge badge-gray">${FX_NAME[x.type] || x.type}</span></div>
      <div class="field"><label for="p-label">표시 이름</label><input class="input" id="p-label" value="${BT.esc(x.label || '')}" maxlength="12" placeholder="비우면 이름 없이 표시"></div>
      ${sizeAndRotate(x, 'fixture')}`;
    $('#p-label').addEventListener('input', e => { x.label = e.target.value; touch(); renderCanvas(); });
    bindCommon(x, 'fixture');
  }

  /* ---------- 저장 ----------
   * BT.floors()가 'bt.floors'를 읽으므로 저장하면 손님 좌석도와 대시보드에 그대로 반영된다 */
  const saveFloors = fl => { try { sessionStorage.setItem('bt.floors', JSON.stringify(fl)); } catch (e) {} };
  const resetFloors = () => { try { sessionStorage.removeItem('bt.floors'); } catch (e) {} };
  function validate() {
    const out = [], ids = {};
    FL.forEach(f => f.tables.forEach(t => { (ids[t.id] = ids[t.id] || []).push(f.name); }));
    Object.entries(ids).filter(([, v]) => v.length > 1).forEach(([id, v]) => out.push(['e', `테이블 번호 ${id}가 ${v.join(', ')}에 겹쳐요`]));
    BOOKED.forEach(id => { if (!ids[id]) out.push(['e', `예약이 걸린 ${id}가 좌석도에 없어요`]); });
    FL.forEach(f => {
      if (!f.tables.length) out.push(['w', `${f.name}에 테이블이 없어요`]);
      f.tables.forEach((a, i) => {
        if (!a.zone) out.push(['w', `${f.name} ${a.id}가 구역 밖에 있어요. 손님 화면 구역 필터에 안 보여요`]);
        f.tables.slice(i + 1).forEach(b => {
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(['w', `${f.name} ${a.id}와 ${b.id}가 겹쳐요`]);
        });
      });
    });
    return out;
  }
  function renderSave() {
    const s = $('#save-state');
    s.textContent = S.dirty ? '저장하지 않은 변경이 있어요' : '저장된 배치';
    s.classList.toggle('dirty', S.dirty);
    $('#layout-reset').textContent = resetArm ? '한 번 더 누르면 되돌림' : '처음 배치로';
  }
  $('#layout-save').addEventListener('click', () => {
    const res = validate(), box = $('#save-result'), errs = res.filter(r => r[0] === 'e');
    if (!errs.length) { saveFloors(FL); S.dirty = false; renderSave(); }
    const done = errs.length ? [] : [['o', '저장했어요. 손님 좌석도와 대시보드에 바로 반영됩니다.']];
    box.hidden = false;
    box.innerHTML = res.concat(done).map(([k, m]) => `<li class="${k}">${BT.esc(m)}</li>`).join('');
  });
  $('#layout-reset').addEventListener('click', () => {
    if (!resetArm) { resetArm = true; renderSave(); setTimeout(() => { resetArm = false; renderSave(); }, 3000); return; }
    resetArm = false; resetFloors(); FL = BT.floors(); S.floor = FL[0].id; S.sel = null; S.dirty = false;
    $('#save-result').hidden = true; render(); BT.toast('처음 배치로 되돌렸어요');
  });
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  function render() { renderFloors(); renderCanvas(); renderSide(); renderSave(); }
  render();
})();
