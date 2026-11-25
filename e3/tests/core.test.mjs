import {test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import {webcrypto}from'node:crypto';
import{validateSnapshot,fact,matchApps,downloadsFor,rating,exportStack,importStack,comparison,freshApps,safeURL}from'../runtime/catalogue.mjs';
import{readPersonal,writePersonal,SnapshotStore}from'../runtime/storage.mjs';
import{validateContent}from'../runtime/content.mjs';
import{validateManifest,resourcePath,verifyEnvelope,stagePackage,ContentActivation}from'../runtime/packages.mjs';
import{E3Platform}from'../runtime/platform.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../content/'+name,import.meta.url))),snapshot=read('catalogue-snapshot.json');
const store=()=>{const m=new Map();return {m,getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
const manifest=(files)=>({format:'woods-e3-content',schemaVersion:1,version:'0.1.1',minimumRuntime:'0.1.0',revision:'a'.repeat(40),files});
test('the complete published catalogue is preserved',()=>{assert.ok(snapshot.data.registry.length>=17);assert.deepEqual(validateSnapshot(snapshot.data).registry.map(a=>a.id),snapshot.data.registry.map(a=>a.id));assert.equal(matchApps(snapshot.data.registry).length,snapshot.data.registry.length)});
test('unknown facts never satisfy anti-filters',()=>{const app={id:'a',name:'A'};assert.equal(fact(app,'noAds'),null);assert.equal(matchApps([app],{filters:['noAds']}).length,0);app.e3={facts:{noAds:{value:true,source:'publisher'}}};assert.equal(matchApps([app],{filters:['noAds']}).length,1);app.e3.facts.noAds.source='guessed';assert.equal(fact(app,'noAds'),null)});
test('metadata validates evidence sources instead of accepting invented certifications',()=>{assert.throws(()=>validateContent('metadata',{schemaVersion:1,apps:{a:{facts:{noAds:{value:true,source:'guessed'}}}}}));validateContent('metadata',{schemaVersion:1,apps:{}})});
test('pricing and RAM remain unknown without metadata',()=>{const a=snapshot.data.registry[0],r=comparison(a,[],{});assert.equal(r.ram,'Not provided');assert.equal(r.price,'Not provided');assert.equal(r.offline,null)});
test('channel selection never falls back to stable under a beta label',()=>{const a=snapshot.data.registry.find(a=>a.id==='com.woodsstudio.prism.news');assert.equal(downloadsFor(a,[],'stable')[0].platform,'android');assert.equal(downloadsFor(a,[],'beta').length,0)});
test('community ratings retain their source values',()=>assert.equal(rating({id:'com.woodsstudio.prism.news'},snapshot.data.reviews).average,3.75));
test('fresh feed does not invent dates from a catalogue sync',()=>assert.equal(freshApps(snapshot.data.registry,[]).length,0));
test('unsafe links and email headers are rejected',()=>{for(const s of ['javascript:alert(1)','http://example.com','https://user:pw@example.com'])assert.equal(safeURL(s),'');assert.equal(safeURL('mailto:hello@example.com?bcc=other@example.com',{email:true}),'');assert.equal(safeURL('mailto:hello@example.com',{email:true}),'mailto:hello@example.com')});
test('saved-app migration preserves old keys and ignores corrupt entries',()=>{const s=store();s.setItem('clover-html-v5:favorites','["a","a",1]');s.setItem('clover-html-v5:preferences','{"wallpaper":"obsidian-light","accent":"rose"}');const p=readPersonal(s);assert.deepEqual(p.saved,['a']);assert.equal(p.theme,'obsidian-light');assert.equal(p.accent,'rose');assert.equal(s.getItem('clover-html-v5:favorites'),'["a","a",1]');p.saved.push('b');writePersonal(p,s);assert.deepEqual(readPersonal(s).saved,['a','b'])});
test('a failed migration does not delete the original personal data',()=>{const s=store();s.setItem('clover-html-v5:favorites','["a"]');s.setItem=()=>{throw Error('Quota')};assert.throws(()=>readPersonal(s));assert.equal(s.getItem('clover-html-v5:favorites'),'["a"]')});
test('list import is bounded and does not trigger an installation',()=>{assert.deepEqual(importStack(exportStack(['a','a','missing'],[{id:'a'}])),['a']);assert.throws(()=>importStack({format:'e3-stack',version:1,appIds:Array(501).fill('a')}))});
test('content packages cannot load JavaScript or escape their revision root',()=>{for(const p of ['../key','/absolute','https://evil/x','a//b','a/./b'])assert.throws(()=>resourcePath(p));assert.throws(()=>validateManifest(manifest([{path:'app.js',bytes:1,kind:'layout',sha256:'a'.repeat(64)}])));assert.throws(()=>validateManifest({...manifest([]),minimumRuntime:'9.0.0'}))});
test('unknown components and injected theme expressions are rejected',()=>{assert.throws(()=>validateContent('layout',{sections:[{type:'execute'}]}));assert.throws(()=>validateContent('themes',{themes:[{mode:'dark',colors:['url(https://evil)']}]}))});
test('signed content accepts a known key and rejects modified payloads',async()=>{const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await webcrypto.subtle.exportKey('jwk',keys.publicKey),m=manifest([{path:'content/layout.json',bytes:2,kind:'layout',sha256:'a'.repeat(64)}]),payload=new TextEncoder().encode(JSON.stringify(m)),signature=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,payload),envelope={keyId:'test',payload:Buffer.from(payload).toString('base64'),signature:Buffer.from(signature).toString('base64')};assert.equal((await verifyEnvelope(envelope,{test:jwk},webcrypto)).version,'0.1.1');await assert.rejects(verifyEnvelope(envelope,{},webcrypto));await assert.rejects(verifyEnvelope({...envelope,payload:Buffer.from(JSON.stringify({...m,version:'0.1.2'})).toString('base64')},{test:jwk},webcrypto))});
test('staging verifies every byte before activation',async()=>{const bytes=new TextEncoder().encode('{"sections":[]}'),hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex'),m=manifest([{path:'layout.json',kind:'layout',bytes:bytes.length,sha256:hash}]);const staged=await stagePackage(m,async()=>bytes,validateContent,webcrypto);assert.deepEqual(staged.files['layout.json'],{sections:[]});await assert.rejects(stagePackage(m,async()=>new Uint8Array(bytes.length),validateContent,webcrypto))});
test('activation failure keeps previous content and explicit recovery restores it',async()=>{let value={active:{manifest:{version:'0.1.1'},files:{old:true}},previous:null};const s={read:async()=>structuredClone(value),write:async v=>{value=structuredClone(v)}};const controller=new ContentActivation(s,async stage=>{if(stage.files.bad)throw Error('Health check')});await assert.rejects(controller.activate({manifest:{version:'0.1.2'},files:{bad:true}}));assert.equal(value.active.manifest.version,'0.1.1');await controller.activate({manifest:{version:'0.1.2'},files:{new:true}});await assert.rejects(controller.activate({manifest:{version:'0.1.1'},files:{old:true}}));await controller.rollback();assert.equal(value.active.manifest.version,'0.1.1')});
test('Android handshake rejects messages from app preview origins',()=>{const listeners={};const p=new E3Platform({location:{origin:'https://appassets.androidplatform.net'},addEventListener:(type,callback)=>listeners[type]=callback});listeners.message({data:{type:'e3:connect'},origin:'https://publisher.example',source:{},ports:[{}]});assert.equal(p.kind,'web')});
test('unknown native actions fail without dispatch',async()=>{const p=new E3Platform({addEventListener(){}});await assert.rejects(p.request('permissions.grant',{permission:'camera'}),/Unsupported/)});
test('the new Android build has no legacy interface or UI asset imports',()=>{const host=fs.readFileSync(new URL('../android/src/com/woodsstudio/clover/apps/MainActivity.java',import.meta.url),'utf8');assert.doesNotMatch(host,/addJavascriptInterface|CloverAndroid|nativeRefresh|evaluateJavascript/);assert.match(host,/createWebMessageChannel/);assert.match(host,/USER_ACTION_REQUIRED/);assert.match(host,/setAllowFileAccess\(false\)/);assert.match(host,/setMixedContentMode\(WebSettings.MIXED_CONTENT_NEVER_ALLOW\)/)});

test('publisher declarations are complete and do not treat N/A as evidence', async () => {
 const {DECLARATIONS,validateDeclarations}=await import('../runtime/declarations.mjs');
 const {fact,evidence}=await import('../runtime/catalogue.mjs');
 const snapshot=JSON.parse(fs.readFileSync(new URL('../content/catalogue-snapshot.json',import.meta.url)));
 assert.deepEqual(Object.keys(snapshot.data.appMetadata.apps).sort(),snapshot.data.registry.map(app=>app.id).sort());
 for(const metadata of Object.values(snapshot.data.appMetadata.apps))validateDeclarations(metadata.declarations);
 const unknown=Object.fromEntries(Object.keys(DECLARATIONS).map(key=>[key,'n/a']));
 assert.equal(fact({e3:{declarations:unknown}},'noAds'),null);
 const app={e3:{declarations:{...unknown,ads:'no',account:'yes',offline:'yes'}}};
 assert.equal(fact(app,'noAds'),true);
 assert.equal(fact(app,'noAccount'),false);
 assert.equal(fact(app,'offline'),true);
 assert.equal(evidence(app,'noAds'),'Publisher declared');
 assert.throws(()=>validateDeclarations({...unknown,ads:'maybe'}));
});

test('E3.UI64 uses the Windows bridge only on the packaged storefront origin', async () => {
 let receiver;
 const webview = {
  addEventListener(name, handler) { assert.equal(name, 'message'); receiver = handler; },
  postMessage(message) {
   assert.equal(message.protocol, 1);
   const result = message.action === 'capabilities' ? {capabilities: ['sandbox.test']} : {opened: true};
   queueMicrotask(() => receiver({data: {id: message.id, ok: true, result}}));
  }
 };
 const host = new E3Platform({
  chrome: {webview},
  location: {origin: 'https://store.e3-ui64.invalid'},
  dispatchEvent() {}
 });
 assert.equal(host.kind, 'windows');
 assert.deepEqual(await host.request('sandbox.test', {id: 'download'}), {opened: true});
 const web = new E3Platform({chrome: {webview},location: {origin: 'https://example.com'}});
 assert.equal(web.kind,'web');
 await assert.rejects(web.request('sandbox.test'), /Android host/);
});

test('Android reconnect replaces the stale channel and rejects interrupted requests', async()=>{
 const listeners={};
 const scope={location:{origin:'https://appassets.androidplatform.net'},addEventListener:(t,f)=>listeners[t]=f,dispatchEvent(){}};
 const p=new E3Platform(scope);
 const makePort=()=>({closed:false,close(){this.closed=true},postMessage(raw){const m=JSON.parse(raw);if(m.action==='capabilities'||m.action==='downloads.list')queueMicrotask(()=>this.onmessage({data:JSON.stringify({id:m.id,ok:true,result:m.action==='capabilities'?{capabilities:['downloads.request']}:[]})}))}});
 const connect=port=>listeners.message({data:{type:'e3:connect'},origin:'https://appassets.androidplatform.net',source:null,ports:[port]});
 const first=makePort();connect(first);await p.request('downloads.list');
 const interrupted=p.request('downloads.enqueue',{url:'https://example.com/file.apk'});
 const second=makePort();connect(second);await assert.rejects(interrupted,/connection changed/);
 assert(first.closed);assert.deepEqual(await p.request('downloads.list'),[]);
 assert.equal(p.pending.size,0);
});

test('browser platform preference uses actual published downloads',async()=>{
 const {browserPlatform,preferredDownload,platformName,comparison}=await import('../runtime/catalogue.mjs');
 assert.equal(browserPlatform({userAgent:'Mozilla Windows NT 10.0'}),'windows');
 assert.equal(browserPlatform({userAgent:'Mozilla Linux Android 15'}),'android');
 assert.equal(browserPlatform({userAgent:'Mozilla Macintosh',maxTouchPoints:5}),'ios');
 assert.equal(browserPlatform({userAgentData:{platform:'Linux'}}),'linux');
 const app={id:'test',name:'Example',downloads:{windows:{url:'https://example.com/app.exe',sizeBytes:2048},android:{url:'https://example.com/app.apk',sizeBytes:1024},linux:'https://example.com/app.deb'}};
 assert.equal(preferredDownload(downloadsFor(app),'windows').platform,'windows');
 assert.equal(preferredDownload(downloadsFor(app),'android').platform,'android');
 assert.equal(preferredDownload(downloadsFor(app),'ios').platform,'windows');
 assert.equal(preferredDownload([],'windows'),null);
 assert.equal(platformName('linux'),'Linux');
 assert.equal(comparison(app,[],{},'windows').size,'Windows · 2 KB');
});
