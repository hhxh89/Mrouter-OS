(function(){
'use strict';

var NAV_URL='/luci-static/mrouter-ui/navigation.json';
var APPEARANCE_URL='/luci-static/mrouter-ui/appearance.json';
var USER_URL='/luci-static/mrouter-ui/user-config.json';
var OPEN_KEY='mrouter.nav.open';

function el(tag, cls, text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function isCurrent(href){if(!href)return false;var p=window.location.pathname.replace(/\/$/,''),h=href.replace(/\/$/,'');return p===h||(h!=='/cgi-bin/luci/admin/dashboard'&&p.indexOf(h+'/')===0);}
function branchHasCurrent(item){if(isCurrent(item.href))return true;return(item.children||[]).some(branchHasCurrent);}
function loadOpen(){try{return JSON.parse(sessionStorage.getItem(OPEN_KEY)||'{}');}catch(e){return{};}}
function saveOpen(v){try{sessionStorage.setItem(OPEN_KEY,JSON.stringify(v));}catch(e){}}
function num(v,min,max,fallback){v=Number(v);return isFinite(v)&&v>=min&&v<=max?v:fallback;}

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

function loadAppearance(){
    return Promise.all([
        fetch(APPEARANCE_URL,{cache:'no-store'}).then(function(r){return r.ok?r.json():{};}).catch(function(){return{};}),
        fetch(USER_URL,{cache:'no-store'}).then(function(r){return r.ok?r.json():{};}).catch(function(){return{};})
    ]).then(function(all){
        var base=(all[0]&&all[0].appearance)||{};
        var over=(all[1]&&all[1].appearance)||{};
        applyAppearance({appearance:Object.assign({},base,over)});
    });
}

function renderItem(item, openState){
    var wrap=el('div','mr-nav-item');
    if(item.children&&item.children.length){
        var row=el('button','mr-nav-parent');row.type='button';row.setAttribute('aria-expanded','false');row.appendChild(el('span','mr-nav-label',item.title));row.appendChild(el('span','mr-nav-chevron','⌄'));wrap.appendChild(row);
        var childBox=el('div','mr-nav-children');
        item.children.forEach(function(child){var a=el('a','mr-nav-link mr-nav-child',child.title);a.href=child.href;if(isCurrent(child.href))a.classList.add('is-active');childBox.appendChild(a);});
        wrap.appendChild(childBox);
        var expanded=!!openState[item.id]||branchHasCurrent(item);
        function apply(){wrap.classList.toggle('is-open',expanded);row.setAttribute('aria-expanded',expanded?'true':'false');}
        apply();
        row.addEventListener('click',function(ev){ev.preventDefault();expanded=!expanded;openState[item.id]=expanded;saveOpen(openState);apply();});
        return wrap;
    }
    var link=el('a','mr-nav-link',item.title);link.href=item.href;if(isCurrent(item.href))link.classList.add('is-active');wrap.appendChild(link);return wrap;
}

function clearLegacyBlockers(){
    document.querySelectorAll('.loading').forEach(function(n){n.style.display='none';n.style.pointerEvents='none';});
    var mask=document.querySelector('.darkMask');if(mask&&window.matchMedia('(min-width:851px)').matches){mask.style.display='none';mask.style.pointerEvents='none';}
}

function installShell(data){
    var menu=document.getElementById('mainmenu');if(!menu||!data||!Array.isArray(data.navigation))return;
    menu.innerHTML='';menu.classList.add('mr-sidebar');menu.style.display='block';
    var nav=el('nav','mr-nav');nav.setAttribute('aria-label','Mrouter navigation');var openState=loadOpen();
    data.navigation.slice().sort(function(a,b){return(a.order||0)-(b.order||0);}).forEach(function(item){nav.appendChild(renderItem(item,openState));});menu.appendChild(nav);
    var mask=document.querySelector('.darkMask');if(mask){mask.classList.add('mr-mobile-mask');mask.addEventListener('click',function(){document.body.classList.remove('mr-mobile-open');});}
    var trigger=document.querySelector('.showSide');if(trigger){trigger.setAttribute('role','button');trigger.setAttribute('tabindex','0');trigger.addEventListener('click',function(){document.body.classList.toggle('mr-mobile-open');});trigger.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();trigger.click();}});}
    clearLegacyBlockers();
}

function boot(){
    clearLegacyBlockers();
    loadAppearance();
    fetch(NAV_URL,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('navigation '+r.status);return r.json();}).then(installShell).catch(function(err){console.error('Mrouter shell:',err);});
    new MutationObserver(clearLegacyBlockers).observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
