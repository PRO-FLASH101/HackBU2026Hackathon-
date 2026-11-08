        // Experimental LLM overlay. Physical simulation and native command interlocks are unchanged.
        var LLM_HEALTH={configured:false,model:'Connecting…',providerMode:'live'},LLM_HEALTH_ERROR='';
        function llmState(){if(!R.llm)R.llm={sessionId:crypto.randomUUID(),busy:false,error:'',auto:true,requests:0,lastStart:0,retryAt:0,calls:[],controller:null};return R.llm;}
        function llmMenu(){
          var o=R.observation,a=[],cost=RA.dispatchCosts,free=type=>o.resources.some(u=>u.type===type&&u.status==='available');
          function add(kind,target,label,charge=0){if(G.money<charge)return;var id=kind+'|'+target;if(G.mute[id]>G.t)return;a.push({id,kind,target:String(target),label,estimatedCost:charge});}
          function assigned(type,id){return o.resources.some(u=>u.type===type&&(u.target===id||u.next===id)&&!['available','return'].includes(u.status));}
          o.stations.forEach(s=>{
            var pumps=o.resources.filter(u=>u.type==='pump'&&(u.target===s.id||u.next===s.id)&&!['available','return'].includes(u.status)).length;
            if(pumps<2){if(free('pump'))add('pump',s.id,'Deploy available pump to '+s.name,cost.pump);o.resources.filter(u=>u.type==='pump'&&u.status==='working'&&u.location!==s.id).forEach(u=>add('move:'+u.id,s.id,'Relocate '+u.id+' from '+u.location+' to '+s.name,cost.pump));}
            if(!s.closed){add('close',s.id,'Close and evacuate '+s.name);add('restrict-entry',s.id,(s.restricted?'Remove entry metering at ':'Meter entry at ')+s.name);}
            if(s.closed&&s.clearance==='clear'&&s.trackCm<5&&s.concourseCm<2&&s.evacuating===0&&s.lines.some(li=>o.lines[li].state==='operating'))add('reopen',s.id,'Reopen '+s.name+' subject to stable-water interlock');
            if(free('response')&&!assigned('response',s.id))add('team',s.id,'Dispatch response team to '+s.name,cost.response);
            if(free('technical')&&!assigned('technical',s.id)){
              if(s.age>90)add('check-sensor',s.id,'Check stale water sensor at '+s.name,cost.technical);
              if(['required','repair-required'].includes(s.clearance)&&s.trackCm<5&&s.concourseCm<2)add('inspect',s.id,'Dispatch flood inspection at '+s.name,cost.technical);
            }
          });
          o.lines.forEach(L=>{
            if(L.state==='operating'){
              add('suspend',L.id,'Suspend and isolate service '+L.name);
              if(o.trains.some(t=>t.line===L.id&&t.parked&&t.reserveReady<=o.t))add('deploy-train',L.id,'Dispatch compatible spare on '+L.name,cost.train);
            }
            if(L.state==='isolated'){
              var affected=o.stations.filter(s=>s.lines.includes(L.id));
              if(!L.signals.length&&affected.every(s=>s.clearance==='clear'&&s.trackCm<5)&&!o.trains.some(t=>t.line===L.id&&!t.parked&&(t.down||t.stall)))add('restore',L.id,'Restore service '+L.name+' subject to interlocks');
              if(free('technical'))L.signals.forEach(seg=>{var target=L.id+':'+seg;if(!o.resources.some(u=>u.task==='sig:'+target&&!['available','return'].includes(u.status)))add('repair-signal',target,'Repair signal '+target+' on '+L.name,cost.technical);});
              o.trains.filter(t=>t.line===L.id&&!t.parked).forEach(t=>{
                if(t.down&&(!t.stall||t.load===0&&o.stations.find(s=>s.id===t.stall)?.clearance==='clear')&&free('technical')&&!o.resources.some(u=>u.task==='train:'+t.id&&!['available','return'].includes(u.status)))add('repair-train',t.id,'Repair disabled Train '+t.id,cost.technical);
                if(t.stall&&t.load>0&&!t.evacuating&&o.resources.some(u=>u.type==='response'&&u.status==='working'&&u.location===t.nearestStation))add('evacuate-train',t.id,'Supervised evacuation of Train '+t.id);
              });
            }
          });
          o.resources.filter(u=>!['available','return','recovery'].includes(u.status)&&!(u.type==='technical'&&u.status==='work')).forEach(u=>add('recall',u.id,'Recall '+u.id+' from '+(u.target||u.location)));
          return a.sort((x,y)=>x.id.localeCompare(y.id));
        }
        function llmPayload(){rSensors(true);var l=llmState();return {sessionId:l.sessionId,observation:{...R.observation,money:G.money,dispatchCosts:RA.dispatchCosts},availableActions:llmMenu(),recentDecisions:[...G.actions.slice(-5).map(a=>({t:a.t,action:a.kind,target:a.target,success:a.success})),...G.log.slice(-3).map(a=>({t:a.t,text:a.text,decision:a.decision}))]};}
        async function llmRequest(){
          if(!G?.real||!R||G.paused||G.over||G.opening||AI_MODE!=='easy'||G.rec)return;
          var owner=R,l=llmState();if(l.busy)return;l.error='';l.busy=true;l.requests++;l.lastStart=performance.now();l.controller=new AbortController();
          var payload=llmPayload(),call={requestedAt:G.t,requestNumber:l.requests,observation:payload.observation,availableActions:payload.availableActions,status:'pending'};l.calls.push(call);tickUI();
          try{
            var response=await fetch('/api/advice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:l.controller.signal});
            var result=await response.json();if(!response.ok)throw Error(result.error||'Advice unavailable.');
            if(R!==owner||G.over){call.status='discarded-after-round';return;}
            var d=result.decision,choice=payload.availableActions.find(a=>a.id===d.action_id);
            if(!d||(!choice&&d.action_id!=='WAIT')||!['Urgent','High','Routine'].includes(d.priority)||['rationale','tradeoff','uncertainty'].some(k=>typeof d[k]!=='string'||d[k].length>1200))throw Error('The server response failed validation. No action was taken.');
            Object.assign(call,{status:'received',receivedAt:G.t,decision:d,model:result.model,responseId:result.responseId,usage:result.usage,latencyMs:result.latencyMs,providerMode:result.providerMode});
            var id='llm-advice-'+l.calls.length;
            G.rec={id,key:d.action_id,kind:choice?.kind||'wait',target:choice?.target||'',text:choice?.label||'Monitor — no intervention recommended',why:d.rationale,tradeoff:d.tradeoff,uncertainty:d.uncertainty,priority:d.priority,score:d.priority==='Urgent'?100:d.priority==='High'?80:40,shownAt:G.t,snapshotTime:payload.observation.t,model:result.model,requestId:result.responseId,providerMode:result.providerMode};
            R.adviceHistory.push({...G.rec,decision:'pending'});
          }catch(error){if(R!==owner)return;if(error.name==='AbortError'&&call.status==='pending')call.status='cancelled';if(error.name!=='AbortError'){l.error=error.message;l.auto=false;Object.assign(call,{status:'error',error:error.message,receivedAt:G.t});}}
          finally{l.busy=false;if(R===owner)tickUI();}
        }
        genRecs=function(){if(!G?.real||!R||R.deciding||AI_MODE!=='easy')return;var l=llmState();if(!G.rec&&!l.busy&&l.auto&&!l.error&&LLM_HEALTH.configured&&performance.now()-l.lastStart>=8000&&G.t>=l.retryAt)llmRequest();};
        decide=function(accept){
          if(!G?.real||!R||G.paused||G.over||AI_MODE!=='easy'||!G.rec||R.deciding)return;
          var r=G.rec,l=llmState(),index=G.actions.length,ok=null;R.deciding=true;
          try{if(accept&&r.kind!=='wait'){
              R.source='llm-adviser';rSensors(true);var eligible=llmMenu().some(a=>a.id===r.key);
              // Re-enumeration prevents stale suspend/restore toggle inversion. Physical interlocks still run.
              ok=eligible?rExecute(r.kind,r.target):rAction(r.kind,r.target,()=>rResult(false,'LLM action no longer available; no action taken.'));
            }else if(!accept)G.mute[r.key]=G.t+300;
            var review={id:r.id,t:G.t,shownAt:r.shownAt,text:r.text,key:r.key,decision:accept?'accepted':'dismissed',accepted:accept,attempted:accept&&r.kind!=='wait',executionSucceeded:accept&&r.kind!=='wait'?!!ok:null,actionIndex:accept&&r.kind!=='wait'?index:null,model:r.model,snapshotTime:r.snapshotTime,providerMode:r.providerMode};
            G.log.push(review);Object.assign(R.adviceHistory.find(a=>a.id===r.id),{decision:review.decision,decidedAt:G.t,executionSucceeded:review.executionSucceeded});l.retryAt=G.t+(r.kind==='wait'?120:15);
          }finally{R.source='manual';R.deciding=false;G.rec=null;tickUI();}
          genRecs();
        };
        function llmPanel(){
          var l=llmState(),r=G.rec,disabled=G.paused||G.over;
          return '<h3>MetroMind · Gemini LLM</h3><p class="realMuted">'+esc(LLM_HEALTH.model)+' · '+(LLM_HEALTH.providerMode==='mock'?'<b>MOCK TEST — not live AI</b>':'Live API adviser')+'<br>Human approval required · original trial results do not apply.</p>'+
          (l.error||LLM_HEALTH_ERROR?'<div class="llmError" role="alert">'+esc(l.error||LLM_HEALTH_ERROR)+'</div>':'')+
          (!LLM_HEALTH.configured?'<div class="llmError">API key missing. Add it to <b>gemini-project/.env</b> and restart the server. Manual controls remain available.</div>':'')+
          (r?'<div class="realPriority '+r.priority.toLowerCase()+'"><span>Model priority</span><strong>'+esc(r.priority)+'</strong></div><div class="realAdviceBody"><h3>'+esc(r.text)+'</h3><p>'+esc(r.why)+'</p><p><b>Tradeoff:</b> '+esc(r.tradeoff)+'</p><p><b>Uncertainty:</b> '+esc(r.uncertainty)+'</p><small>Observed at '+rMinutes(r.snapshotTime)+' · snapshot age '+rMinutes(G.t-r.snapshotTime)+'. Restrictions rechecked on acceptance.</small></div><footer class="realAdviceFooter"><p class="advicePinnedNote">Pinned until you accept or dismiss. Conditions continue to change.</p>'+rButton(r.kind==='wait'?'Acknowledge monitoring':'Accept intervention','accept','',disabled)+rButton('Dismiss','dismiss','',disabled)+rAdviceCounters()+'</footer>':
          '<div class="realAdviceBody"><p role="status">'+(l.busy?'Requesting advice… Simulation continues while the model responds.':G.paused?'Resume the simulation to request advice.':'Ready. Request a recommendation or enable automatic requests.')+'</p><p class="realMuted">No rule-based fallback. If the API is unavailable, continue manually.</p></div>'+rButton(l.busy?'Waiting for API…':'Request / retry advice','llm-request','',disabled||l.busy||!LLM_HEALTH.configured)+rAdviceCounters())+
          '<div class="llmControls">'+rButton(l.auto?'Auto requests: on':'Auto requests: off','llm-auto','',false)+'<small>'+l.requests+' requests this round · '+(LLM_HEALTH.maxRequestsPerRound||30)+' server limit</small></div>';
        }
        var llmOriginalPanel=rPanel;
        rPanel=function(id,markup){if(id==='realAdvice')return rPanelBeforeTabs(id,llmPanel());return llmOriginalPanel(id,markup);};
        document.addEventListener('click',e=>{var b=e.target.closest('[data-r-kind]');if(!b||!R)return;if(!['llm-request','llm-auto'].includes(b.dataset.rKind))return;e.stopImmediatePropagation();if(b.dataset.rKind==='llm-auto'){llmState().auto=!llmState().auto;tickUI();genRecs();}else llmRequest();},true);
        var llmOriginalStart=startMission;
        startMission=function(i,bought){if(R?.llm?.controller)R.llm.controller.abort();llmOriginalStart(i,bought);PAIR.assistanceEngine='llm-experimental-v1';PAIR.llmConfig={provider:'Gemini generateContent',model:LLM_HEALTH.model};};
        var llmOriginalFinish=finish;
        finish=function(){if(G?.real&&!G.over&&G.t+1e-7>=PAIR.horizon&&R?.llm){var l=R.llm;l.controller?.abort();l.calls.filter(c=>c.status==='pending').forEach(c=>{c.status='cancelled-at-endpoint';});}return llmOriginalFinish();};
        var llmOriginalMetrics=originalMetrics;
        originalMetrics=function(){var m=llmOriginalMetrics();if(R?.llm)m.llm={engine:'llm-experimental-v1',calls:R.llm.calls,model:LLM_HEALTH.model,autoRequests:R.llm.auto};return m;};
        exportPair=function(){var data={...PAIR,exportedAt:new Date().toISOString(),assistanceEngine:'llm-experimental-v1',definitions:{assistance:'LLM chooses from an unranked operational action menu using observed state. No rule-based ranking or fallback. Operator accepts/dismisses; native physical interlocks enforce execution.',comparison:'New experimental runs only; do not pool with the recorded rule-based experiment.',physics:'Physical model 2.0.2; educational assumptions, not validated MTA operations.',latency:'Simulation continues during API calls. Request and receipt simulation timestamps, model, token usage and decisions are recorded.'}};if(G&&!G.over)data.partialRound={condition:AI_MODE==='easy'?'assisted':'human',metrics:originalMetrics(),actions:G.actions,adviceReviews:G.log,incidents:G.inc};var url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='metro-gemini-experimental-'+PAIR.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
        fetch('/api/health').then(r=>{if(!r.ok)throw Error();return r.json();}).then(h=>{LLM_HEALTH=h;var el=$('#llmConnection');if(el)el.textContent=h.configured?'API key configured · '+h.model:'API key missing · configure .env and restart';if(G?.real)tickUI();}).catch(()=>{LLM_HEALTH_ERROR='Local backend unavailable. Open this app through npm start, not as an HTML file.';});
        setInterval(()=>{if(G?.real&&!G.paused&&!G.over)genRecs();},1000);
        if(window.realismTest)window.llmTest={menu:llmMenu,payload:llmPayload,request:llmRequest,review:decide,state:()=>({health:LLM_HEALTH,llm:llmState(),advice:G.rec}),auto(value){llmState().auto=value;}};
