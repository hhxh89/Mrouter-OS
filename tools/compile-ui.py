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

def load(name):
    p=SRC/(name+'.yaml')
    with p.open(encoding='utf-8') as f: data=yaml.safe_load(f)
    if not isinstance(data,dict) or data.get('version') != 1: raise SystemExit(f'{p}: version: 1 is required')
    return data

def dump_json(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def validate_ids(pages):
    allowed=re.compile(r'^[a-z0-9][a-z0-9-]*$'); routes=set()
    for pid,p in pages['pages'].items():
        if not allowed.match(pid): raise SystemExit(f'invalid page id: {pid}')
        route=p.get('route')
        if not route or not route.startswith('admin/') or route in routes: raise SystemExit(f'invalid/duplicate route for {pid}: {route}')
        routes.add(route); layout=p.get('layout') or []
        if not isinstance(layout,list) or not layout: raise SystemExit(f'{pid}: layout must be a non-empty list')
        for block in layout:
            if not isinstance(block,dict) or not block.get('type'): raise SystemExit(f'{pid}: each layout block needs a type')
            if block.get('type')=='legacy':
                c=block.get('component')
                if not c or not re.match(r'^[a-z0-9-]+$',c): raise SystemExit(f'{pid}: invalid component')

def wrapper(pid):
    return f"""'use strict';\n'require view';\n'require fs';\n'require ui';\nvar PAGE_ID={json.dumps(pid)};\nreturn view.extend({{\n load:function(){{if(!window.MrouterSchemaRuntime)throw new Error('Mrouter YAML runtime not loaded');return window.MrouterSchemaRuntime.load(PAGE_ID,fs);}},\n render:function(st){{return window.MrouterSchemaRuntime.render(PAGE_ID,st,fs,ui);}},\n handleSaveApply:null,handleSave:null,handleReset:null\n}});\n"""

def main():
    docs={n:load(n) for n in DOCS}; pages=docs['pages']; validate_ids(pages)
    WEB.mkdir(parents=True,exist_ok=True); VIEWS.mkdir(parents=True,exist_ok=True); MENU.parent.mkdir(parents=True,exist_ok=True); DEFAULTS.mkdir(parents=True,exist_ok=True)
    for n,obj in docs.items(): dump_json(WEB/(n+'.json'),obj)
    for n in DOCS: (DEFAULTS/(n+'.yaml')).write_text((SRC/(n+'.yaml')).read_text(encoding='utf-8'),encoding='utf-8')
    menu={}
    for pid,p in pages['pages'].items():
        if p.get('renderer')!='yaml': continue
        menu[p['route']]={'title':p.get('title',pid),'order':p.get('order',50),'action':{'type':'view','path':'mrouter-yaml/'+pid},'depends':{'acl':['mrouter-ui']}}
        (VIEWS/(pid+'.js')).write_text(wrapper(pid),encoding='utf-8')
    dump_json(MENU,menu)
    print(f'Mrouter UI YAML compiled: {len(pages["pages"])} pages, {len(menu)} YAML routes')

if __name__=='__main__': main()
