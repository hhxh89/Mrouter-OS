'use strict';
'require view';
'require fs';
'require ui';
function bounded(p,f,ms){return Promise.race([Promise.resolve(p).catch(function(){return f;}),new Promise(function(r){window.setTimeout(function(){r(f);},ms||4500);})]);}
function exec(path,args){return bounded(fs.exec(path,args||[]),{stdout:'',stderr:'Timed out',code:124},4500);}
function t(v){return [String(v==null||v===''?'—':v)];}
function parse(r){let s={ports:[],initialized:false,pending:false,count:0,wan:'',lan:'',lanIP:'',lanSubnet:'',iot:false,iotSubnet:'',savedWan:'',savedLan:''};String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|');if(p[0]==='STATUS'){s.initialized=p[1]==='1';s.pending=p[2]==='1';s.count=Number(p[3])||0;s.wan=p[4]||'';s.lan=p[5]||'';s.lanIP=p[6]||'';s.lanSubnet=p[7]||'';s.iot=p[8]==='1';s.iotSubnet=p[9]||'';}else if(p[0]==='SAVED'){s.savedWan=p[1]||'';s.savedLan=p[2]||'';}else if(p[0]==='PORT')s.ports.push({dev:p[1],role:p[2],state:p[3],speed:p[4],driver:p[5],mac:p[6]});});return s;}
function pill(role){let c=role==='WAN'?'blue':role==='LAN'?'good':'neutral';return E('span',{'class':'m-state-pill '+c},t(role));}
function portCard(p){return E('div',{'class':'m-port m-port-role-card'},[E('div',{'class':'m-port-head'},[E('div',{},[E('span',{'class':'m-dot '+(p.state==='up'?'m-green':'m-gray')}),E('strong',{},t(p.dev))]),pill(p.role)]),E('div',{'class':'m-port-meta'},[E('span',{},t('Link '+p.state)),E('span',{},t('Speed '+p.speed)),E('span',{},t('Driver '+p.driver)),E('span',{'class':'m-mono'},t(p.mac))])]);}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,
 load:function(){return exec('/usr/libexec/mrouter-status-ports',[]).then(parse);},
 render:function(s){
   let canSwap=s.count===2&&s.ports.filter(function(p){return p.role==='WAN';}).length===1&&s.ports.filter(function(p){return p.role==='LAN';}).length===1;
   let swap=E('button',{'class':'m-secondary-button','type':'button'},t('Swap WAN / LAN'));
   swap.disabled=!canSwap;
   swap.title=canSwap?'Save the opposite physical roles. A reboot is required.':'Swap is disabled until exactly one WAN and one LAN physical port are identified.';
   swap.addEventListener('click',function(){if(!canSwap)return;let cancel=E('button',{'class':'btn','type':'button'},t('Cancel'));let confirm=E('button',{'class':'btn cbi-button-action','type':'button'},t('Save swapped roles'));cancel.addEventListener('click',ui.hideModal);confirm.addEventListener('click',function(){confirm.disabled=true;exec('/usr/libexec/mrouter-ports',['swap']).then(function(r){ui.hideModal();if(r.code)ui.addNotification(null,E('p',{},t(r.stderr||'Unable to save roles')),'error');else{ui.addNotification(null,E('p',{},t('New roles saved. Reboot only when ready.')),'info');window.setTimeout(function(){window.location.reload();},700);}});});ui.showModal('Swap physical port roles?',[E('p',{},t('This writes the opposite WAN/LAN assignment but does not restart networking automatically.')),E('div',{'class':'right'},[cancel,confirm])]);});
   let ports=E('div',{'class':'m-port-grid'});s.ports.forEach(function(p){ports.appendChild(portCard(p));});
   return E('div',{'class':'mrouter-page'},[
    E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},t('Port Assignment')),E('div',{'class':'m-subtitle'},t('Physical roles are read from the live OpenWrt network configuration'))])]),
    s.pending?E('div',{'class':'m-policy-health warn'},[E('strong',{},t('Reboot required')),E('span',{},t('A new physical-port assignment is saved but the running network still uses the current roles.'))]):'',
    E('div',{'class':'m-section'},[E('div',{'class':'m-section-header'},[E('div',{},[E('h3',{},t('Physical Ethernet Ports')),E('div',{'class':'m-muted'},t(s.count+' physical port'+(s.count===1?'':'s')+' detected'))]),swap]),ports]),
    E('div',{'class':'m-section'},[E('h3',{},t('Current Network Design')),E('div',{'class':'m-info-grid'},[
      E('div',{'class':'m-info'},[E('span',{},t('WAN')),E('span',{},t(s.wan||'Not assigned'))]),
      E('div',{'class':'m-info'},[E('span',{},t('LAN')),E('span',{},t(s.lan||'Not assigned'))]),
      E('div',{'class':'m-info'},[E('span',{},t('LAN address')),E('span',{},t(s.lanIP||'Not configured'))]),
      E('div',{'class':'m-info'},[E('span',{},t('LAN subnet')),E('span',{},t(s.lanSubnet||'Not configured'))]),
      E('div',{'class':'m-info'},[E('span',{},t('IoT network')),E('span',{},t(s.iot?(s.iotSubnet||'Configured'):'Not configured'))])
    ])])
   ]);
 }
});
