'use strict';
'require view';
function tx(v){return [String(v==null||v===''?'—':v)];}
function card(title,desc,action,label,cls){return E('div',{'class':'m-backup-card'},[E('div',{},[E('h3',{},tx(title)),E('p',{},tx(desc))]),E('a',{'class':(cls||'m-ios-button')+' m-service-open','href':L.url(action)},tx(label))]);}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,render:function(){return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Backup & Firmware')),E('div',{'class':'m-subtitle'},tx('Protect the configuration before upgrades or major changes'))])]),
 E('div',{'class':'m-backup-grid'},[
  card('Configuration Backup','Download a sysupgrade-compatible archive of the current router configuration.','admin/advanced/expert/backup','Backup / Restore'),
  card('Restore Configuration','Restore a known-good configuration archive. Mrouter recommends a Proxmox/VM snapshot as well when testing.','admin/advanced/expert/backup','Restore Backup','m-secondary-link-button'),
  card('Firmware Upgrade','Upload an OpenWrt/Mrouter firmware image, verify it and choose whether to keep settings.','admin/advanced/expert/backup','Open Firmware Upgrade'),
  card('Mrouter Packages','Package-first upgrades are preferred for UI, theme and service changes; full firmware is only needed for base/kernel/image changes.','admin/advanced/packages','Package Manager','m-secondary-link-button')
 ]),
 E('div',{'class':'m-info-card m-warning-card'},[E('strong',{},tx('Before a major change')),E('span',{},tx('Create a backup or VM snapshot, confirm the LAN address, and avoid rebooting until saved network settings are known-good.'))])
]);}});
