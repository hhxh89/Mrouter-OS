#!/usr/bin/env python3
import json,re,sys
from pathlib import Path
try:
 import yaml
except Exception:
 sys.stderr.write('PyYAML is required. Install with: sudo apt install python3-yaml\n'); raise
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'package/mrouter/luci-app-mrouter'
CORE=ROOT/'package/mrouter/mrouter-core/files/usr/libexec'
PAGES=yaml.safe_load((APP/'ui-src/pages.yaml').read_text())
ACTIONS=yaml.safe_load((APP/'ui-src/actions.yaml').read_text())
SCHEMA=yaml.safe_load((APP/'ui-src/schema.yaml').read_text())
ACL=json.loads((APP/'root/usr/share/rpcd/acl.d/mrouter.json').read_text())
BRIDGE=(CORE/'mrouter-ui-action').read_text(errors='ignore')
errors=[]

pages=PAGES.get('pages',{})
services=ACTIONS.get('services',{})
allowed_blocks=set(SCHEMA.get('schema',{}).get('block_types',[]))

# Native-only frontend: legacy is a hard build failure.
raw_pages=(APP/'ui-src/pages.yaml').read_text()
raw_runtime=(APP/'htdocs/luci-static/mrouter-ui/schema-runtime.js').read_text()
if re.search(r'\btype:\s*legacy\b',raw_pages): errors.append('pages.yaml still contains a legacy block')
if 'loadLegacy' in raw_runtime or "view.mrouter." in raw_runtime: errors.append('schema runtime still contains legacy view loading')
if 'legacy' in allowed_blocks: errors.append('schema still permits legacy blocks')

# Every page must be YAML-rendered and only use registered native blocks/services.
yaml_pairs=set()
def walk(obj,pid):
 if isinstance(obj,dict):
  if obj.get('type') and obj.get('type') not in allowed_blocks: errors.append(f'{pid}: unsupported block type {obj.get("type")}')
  svc=obj.get('service')
  if svc and svc not in services: errors.append(f'{pid}: unregistered service {svc}')
  if svc and isinstance(obj.get('action'),str) and not obj['action'].startswith('$field.'):
   yaml_pairs.add((svc,obj['action']))
  for v in obj.values(): walk(v,pid)
 elif isinstance(obj,list):
  for v in obj: walk(v,pid)
for pid,p in pages.items():
 if p.get('renderer')!='yaml': errors.append(f'{pid}: renderer is not yaml')
 if not p.get('layout'): errors.append(f'{pid}: empty layout')
 walk(p,pid)

# Every service maps to a packaged Mrouter helper.
registered=set()
for sid,s in services.items():
 h=s.get('helper','')
 if not h.startswith('/usr/libexec/mrouter-'): errors.append(f'{sid}: unsafe helper path {h}')
 else:
  registered.add(h)
  if not (CORE/Path(h).name).exists(): errors.append(f'{sid}: helper not packaged: {h}')

# YAML literal action pairs must appear in the bridge allowlist.
for svc,act in sorted(yaml_pairs):
 if f'{svc}:{act}' not in BRIDGE: errors.append(f'YAML action not allowed by bridge: {svc}:{act}')

# ACL must allow the single bridge and UI config helper.
read_file=ACL['mrouter-ui']['read']['file']; write_file=ACL['mrouter-ui']['write']['file']
for h in ('/usr/libexec/mrouter-ui-action','/usr/libexec/mrouter-ui-config'):
 if h not in read_file and h not in write_file: errors.append(f'ACL missing {h}')

# Generated menu routes must all point to mrouter-yaml, never old mrouter views.
menu_path=APP/'root/usr/share/luci/menu.d/zz-mrouter-yaml.json'
if menu_path.exists():
 menu=json.loads(menu_path.read_text())
 for route,node in menu.items():
  path=((node.get('action') or {}).get('path') or '')
  if not path.startswith('mrouter-yaml/'): errors.append(f'{route}: generated route is not native YAML: {path}')

# APK Makefile must explicitly strip the old handwritten view tree.
mf=(APP/'Makefile').read_text()
if 'rm -rf $(1)/www/luci-static/resources/view/mrouter' not in mf: errors.append('APK does not exclude legacy mrouter view directory')

if errors:
 print('Mrouter native YAML UI audit FAILED:')
 for e in errors: print(' - '+e)
 sys.exit(1)
print(f'Mrouter native YAML UI audit OK: {len(pages)} pages, {len(registered)} registered services, {len(yaml_pairs)} literal actions, 0 legacy blocks')
