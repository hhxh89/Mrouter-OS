'use strict';
'require view';
'require fs';
'require ui';

const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(a){return fs.exec(HELPER,a||[]).catch(function(e){return{code:1,stdout:'',stderr:String(e)};});}
function parse(r){let o={hostname:'',timezone:'UTC',zonename:'UTC',epoch:0};String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|');if(p[0]==='SYS'){o.hostname=p[1]||'';o.timezone=p[2]||'UTC';o.zonename=p[3]||'UTC';o.epoch=Number(p[4])||0;}});return o;}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:function(){return exec(['snapshot']);},render:function(raw){let s=parse(raw),host=E('input',{'class':'m-ios-input','type':'text','value':s.hostname||'Mrouter'}),zone=E('select',{'class':'m-ios-input'},[
 E('option',{'value':'Europe/London'},tx('United Kingdom — Europe/London')),
 E('option',{'value':'Europe/Berlin'},tx('Central Europe — Europe/Berlin')),
 E('option',{'value':'America/New_York'},tx('US Eastern — America/New_York')),
 E('option',{'value':'America/Los_Angeles'},tx('US Pacific — America/Los_Angeles')),
 E('option',{'value':'UTC'},tx('UTC'))
]);
 if(Array.from(zone.options).some(function(o){return o.value===s.zonename;}))zone.value=s.zonename;else zone.value='UTC';
 let browserZone='';try{browserZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}
 let useBrowser=E('button',{'class':'m-secondary-button','type':'button'},tx(browserZone?'Use browser timezone ('+browserZone+')':'Browser timezone unavailable'));useBrowser.disabled=!browserZone||!Array.from(zone.options).some(function(o){return o.value===browserZone;});useBrowser.addEventListener('click',function(){zone.value=browserZone;});
 let save=E('button',{'class':'m-ios-button','type':'button'},tx('Save Device Settings'));save.addEventListener('click',function(){save.disabled=true;exec(['system-save',host.value.trim(),zone.value]).then(function(r){if(r.code){save.disabled=false;ui.addNotification(null,E('p',{},tx(r.stderr||'Could not save system settings.')),'error');}else{ui.addNotification(null,E('p',{},tx('Device settings saved.')),'info');window.setTimeout(function(){window.location.reload();},600);}});});
 let now=s.epoch?new Date(s.epoch*1000).toLocaleString():'—';
 return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Device Settings')),E('div',{'class':'m-subtitle'},tx('Identity, time and the basic settings people actually change'))]),E('a',{'class':'m-secondary-link-button','href':L.url('admin/advanced/expert/system')},tx('Expert System Settings'))]),
 E('div',{'class':'m-stats-grid'},[E('div',{'class':'m-stat-card'},[E('span',{},tx('Hostname')),E('strong',{},tx(s.hostname))]),E('div',{'class':'m-stat-card'},[E('span',{},tx('Time zone')),E('strong',{},tx(s.zonename||s.timezone))]),E('div',{'class':'m-stat-card'},[E('span',{},tx('Router time')),E('strong',{},tx(now))])]),
 E('div',{'class':'m-section'},[E('h3',{},tx('General')),E('div',{'class':'m-service-form'},[E('label',{},[E('span',{},tx('Device name')),host]),E('label',{},[E('span',{},tx('Timezone')),zone])]),E('div',{'class':'m-inline-actions'},[save,useBrowser])]),
 E('div',{'class':'m-info-card'},[E('strong',{},tx('Advanced time and logging')),E('span',{},tx('NTP servers, logging targets, language and uncommon system options remain available in Expert System Settings.'))])
]);}});
