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

    if(document.documentElement) document.documentElement.style.pointerEvents='';
    if(document.body) document.body.style.pointerEvents='';

    [menu,left,right,content].forEach(function(el){
        if(!el) return;
        el.style.pointerEvents='auto';
    });

    if(menu) menu.style.userSelect='auto';

    if(mask && isDesktop()){
        mask.style.pointerEvents='none';
        mask.style.display='none';
        mask.style.opacity='0';
    }
}

var hadSelection=false;

function selectionActive(){
    var s=window.getSelection ? window.getSelection() : null;
    return !!(s && !s.isCollapsed && String(s).length);
}

document.addEventListener('selectionchange',function(){
    if(selectionActive()) hadSelection=true;
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

document.addEventListener('DOMContentLoaded',function(){
    recoverUi();
    new MutationObserver(function(){
        if(isDesktop()) recoverUi();
    }).observe(document.body,{childList:true,subtree:true});
});
})();
