'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(){return fs.exec(HELPER,['packages']).catch(function(){return{stdout:''};});}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:exec,render:function(raw){let lines=String((raw&&raw.stdout)||'').trim().split(/\r?\n/).filter(Boolean);return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Package Manager')),E('div',{'class':'m-subtitle'},tx('Optional OpenWrt software and Mrouter package updates'))]),E('a',{'class':'m-ios-button m-service-open','href':L.url('admin/advanced/expert/packages')},tx('Open Package Manager'))]),
 E('div',{'class':'m-stats-grid'},[E('div',{'class':'m-stat-card'},[E('span',{},tx('Installed packages')),E('strong',{},tx(lines.length))]),E('div',{'class':'m-stat-card'},[E('span',{},tx('Mrouter update model')),E('strong',{},tx('Package-first'))])]),
 E('div',{'class':'m-section'},[E('h3',{},tx('Package-first upgrades')),E('p',{'class':'m-muted'},tx('UI, theme and backend fixes should normally upgrade as APK packages. A full firmware image is reserved for OpenWrt base, kernel or image-layout changes.')),E('div',{'class':'m-inline-actions'},[E('a',{'class':'m-ios-button m-service-open','href':L.url('admin/advanced/expert/packages')},tx('Search / Install Packages'))])]),
 E('div',{'class':'m-info-card m-warning-card'},[E('strong',{},tx('Compatibility')),E('span',{},tx('Installing arbitrary packages can replace libraries or services Mrouter depends on. Take a backup before major package changes.'))])
]);}});
