/* A-02 서비스 관리자 (v2 프로토타입에서 옮김)
 * 동작: 점주 계정 상세 보기, 승인(2단계 확인), 승인 내역을 최근 활동에 추가
 * 승인 상태는 sessionStorage('bt.admin.approved')에 저장한다.
 * v2와 다른 점: AI 처리 방식을 "OpenAI API 사용 중"으로 고정하지 않고 매장 설정(STORE.ai)을 읽어 표시한다.
 */
(function () {
  const $ = s => document.querySelector(s);
  const A = BT_DATA.ADMIN, NOW = BT_DATA.OWNER_NOW;
  const S = { open: null, ask: null };
  const KEY = 'bt.admin.approved';
  const approved = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const saveApproved = v => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const AI_LABEL = { local: ['로컬 LLM', '매장 서버의 소형 모델 (Ollama). 문장이 외부로 나가지 않습니다.'], external: ['외부 API', '점주가 선택한 경우에만 외부 AI 서비스로 문장을 보냅니다.'], openai: ['외부 API', '점주가 선택한 경우에만 외부 AI 서비스로 문장을 보냅니다.'], off: ['사용 안 함', '채팅 없이 화면에서 직접 고릅니다.'] };

  function render() {
    const done = approved(), doneIds = done.map(x => x.id);
    const pending = A.pending.filter(p => !doneIds.includes(p.id));

    const tile = (k, label, v, d) => `<div class="stat"><span class="k"><span class="dot c-${k}"></span>${label}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
    const ai = AI_LABEL[BT.store().ai] || AI_LABEL.local;
    $('#stats').innerHTML = tile('booked', '등록 매장', A.stores.total + done.length, `운영 중 ${A.stores.open + done.length} · 점검 ${A.stores.check}`) +
      tile('waiting', '승인 대기', pending.length, '신규 점주 계정') +
      tile('visited', '오늘 예약', A.todayReservations, '전체 매장 기준') +
      tile('booked', 'AI 해석', ai[0], '규칙 파서가 먼저 처리');

    $('#ap-badge').textContent = pending.length ? `${pending.length}건 대기` : '대기 없음';
    $('#ap-list').innerHTML = A.pending.map(p => {
      const ok = doneIds.includes(p.id);
      return `<article class="stack" style="gap:8px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;${ok ? 'background:var(--surface-2)' : ''}">
        <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap;gap:12px">
          <div class="row" style="flex-wrap:nowrap;gap:12px;min-width:0">
            <span class="ai-mark" style="background:var(--teal-deep)" aria-hidden="true">${BT.esc(p.store[0])}</span>
            <div style="min-width:0"><b>${BT.esc(p.store)}</b><div class="hint">${BT.esc(p.owner)} · ${BT.esc(p.email)}</div><div class="hint">${BT.esc(p.area)} · ${BT.esc(p.category)}</div></div>
          </div>
          ${ok ? '<span class="badge badge-teal">승인 완료</span>' : '<span class="badge badge-amber">대기</span>'}
        </div>
        ${S.open === p.id ? `<dl class="kv" style="font-size:13px"><dt>계정 번호</dt><dd class="mono">${p.id}</dd><dt>사업자번호</dt><dd class="mono">${p.bizNo}</dd><dt>테이블 수</dt><dd>${p.tables}개</dd><dt>신청일</dt><dd>${BT.fmtDate(p.appliedAt)}</dd></dl>` : ''}
        ${S.ask === p.id ? `<p class="notice warn">${BT.esc(p.store)} 점주 계정을 승인하면 점주 대시보드와 예약 관리를 쓸 수 있게 됩니다.</p>
          <div class="form-row"><button type="button" class="btn btn-primary btn-sm" data-yes="${p.id}">네, 승인</button><button type="button" class="btn btn-ghost btn-sm" data-no>돌아가기</button></div>`
          : `<div class="row"><button type="button" class="btn btn-ghost btn-sm" data-open="${p.id}" aria-expanded="${S.open === p.id}">${S.open === p.id ? '상세 닫기' : '상세'}</button>
             ${ok ? '' : `<button type="button" class="btn btn-primary btn-sm" data-ask="${p.id}">승인</button>`}</div>`}
      </article>`;
    }).join('');
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { S.open = S.open === b.dataset.open ? null : b.dataset.open; render(); }));
    document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => { S.ask = b.dataset.ask; render(); $('[data-no]').focus(); }));
    document.querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', () => { S.ask = null; render(); }));
    document.querySelectorAll('[data-yes]').forEach(b => b.addEventListener('click', () => {
      const p = A.pending.find(x => x.id === b.dataset.yes), list = approved();
      if (!list.some(x => x.id === p.id)) { list.unshift({ id: p.id, store: p.store, time: NOW }); saveApproved(list); }
      S.ask = null; render(); BT.toast(`${p.store} 계정을 승인했어요`);
    }));

    $('#sv-list').innerHTML = A.services.map(([k, v]) => `<dt>${BT.esc(k)}</dt><dd>${v === 'ok' ? '<span class="badge badge-teal">정상</span>' : BT.esc(v)}</dd>`).join('');
    const acts = done.map(x => ({ time: x.time, title: '점주 계정 승인', desc: `${x.store} 계정 활성화` })).concat(A.activity);
    $('#ac-list').innerHTML = acts.map(a => `<li class="o"><b class="mono">${a.time}</b> · ${BT.esc(a.title)} · ${BT.esc(a.desc)}</li>`).join('');
  }
  // Internal sidebar items never change the page route or the outer HTML hash.
  // The admin page keeps its approval and service sections mounted while navigating.
  const adminNav = [...document.querySelectorAll('#admin-side [data-admin-target]')];
  function activateAdminTab(id) {
    adminNav.forEach(link => {
      const active = link.dataset.adminTarget === id;
      link.classList.toggle('on', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  document.querySelector('#admin-side').addEventListener('click', event => {
    const link = event.target.closest('a[data-admin-target]');
    if (!link) return;
    const id = link.dataset.adminTarget;
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    activateAdminTab(id);
    if (id === 'overview') window.scrollTo({ top: 0, behavior: 'smooth' });
    else section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  render();
})();
