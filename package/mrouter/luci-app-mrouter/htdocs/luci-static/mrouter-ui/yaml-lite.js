(function(g){
'use strict';
function scalar(s){
 s=s.trim();
 if(s==='')return '';
 if(s==='true')return true;if(s==='false')return false;if(s==='null'||s==='~')return null;
 if(/^-?\d+(?:\.\d+)?$/.test(s))return Number(s);
 if((s[0]==='"'&&s[s.length-1]==='"')||(s[0]==="'"&&s[s.length-1]==="'")){
  if(s[0]==='"'){try{return JSON.parse(s);}catch(e){}}
  return s.slice(1,-1).replace(/''/g,"'");
 }
 if((s[0]==='['&&s[s.length-1]===']')||(s[0]==='{'&&s[s.length-1]==='}')){try{return JSON.parse(s);}catch(e){}}
 return s;
}
function lines(text){return String(text||'').replace(/\t/g,'  ').split(/\r?\n/).map(function(raw,n){var m=raw.match(/^( *)(.*)$/);return{n:n+1,indent:m[1].length,text:m[2]};}).filter(function(x){return x.text.trim()!==''&&!/^\s*#/.test(x.text);});}
function splitKV(s,n){var q=null,esc=false;for(var i=0;i<s.length;i++){var c=s[i];if(esc){esc=false;continue;}if(c==='\\'&&q==='"'){esc=true;continue;}if(q){if(c===q)q=null;continue;}if(c==='"'||c==="'"){q=c;continue;}if(c===':')return[s.slice(0,i).trim(),s.slice(i+1).trim()];}throw new Error('YAML line '+n+': expected key: value');}
function parse(text){
 var a=lines(text),i=0;
 function block(indent){
  if(i>=a.length)return{};
  var isArr=a[i].indent===indent&&/^\-\s*(.*)$/.test(a[i].text),out=isArr?[]:{};
  while(i<a.length){var L=a[i];if(L.indent<indent)break;if(L.indent>indent)throw new Error('YAML line '+L.n+': unexpected indentation');
   if(isArr){var mm=L.text.match(/^\-\s*(.*)$/);if(!mm)break;var rest=mm[1];i++;
    if(rest===''){if(i<a.length&&a[i].indent>indent)out.push(block(a[i].indent));else out.push(null);continue;}
    if(rest.indexOf(':')>=0){var kv=splitKV(rest,L.n),obj={};if(kv[1]!=='')obj[kv[0]]=scalar(kv[1]);else if(i<a.length&&a[i].indent>indent)obj[kv[0]]=block(a[i].indent);else obj[kv[0]]={};
      if(i<a.length&&a[i].indent>indent){var more=block(a[i].indent);if(more&&typeof more==='object'&&!Array.isArray(more))Object.keys(more).forEach(function(k){obj[k]=more[k];});}
      out.push(obj);continue;}
    out.push(scalar(rest));continue;
   }
   if(/^\-\s*/.test(L.text))break;
   var kv2=splitKV(L.text,L.n),key=kv2[0];if(!key)throw new Error('YAML line '+L.n+': empty key');i++;
   if(kv2[1]!=='')out[key]=scalar(kv2[1]);else if(i<a.length&&a[i].indent>indent)out[key]=block(a[i].indent);else out[key]={};
  }
  return out;
 }
 return a.length?block(a[0].indent):{};
}
function q(s){s=String(s);if(s===''||/[:#\[\]{},&*!|>'"%@`\n\r]/.test(s)||/^[-?:]\s/.test(s)||/^(true|false|null|~|-?\d+(?:\.\d+)?)$/i.test(s))return JSON.stringify(s);return s;}
function stringify(v,indent){indent=indent||0;var pad=' '.repeat(indent),out=[];
 if(Array.isArray(v)){v.forEach(function(x){if(x&&typeof x==='object'){if(Array.isArray(x)){out.push(pad+'-');out.push(stringify(x,indent+2));}else{var ks=Object.keys(x);if(!ks.length){out.push(pad+'- {}');return;}var first=ks.shift(),fv=x[first];if(fv&&typeof fv==='object'){out.push(pad+'- '+first+':');out.push(stringify(fv,indent+4));}else out.push(pad+'- '+first+': '+fmt(fv));ks.forEach(function(k){var z=x[k];if(z&&typeof z==='object'){out.push(pad+'  '+k+':');out.push(stringify(z,indent+4));}else out.push(pad+'  '+k+': '+fmt(z));});}}else out.push(pad+'- '+fmt(x));});return out.join('\n');}
 Object.keys(v||{}).forEach(function(k){var x=v[k];if(x&&typeof x==='object'){out.push(pad+k+':');out.push(stringify(x,indent+2));}else out.push(pad+k+': '+fmt(x));});return out.join('\n');
}
function fmt(v){if(v===true)return'true';if(v===false)return'false';if(v==null)return'null';if(typeof v==='number')return String(v);return q(v);}
g.MrouterYaml={parse:parse,stringify:function(v){return stringify(v,0)+'\n';}};
})(window);
