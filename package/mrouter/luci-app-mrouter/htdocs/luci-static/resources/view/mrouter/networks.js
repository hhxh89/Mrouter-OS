'use strict';
'require view';
'require fs';
'require ui';

const H='/usr/libexec/mrouter-networks';
function t(v){return [String(v==null||v===''?'—':v)];}
function run(a){return fs.exec(H,a||[]).catch(e=>({code:1,stdout:'',stderr:String(e)}));}
function parse(r){let o=[];String((r&&r.stdout)||'').split(/\r?\n/).forEach(l=>{let p=l.split('|');if(p[0]==='NET')o.push({id:p[1],proto:p[2],dev:p[3],ip:p[4],mask:p[5],up:p[6]==='1',zone:p[7],managed:p[8]==='1'});});return o;}
function notify(r){if(!r||r.code!==0){ui.addNotification(null,E('p',{},t((r&&(r.stderr||r.stdout))||'Action failed')),'error');return false;}return true;}
function toggle(on){let b=E('button',{'class':'m-toggle m-toggle-small'+(on?' on':''),'type':'button'},[E('span',{})]);b.onclick=()=>b.classList.toggle('on');return b;}

return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,
 load:()=>run(['status']).then(parse),
 render(nets){
  let id=E('input',{'class':'m-ios-input','placeholder':'guest'}),type=E('select',{'class':'m-ios-input'},[
   E('option',{'value':'guest'},t('Guest')),E('option',{'value':'iot'},t('IoT')),E('option',{'value':'lan'},t('Trusted LAN')),E('option',{'value':'custom'},t('Custom'))
  ]),cidr=E('input',{'class':'m-ios-input','placeholder':'192.168.30.1/24'}),vlan=E('input',{'class':'m-ios-input','type':'number','min':'0','max':'4094','value':'0'}),parent=E('input',{'class':'m-ios-input','placeholder':'eth2 or br-lan'}),dhcp=toggle(true),internet=toggle(true);
  let create=E('button',{'class':'m-primary-button','type':'button'},t('Create Network'));
  create.onclick=()=>{create.disabled=true;run(['create',id.value.trim(),type.value,cidr.value.trim(),vlan.value||'0',parent.value.trim(),dhcp.classList.contains('on')?'1':'0',internet.classList.contains('on')?'1':'0']).then(r=>{if(notify(r))location.reload();else create.disabled=false;});};
  let list=E('div',{'class':'m-simple-list'});
  nets.forEach(n=>{let del=E('button',{'class':'m-danger-outline-button','type':'button'},t('Delete'));if(!n.managed)del.disabled=true;del.onclick=()=>{if(!confirm('Delete Mrouter-created network "'+n.id+'"?'))return;del.disabled=true;run(['delete',n.id]).then(r=>notify(r)&&location.reload());};list.appendChild(E('div',{'class':'m-simple-row'},[E('div',{},[E('strong',{},t(n.id)),E('span',{},t((n.ip||'Dynamic')+(n.mask?' / '+n.mask:'')+' · '+(n.dev||'no device')+' · zone '+(n.zone||'—')))]),E('div',{'class':'m-inline-actions'},[E('span',{'class':'m-state-pill '+(n.up?'good':'neutral')},t(n.up?'Up':'Down')),n.managed?del:E('span',{'class':'m-state-pill neutral'},t('Existing OpenWrt'))])]))});
  if(!nets.length)list.appendChild(E('div',{'class':'m-empty'},t('No configured interfaces found.')));
  return E('div',{'class':'mrouter-page'},[
   E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},t('Networks')),E('div',{'class':'m-subtitle'},t('Create Guest, IoT, trusted or VLAN networks without replacing existing OpenWrt configuration'))])]),
   E('div',{'class':'m-section'},[E('h3',{},t('Configured Networks')),list]),
   E('div',{'class':'m-section'},[E('h3',{},t('Create Network')),E('div',{'class':'m-info-banner'},t('Mrouter takes a network/DHCP/firewall backup before creating a network. Existing interfaces are never rewritten.')),E('div',{'class':'m-policy-form-grid'},[
    E('label',{},[E('span',{},t('Network name')),id]),E('label',{},[E('span',{},t('Type')),type]),E('label',{},[E('span',{},t('Router address / prefix')),cidr]),E('label',{},[E('span',{},t('VLAN ID (0 = none)')),vlan]),E('label',{},[E('span',{},t('Parent device for VLAN')),parent]),E('label',{'class':'m-inline-toggle-label'},[E('span',{},t('DHCP server')),dhcp]),E('label',{'class':'m-inline-toggle-label'},[E('span',{},t('Internet access')),internet])]),create])
  ]);
 }
});
