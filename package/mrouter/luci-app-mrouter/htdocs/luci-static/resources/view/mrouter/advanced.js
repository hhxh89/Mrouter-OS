'use strict';
'require view';
function tx(v){return [String(v)];}
function card(title,description,path,badge){let c=[E('strong',{},tx(title))];if(badge)c.push(E('small',{'class':'m-card-badge'},tx(badge)));c.push(E('span',{},tx(description)));return E('a',{'class':'m-advanced-card','href':L.url(path)},[E('div',{},c),E('i',{},tx('›'))]);}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,render:function(){return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Advanced')),E('div',{'class':'m-subtitle'},tx('Powerful router controls presented in plain language'))])]),
 E('div',{'class':'m-advanced-grid'},[
  card('System Health','Hardware, Ethernet links, storage, services and routing health.','admin/advanced/system-health','Recommended'),
  card('Network Settings','Networks, DHCP/DNS, firewall, routing, traffic control and diagnostics.','admin/advanced/network-settings'),
  card('Administration','Device settings, account security, SSH, web access, startup and backups.','admin/advanced/administration'),
  card('System Log','Search recent router events and service warnings.','admin/advanced/system-log'),
  card('Processes','Read running processes and open expert controls when needed.','admin/advanced/processes'),
  card('Terminal','Secure browser terminal on Mrouter-OS.','admin/advanced/terminal'),
  card('Package Manager','Install optional software and package-first Mrouter updates.','admin/advanced/packages'),
  card('Expert LuCI','Raw OpenWrt controls for unusual bridges, DSA, VLAN filtering and specialist settings.','admin/advanced/expert','Expert')
 ])
]);}});
