(function(){
  'use strict';
  // ---- scroll reveal
  try{
    var rm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if('IntersectionObserver' in window && !rm){
      document.documentElement.classList.add('js');
      var els=[].slice.call(document.querySelectorAll('.course,.tier,.quote,.cell,.lvl,.honour,.method > *,.pricecard,.portrait,.faq details,.comm-top,.shot-wrap'));
      els.forEach(function(e,i){e.classList.add('rv'); e.style.transitionDelay=((i%4)*70)+'ms';});
      var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12,rootMargin:'0px 0px -5% 0px'});
      els.forEach(function(e){io.observe(e)});
    }
  }catch(x){}


  // ---- sign-up forms (Start page and course waitlists) -> /api/subscribe
  function wire(form){
    form.setAttribute('novalidate','');
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var name=form.querySelector('input[name=name]'), email=form.querySelector('input[name=email]');
      var consent=form.querySelector('input[name=consent]');
      var err=form.querySelector('.form-error'), btn=form.querySelector('button[type=submit]');
      function fail(msg,el){ err.textContent=msg; err.hidden=false; if(el) el.focus(); }
      err.hidden=true;
      if(!name.value.trim()) return fail('Please add your first name.',name);
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) return fail('Please check your email address.',email);
      if(consent && !consent.checked) return fail('Please tick the box so we know you are happy to hear from us.',consent);
      var goals=[].map.call(form.querySelectorAll('input[name=goal]:checked'),function(x){return x.value}).join(', ');
      var body={name:name.value.trim(),email:email.value.trim(),goal:goals,source:form.getAttribute('data-source')||'website',
        consent:consent?consent.checked:true,company:(form.querySelector('input[name=company]')||{}).value||''};
      var label=btn.textContent; btn.disabled=true; btn.textContent='One moment...';
      fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,j:j}})})
        .then(function(res){
          if(!res.ok) throw new Error(res.j.message||'');
          var holder=form.closest('.wf-body')||form.closest('#formbody')||form;
          var card=holder.parentNode, thanks=card.querySelector('.wf-thanks');
          var slot=thanks.querySelector('[data-name-slot]');
          if(slot && form.id==='joinform') slot.textContent='Welcome aboard, '+body.name+'.';
          holder.hidden=true; thanks.hidden=false; thanks.setAttribute('tabindex','-1'); thanks.focus();
        })
        .catch(function(x){
          fail(x&&x.message?x.message:'Sorry, something went wrong on our side. Please try again in a moment.');
          btn.disabled=false; btn.textContent=label;
        });
    });
  }
  [].forEach.call(document.querySelectorAll('form[data-source]'),wire);

  // ---- app screenshot viewer
  var tabs=[].slice.call(document.querySelectorAll('.vtab'));
  tabs.forEach(function(t){t.addEventListener('click',function(){
    tabs.forEach(function(x){
      var on=(x===t);
      x.setAttribute('aria-selected',on?'true':'false');
      document.getElementById(x.getAttribute('aria-controls')).hidden=!on;
    });
  })});

  // ---- goal picker (Start page)
  var chips=document.getElementById('chips'), res=document.getElementById('result');
  if(chips&&res){
    var map={
      think:['Start with the Foundation Course','Join iCan Start free, try the three taster lessons, then move to iCan Commit for all 21 modules. The Foundation Course is built to help you beat stress and live a calmer life.','Start free'],
      calm:['Take a look at iCan Be Calm','iCan Be Calm shows you how to understand, manage and overcome stress. Start free and try the Find Your Calm taster lesson, then step up to the full course.','Start free'],
      biz:['Look at iCan Grow','iCan Grow is our business plan and user manual for owner-managed businesses. Start free to meet the community, then book a discovery call about the programme and fee deferment.','Start free'],
      lead:['Look at iCan Lead','iCan Lead is our leadership programme: the Top 10 Mindsets of Great Leaders, with a weekly drop-in for teams. Start free to meet the community, then book a discovery call about your team.','Start free'],
      speak:['Take a look at iCan Speak','iCan Speak helps you find your voice and speak with presence. Start free to join the community and try the taster lessons, then step up to the full course.','Start free'],
      sell:['Take a look at iCan Sell','iCan Sell helps you sell in a natural, confident and genuinely helpful way. Start free, try the taster lessons, then step up to the full course.','Start free'],
      wealth:['Take a look at iCan Be Wealthy','iCan Be Wealthy helps you untangle money beliefs and learn the basics of wealth. Start free and try the taster lessons, and Module 7 of the Foundation Course introduces the mindset.','Start free'],
    };
    chips.addEventListener('click',function(e){
      var b=e.target.closest('.chip'); if(!b) return;
      [].forEach.call(chips.children,function(c){c.setAttribute('aria-pressed',c===b?'true':'false')});
      var r=map[b.getAttribute('data-k')];
      res.innerHTML='<h3></h3><p></p><button class="btn btn-primary" type="button" id="togo"></button>';
      res.children[0].textContent=r[0]; res.children[1].textContent=r[1]; res.children[2].textContent=r[2];
      document.getElementById('togo').addEventListener('click',function(){
        document.getElementById('formcard').scrollIntoView({block:'center'});
        var n=document.getElementById('fname'); if(n) n.focus({preventScroll:true});
      });
    });
  }
})();
