/* Inline seat-map zoom controls. Presentation-only: existing table selection and booking logic remain unchanged. */
(function(){
  const body=document.body;
  if(!body || body.dataset.screen!=='reserve') return;
  const card=document.querySelector('.booking-map-card');
  const scroller=card && card.querySelector('.booking-map-scroll');
  const host=document.getElementById('map');
  if(!card || !scroller || !host || card.querySelector('.seatmap-zoom-controls')) return;
  const tools=document.createElement('div');
  tools.className='seatmap-zoom-controls';
  tools.innerHTML='<span class="seatmap-zoom-hint">좌석도가 작으면 확대해 자세히 볼 수 있어요.</span><div class="seatmap-zoom-actions" role="group" aria-label="좌석도 확대 및 축소"><button type="button" data-map-zoom="out" aria-label="좌석도 축소" title="축소">−</button><output data-map-zoom-label aria-live="polite">100%</output><button type="button" data-map-zoom="in" aria-label="좌석도 확대" title="확대">+</button><button type="button" data-map-zoom="fit" aria-label="좌석도 화면에 맞추기" title="화면에 맞추기">맞춤</button></div>';
  scroller.parentNode.insertBefore(tools,scroller);
  let zoom=1;
  const label=tools.querySelector('[data-map-zoom-label]');
  const out=tools.querySelector('[data-map-zoom="out"]');
  const inn=tools.querySelector('[data-map-zoom="in"]');
  function apply(resetScroll){
    const cv=host.querySelector('.map-canvas');
    if(!cv) return;
    const base=Math.max(220,scroller.clientWidth-16);
    cv.style.setProperty('width',Math.round(base*zoom)+'px','important');
    cv.style.setProperty('min-width','0','important');
    cv.style.setProperty('max-width','none','important');
    cv.style.setProperty('height','auto','important');
    cv.style.setProperty('aspect-ratio','1000 / 600','important');
    cv.style.setProperty('margin','0','important');
    cv.style.setProperty('flex','0 0 auto','important');
    label.textContent=Math.round(zoom*100)+'%';
    out.disabled=zoom<=0.7; inn.disabled=zoom>=2.1;
    if(resetScroll){scroller.scrollLeft=0;scroller.scrollTop=0;}
  }
  out.addEventListener('click',()=>{zoom=Math.max(.7,Math.round((zoom-.15)*100)/100);apply(false);});
  inn.addEventListener('click',()=>{zoom=Math.min(2.1,Math.round((zoom+.15)*100)/100);apply(false);});
  tools.querySelector('[data-map-zoom="fit"]').addEventListener('click',()=>{zoom=1;apply(true);});
  const observer=new MutationObserver(()=>requestAnimationFrame(()=>apply(false)));
  observer.observe(host,{childList:true});
  if(window.ResizeObserver){new ResizeObserver(()=>apply(false)).observe(scroller);}
  window.addEventListener('resize',()=>apply(false),{passive:true});
  requestAnimationFrame(()=>apply(true));
})();
