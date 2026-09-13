'use strict';
'require view';
'require fs';
'require ui';

var HELPER='/usr/libexec/mrouter-ui-config';

function run(args){return fs.exec(HELPER,args||[]).then(function(r){if(r.code)throw new Error((r.stderr||r.stdout||'UI configuration failed').trim());return (r.stdout||'').trim();});}
function parseStatus(s){var p=(s||'').split('|');return{accent:p[1]||'#007AFF',density:p[2]||'compact',sidebar:p[3]||'212',content:p[4]||'1440',form:p[5]||'360',radius:p[6]||'14',compact:(p[7]||'1')==='1'};}
function yamlOf(v){return 'appearance:\n  accent: "'+v.accent+'"\n  density: '+v.density+'\n  sidebar_width: '+v.sidebar+'\n  content_max_width: '+v.content+'\n  form_max_width: '+v.form+'\n  card_radius: '+v.radius+'\n  compact_forms: '+(v.compact?'true':'false')+'\n';}
function parseYaml(text){var o={};String(text||'').split(/\r?\n/).forEach(function(line){var m=line.match(/^\s{2}([a-z_]+):\s*(.*?)\s*$/);if(!m)return;var v=m[2].replace(/^['"]|['"]$/g,'');o[m[1]]=v;});return{accent:o.accent||'#007AFF',density:o.density||'compact',sidebar:o.sidebar_width||'212',content:o.content_max_width||'1440',form:o.form_max_width||'360',radius:o.card_radius||'14',compact:String(o.compact_forms||'true').toLowerCase()!=='false'};}
function field(label,input){return E('label',{'class':'mr-designer-field'},[E('span',{},label),input]);}

return view.extend({
 load:function(){return run(['status']).then(parseStatus);},
 render:function(v){
   var accent=E('input',{type:'color',value:v.accent});
   var density=E('select',{},[E('option',{value:'compact'},'Compact'),E('option',{value:'comfortable'},'Comfortable')]);density.value=v.density;
   var sidebar=E('input',{type:'number',min:'180',max:'320',value:v.sidebar});
   var content=E('input',{type:'number',min:'900',max:'2200',value:v.content});
   var form=E('input',{type:'number',min:'220',max:'640',value:v.form});
   var radius=E('input',{type:'number',min:'0',max:'28',value:v.radius});
   var compact=E('input',{type:'checkbox'});compact.checked=v.compact;
   var yaml=E('textarea',{'class':'mr-yaml-editor',rows:'12',spellcheck:'false'},yamlOf(v));
   var msg=E('div',{'class':'m-info-banner'},'Changes are stored in /etc/mrouter/ui.d/appearance.yaml and survive package upgrades.');

   function values(){return{accent:accent.value,density:density.value,sidebar:sidebar.value,content:content.value,form:form.value,radius:radius.value,compact:compact.checked};}
   function syncYaml(){yaml.value=yamlOf(values());}
   [accent,density,sidebar,content,form,radius,compact].forEach(function(x){x.addEventListener('change',syncYaml);});

   var save=E('button',{'class':'btn cbi-button cbi-button-apply','type':'button'},'Apply');
   save.onclick=function(){var x=values();save.disabled=true;run(['set',x.accent,x.density,x.sidebar,x.content,x.form,x.radius,x.compact?'1':'0']).then(function(){ui.addNotification(null,E('p',{},'UI settings saved. Reloading…'),'info');setTimeout(function(){location.reload();},300);}).catch(function(e){ui.addNotification(null,E('p',{},e.message),'error');save.disabled=false;});};

   var applyYaml=E('button',{'class':'btn cbi-button','type':'button'},'Apply YAML');
   applyYaml.onclick=function(){try{var x=parseYaml(yaml.value);accent.value=x.accent;density.value=x.density;sidebar.value=x.sidebar;content.value=x.content;form.value=x.form;radius.value=x.radius;compact.checked=x.compact;save.click();}catch(e){ui.addNotification(null,E('p',{},'Invalid YAML: '+e.message),'error');}};

   var reset=E('button',{'class':'btn cbi-button cbi-button-reset','type':'button'},'Reset defaults');
   reset.onclick=function(){reset.disabled=true;run(['reset']).then(function(){location.reload();}).catch(function(e){ui.addNotification(null,E('p',{},e.message),'error');reset.disabled=false;});};

   return E('div',{'class':'mrouter-page mr-ui-designer'},[
     E('div',{'class':'m-page-title'},[E('div',{},[E('h2',{},'Mrouter UI Designer'),E('div',{'class':'m-subtitle'},'Fast local interface customisation backed by YAML')])]),
     E('div',{'class':'m-section'},[E('h3',{},'Appearance'),E('div',{'class':'mr-designer-grid'},[
       field('Accent colour',accent),field('Density',density),field('Sidebar width',sidebar),field('Content width',content),field('Form control width',form),field('Card radius',radius),field('Compact forms',compact)
     ]),E('div',{'class':'cbi-page-actions'},[save,reset])]),
     E('div',{'class':'m-section'},[E('h3',{},'YAML mode'),msg,yaml,E('div',{'class':'cbi-page-actions'},[applyYaml])])
   ]);
 },
 handleSaveApply:null,handleSave:null,handleReset:null
});
