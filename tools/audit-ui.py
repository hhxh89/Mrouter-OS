#!/usr/bin/env python3
import json,re,sys
from pathlib import Path
try:
 import yaml
except Exception:
 sys.stderr.write('PyYAML is required. Install with: sudo apt install python3-yaml\n'); raise
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'package/mrouter/luci-app-mrouter'; CORE=ROOT/'package/mrouter/mrouter-core/files/usr/libexec'; SRC=APP/'ui-src'

def load_yaml(p):
 data=yaml.safe_load(p.read_text())
 if not isinstance(data,dict) or data.get('version') != 1: raise SystemExit(f'{p}: version: 1 is required')
 return data

def deep_merge(base,patch):
 if isinstance(base,dict) and isinstance(patch,dict):
  out=dict(base)
  for k,v in patch.items(): out[k]=deep_merge(out[k],v) if k in out else v
  return out
 return patch

PAGES=load_yaml(SRC/'pages.yaml')
raw_pages=(SRC/'pages.yaml').read_text()
for ov in sorted(SRC.glob('pages-*.yaml')):
 data=load_yaml(ov); raw_pages+='\n'+ov.read_text()
 for pid,patch in (data.get('pages') or {}).items():
  if pid not in PAGES.get('pages',{}): raise SystemExit(f'{ov}: unknown page id {pid}')
  PAGES['pages'][pid]=deep_merge(PAGES['pages'][pid],patch)
ACTIONS=load_yaml(SRC/'actions.yaml'); SCHEMA=load_yaml(SRC/'schema.yaml'); ACL=json.loads((APP/'root/usr/share/rpcd/acl.d/mrouter.json').read_text()); BRIDGE=(CORE/'mrouter-ui-action').read_text(errors='ignore')
errors=[]; pages=PAGES.get('pages',{}); services=ACTIONS.get('services',{}); allowed_blocks=set(SCHEMA.get('schema',{}).get('block_types',[])); allowed_fields=set(SCHEMA.get('schema',{}).get('field_types',[]))
raw_runtime=(APP/'htdocs/luci-static/mrouter-ui/schema-runtime.js').read_text()
if re.search(r'\btype:\s*legacy\b',raw_pages): errors.append('page YAML still contains a legacy block')
if 'loadLegacy' in raw_runtime or 'view.mrouter.' in raw_runtime: errors.append('schema runtime still contains legacy view loading')
if 'legacy' in allowed_blocks: errors.append('schema still permits legacy blocks')

yaml_pairs=set()
def walk(obj,pid,ctx='block'):
 if isinstance(obj,dict):
  typ=obj.get('type')
  if typ:
   if ctx=='field':
    if typ not in allowed_fields: errors.append(f'{pid}: unsupported field type {typ}')
   elif ctx=='block' and typ not in allowed_blocks:
    errors.append(f'{pid}: unsupported block type {typ}')
  svc=obj.get('service')
  if svc and svc not in services: errors.append(f'{pid}: unregistered service {svc}')
  if svc and isinstance(obj.get('action'),str) and not obj['action'].startswith('$field.'): yaml_pairs.add((svc,obj['action']))
  for k,v in obj.items():
   if k=='fields' and isinstance(v,list):
    for item in v: walk(item,pid,'field')
   elif k in ('labels','options','options_from'):
    continue
   else:
    walk(v,pid,ctx)
 elif isinstance(obj,list):
  for v in obj: walk(v,pid,ctx)
for pid,p in pages.items():
 if p.get('renderer')!='yaml': errors.append(f'{pid}: renderer is not yaml')
 if not p.get('layout'): errors.append(f'{pid}: empty layout')
 walk(p,pid,'block')

registered={}; helper_actions={}
def action_dispatch(text):
 # Parse only the command-dispatch case "$ACTION" in ... esac. Accept indented,
 # multiline and compact BusyBox-style case bodies. Each command arm may appear
 # at the beginning of a line or immediately after ';;'.
 m=re.search(r'(?ms)^\s*case\s+"?\$ACTION"?\s+in\s*(?P<body>.*?^\s*esac\s*$)',text)
 if not m: return None
 body=m.group('body'); out=set()
 for x in re.finditer(r'(?m)(?:^|;;)\s*([A-Za-z0-9_.:-]+(?:\|[A-Za-z0-9_.:-]+)*)\)\s*',body):
  out.update(a for a in x.group(1).split('|') if a and a!='*' and not a.startswith('$'))
 return out
for sid,s in services.items():
 h=s.get('helper','')
 if not h.startswith('/usr/libexec/mrouter-'): errors.append(f'{sid}: unsafe helper path {h}'); continue
 hf=CORE/Path(h).name; registered[sid]=h
 if not hf.exists(): errors.append(f'{sid}: helper not packaged: {h}'); continue
 helper_actions[sid]=action_dispatch(hf.read_text(errors='ignore'))

ALIASES={
 ('tailscale','up'):('tailscale','bind'),('tailscale','down'):('tailscale','disable'),
 ('adguard','start'):('adguard','enable'),('adguard','stop'):('adguard','disable'),('adguard','restart'):('adguard','enable'),
 ('openvpn','disconnect'):('openvpn','connect'),('policy','reconcile'):('policy','status'),
}
for svc,act in sorted(yaml_pairs):
 if f'{svc}:{act}' not in BRIDGE: errors.append(f'YAML action not allowed by bridge: {svc}:{act}')
 hs,ha=ALIASES.get((svc,act),(svc,act)); accepted=helper_actions.get(hs)
 if accepted is not None and accepted and ha not in accepted: errors.append(f'YAML action not accepted by helper: {svc}:{act} -> {hs}:{ha} (helper accepts {sorted(accepted)})')

read_file=ACL['mrouter-ui']['read']['file']; write_file=ACL['mrouter-ui']['write']['file']
for h in ('/usr/libexec/mrouter-ui-action','/usr/libexec/mrouter-ui-config'):
 if h not in read_file and h not in write_file: errors.append(f'ACL missing {h}')
menu_path=APP/'root/usr/share/luci/menu.d/zz-mrouter-yaml.json'
if menu_path.exists():
 menu=json.loads(menu_path.read_text())
 for route,node in menu.items():
  path=((node.get('action') or {}).get('path') or '')
  if not path.startswith('mrouter-yaml/'): errors.append(f'{route}: generated route is not native YAML: {path}')
mf=(APP/'Makefile').read_text()
if 'rm -rf $(1)/www/luci-static/resources/view/mrouter' not in mf: errors.append('APK does not exclude legacy mrouter view directory')
if errors:
 print('Mrouter native YAML UI audit FAILED:')
 for e in errors: print(' - '+e)
 sys.exit(1)
print(f'Mrouter native YAML UI audit OK: {len(pages)} pages, {len(registered)} registered services, {len(yaml_pairs)} literal actions, {len(list(SRC.glob("pages-*.yaml")))} modular overlays, 0 legacy blocks')
