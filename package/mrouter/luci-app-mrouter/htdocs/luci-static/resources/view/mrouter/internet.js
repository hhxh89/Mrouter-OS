'use strict';
'require view';
'require fs';
'require poll';
'require ui';

const INFO = '/usr/libexec/mrouter-internet-info';
function bounded(promise, fallback, ms) { return Promise.race([Promise.resolve(promise).catch(function(){return fallback;}), new Promise(function(resolve){window.setTimeout(function(){resolve(fallback);}, ms || 4500);})]); }
function exec(path,args,fallback,ms){return bounded(fs.exec(path,args||[]),fallback,ms);}
function text(v){return [String(v==null||v===''?'—':v)];}
function infoFrom(r){try{return JSON.parse(String((r&&r.stdout)||'{}'));}catch(e){return {};}}
function fmtDuration(v){v=Math.max(0,Number(v)||0);let d=Math.floor(v/86400),h=Math.floor((v%86400)/3600),m=Math.floor((v%3600)/60),s=Math.floor(v%60);if(d)return d+'d '+h+'h '+m+'m';if(h)return h+'h '+m+'m';if(m)return m+'m '+s+'s';return s+'s';}
function fmtSince(v){v=Number(v)||0;if(!v)return '—';try{return new Date(v*1000).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch(e){return '—';}}
function metric(label){let value=E('strong');return {node:E('div',{'class':'m-stat-card'},[E('span',{},text(label)),value]),value:value};}
function infoCell(label){let value=E('strong');return {node:E('div',{'class':'m-info'},[E('span',{},text(label)),value]),value:value};}
function portCard(p){let on=p.state==='Connected';return E('div',{'class':'m-port'},[E('div',{'class':'m-port-head'},[E('span',{'class':'m-dot '+(on?'m-green':'m-gray')}),E('strong',{},text((p.role||'Port')+' · '+(p.name||'—')))]),E('div',{'class':'m-port-meta'},[E('span',{},text(p.state||'—')),E('span',{},text('Current: '+(p.speed||'—'))),E('span',{},text('Max: '+(p.max_speed||'—'))),E('span',{},text('Driver: '+(p.driver||'—'))),E('span',{},text('Duplex: '+(p.duplex||'—')))])]);}

return view.extend({
 handleSaveApply:null,handleSave:null,handleReset:null,refs:{},
 load:function(){return exec(INFO,[],{stdout:'{}'},4500);},
 update:function(info){
   let r=this.refs;if(!r.status)return;
   r.status.textContent=info.online?'Connected':'Offline';r.status.className='m-status-pill '+(info.online?'m-status-good':'m-status-bad');
   r.publicIP.textContent=info.public_ip||'—';r.uptime.textContent=fmtDuration(info.uptime_seconds);r.duration.textContent=fmtDuration(info.internet_duration);r.since.textContent=fmtSince(info.internet_since);
   r.topologyLabel.textContent=info.online?'Connected since':'Offline since';r.topologySince.textContent=fmtSince(info.internet_since);r.topologyIP.textContent=info.lan_ip||info.local_ip||'—';
   r.type.textContent=info.type||'—';r.iface.textContent=info.interface||'—';r.gateway.textContent=info.gateway||'—';r.localIP.textContent=info.local_ip||'—';r.dns.textContent=info.dns||'—';r.publicIPInfo.textContent=info.public_ip||'—';r.uptimeInfo.textContent=fmtDuration(info.uptime_seconds);r.durationInfo.textContent=fmtDuration(info.internet_duration);
   r.ports.replaceChildren.apply(r.ports,(info.ports||[]).map(portCard));
 },
 render:function(raw){
   let info=infoFrom(raw),status=E('span'),ports=E('div',{'class':'m-port-grid'});
   let mPublic=metric('Public IP'),mUptime=metric('Router uptime'),mDuration=metric('Connection duration'),mSince=metric('Since');
   let iType=infoCell('Connection type'),iIface=infoCell('Interface'),iGateway=infoCell('Gateway'),iLocal=infoCell('WAN IP'),iDns=infoCell('DNS'),iPublic=infoCell('Public IP'),iUptime=infoCell('Uptime'),iDuration=infoCell('Connected / offline');
   let topologyLabel=E('span'),topologySince=E('span'),topologyIP=E('span');
   this.refs={status:status,publicIP:mPublic.value,uptime:mUptime.value,duration:mDuration.value,since:mSince.value,topologyLabel:topologyLabel,topologySince:topologySince,topologyIP:topologyIP,type:iType.value,iface:iIface.value,gateway:iGateway.value,localIP:iLocal.value,dns:iDns.value,publicIPInfo:iPublic.value,uptimeInfo:iUptime.value,durationInfo:iDuration.value,ports:ports};
   let check=E('button',{'class':'m-ios-button','type':'button'},text('Check Again'));
   check.addEventListener('click',L.bind(function(){check.disabled=true;return exec(INFO,['refresh'],{stdout:'{}'},7000).then(L.bind(function(r){this.update(infoFrom(r));},this)).finally(function(){check.disabled=false;});},this));
   let root=E('div',{'class':'mrouter-page'},[
     E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},text('Internet')),E('div',{'class':'m-subtitle'},text('Connection health, addressing and physical ports'))]),E('div',{},[status,check])]),
     E('div',{'class':'m-stats-grid'},[mPublic.node,mUptime.node,mDuration.node,mSince.node]),
     E('div',{'class':'m-section'},[E('h3',{},text('Network Topology')),E('div',{'class':'mrouter-topology'},[
       E('div',{'class':'mrouter-topology-node'},[E('div',{'class':'mrouter-topology-icon'},text('⇄')),E('div',{'class':'mrouter-topology-title'},text('Internet')),E('div',{'class':'mrouter-topology-sub'},[topologyLabel,E('br'),topologySince])]),
       E('div',{'class':'mrouter-topology-arrow'},text('→')),
       E('div',{'class':'mrouter-topology-node router'},[E('div',{'class':'mrouter-topology-icon'},text('M')),E('div',{'class':'mrouter-topology-title'},text('Mrouter-OS')),E('div',{'class':'mrouter-topology-sub'},[topologyIP])]),
       E('div',{'class':'mrouter-topology-arrow'},text('→')),
       E('div',{'class':'mrouter-topology-node'},[E('div',{'class':'mrouter-topology-icon'},text('⌂')),E('div',{'class':'mrouter-topology-title'},text('LAN')),E('div',{'class':'mrouter-topology-sub'},text('Clients & local services'))])
     ])]),
     E('div',{'class':'m-section'},[E('h3',{},text('Network Information')),E('div',{'class':'m-info-grid'},[iType.node,iIface.node,iGateway.node,iLocal.node,iDns.node,iPublic.node,iUptime.node,iDuration.node])]),
     E('div',{'class':'m-section'},[E('h3',{},text('Ethernet Ports')),ports])
   ]);
   this.update(info);
   poll.add(L.bind(function(){return exec(INFO,[],{stdout:'{}'},4500).then(L.bind(function(r){this.update(infoFrom(r));},this));},this),5);
   return root;
 }
});
