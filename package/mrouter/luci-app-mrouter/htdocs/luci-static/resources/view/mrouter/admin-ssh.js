'use strict';
'require view';
'require fs';
'require ui';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(a){return fs.exec(HELPER,a||[]).catch(function(e){return{code:1,stdout:'',stderr:String(e)};});}
function parse(r){let o={enabled:false,running:false,port:'22',passwordAuth:'on',iface:''};String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|');if(p[0]==='SSH'){o.enabled=p[1]==='1';o.running=p[2]==='1';o.port=p[3]||'22';o.passwordAuth=p[4]||'on';o.iface=p[5]||'';}});return o;}
function toggle(on){return E('button',{'class':'m-toggle m-toggle-large'+(on?' on':''),'type':'button'},[E('span',{})]);}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:function(){return exec(['snapshot']);},render:function(raw){let s=parse(raw),en=toggle(s.enabled);en.addEventListener('click',function(){en.classList.toggle('on');});let pa=toggle(!/^(off|0|no)$/i.test(s.passwordAuth));pa.addEventListener('click',function(){pa.classList.toggle('on');});let port=E('input',{'class':'m-ios-input','type':'number','min':'1','max':'65535','value':s.port});let save=E('button',{'class':'m-ios-button','type':'button'},tx('Apply SSH Settings'));save.addEventListener('click',function(){save.disabled=true;exec(['ssh-save',en.classList.contains('on')?'1':'0',String(port.value||'22'),pa.classList.contains('on')?'on':'off']).then(function(r){if(r.code){save.disabled=false;ui.addNotification(null,E('p',{},tx(r.stderr||'Could not save SSH settings.')),'error');}else window.setTimeout(function(){window.location.reload();},500);});});return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('SSH Access')),E('div',{'class':'m-subtitle'},tx('Secure command-line access without digging through Dropbear options'))]),E('span',{'class':'m-state-pill '+(s.running?'good':'neutral')},tx(s.running?'Running':'Stopped'))]),
 E('div',{'class':'m-hero-card'},[E('div',{},[E('h3',{},tx('SSH Server')),E('p',{},tx('Enable SSH only when you need command-line access. Keys are preferred over password login.'))]),E('div',{'class':'m-app-control-row'},[E('span',{},tx('Enable SSH')),en])]),
 E('div',{'class':'m-section'},[E('div',{'class':'m-service-form'},[E('label',{},[E('span',{},tx('Port')),port]),E('label',{'class':'m-check-row'},[pa,E('span',{},tx('Allow password authentication'))])]),E('div',{'class':'m-inline-actions'},[save,E('a',{'class':'m-secondary-link-button','href':L.url('admin/advanced/administration/sshkeys')},tx('Manage SSH Keys')),E('a',{'class':'m-secondary-link-button','href':L.url('admin/advanced/expert/ssh')},tx('Expert SSH Settings'))])]),
 E('div',{'class':'m-info-card'},[E('strong',{},tx('Recommended')),E('span',{},tx('Use SSH keys, keep SSH on trusted networks and avoid forwarding the SSH port from the Internet unless you specifically need it.'))])
]);}});
