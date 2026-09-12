'use strict';
'require view';
'require fs';
const HELPER='/usr/libexec/mrouter-advanced';
function tx(v){return [String(v==null||v===''?'—':v)];}
function exec(){return fs.exec(HELPER,['snapshot']).catch(function(){return{stdout:''};});}
function parse(r){let out=[];String((r&&r.stdout)||'').split(/\r?\n/).forEach(function(l){let p=l.split('|');if(p[0]==='CRON')out.push(p.slice(1).join('|'));});return out;}
function explain(line){let p=line.trim().split(/\s+/);if(p.length<6)return{when:'Custom',cmd:line};let when=p.slice(0,5).join(' '),cmd=p.slice(5).join(' ');return{when:when,cmd:cmd};}
return view.extend({handleSaveApply:null,handleSave:null,handleReset:null,load:exec,render:function(raw){let jobs=parse(raw),list=E('div',{'class':'m-simple-list'});jobs.forEach(function(j){let x=explain(j);list.appendChild(E('div',{'class':'m-simple-row'},[E('div',{},[E('strong',{},tx(x.cmd)),E('span',{},tx('Schedule: '+x.when))]),E('span',{'class':'m-state-pill neutral'},tx('Cron'))]));});if(!jobs.length)list.appendChild(E('div',{'class':'m-empty'},tx('No scheduled tasks are configured.')));return E('div',{'class':'mrouter-page'},[
 E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},tx('Scheduled Tasks')),E('div',{'class':'m-subtitle'},tx('Automatic jobs and maintenance schedules'))]),E('a',{'class':'m-ios-button m-service-open','href':L.url('admin/advanced/expert/scheduled')},tx('+ Create Task'))]),
 E('div',{'class':'m-section'},[E('h3',{},tx('Tasks')),list]),
 E('div',{'class':'m-info-card'},[E('strong',{},tx('Friendly scheduler planned')),E('span',{},tx('The Mrouter view keeps existing cron jobs readable. Use the advanced editor for custom cron expressions and commands.'))])
]);}});
