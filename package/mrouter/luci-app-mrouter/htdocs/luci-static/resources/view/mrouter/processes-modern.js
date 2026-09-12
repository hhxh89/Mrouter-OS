'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(){return fs.exec(HELPER,['processes']).catch(function(){return{stdout:''};});}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:exec,render:function(raw){let pre=E('pre',{'class':'m-modern-log'},tx(String((raw&&raw.stdout)||'No process data.')));return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Processes')),E('div',{'class':'m-subtitle'},tx('Running services and system processes'))]),E('a',{'class':'m-secondary-link-button','href':L.url('admin/advanced/expert/processes')},tx('Expert Process Controls'))]),
 E('div',{'class':'m-section'},[E('div',{'class':'m-info-card'},[E('strong',{},tx('Read-only overview')),E('span',{},tx('Use Expert Process Controls for termination actions. Mrouter avoids putting a destructive Kill button next to every system process.'))]),pre])
]);}});
