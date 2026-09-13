'use strict';
'require view';
'require fs';
'require poll';
const INFO='/usr/libexec/mrouter-internet-info', WAN='/usr/libexec/mrouter-wan', TRAFFIC='/usr/libexec/mrouter-traffic-live';
function t(v){return [String(v==null||v===''?'—':v)];}
function run(p,a){return fs.exec(p,a||[]).catch(()=>({stdout:''}));}
function json(r){try{return JSON.parse(String(r.stdout||'{}'));}catch(e){return{};}}
function parseWan(r){let o={quality:[],nat:{},v6:{},multi:{}};String(r.stdout||'').split(/\r?\n/).forEach(l=>{let p=l.split('|');if(p[0]==='STATUS')o.multi={on:p[1]==='1',pri:p[2],sec:p[3],mode:p[4]};else if(p[0]==='QUALITY')o.quality.push({ts:+p[1],iface:p[2],loss:+p[3],avg:+p[4],max:+p[5]});else if(p[0]==='NAT')o.nat={wan:p[1],pub:p[2],cgnat:p[3]==='1'};else if(p[0]==='IPV6')o.v6={iface:p[1],ip:p[2],gw:p[3]};});return o;}
function parseTraffic(r){let o={};String(r.stdout||'').split(/\r?\n/).forEach(l=>{let p=l.split('|');if((p[0]==='WAN'||p[0]==='VPN')&&p.length>=4)o[p[0]+':'+p[1]]={kind:p[0],name:p[1],rx:+p[2]||0,tx:+p[3]||0};});return o;}
function bytes(v){v=Number(v)||0;if(v>=1073741824)return(v/1073741824).toFixed(2)+' GB';if(v>=1048576)return(v/1048576).toFixed(1)+' MB';if(v>=1024)return(v/1024).toFixed(1)+' KB';return Math.round(v)+' B';}
function rate(v){return bytes(v)+'/s';}
function dur(v){v=Math.max(0,+v||0);let d=Math.floor(v/86400),h=Math.floor(v%86400/3600),m=Math.floor(v%3600/60);return d?d+'d '+h+'h':h?h+'h '+m+'m':m+'m';}
function port(p){return E('div',{'class':'m-port'},[E('div',{'class':'m-port-head'},[E('span',{'class':'m-dot '+(p.state==='Connected'?'m-green':'m-gray')}),E('strong',{},t((p.role||'Port')+' · '+(p.name||'—')))]),E('div',{'class':'m-port-meta'},[E('span',{},t(p.state)),E('span',{},t('Current '+(p.speed||'—'))),E('span',{},t('Max '+(p.max_speed||'—'))),E('span',{},t(p.driver||'—'))])]);}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,prev:null,prevAt:0,
 load(){return Promise.all([run(INFO,[]),run(WAN,['status']),run(TRAFFIC,[])]);},
 render(d){let info=json(d[0]),wan=parseWan(d[1]),traf=parseTraffic(d[2]),status=E('span'),stats=E('div',{'class':'m-stats-grid'}),quality=E('div'),traffic=E('div'),ports=E('div',{'class':'m-port-grid'});
  let q=wan.quality.slice(-60),last=q[q.length-1]||{},avg=q.length?q.reduce((a,x)=>a+x.avg,0)/q.length:0,loss=q.length?q.reduce((a,x)=>a+x.loss,0)/q.length:0;
  function metric(name,val){return E('div',{'class':'m-stat-card'},[E('span',{},t(name)),E('strong',{},t(val))]);}
  stats.append(metric('Public IP',info.public_ip||'—'),metric('WAN IP',info.local_ip||'—'),metric('Uptime',dur(info.uptime_seconds)),metric('DNS',info.dns||'—'));
  quality.appendChild(E('div',{'class':'m-modern-grid'},[metric('Latency',q.length?avg.toFixed(1)+' ms':'—'),metric('Packet loss',q.length?loss.toFixed(1)+'%':'—'),metric('Latest peak',last.max!=null?Number(last.max).toFixed(1)+' ms':'—'),metric('IPv6',wan.v6.ip||'Not detected')]));
  if(wan.nat.cgnat)quality.appendChild(E('div',{'class':'m-info-banner'},t('CGNAT/private upstream addressing detected. Inbound port forwarding may require the upstream router or ISP support.')));
  function drawTraffic(next){let now=Date.now()/1000,nodes=[];Object.keys(next).forEach(k=>{let x=next[k],pr=this.prev&&this.prev[k],dt=this.prevAt?Math.max(.1,now-this.prevAt):0,rx=pr&&dt?Math.max(0,(x.rx-pr.rx)/dt):0,tx=pr&&dt?Math.max(0,(x.tx-pr.tx)/dt):0;nodes.push(E('div',{'class':'m-modern-net-card'},[E('div',{'class':'m-modern-net-head'},[E('strong',{},t((x.kind==='WAN'?'Internet':'VPN')+' · '+x.name)),E('span',{'class':'m-state-pill '+(x.kind==='WAN'?'good':'neutral')},t(x.kind))]),E('div',{'class':'m-modern-net-grid'},[E('div',{},[E('span',{},t('Download')),E('strong',{},t(rate(rx)))]),E('div',{},[E('span',{},t('Upload')),E('strong',{},t(rate(tx)))]),E('div',{},[E('span',{},t('Received')),E('strong',{},t(bytes(x.rx)))]),E('div',{},[E('span',{},t('Sent')),E('strong',{},t(bytes(x.tx)))])])]))});traffic.replaceChildren.apply(traffic,nodes.length?nodes:[E('div',{'class':'m-empty'},t('Traffic counters unavailable.'))]);this.prev=next;this.prevAt=now;}
  drawTraffic.call(this,traf);(info.ports||[]).forEach(p=>ports.appendChild(port(p)));
  status.textContent=info.online?'Connected':'Offline';status.className='m-status-pill '+(info.online?'m-status-good':'m-status-bad');
  let root=E('div',{'class':'mrouter-page'},[E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},t('Internet')),E('div',{'class':'m-subtitle'},t('Connection, WAN quality, traffic and physical ports'))]),status]),stats,E('div',{'class':'m-section'},[E('div',{'class':'m-section-header'},[E('div',{},[E('h3',{},t('WAN Quality')),E('p',{'class':'m-muted'},t('Real latency and packet-loss samples collected by Mrouter.'))]),E('a',{'class':'m-secondary-link-button','href':L.url('admin/advanced/network-settings/multiwan')},t(wan.multi.on?'Multi-WAN '+wan.multi.mode:'Configure Multi-WAN'))]),quality]),E('div',{'class':'m-section'},[E('h3',{},t('Live Traffic')),traffic]),E('div',{'class':'m-section'},[E('h3',{},t('Connection Details')),E('div',{'class':'m-modern-grid'},[metric('Gateway',info.gateway),metric('Interface',info.interface),metric('Connection type',info.type),metric('Connected / offline',dur(info.internet_duration))])]),E('div',{'class':'m-section'},[E('h3',{},t('Ethernet Ports')),ports])]);
  poll.add(L.bind(function(){return run(TRAFFIC,[]).then(r=>drawTraffic.call(this,parseTraffic(r)));},this),2);
  poll.add(function(){return Promise.all([run(INFO,[]),run(WAN,['status'])]).then(x=>{let i=json(x[0]);status.textContent=i.online?'Connected':'Offline';status.className='m-status-pill '+(i.online?'m-status-good':'m-status-bad');});},10);
  return root;
 }
});
