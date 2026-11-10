/* 바로테이블 서비스 관리자 — 운영 콘솔 UI (시연 데이터, 서버 연동 없음)
   다른 고객·점주 화면의 데이터/기능은 변경하지 않습니다. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DATA = BT_DATA.ADMIN;
  const STORAGE = 'bt.admin.console.v3';
  const APPROVED_LEGACY = 'bt.admin.approved';
  const STORE_SEED = [
    ['ST-001','바로키친 성수점','서울 성동구','다이닝',11,'open'],
    ['ST-002','그린포크 브런치','서울 강남구','브런치',14,'open'],
    ['ST-003','라이트 테이블','서울 마포구','양식',10,'open'],
    ['ST-004','정원식당','서울 서초구','한식',8,'open'],
    ['ST-005','모노 다이닝','경기 성남시','다이닝',12,'open'],
    ['ST-006','나무 스시','서울 용산구','일식',13,'open'],
    ['ST-007','오후의 식탁','서울 종로구','카페',9,'open'],
    ['ST-008','도도 비스트로','서울 송파구','비스트로',16,'open'],
    ['ST-009','어반 그릴','인천 연수구','그릴',12,'open'],
    ['ST-010','테라스 키친','서울 광진구','양식',15,'open'],
    ['ST-011','여름 파스타','서울 중구','이탈리안',10,'open'],
    ['ST-012','슬로우 바이트','경기 수원시','다이닝',7,'check']
  ].map(([id,name,area,category,tables,status])=>({id,name,area,category,tables,status}));
  /* 기본 활동 기록은 오늘(BT.TODAY)과 어제 날짜로 표시 */
  const dayLabel = n => { const d = BT.parseDate(BT.TODAY); d.setDate(d.getDate() - n); return BT.iso(d).replace(/-/g, '.'); };
  const DEFAULT_ACTIVITY = [
    {time:dayLabel(0)+' 16:42',type:'account',title:'점주 계정 승인',desc:'바로키친 성수점 계정 활성화'},
    {time:dayLabel(0)+' 11:25',type:'system',title:'서비스 점검',desc:'예약 및 좌석도 서비스 상태 확인'},
    {time:dayLabel(1)+' 17:35',type:'store',title:'매장 정보 검토',desc:'슬로우 바이트 운영 점검 대상 등록'}
  ];
  /* 예약 접수 추이 그래프의 요일: 마지막 막대가 오늘 */
  const WEEK_LABELS = Array.from({length: 7}, (_, i) => { const d = BT.parseDate(BT.TODAY); d.setDate(d.getDate() - 6 + i); return '일월화수목금토'[d.getDay()]; });
  const BOOKING_WEEKS = [64,71,76,62,90,81,84];
  const BOOKING_MONTH = [68,62,73,71,77,80,69,72,85,80,79,94,83,76,67,71,80,78,86,82,92,88,73,74,90,83,70,90,81,84];
  let model;
  try { model = JSON.parse(sessionStorage.getItem(STORAGE)) || {}; } catch (_) {model = {};}
  model.decisions ||= {};
  model.storeStatus ||= {};
  model.activity ||= [];
  model.note ??= '';
  try {
    const legacy = JSON.parse(sessionStorage.getItem(APPROVED_LEGACY)) || [];
    legacy.forEach(item => {if (item && item.id && !model.decisions[item.id]) model.decisions[item.id] = {status:'approved',time:item.time||'2026.10.16',reason:''}; });
  } catch (_) {}
  const state={approvalFilter:'pending', approvalSearch:'', storeSearch:'', storeFilter:'all', period:7, activityFilter:'all', activityLimit:5, detail:null};
  const persist=()=>{try{sessionStorage.setItem(STORAGE,JSON.stringify(model));}catch(_){}};
  const notify=msg=>{if (window.BT && BT.toast) BT.toast(msg);else alert(msg);};
  const statuses = {pending:'대기',approved:'승인 완료',rejected:'반려'};
  const storeLabels = {open:'운영 중',check:'점검 중',paused:'운영 중지'};
  const icon = {open:'●',check:'●',paused:'●'};
  const readableTime=()=>new Date().toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(/\.$/,'');
  const approvals=()=>DATA.pending.map(p=>({...p,status:model.decisions[p.id]?.status||'pending',rejectReason:model.decisions[p.id]?.reason||''}));
  const stores=()=>STORE_SEED.map(p=>({...p,status:model.storeStatus[p.id]||p.status})).concat(DATA.pending.filter(p=>(model.decisions[p.id]?.status||'pending')==='approved').map(p=>({id:p.id,name:p.store,area:p.area,category:p.category,tables:p.tables,status:model.storeStatus[p.id]||'open'})));
  const events=()=>[...model.activity, ...DEFAULT_ACTIVITY];
  function addEvent(type,title,desc){model.activity.unshift({time:readableTime(),type,title,desc});persist();}
  function pill(name,type){return `<span class="adm-chip ${type||''}">${esc(name)}</span>`;}
  function renderStats(){
    const list=approvals(), shops=stores(), pending=list.filter(p=>p.status==='pending').length, service=shops.filter(s=>s.status==='check'||s.status==='paused').length;
    const kpis=[['▤','등록 매장',shops.length+'개','기본 12개 + 신규 승인 매장'],['✓','승인 대기',pending+'건','점주 가입 검토 필요'],['▥','오늘 예약',DATA.todayReservations+'건','전체 매장 기준'],['◉','점검 대상 매장',service+'곳','운영 상태 확인 필요']];
    $('#stats').innerHTML=kpis.map(([ic,label,value,desc])=>`<div class="adm-kpi"><div class="kpi-name">${label}<span class="kpi-icon">${ic}</span></div><div class="kpi-value">${value}</div><div class="kpi-caption">${desc}</div></div>`).join('');
    $('#ap-badge').textContent=`${pending}건 대기`;
    $('#side-pending-count').textContent=pending;
    $('#quick-pending').textContent=`대기 ${pending}건`;
    $('#today-pending').textContent=pending+'건';
    $('#today-check').textContent=service+'곳';
    $('#store-total-count').textContent=shops.length;
    $('#today-bookings').textContent=DATA.todayReservations+'건';
  }
  function renderApprovals(){
    const entries=approvals().filter(p=>(state.approvalFilter==='all'||p.status===state.approvalFilter) && [p.store,p.owner,p.area,p.id,p.email].some(x=>String(x).toLowerCase().includes(state.approvalSearch.toLowerCase())));
    $('#ap-list').innerHTML=entries.length?entries.map(p=>{
      const expanded=state.detail===p.id;
      const cls=p.status==='pending'?'amber':p.status==='approved'?'green':'red';
      return `<article class="admin-approval-item"><div class="top"><span class="admin-approval-logo">${esc(p.store.charAt(0))}</span><div class="info"><div class="admin-approval-name">${esc(p.store)}</div><div class="admin-approval-meta"><span>담당자 ${esc(p.owner)}</span><span>${esc(p.area)} · ${esc(p.category)}</span><span>${esc(p.appliedAt)} 신청</span></div></div>${pill(statuses[p.status],cls)}</div>
       ${expanded?`<div class="admin-approval-details"><div><span>신청번호</span><b>${esc(p.id)}</b></div><div><span>담당자 이메일</span><b>${esc(p.email)}</b></div><div><span>사업자등록번호</span><b>${esc(p.bizNo)}</b></div><div><span>테이블 수</span><b>${esc(p.tables)}개</b></div>${p.status==='rejected'?`<div style="grid-column:1/-1"><span>반려 사유</span><b>${esc(p.rejectReason||'사유 없음')}</b></div>`:''}</div>`:''}
       <div class="admin-approval-actions"><button type="button" class="adm-btn secondary" data-admin-detail="${esc(p.id)}">${expanded?'상세 접기':'신청 정보 상세'}</button>${p.status==='pending'?`<button type="button" class="adm-btn" data-admin-decision="approved" data-id="${esc(p.id)}">승인</button><button type="button" class="adm-btn danger" data-admin-decision="rejected" data-id="${esc(p.id)}">반려</button>`:''}</div></article>`;
    }).join(''):'<div class="adm-empty">선택한 조건에 해당하는 점주 신청이 없습니다.</div>';
    $$('#approval-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.approvalFilter===state.approvalFilter));
  }
  function renderStores(){
    const filtered=stores().filter(s=>(state.storeFilter==='all'||s.status===state.storeFilter)&&[s.name,s.area,s.category,s.id].some(x=>String(x).toLowerCase().includes(state.storeSearch.toLowerCase())));
    $('#store-rows').innerHTML=filtered.length?filtered.map(s=>`<tr><td><span class="store-primary">${esc(s.name)}</span><div style="font-size:10px;color:#a4a8ad;margin-top:4px">${esc(s.id)}</div></td><td>${esc(s.area)}</td><td>${esc(s.category)}</td><td>${esc(s.tables)}개</td><td>${pill(storeLabels[s.status],s.status==='open'?'green':s.status==='check'?'amber':'red')}</td><td><button type="button" class="adm-btn secondary" data-store-detail="${esc(s.id)}">관리</button></td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:#9aa0a5;padding:25px">검색된 매장이 없습니다.</td></tr>';
    $('#store-count-label').textContent=`${filtered.length}개 매장 표시 / 전체 ${stores().length}개`;
  }
  function renderBooking(){
    const dataset=state.period===7?BOOKING_WEEKS:BOOKING_MONTH;
    const maximum=Math.max(...dataset,1);
    $('#booking-chart').innerHTML=dataset.map((v,i)=>`<div class="adm-bar-unit"><div class="adm-bar ${i===dataset.length-1?'today':''}" style="height:${Math.max(3,Math.round(v/maximum*100))}%" data-value="${v}건" title="${v}건"></div><span>${state.period===7?WEEK_LABELS[i]:(i+1)%5===0||i===29?(i+1)+'일':''}</span></div>`).join('');
    const total=dataset.reduce((a,b)=>a+b,0);
    $('#chart-period-label').textContent=`최근 ${state.period}일`;
    $('#booking-period-total').textContent=total.toLocaleString('ko-KR')+'건';
    $('#booking-period-avg').textContent=Math.round(total/dataset.length)+'건';
    $('#booking-chart').setAttribute('aria-label',`최근 ${state.period}일 예약 수, 합계 ${total}건, 일평균 ${Math.round(total/dataset.length)}건`);
    const counts=[['확정',62,'#28517a'],['방문 완료',15,'#74a6db'],['취소',5,'#e3a651'],['노쇼',2,'#dd7d70']];
    $('#booking-status-list').innerHTML=counts.map(([name,num,color])=>`<div class="adm-status-line"><span>${name}</span><span class="adm-status-track"><div style="width:${num/DATA.todayReservations*100}%;background:${color}"></div></span><b style="color:${color};text-align:right">${num}</b></div>`).join('');
    $$('#booking-period button').forEach(b=>b.classList.toggle('active',Number(b.dataset.period)===state.period));
  }
  function renderServices(){
    const serviceItems=[['웹 예약','고객 예약 화면 및 단계별 진행','정상'],['좌석도·테이블 선택','선택 조건별 자리 배치도','정상'],['점주 관리 화면','예약·좌석·운영 조건 관리','정상'],['점검 대상 매장',`${stores().filter(s=>s.status!=='open').length}곳의 운영 상태 확인 필요`,'확인 필요']];
    $('#sv-list').innerHTML=serviceItems.map(([a,b,status])=>`<div class="admin-service-item"><div><strong>${esc(a)}</strong><p>${esc(b)}</p></div>${pill(status,status==='정상'?'green':'amber')}</div>`).join('');
    $('#ops-note').value=model.note;
  }
  function renderActivities(){
    const logs=events().filter(e=>state.activityFilter==='all'||e.type===state.activityFilter);
    $('#ac-list').innerHTML=logs.slice(0,state.activityLimit).map(e=>`<li><span class="admin-activity-dot"></span><div class="admin-activity-body"><b>${esc(e.title)}</b><p>${esc(e.desc)}</p></div><span class="admin-activity-time">${esc(e.time)}</span></li>`).join('')||'<li class="adm-empty">표시할 기록이 없습니다.</li>';
    $('#activity-more').disabled=state.activityLimit>=logs.length;
    $('#activity-more').textContent=state.activityLimit>=logs.length?'모두 표시됨':'더 보기';
  }
  function renderAll(){renderStats();renderApprovals();renderStores();renderBooking();renderServices();renderActivities();}
  const modalRoot=$('#admin-dialog-root');
  function closeDialog(){modalRoot.innerHTML='';}
  function openDialog(body){modalRoot.innerHTML=`<div class="adm-modal-backdrop" id="admin-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" class="adm-modal">${body}</section></div>`; const auto=modalRoot.querySelector('button');if(auto)auto.focus();}
  function askDecision(id,status){
    const p=DATA.pending.find(x=>x.id===id);if(!p||model.decisions[p.id])return;
    const approve=status==='approved';
    openDialog(`<h2 id="admin-dialog-title">${approve?'점주 계정을 승인할까요?':'점주 계정을 반려할까요?'}</h2><p>${esc(p.store)} · ${esc(p.owner)}의 신청 내역입니다. 변경 사항은 현재 화면에 반영됩니다.</p><div class="adm-modal-meta"><b>신청번호</b> ${esc(p.id)}<br><b>지역</b> ${esc(p.area)}<br><b>사업자번호</b> ${esc(p.bizNo)}</div>${!approve?'<label style="font-size:12px;font-weight:700">반려 사유 (선택)<textarea class="adm-reject-reason" id="admin-reject-reason" maxlength="150" placeholder="검토가 필요한 이유를 적어 주세요."></textarea></label>':''}<div class="adm-modal-actions"><button type="button" class="adm-btn secondary" data-modal-cancel>취소</button><button type="button" class="adm-btn ${approve?'':'danger'}" data-modal-confirm="decision" data-id="${esc(id)}" data-value="${status}">${approve?'승인 확정':'반려 확정'}</button></div>`);
  }
  function askStore(id){
    const s=stores().find(v=>v.id===id);if(!s)return;
    const isOpen=s.status==='open';
    openDialog(`<h2 id="admin-dialog-title">매장 관리 · ${esc(s.name)}</h2><p>매장 기본 정보와 운영 상태를 확인합니다.</p><div class="adm-modal-meta"><b>매장 코드</b> ${esc(s.id)}<br><b>지역</b> ${esc(s.area)}<br><b>업종</b> ${esc(s.category)}<br><b>테이블</b> ${s.tables}개<br><b>현재 상태</b> ${esc(storeLabels[s.status])}</div><label for="admin-next-store-status" style="font-size:12px;font-weight:750;color:#374655">운영 상태 변경</label><select id="admin-next-store-status" class="adm-select" style="display:block;width:100%;margin-top:8px"><option value="open" ${s.status==='open'?'selected':''}>운영 중</option><option value="check" ${s.status==='check'?'selected':''}>점검 중</option><option value="paused" ${s.status==='paused'?'selected':''}>운영 중지</option></select><p>현재 화면의 운영 상태만 변경됩니다. 실제 예약 접수에는 영향을 주지 않습니다.</p><div class="adm-modal-actions"><button type="button" class="adm-btn secondary" data-modal-cancel>닫기</button><button type="button" class="adm-btn" data-modal-confirm="store" data-id="${esc(s.id)}">변경 적용</button></div>`);
  }
  function jumpTo(id){
    const el=document.getElementById(id);if(!el)return;
    $$('#admin-side [data-admin-target]').forEach(link=>{const ok=link.dataset.adminTarget===id;link.classList.toggle('on',ok);if(ok)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});
    if(id==='overview')window.scrollTo({top:0,behavior:'smooth'});
    else el.scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest('#admin-side [data-admin-target]');if(nav){e.preventDefault();e.stopPropagation();jumpTo(nav.dataset.adminTarget);return;}
    const jump=e.target.closest('[data-jump]');if(jump){jumpTo(jump.dataset.jump);return;}
    const decision=e.target.closest('[data-admin-decision]');if(decision){askDecision(decision.dataset.id,decision.dataset.adminDecision);return;}
    const detail=e.target.closest('[data-admin-detail]');if(detail){state.detail=state.detail===detail.dataset.adminDetail?null:detail.dataset.adminDetail;renderApprovals();return;}
    const store=e.target.closest('[data-store-detail]');if(store){askStore(store.dataset.storeDetail);return;}
    const tab=e.target.closest('[data-approval-filter]');if(tab){state.approvalFilter=tab.dataset.approvalFilter;renderApprovals();return;}
    const period=e.target.closest('[data-period]');if(period){state.period=Number(period.dataset.period);renderBooking();return;}
    if(e.target.closest('[data-modal-cancel]') || e.target.id==='admin-modal-backdrop'){closeDialog();return;}
    const confirm=e.target.closest('[data-modal-confirm]');if(confirm){
      const id=confirm.dataset.id;
      if(confirm.dataset.modalConfirm==='decision'){
        if(model.decisions[id]){closeDialog();return;}
        const status=confirm.dataset.value;
        const p=DATA.pending.find(x=>x.id===id);if(!p){closeDialog();return;}
        const reason=$('#admin-reject-reason')?.value.trim()||'';
        model.decisions[id]={status,time:readableTime(),reason};
        addEvent('account',status==='approved'?'점주 계정 승인':'점주 계정 반려',`${p.store} · ${status==='approved'?'승인 완료':(reason?'반려 사유: '+reason:'신청 반려')}`);
        state.approvalFilter=status;
        notify(`${p.store} · ${status==='approved'?'승인':'반려'} 상태가 반영됐습니다`);
      } else if(confirm.dataset.modalConfirm==='store'){
        const next=$('#admin-next-store-status')?.value;
        const s=stores().find(x=>x.id===id);
        if(s && storeLabels[next] && s.status!==next){model.storeStatus[id]=next;addEvent('store','매장 운영 상태 변경',`${s.name} · ${storeLabels[s.status]} → ${storeLabels[next]}`);notify('운영 상태 변경을 화면에 반영했습니다');}
      }
      closeDialog();persist();renderAll();return;
    }
    if(e.target.closest('#save-ops-note')){model.note=$('#ops-note').value.slice(0,1000);addEvent('system','운영 메모 수정','운영 메모 저장');$('#ops-note-save-msg').textContent='메모 저장됨';renderActivities();notify('운영 메모가 저장됐습니다');return;}
    if(e.target.closest('#activity-more')){state.activityLimit+=5;renderActivities();return;}
    if(e.target.closest('#admin-refresh')){renderAll();notify('운영 정보를 다시 표시했습니다');return;}
  });
  $('#approval-search').addEventListener('input',e=>{state.approvalSearch=e.target.value;renderApprovals();});
  $('#store-search').addEventListener('input',e=>{state.storeSearch=e.target.value;renderStores();});
  $('#store-status').addEventListener('change',e=>{state.storeFilter=e.target.value;renderStores();});
  $('#activity-filter').addEventListener('change',e=>{state.activityFilter=e.target.value;state.activityLimit=5;renderActivities();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog();});
  renderAll();
})();
