'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(a){return fs.exec(HELPER,a||[]).catch(function(){return{stdout:''};});}
function parse(r){let o={nets:[],def:{}};String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|');if(p[0]==='NET')o.nets.push({name:p[1],proto:p[2],dev:p[3],ip:p[4],mask:p[5],gw:p[6],role:p[7],up:p[8]==='1'});else if(p[0]==='DEFAULT')o.def={dev:p[1],gw:p[2],src:p[3]};});return o;}
function role(n){if(n.name==='wan'||n.name==='wan6')return'Internet';if(n.name==='lan')return'LAN';if(n.name==='iot')return'IoT';if(n.name==='guest')return'Guest';return'Network';}
function icon(r){return r==='Internet'?'↗':r==='LAN'?'⌂':r==='IoT'?'◈':r==='Guest'?'◎':'◇';}
function card(n){let r=role(n),state=n.up?'Online':'Offline';return E('div',{'class':'m-modern-net-card'},[E('div',{'class':'m-modern-net-head'},[E('span',{'class':'m-modern-icon'},tx(icon(r))),E('div',{},[E('strong',{},tx(r)),E('span',{},tx(n.name))]),E('span',{'class':'m-state-pill '+(n.up?'good':'neutral')},tx(state))]),E('div',{'class':'m-modern-net-grid'},[E('div',{},[E('span',{},tx('Address')),E('strong',{},tx(n.ip||'Automatic'))]),E('div',{},[E('span',{},tx('Device')),E('strong',{},tx(n.dev))]),E('div',{},[E('span',{},tx('Protocol')),E('strong',{},tx((n.proto||'none').toUpperCase()))]),E('div',{},[E('span',{},tx('Gateway')),E('strong',{},tx(n.gw||'—'))])])]);}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:function(){return exec(['snapshot']);},render:function(raw){let s=parse(raw),grid=E('div',{'class':'m-modern-grid'});s.nets.filter(function(n){return !/^loopback$/.test(n.name);}).forEach(function(n){grid.appendChild(card(n));});if(!grid.children.length)grid.appendChild(E('div',{'class':'m-empty-card'},tx('No configured networks were found.')));return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Networks')),E('div',{'class':'m-subtitle'},tx('Internet, LAN, VLAN and guest networks in one place'))]),E('a',{'class':'m-ios-button m-service-open','href':L.url('admin/advanced/expert/interfaces')},tx('+ Create Network'))]),
 E('div',{'class':'m-health-strip'},[E('div',{},[E('span',{},tx('Internet path')),E('strong',{},tx((s.def.src||'Router')+' → '+(s.def.gw||'No gateway')+' → Internet'))]),E('span',{'class':'m-state-pill '+(s.def.gw?'good':'bad')},tx(s.def.gw?'Ready':'No default route'))]),
 grid,
 E('div',{'class':'m-info-card'},[E('strong',{},tx('Simple by default, expert controls when needed')),E('span',{},[document.createTextNode('Mrouter shows the networks people normally manage. Bridges, DSA devices, VLAN filtering and unusual hardware remain available in '),E('a',{'href':L.url('admin/advanced/expert/interfaces')},tx('Expert Interface Editor')),document.createTextNode('.')])])
]);}});
