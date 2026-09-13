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
ACL=json.loads((APP/'root/usr/share/rpcd/acl.d/mrouter.json').read_text())
errors=[]

# Every YAML compatibility component must exist, preserving the currently tested page implementation.
for pid,p in PAGES['pages'].items():
 for block in p.get('layout',[]):
  if block.get('type')=='legacy':
   f=APP/'htdocs/luci-static/resources/view/mrouter'/(block['component']+'.js')
   if not f.exists(): errors.append(f'{pid}: missing legacy component {block["component"]}')

# Every registered service must map to a packaged helper and never to arbitrary shell.
registered=set()
for sid,s in ACTIONS['services'].items():
 h=s.get('helper','')
 if not h.startswith('/usr/libexec/mrouter-'): errors.append(f'{sid}: unsafe helper path {h}')
 else:
  registered.add(h)
  if not (CORE/Path(h).name).exists(): errors.append(f'{sid}: helper not packaged: {h}')

# Every helper referenced by frontend JS must exist and be represented by ACL or registry.
js_helpers=set()
for f in (APP/'htdocs/luci-static/resources/view/mrouter').glob('*.js'):
 txt=f.read_text(errors='ignore')
 js_helpers.update(re.findall(r"/usr/libexec/mrouter-[A-Za-z0-9._-]+",txt))
read_file=ACL['mrouter-ui']['read']['file']; write_file=ACL['mrouter-ui']['write']['file']
acl_helpers=set(read_file)|set(write_file)
for h in sorted(js_helpers):
 if not (CORE/Path(h).name).exists(): errors.append(f'frontend references missing helper: {h}')
 if h not in acl_helpers: errors.append(f'frontend helper missing ACL: {h}')
 if h not in registered and not Path(h).name.startswith('mrouter-status-') and Path(h).name not in ('mrouter-client-data','mrouter-iot-info'):
  errors.append(f'frontend helper missing YAML action registry: {h}')

# Heuristic action audit for views that use exactly one helper: literal action names must be accepted by the helper case table.
def helper_case_actions(text):
 out=set()
 for m in re.finditer(r'^\s*([A-Za-z0-9_.:-]+(?:\|[A-Za-z0-9_.:-]+)*)\)\s*',text,re.M):
  for a in m.group(1).split('|'):
   if a not in ('*','') and not a.startswith('$'): out.add(a)
 return out
for f in (APP/'htdocs/luci-static/resources/view/mrouter').glob('*.js'):
 txt=f.read_text(errors='ignore')
 hs=set(re.findall(r"/usr/libexec/mrouter-[A-Za-z0-9._-]+",txt))
 if len(hs)!=1: continue
 h=next(iter(hs)); hf=CORE/Path(h).name
 if not hf.exists(): continue
 accepted=helper_case_actions(hf.read_text(errors='ignore'))
 literals=set(re.findall(r"(?:run|execHelper|call)\s*\(\s*\[\s*['\"]([A-Za-z0-9_.:-]+)['\"]",txt))
 if accepted and literals:
  for a in sorted(literals):
   if a not in accepted and a!='status': errors.append(f'{f.name}: action {a!r} not found in {Path(h).name}')

if errors:
 print('Mrouter UI audit FAILED:')
 for e in errors: print(' - '+e)
 sys.exit(1)
print(f'Mrouter UI audit OK: {len(PAGES["pages"])} YAML pages, {len(registered)} registered services, {len(js_helpers)} frontend helpers checked')
