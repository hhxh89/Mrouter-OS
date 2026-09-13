(function(){
'use strict';

var NAV_URL='/luci-static/mrouter-ui/navigation.json';
var OPEN_KEY='mrouter.nav.open';

function el(tag, cls, text){
    var n=document.createElement(tag);
    if(cls) n.className=cls;
    if(text!=null) n.textContent=text;
    return n;
}

function isDesktop(){
    return !window.matchMedia || window.matchMedia('(min-width: 851px)').matches;
}

/*
 * Mrouter no longer uses menu-material. The inherited Material template still
 * contains its old global loading and dark-mask elements, so make them inert.
 * Without menu-material there is nobody upstream to clear the legacy
 * "Collecting data..." overlay, which would otherwise cover stock LuCI views.
 */
function clearLegacyBlockingLayers(){
    document.querySelectorAll('.main > .loading, body > .loading, .loading').forEach(function(node){
        if(node && /Collecting data/i.test(node.textContent||'')){
            node.style.display='none';
            node.style.pointerEvents='none';
            node.setAttribute('aria-hidden','true');
        }
    });

    var mask=document.querySelector('.darkMask');
    if(mask && isDesktop()){
        mask.style.display='none';
        mask.style.pointerEvents='none';
        mask.style.opacity='0';
        mask.setAttribute('aria-hidden','true');
    }
}

function isCurrent(href){
    if(!href) return false;
    var p=window.location.pathname.replace(/\/$/,'');
    var h=href.replace(/\/$/,'');
    return p===h || (h!=='/cgi-bin/luci/admin/dashboard' && p.indexOf(h+'/')===0);
}

function branchHasCurrent(item){
    if(isCurrent(item.href)) return true;
    return (item.children||[]).some(branchHasCurrent);
}

function loadOpen(){
    try { return JSON.parse(sessionStorage.getItem(OPEN_KEY)||'{}'); }
    catch(e){ return {}; }
}

function saveOpen(v){
    try { sessionStorage.setItem(OPEN_KEY,JSON.stringify(v)); } catch(e){}
}

function renderItem(item, openState){
    var wrap=el('div','mr-nav-item');
    if(item.children && item.children.length){
        var row=el('button','mr-nav-parent');
        row.type='button';
        row.setAttribute('aria-expanded','false');
        row.appendChild(el('span','mr-nav-label',item.title));
        row.appendChild(el('span','mr-nav-chevron','⌄'));
        wrap.appendChild(row);

        var childBox=el('div','mr-nav-children');
        item.children.forEach(function(child){
            var a=el('a','mr-nav-link mr-nav-child',child.title);
            a.href=child.href;
            if(isCurrent(child.href)) a.classList.add('is-active');
            childBox.appendChild(a);
        });
        wrap.appendChild(childBox);

        var expanded=!!openState[item.id] || branchHasCurrent(item);
        function apply(){
            wrap.classList.toggle('is-open',expanded);
            row.setAttribute('aria-expanded',expanded?'true':'false');
        }
        apply();
        row.addEventListener('click',function(ev){
            ev.preventDefault();
            expanded=!expanded;
            openState[item.id]=expanded;
            saveOpen(openState);
            apply();
        });
        return wrap;
    }

    var link=el('a','mr-nav-link',item.title);
    link.href=item.href;
    if(isCurrent(item.href)) link.classList.add('is-active');
    wrap.appendChild(link);
    return wrap;
}

function installShell(data){
    clearLegacyBlockingLayers();

    var menu=document.getElementById('mainmenu');
    if(!menu || !data || !Array.isArray(data.navigation)) return;

    menu.innerHTML='';
    menu.classList.add('mr-sidebar');
    menu.style.display='block';
    var nav=el('nav','mr-nav');
    nav.setAttribute('aria-label','Mrouter navigation');
    var openState=loadOpen();
    data.navigation.slice().sort(function(a,b){return (a.order||0)-(b.order||0);}).forEach(function(item){
        nav.appendChild(renderItem(item,openState));
    });
    menu.appendChild(nav);

    var mask=document.querySelector('.darkMask');
    if(mask){
        mask.classList.add('mr-mobile-mask');
        mask.addEventListener('click',function(){ document.body.classList.remove('mr-mobile-open'); });
    }

    var trigger=document.querySelector('.showSide');
    if(trigger){
        trigger.setAttribute('role','button');
        trigger.setAttribute('tabindex','0');
        trigger.addEventListener('click',function(){ document.body.classList.toggle('mr-mobile-open'); });
        trigger.addEventListener('keydown',function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); trigger.click(); } });
    }

    clearLegacyBlockingLayers();
}

function boot(){
    clearLegacyBlockingLayers();

    fetch(NAV_URL,{cache:'no-store'})
        .then(function(r){ if(!r.ok) throw new Error('navigation '+r.status); return r.json(); })
        .then(installShell)
        .catch(function(err){ console.error('Mrouter shell:',err); });

    /* Catch legacy overlays reinserted by LuCI views without touching page UI. */
    if(document.body && window.MutationObserver){
        new MutationObserver(clearLegacyBlockingLayers).observe(document.body,{childList:true,subtree:true});
    }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
