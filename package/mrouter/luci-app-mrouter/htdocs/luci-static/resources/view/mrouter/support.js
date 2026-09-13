'use strict';
'require view';
'require fs';
const H='/usr/libexec/mrouter-support';function t(v){return [String(v==null||v===''?'—':v)];}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:()=>fs.exec(H,['summary']),render(r){let pre=E('pre',{'class':'m-modern-log'},t(r.stdout||'No summary'));let copy=E('button',{'class':'m-ios-button','type':'button'},t('Copy Summary'));copy.onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(pre.textContent||'');return E('div',{'class':'mrouter-page'},[E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},t('Support Bundle')),E('div',{'class':'m-subtitle'},t('Sanitised troubleshooting snapshot'))])]),E('div',{'class':'m-section'},[copy,pre]),E('div',{'class':'m-info-card'},[E('strong',{},t('No secrets')),E('span',{},t('This summary intentionally avoids UCI passwords, API tokens and VPN private keys.'))])]);}});
