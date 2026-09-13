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
ALLOWED_BLOCKS={'heading','notice','stats','card','records','json','code','form','actions','link'}

def load(name):
    p=SRC/(name+'.yaml')
    with p.open(encoding='utf-8') as f: data=yaml.safe_load(f)
    if not isinstance(data,dict) or data.get('version') != 1: raise SystemExit(f'{p}: version: 1 is required')
    return data

def dump_json(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def validate_ids(pages,actions):
    allowed=re.compile(r'^[a-z0-9][a-z0-9-]*$'); routes=set(); services=set(actions.get('services',{}))
    for pid,p in pages['pages'].items():
        if not allowed.match(pid): raise SystemExit(f'invalid page id: {pid}')
        route=p.get('route')
        if not route or not route.startswith('admin/') or route in routes: raise SystemExit(f'invalid/duplicate route for {pid}: {route}')
        routes.add(route)
        if p.get('renderer')!='yaml': raise SystemExit(f'{pid}: renderer must be yaml')
        layout=p.get('layout') or []
        if not isinstance(layout,list) or not layout: raise SystemExit(f'{pid}: layout must be a non-empty list')
        for block in layout:
            if not isinstance(block,dict) or not block.get('type'): raise SystemExit(f'{pid}: each layout block needs a type')
            if block.get('type') == 'legacy': raise SystemExit(f'{pid}: legacy page blocks are forbidden')
            if block.get('type') not in ALLOWED_BLOCKS: raise SystemExit(f'{pid}: unsupported block type {block.get("type")}')
        for sid,spec in (p.get('sources') or {}).items():
            if spec.get('service') not in services: raise SystemExit(f'{pid}: source {sid} uses unregistered service {spec.get("service")}')
        def check_actions(obj):
            if isinstance(obj,dict):
                if 'service' in obj and ('action' in obj or 'args' in obj):
                    if obj.get('service') not in services: raise SystemExit(f'{pid}: action uses unregistered service {obj.get("service")}')
                for v in obj.values(): check_actions(v)
            elif isinstance(obj,list):
                for v in obj: check_actions(v)
        check_actions(layout)

def wrapper(pid):
    return f"""'use strict';\n'require view';\n'require fs';\n'require ui';\nvar PAGE_ID={json.dumps(pid)};\nreturn view.extend({{\n load:function(){{if(!window.MrouterSchemaRuntime)throw new Error('Mrouter YAML runtime not loaded');return window.MrouterSchemaRuntime.load(PAGE_ID,fs);}},\n render:function(st){{return window.MrouterSchemaRuntime.render(PAGE_ID,st,fs,ui);}},\n handleSaveApply:null,handleSave:null,handleReset:null\n}});\n"""

def main():
    docs={n:load(n) for n in DOCS}; pages=docs['pages']; validate_ids(pages,docs['actions'])
    WEB.mkdir(parents=True,exist_ok=True); VIEWS.mkdir(parents=True,exist_ok=True); MENU.parent.mkdir(parents=True,exist_ok=True); DEFAULTS.mkdir(parents=True,exist_ok=True)
    for n,obj in docs.items(): dump_json(WEB/(n+'.json'),obj)
    for n in DOCS: (DEFAULTS/(n+'.yaml')).write_text((SRC/(n+'.yaml')).read_text(encoding='utf-8'),encoding='utf-8')
    for old in VIEWS.glob('*.js'): old.unlink()
    menu={}
    for pid,p in pages['pages'].items():
        menu[p['route']]={'title':p.get('title',pid),'order':p.get('order',50),'action':{'type':'view','path':'mrouter-yaml/'+pid},'depends':{'acl':['mrouter-ui']}}
        (VIEWS/(pid+'.js')).write_text(wrapper(pid),encoding='utf-8')
    dump_json(MENU,menu)
    print(f'Mrouter UI YAML compiled: {len(pages["pages"])} native pages, {len(menu)} YAML routes, 0 legacy blocks')

if __name__=='__main__': main()
