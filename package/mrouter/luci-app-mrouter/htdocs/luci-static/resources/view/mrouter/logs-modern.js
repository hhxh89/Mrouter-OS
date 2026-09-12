'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(a){return fs.exec(HELPER,a||[]).catch(function(){return{stdout:''};});}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:function(){return exec(['logs']);},render:function(raw){let search=E('input',{'class':'m-ios-input','type':'search','placeholder':'Filter by service, error or text'}),pre=E('pre',{'class':'m-modern-log'},tx(String((raw&&raw.stdout)||'No log entries.'))),refresh=E('button',{'class':'m-ios-button','type':'button'},tx('Refresh')),clear=E('button',{'class':'m-secondary-button','type':'button'},tx('Clear View')),copy=E('button',{'class':'m-secondary-button','type':'button'},tx('Copy'));function run(){refresh.disabled=true;exec(['logs',search.value.trim()]).then(function(r){pre.textContent=String(r.stdout||'No matching log entries.');}).finally(function(){refresh.disabled=false;});}refresh.addEventListener('click',run);search.addEventListener('keydown',function(e){if(e.key==='Enter')run();});clear.addEventListener('click',function(){pre.textContent='';});copy.addEventListener('click',function(){if(navigator.clipboard)navigator.clipboard.writeText(pre.textContent||'');});return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('System Log')),E('div',{'class':'m-subtitle'},tx('Recent router events with fast filtering'))]),E('a',{'class':'m-secondary-link-button','href':L.url('admin/advanced/expert/log')},tx('Expert Log'))]),
 E('div',{'class':'m-section'},[E('div',{'class':'m-log-toolbar'},[search,refresh,clear,copy]),pre])
]);}});
