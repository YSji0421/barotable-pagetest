/* Click-and-hold drag scrolling for overflow areas. Touch scrolling remains native. */
(function(){
  const selector='.sheet-horizontal,.sheet-time-scroll,.booking-map-scroll,.sf-area,.tt-scroll,.list-scroll,.adm-table-scroll,body[data-screen="owner-dashboard"] .map-scroll,body[data-screen="owner-guests"] .map-scroll,[data-drag-scroll]';
  let active=null, suppress=null, suppressTimer=null;
  document.addEventListener('mousedown',function(e){
    if(e.button!==0 || e.target.closest('input,textarea,select,option,[contenteditable="true"]')) return;
    const el=e.target.closest(selector); if(!el) return;
    /* The editor's table objects use their own drag handler; only empty canvas space pans. */
    if(el.id==='canvas-scroll' && e.target.closest('.ed-item')) return;
    if(el.scrollWidth<=el.clientWidth+2 && el.scrollHeight<=el.clientHeight+2) return;
    active={el,x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop,moved:false};
  });
  document.addEventListener('mousemove',function(e){
    if(!active) return;
    const dx=e.clientX-active.x,dy=e.clientY-active.y;
    if(!active.moved && Math.hypot(dx,dy)<5) return;
    active.moved=true; active.el.classList.add('is-dragging');
    e.preventDefault(); active.el.scrollLeft=active.left-dx; active.el.scrollTop=active.top-dy;
  },{passive:false});
  function finish(){
    if(!active) return;
    const ended=active; active=null; ended.el.classList.remove('is-dragging');
    if(ended.moved){suppress=ended.el;if(suppressTimer)clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>{suppress=null;},450);}
  }
  document.addEventListener('mouseup',finish);
  document.addEventListener('mouseleave',finish);
  document.addEventListener('click',function(e){
    if(!suppress) return;
    if(e.target.closest(selector)===suppress){e.preventDefault();e.stopImmediatePropagation();suppress=null;if(suppressTimer)clearTimeout(suppressTimer);}
  },true);
})();
