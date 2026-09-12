'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(){return fs.exec(HELPER,['snapshot']).catch(function(){return{stdout:''};});}
function parse(r){let o={running:false,http:'',https:'',redirect:false};String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|');if(p[0]==='WEB'){o.running=p[1]==='1';o.http=p[2]||'';o.https=p[3]||'';o.redirect=p[4]==='1';}});return o;}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:exec,render:function(raw){let s=parse(raw);return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Web Access')),E('div',{'class':'m-subtitle'},tx('How the Mrouter management interface is exposed'))]),E('span',{'class':'m-state-pill '+(s.running?'good':'bad')},tx(s.running?'Running':'Stopped'))]),
 E('div',{'class':'m-stats-grid'},[E('div',{'class':'m-stat-card'},[E('span',{},tx('HTTP listeners')),E('strong',{},tx(s.http||'None'))]),E('div',{'class':'m-stat-card'},[E('span',{},tx('HTTPS listeners')),E('strong',{},tx(s.https||'None'))]),E('div',{'class':'m-stat-card'},[E('span',{},tx('Redirect to HTTPS')),E('strong',{},tx(s.redirect?'On':'Off'))])]),
 E('div',{'class':'m-section'},[E('h3',{},tx('Management Access')),E('p',{'class':'m-muted'},tx('For most homes, keep the web interface reachable only from trusted LAN/VPN networks. Direct WAN management should be an explicit advanced choice.')),E('div',{'class':'m-inline-actions'},[E('a',{'class':'m-ios-button m-service-open','href':L.url('admin/advanced/expert/web')},tx('Configure Web Access'))])]),
 E('div',{'class':'m-info-card m-warning-card'},[E('strong',{},tx('Internet exposure warning')),E('span',{},tx('Do not port-forward the Mrouter web interface from the Internet. Use Tailscale, WireGuard or another secure remote-access method instead.'))])
]);}});
