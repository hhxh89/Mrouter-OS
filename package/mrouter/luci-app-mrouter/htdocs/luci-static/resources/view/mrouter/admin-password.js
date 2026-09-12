'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(){return fs.exec(HELPER,['snapshot']).catch(function(){return{stdout:''};});}
function parse(r){let configured=false;String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|');if(p[0]==='PASS')configured=p[1]==='1';});return configured;}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:exec,render:function(raw){let ok=parse(raw);return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Administrator Account')),E('div',{'class':'m-subtitle'},tx('Secure access to the Mrouter web interface'))]),E('span',{'class':'m-state-pill '+(ok?'good':'warn')},tx(ok?'Password set':'Password required'))]),
 E('div',{'class':'m-hero-card'},[E('div',{},[E('h3',{},tx('Web administrator')),E('p',{},tx('Mrouter keeps OpenWrt authentication underneath. The login username remains editable so installations using a non-root administrator are supported.'))]),E('a',{'class':'m-ios-button m-service-open','href':L.url('admin/advanced/expert/password')},tx(ok?'Change Password':'Set Password'))]),
 E('div',{'class':'m-section'},[E('h3',{},tx('Security Recommendations')),E('div',{'class':'m-simple-list'},[
  E('div',{'class':'m-simple-row'},[E('div',{},[E('strong',{},tx('Use a unique administrator password')),E('span',{},tx('Do not reuse the password from another service.'))]),E('span',{'class':'m-state-pill '+(ok?'good':'warn')},tx(ok?'Done':'Required'))]),
  E('div',{'class':'m-simple-row'},[E('div',{},[E('strong',{},tx('Keep management on trusted networks')),E('span',{},tx('Avoid exposing the web interface directly to the Internet.'))]),E('span',{'class':'m-state-pill good'},tx('Recommended'))])
 ])]),
 E('div',{'class':'m-info-card'},[E('strong',{},tx('Authentication logic is unchanged')),E('span',{},tx('Mrouter does not store browser credentials and does not force the username to root.'))])
]);}});
