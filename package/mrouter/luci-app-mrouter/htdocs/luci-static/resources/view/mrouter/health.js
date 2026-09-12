'use strict';
'require view';
'require fs';

function bounded(p, fallback, ms) { return Promise.race([Promise.resolve(p).catch(function(){return fallback;}), new Promise(function(r){window.setTimeout(function(){r(fallback);}, ms||4500);})]); }
function exec(path,args){ return bounded(fs.exec(path,args||[]),{stdout:'',code:124},4500); }
function t(v){ return [String(v==null||v===''?'—':v)]; }
function bytes(v){ v=Number(v)||0; let u=['B','KB','MB','GB','TB'],i=0; while(v>=1024&&i<u.length-1){v/=1024;i++;} return (i?v.toFixed(v>=100?0:v>=10?1:2):v.toFixed(0))+' '+u[i]; }
function uptime(v){ v=Number(v)||0; let d=Math.floor(v/86400); v%=86400; let h=Math.floor(v/3600),m=Math.floor((v%3600)/60); return (d?d+'d ':'')+h+'h '+m+'m'; }
function parse(r){ let o={services:[],ports:[]}; String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|'); if(p[0]==='SERVICE')o.services.push({name:p[1],state:p[2]}); else if(p[0]==='PORT')o.ports.push({dev:p[1],role:p[2],state:p[3],speed:p[4],driver:p[5]}); else if(p[0]==='PBR'){o.pbrEnabled=p[1]==='1';o.pbrActive=p[2]==='1';} else if(p.length>=2)o[p[0]]=p.slice(1).join('|');}); return o; }
function info(label,value){ return E('div',{'class':'m-info'},[E('span',{},t(label)),E('span',{},t(value))]); }
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,
 load:function(){return exec('/usr/libexec/mrouter-status-health',[]).then(parse);},
 render:function(s){
   let rootparts=String(s.ROOT||'0 0 0').split(' '), total=Number(rootparts[0])||0, used=Number(rootparts[1])||0;
   let memTotal=Number(s.MEMTOTAL)||0, memAvail=Number(s.MEMAVAIL)||0;
   let svc=E('div',{'class':'m-health-services'}); s.services.forEach(function(x){svc.appendChild(E('div',{'class':'m-health-service'},[E('span',{},t(x.name)),E('strong',{'class':x.state==='running'?'m-app-running':'m-app-stopped'},t(x.state))]));});
   let ports=E('div',{'class':'m-port-grid'}); s.ports.forEach(function(p){ports.appendChild(E('div',{'class':'m-port'},[E('div',{'class':'m-port-head'},[E('span',{'class':'m-dot '+(p.state==='up'?'m-green':'m-gray')}),E('strong',{},t(p.role+' · '+p.dev))]),E('div',{'class':'m-port-meta'},[E('span',{},t(p.state)),E('span',{},t(p.speed)),E('span',{},t(p.driver))]) ]));});
   let pbrState=!s.pbrEnabled?'Disabled':(s.pbrActive?'Active':'Error');
   return E('div',{'class':'mrouter-page'},[
    E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},t('System Health')),E('div',{'class':'m-subtitle'},t('Mrouter-OS hardware, services and routing health'))])]),
    E('div',{'class':'m-section'},[E('h3',{},t('System')),E('div',{'class':'m-info-grid'},[info('Mrouter-OS',s.VERSION),info('OpenWrt',s.OPENWRT),info('Kernel',s.KERNEL),info('Uptime',uptime(s.UPTIME)),info('Load',s.LOAD),info('Memory used',bytes(Math.max(0,memTotal-memAvail))+' / '+bytes(memTotal)),info('Root storage',bytes(used)+' / '+bytes(total)),info('CPU temperature',s.TEMP?s.TEMP+' °C':'Not exposed')])]),
    E('div',{'class':'m-section'},[E('div',{'class':'m-section-header'},[E('div',{},[E('h3',{},t('Ethernet Ports')),E('div',{'class':'m-muted'},t('Physical port roles and negotiated link state'))]),E('a',{'class':'m-blue-link-button','href':L.url('admin/advanced/network-settings/ports')},t('Port Assignment'))]),ports]),
    E('div',{'class':'m-section'},[E('div',{'class':'m-section-header'},[E('h3',{},t('Services')),E('span',{'class':'m-status-pill '+(pbrState==='Error'?'m-status-offline':pbrState==='Active'?'m-status-online':'')},t('PBR '+pbrState))]),svc])
   ]);
 }
});
