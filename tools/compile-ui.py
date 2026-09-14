#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
try:
    import yaml
except Exception:
    sys.stderr.write("PyYAML is required. Install with: sudo apt install python3-yaml\n")
    raise

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'package/mrouter/luci-app-mrouter/ui-src'
WEB=ROOT/'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui'
VIEWS=ROOT/'package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter-yaml'
MENU=ROOT/'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/zz-mrouter-yaml.json'
DEFAULTS=ROOT/'package/mrouter/luci-app-mrouter/root/usr/share/mrouter/ui/defaults'
DOCS=['appearance','navigation','pages','login','actions','schema']
PAGE_OVERLAY_GLOB='pages-*.yaml'

def load(name):
    p=SRC/(name+'.yaml')
    with p.open(encoding='utf-8') as f: data=yaml.safe_load(f)
    if not isinstance(data,dict) or data.get('version') != 1: raise SystemExit(f'{p}: version: 1 is required')
    return data

def load_yaml_file(p):
    with p.open(encoding='utf-8') as f: data=yaml.safe_load(f)
    if not isinstance(data,dict) or data.get('version') != 1:
        raise SystemExit(f'{p}: version: 1 is required')
    return data

def deep_merge(base, patch):
    if isinstance(base,dict) and isinstance(patch,dict):
        out=dict(base)
        for k,v in patch.items():
            out[k]=deep_merge(out[k],v) if k in out else v
        return out
    return patch

def apply_page_overlays(pages):
    merged={'version':pages.get('version',1),'pages':dict(pages.get('pages') or {})}
    for p in sorted(SRC.glob(PAGE_OVERLAY_GLOB)):
        data=load_yaml_file(p)
        for pid,patch in (data.get('pages') or {}).items():
            if pid not in merged['pages']:
                raise SystemExit(f'{p}: unknown page id {pid}')
            merged['pages'][pid]=deep_merge(merged['pages'][pid],patch)
    return merged

def dump_json(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def dump_yaml(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(yaml.safe_dump(obj,sort_keys=False,allow_unicode=True,width=120),encoding='utf-8')

def validate_ids(pages,actions,schema):
    allowed=re.compile(r'^[a-z0-9][a-z0-9-]*$')
    routes=set()
    services=set(actions.get('services',{}))
    allowed_blocks=set((schema.get('schema') or {}).get('block_types') or [])
    allowed_fields=set((schema.get('schema') or {}).get('field_types') or [])
    if not allowed_blocks:
        raise SystemExit('schema.yaml: block_types must not be empty')
    if 'legacy' in allowed_blocks:
        raise SystemExit('schema.yaml: legacy block type is forbidden')

    def validate_obj(obj,pid,ctx='generic'):
        if isinstance(obj,dict):
            typ=obj.get('type')
            if typ:
                if typ == 'legacy':
                    raise SystemExit(f'{pid}: legacy page blocks are forbidden')
                if ctx == 'field':
                    if typ not in allowed_fields:
                        raise SystemExit(f'{pid}: unsupported field type {typ}')
                elif ctx == 'block':
                    if typ not in allowed_blocks:
                        raise SystemExit(f'{pid}: unsupported block type {typ}')
            if 'service' in obj and ('action' in obj or 'args' in obj):
                if obj.get('service') not in services:
                    raise SystemExit(f'{pid}: action uses unregistered service {obj.get("service")}')
            for k,v in obj.items():
                if k == 'fields' and isinstance(v,list):
                    for item in v:
                        validate_obj(item,pid,'field')
                elif k == 'layout' and isinstance(v,list):
                    for item in v:
                        validate_obj(item,pid,'block')
                else:
                    validate_obj(v,pid,'generic')
        elif isinstance(obj,list):
            for v in obj:
                validate_obj(v,pid,ctx)

    for pid,p in pages['pages'].items():
        if not allowed.match(pid): raise SystemExit(f'invalid page id: {pid}')
        route=p.get('route')
        if not route or not route.startswith('admin/') or route in routes: raise SystemExit(f'invalid/duplicate route for {pid}: {route}')
        routes.add(route)
        if p.get('renderer')!='yaml': raise SystemExit(f'{pid}: renderer must be yaml')
        layout=p.get('layout') or []
        if not isinstance(layout,list) or not layout: raise SystemExit(f'{pid}: layout must be a non-empty list')
        for item in layout:
            validate_obj(item,pid,'block')
        for sid,spec in (p.get('sources') or {}).items():
            if spec.get('service') not in services: raise SystemExit(f'{pid}: source {sid} uses unregistered service {spec.get("service")}')

def wrapper(pid):
    return f"""'use strict';\n'require view';\n'require fs';\n'require ui';\nvar PAGE_ID={json.dumps(pid)};\nreturn view.extend({{\n load:function(){{if(!window.MrouterSchemaRuntime)throw new Error('Mrouter YAML runtime not loaded');return window.MrouterSchemaRuntime.load(PAGE_ID,fs);}},\n render:function(st){{return window.MrouterSchemaRuntime.render(PAGE_ID,st,fs,ui);}},\n handleSaveApply:null,handleSave:null,handleReset:null\n}});\n"""

def main():
    docs={n:load(n) for n in DOCS}
    docs['pages']=apply_page_overlays(docs['pages'])
    pages=docs['pages']
    validate_ids(pages,docs['actions'],docs['schema'])
    WEB.mkdir(parents=True,exist_ok=True); VIEWS.mkdir(parents=True,exist_ok=True); MENU.parent.mkdir(parents=True,exist_ok=True); DEFAULTS.mkdir(parents=True,exist_ok=True)
    for n,obj in docs.items(): dump_json(WEB/(n+'.json'),obj)
    for n in DOCS:
        if n == 'pages':
            dump_yaml(DEFAULTS/'pages.yaml', pages)
        else:
            (DEFAULTS/(n+'.yaml')).write_text((SRC/(n+'.yaml')).read_text(encoding='utf-8'),encoding='utf-8')
    for p in sorted(SRC.glob(PAGE_OVERLAY_GLOB)):
        (DEFAULTS/p.name).write_text(p.read_text(encoding='utf-8'),encoding='utf-8')
    for old in VIEWS.glob('*.js'): old.unlink()
    menu={}
    for pid,p in pages['pages'].items():
        menu[p['route']]={'title':p.get('title',pid),'order':p.get('order',50),'action':{'type':'view','path':'mrouter-yaml/'+pid},'depends':{'acl':['mrouter-ui']}}
        (VIEWS/(pid+'.js')).write_text(wrapper(pid),encoding='utf-8')
    dump_json(MENU,menu)
    overlays=len(list(SRC.glob(PAGE_OVERLAY_GLOB)))
    print(f'Mrouter UI YAML compiled: {len(pages["pages"])} native pages, {len(menu)} YAML routes, {overlays} modular page overlays, 0 legacy blocks')

if __name__=='__main__': main()
