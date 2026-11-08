"""Rebuild the isolated LLM variant; never modifies the measured simulator."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parent
base=(root/'src/base-simulator.html').read_text()
assert base.count('        intro();')==1
page=base.replace('        intro();',(root/'src/llm-client.js').read_text()+'\n        intro();')
page=page.replace('</style>',(root/'src/llm.css').read_text()+'\n</style>')
page=page.replace('<title>','<title>LLM Experiment · ',1)
page=page.replace('metro_original_pair_v1','metro_llm_experimental_pair_v1')
page=page.replace('METRO CRISIS / PHYSICAL-UNITS EXPERIMENT v2','METRO CRISIS / EXPERIMENTAL LLM ADVISER')
page=page.replace('Coordinate a one-hour flood response.','Coordinate a crisis with an LLM adviser.')
page=page.replace('Compare human-operated rounds with and without MetroMind.','Compare human-operated rounds with and without an LLM adviser. This separate prototype has no preloaded findings. <span id="llmConnection">Checking local API configuration…</span>')
page=page.replace('MetroMind uses rules and the same noisy/stale observations you see. No trained model or hidden future events.','The LLM receives the same noisy/stale observations and an unranked action menu. It has no hidden future events. Model advice can be wrong; execution requires operator approval.')
page=page.replace('<option value="assisted">Assistance first</option>','<option value="assisted" selected>LLM assistance first</option>')
page=page.replace('Human + MetroMind','Human + LLM adviser')
page=page.replace('Expand Services to suspend/isolate, restore and deploy spares.','Use the Trains tab to suspend/isolate, restore and deploy spares.')
(root/'public/simulator.html').write_text(page)
print('Built independent LLM app:',len(page.encode()),'bytes')
