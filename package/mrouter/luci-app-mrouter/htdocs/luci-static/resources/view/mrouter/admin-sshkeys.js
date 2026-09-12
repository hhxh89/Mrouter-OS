'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(){return fs.exec(HELPER,['keys']).catch(function(){return{stdout:'KEYS|0'};});}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:exec,render:function(raw){let p=String((raw&&raw.stdout)||'KEYS|0').trim().split('|'),count=Number(p[1])||0;return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('SSH Keys')),E('div',{'class':'m-subtitle'},tx('Trusted public keys allowed to sign in to Mrouter'))]),E('span',{'class':'m-state-pill '+(count?'good':'neutral')},tx(count+' key'+(count===1?'':'s')))]),
 E('div',{'class':'m-section'},[E('h3',{},tx('Authorized Keys')),count?E('div',{'class':'m-info-card'},[E('strong',{},tx(count+' authorized key'+(count===1?'':'s')+' installed')),E('span',{},tx('Mrouter deliberately does not display private keys. Only public authorized keys are managed here.'))]):E('div',{'class':'m-empty'},tx('No SSH public keys are installed yet.')),E('div',{'class':'m-inline-actions','style':'margin-top:16px'},[E('a',{'class':'m-ios-button m-service-open','href':L.url('admin/advanced/expert/sshkeys')},tx(count?'Manage Keys':'Add SSH Key'))])]),
 E('div',{'class':'m-info-card'},[E('strong',{},tx('Safer than passwords')),E('span',{},tx('Add only public keys. Mrouter never needs or stores your SSH private key.'))])
]);}});
