(function(){
'use strict';

var NAV_URL='/luci-static/mrouter-ui/navigation.json';
var USER_NAV_URL='/luci-static/mrouter-ui/user-navigation.json';
var APPEARANCE_URL='/luci-static/mrouter-ui/appearance.json';
var USER_URL='/luci-static/mrouter-ui/user-config.json';
var OPEN_KEY='mrouter.nav.open.v2';

function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
function getJSON(url){return fetch(url,{cache:'no-store',credentials:'same-origin'}).then(function(r){return r.ok?r.json():{};}).catch(function(){return{};});}
function num(v,min,max,fallback){v=Number(v);return isFinite(v)&&v>=min&&v<=max?v:fallback;}
function pathOnly(href){try{return new URL(href,location.origin).pathname.replace(/\/$/,'');}catch(e){return String(href||'').replace(/\/$/,'');}}
function isCurrent(href){var p=location.pathname.replace(/\/$/,''),h=pathOnly(href);return !!h&&(p===h||p.indexOf(h+'/')===0);}
function branchCurrent(item){if(isCurrent(item.href))return true;return(item.children||[]).some(branchCurrent);}
function loadOpen(){try{return JSON.parse(sessionStorage.getItem(OPEN_KEY)||'{}');}catch(e){return{};}}
function saveOpen(v){try{sessionStorage.setItem(OPEN_KEY,JSON.stringify(v));}catch(e){}}

function applyAppearance(cfg){
 cfg=(cfg&&cfg.appearance)||cfg||{};
 var root=document.documentElement,body=document.body;
 var accent=/^#[0-9a-f]{6}$/i.test(cfg.accent||'')?cfg.accent:'#007AFF';
 root.style.setProperty('--mr-accent',accent);
 root.style.setProperty('--mr-sidebar-width',num(cfg.sidebar_width,180,320,212)+'px');
 root.style.setProperty('--mr-content-max',num(cfg.content_max_width,900,2200,1440)+'px');
 root.style.setProperty('--mr-form-max',num(cfg.form_max_width,220,640,360)+'px');
 root.style.setProperty('--mr-card-radius',num(cfg.card_radius,0,28,14)+'px');
 root.style.setProperty('--mr-section-gap',num(cfg.section_gap,8,40,18)+'px');
 body.classList.toggle('mr-density-compact',(cfg.density||'compact')==='compact');
 body.classList.toggle('mr-compact-forms',cfg.compact_forms!==false);
}
function loadAppearance(){return Promise.all([getJSON(APPEARANCE_URL),getJSON(USER_URL)]).then(function(all){var base=(all[0]&&all[0].appearance)||{},over=(all[1]&&all[1].appearance)||{};applyAppearance({appearance:Object.assign({},base,over)});});}
function mergeNav(base,user){return user&&Array.isArray(user.navigation)?user:(base||{});}

function renderItem(item,state){
 if(item.visible===false)return null;
 var wrap=el('div','mr-nav-item');
 if(item.children&&item.children.length){
  var button=el('button','mr-nav-parent');button.type='button';button.dataset.navGroup=item.id||'';
  button.appendChild(el('span','mr-nav-label',item.title));button.appendChild(el('span','mr-nav-chevron','⌄'));wrap.appendChild(button);
  var children=el('div','mr-nav-children');
  item.children.filter(function(x){return x.visible!==false;}).sort(function(a,b){return(a.order||0)-(b.order||0);}).forEach(function(child){
   var a=el('a','mr-nav-link mr-nav-child',child.title);a.href=child.href||'#';if(isCurrent(child.href))a.classList.add('is-active');children.appendChild(a);
  });
  wrap.appendChild(children);
  var open=state[item.id]===true||branchCurrent(item);
  function sync(){wrap.classList.toggle('is-open',open);button.setAttribute('aria-expanded',open?'true':'false');children.hidden=!open;}
  sync();
  button.addEventListener('click',function(){open=!open;state[item.id]=open;saveOpen(state);sync();});
 }else{
  var link=el('a','mr-nav-link',item.title);link.href=item.href||'#';if(isCurrent(item.href))link.classList.add('is-active');wrap.appendChild(link);
 }
 return wrap;
}

function closeMobile(){document.body.classList.remove('mr-mobile-open');var b=document.getElementById('mrouter-menu-toggle');if(b)b.setAttribute('aria-expanded','false');}
function installMobile(){
 var b=document.getElementById('mrouter-menu-toggle'),backdrop=document.getElementById('mrouter-mobile-backdrop');
 if(b)b.addEventListener('click',function(){var open=!document.body.classList.contains('mr-mobile-open');document.body.classList.toggle('mr-mobile-open',open);b.setAttribute('aria-expanded',open?'true':'false');});
 if(backdrop)backdrop.addEventListener('click',closeMobile);
 window.addEventListener('resize',function(){if(window.innerWidth>850)closeMobile();},{passive:true});
}
function installNavigation(data){
 var host=document.getElementById('mrouter-sidebar');if(!host||!data||!Array.isArray(data.navigation))return;
 var nav=el('nav','mr-nav');nav.setAttribute('aria-label','Mrouter navigation');var state=loadOpen();
 data.navigation.slice().filter(function(x){return x.visible!==false;}).sort(function(a,b){return(a.order||0)-(b.order||0);}).forEach(function(item){var n=renderItem(item,state);if(n)nav.appendChild(n);});
 host.replaceChildren(nav);
 host.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a.mr-nav-link');if(a&&window.innerWidth<=850)closeMobile();});
}
function boot(){
 loadAppearance();installMobile();
 Promise.all([getJSON(NAV_URL),getJSON(USER_NAV_URL)]).then(function(all){installNavigation(mergeNav(all[0],all[1]));}).catch(function(err){console.error('Mrouter navigation:',err);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
