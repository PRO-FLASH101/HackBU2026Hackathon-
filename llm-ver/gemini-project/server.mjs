import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateInput,getAdvice} from './src/adviser.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export function loadEnv(filename=path.join(root,'.env')){
 if(!existsSync(filename))return;
 for(const line of readFileSync(filename,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!==undefined)continue;let value=m[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);else value=value.replace(/\s+#.*$/,'');process.env[m[1]]=value;}
}
export function createServer(config,fetchImpl=fetch){
 const counts=new Map();let inflight=false,lastStart=0;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 return http.createServer(async(req,res)=>{
  const host=req.headers.host||'';if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return send(res,403,{error:'Use localhost or 127.0.0.1.'});
  if(req.headers.origin&&req.headers.origin!=='http://'+host)return send(res,403,{error:'Cross-origin requests are not permitted.'});
  const route=(req.url||'').split('?')[0];
  if(req.method==='GET'&&route==='/api/health')return send(res,200,{configured:!!config.apiKey,model:config.model,providerMode:config.providerMode||'live',maxRequestsPerRound:config.maxRequests,timeoutMs:config.timeoutMs});
  if(req.method==='GET'&&(route==='/'||route==='/simulator.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});return res.end(readFileSync(path.join(root,'public/simulator.html')));}
  if(req.method!=='POST'||route!=='/api/advice')return send(res,404,{error:'Not found.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'Expected application/json.'});
  let bytes=0,tooLarge=false,chunks=[];
  for await(const chunk of req){bytes+=chunk.length;if(bytes>100000){tooLarge=true;chunks=[];}else if(!tooLarge)chunks.push(chunk);}
  if(tooLarge)return send(res,413,{error:'Snapshot is too large.'});
  let input;try{input=validateInput(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{return send(res,400,{error:'Invalid snapshot or action menu.'});}
  if(!config.apiKey)return send(res,503,{error:'Add GEMINI_API_KEY to gemini-project/.env, then restart the server.'});
  if(inflight)return send(res,429,{error:'An advice request is already in progress.'});
  if(Date.now()-lastStart<(config.minIntervalMs??3000))return send(res,429,{error:'Wait a few seconds before requesting advice again.'});
  const used=counts.get(input.sessionId)||0;if(used>=config.maxRequests)return send(res,429,{error:'This round reached its API request limit. Continue manually.'});
  if(counts.size>=200&&!counts.has(input.sessionId))return send(res,429,{error:'Restart the local server before starting more rounds.'});
  counts.set(input.sessionId,used+1);inflight=true;lastStart=Date.now();
  try{return send(res,200,{...await getAdvice(input,config,fetchImpl),snapshotTime:input.observation.t,requestNumber:used+1});}
  catch(error){const timeout=error.name==='TimeoutError'||error.name==='AbortError';return send(res,502,{error:timeout?'The API request timed out. No action was taken. Retry or continue manually.':error.message==='fetch failed'?'Cannot reach the API. Check your internet connection.':error.message});}
  finally{inflight=false;}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 loadEnv();const port=Number(process.env.PORT||8787);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be 1024–65535.');
 const server=createServer({apiKey:process.env.GEMINI_API_KEY||'',model:process.env.GEMINI_MODEL||'gemini-3.8-flash',timeoutMs:Math.max(1000,Math.min(60000,Number(process.env.GEMINI_TIMEOUT_MS)||20000)),maxRequests:Math.max(1,Math.min(100,Number(process.env.MAX_REQUESTS_PER_ROUND)||30))});
 server.requestTimeout=30000;server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port in use. Change PORT in .env.':e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Metro Crisis LLM: http://127.0.0.1:'+port+'\n'+(process.env.GEMINI_API_KEY?'API key configured.':'No API key yet. Edit .env and restart.')));
}
