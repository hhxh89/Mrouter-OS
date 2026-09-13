(function(){
'use strict';

function isDesktop(){
    return window.matchMedia && window.matchMedia('(min-width: 851px)').matches;
}

function recoverUi(){
    var menu=document.getElementById('mainmenu');
    var left=document.querySelector('.main-left');
    var right=document.querySelector('.main-right');
    var content=document.getElementById('maincontent');
    var mask=document.querySelector('.darkMask');
    var loading=document.querySelector('.main > .loading, .loading');

    if(document.documentElement) document.documentElement.style.pointerEvents='';
    if(document.body) document.body.style.pointerEvents='';

    [menu,left,right,content].forEach(function(el){
        if(!el) return;
        el.style.pointerEvents='auto';
    });

    if(menu) menu.style.userSelect='auto';

    if(isDesktop()){
        if(mask){
            mask.style.pointerEvents='none';
            mask.style.display='none';
            mask.style.opacity='0';
        }
        if(loading){
            /* LuCI may leave the loading overlay present after rapid menu clicks.
             * Keep the visual indicator, but never allow it to trap desktop input. */
            loading.style.pointerEvents='none';
        }
    }
}

function hasSubmenu(a){
    var li=a && a.parentElement;
    if(!li) return false;
    for(var i=0;i<li.children.length;i++){
        if(li.children[i].tagName==='UL') return true;
    }
    return false;
}

var hadSelection=false;
var lastMenuTarget=null;
var lastMenuAt=0;
var lastLeafAt=0;

function selectionActive(){
    var s=window.getSelection ? window.getSelection() : null;
    return !!(s && !s.isCollapsed && String(s).length);
}

document.addEventListener('selectionchange',function(){
    if(selectionActive()) hadSelection=true;
},true);

/* Protect menu-material from click storms. Repeated clicks on the same group,
 * or multiple navigation clicks before LuCI finishes replacing the view,
 * can otherwise leave its loading/mask state active indefinitely. */
document.addEventListener('click',function(ev){
    var a=ev.target && ev.target.closest ? ev.target.closest('#mainmenu a') : null;
    if(!a) return;

    var now=Date.now();

    if(hasSubmenu(a)){
        if(lastMenuTarget===a && (now-lastMenuAt)<220){
            ev.preventDefault();
            ev.stopImmediatePropagation();
            recoverUi();
            return;
        }
        lastMenuTarget=a;
        lastMenuAt=now;
        window.setTimeout(recoverUi,0);
        window.setTimeout(recoverUi,250);
        return;
    }

    if((now-lastLeafAt)<350){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        recoverUi();
        return;
    }

    lastLeafAt=now;
    window.setTimeout(recoverUi,0);
    window.setTimeout(recoverUi,350);
    window.setTimeout(recoverUi,900);
},true);

document.addEventListener('dblclick',function(ev){
    var a=ev.target && ev.target.closest ? ev.target.closest('#mainmenu a') : null;
    if(!a || !hasSubmenu(a)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    recoverUi();
},true);

document.addEventListener('pointerdown',function(){
    if(isDesktop()) recoverUi();
},true);

document.addEventListener('pointerup',function(){
    if(hadSelection || isDesktop()){
        window.requestAnimationFrame(recoverUi);
        window.setTimeout(recoverUi,50);
    }
    hadSelection=false;
},true);

document.addEventListener('mouseup',function(){
    if(hadSelection){
        window.requestAnimationFrame(recoverUi);
        window.setTimeout(recoverUi,50);
        hadSelection=false;
    }
},true);

document.addEventListener('dragend',function(){
    window.requestAnimationFrame(recoverUi);
},true);

window.addEventListener('focus',recoverUi);
window.addEventListener('resize',recoverUi);
window.addEventListener('pageshow',recoverUi);

document.addEventListener('DOMContentLoaded',function(){
    recoverUi();
    new MutationObserver(function(){
        if(isDesktop()) recoverUi();
    }).observe(document.body,{childList:true,subtree:true});
    window.setInterval(function(){
        if(isDesktop()) recoverUi();
    },1000);
});
})();
