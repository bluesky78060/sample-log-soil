const path=require('path');
const R='/Users/leechanhee/orca/workspaces/sample-log-soil/soil';
const {JSDOM}=require(R+'/node_modules/jsdom');
const load=(p)=>{const w=new JSDOM('<!doctype html><body></body>').window;const f=require(p);return {P:f(w),w};};
const old=load(process.argv[2]+'/package/dist/purify.cjs.js'), neu=load(R+'/node_modules/dompurify/dist/purify.cjs.js');
const src=require('fs').readFileSync(R+'/src/shared/sanitize.js','utf8');
const cfgText=src.slice(src.indexOf('const config = {')+15, src.indexOf('};', src.indexOf('const config = {'))+1);
const config=eval('('+cfgText+')');
for(const {P} of [old,neu]) P.addHook('afterSanitizeAttributes',(node)=>{ if(node.tagName==='A'&&node.getAttribute('target')==='_blank') node.setAttribute('rel','noopener noreferrer');});
const cases=['<a href="https://x" target="_blank">x</a>','<a href=x target=_blank rel=opener><b>y</b></a>','<img src=x onerror=alert(1)>','<script>alert(1)</script>t','<div style="width:5%" data-width-pct="5" hidden aria-label=q role=button>z</div>','<form><input name=attributes><input name=parentNode></form>','<svg><a href=javascript:1>s</a></svg>','<math><mi><a target=_blank href=1>m</a></mi></math>','<template><a target=_blank href=1>t</a></template>','<iframe srcdoc="<a target=_blank>"></iframe><a target=_blank>k</a>','<table><tr><td colspan=2 onclick=x>1</td></tr></table>','<select><option selected value="a&quot;b">o</option></select>','<p id=cookie name=body>c</p>','<details open><summary>s</summary><a target="_blank" href="?a=1&b=2">d</a></details>','<x-foo target=_blank>f</x-foo><a target=_blank>after</a>','<noscript><a target=_blank title="</noscript><img src=x onerror=1>"></a></noscript>'];
let diff=0;
for(const c of cases){const a=old.P.sanitize(c,config), b=neu.P.sanitize(c,config); if(a!==b){diff++;console.log('DIFF',c,'\n 15:',a,'\n 16:',b);} }
console.log('versions',old.P.version,neu.P.version,'cases',cases.length,'diffs',diff);
console.log('sample',neu.P.sanitize(cases[1],config));
