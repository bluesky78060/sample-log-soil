window.NETWORK_CONFIG={ALLOWED_GATEWAY:"",VWORLD_API_KEY:""};const Hp={STORAGE_KEY:"networkAccessConfig",getAllowedGateway(){var r;return((r=window.NETWORK_CONFIG)==null?void 0:r.ALLOWED_GATEWAY)||null},defaultConfig:{adminIPs:[],timeout:5e3},_currentIP:null,_lastCheck:null,_cacheTimeout:6e4,loadConfig(){try{const r=localStorage.getItem(this.STORAGE_KEY);if(r)return{...this.defaultConfig,...JSON.parse(r)}}catch(r){logger.error("[NetworkAccess] 설정 로드 실패:",r)}return{...this.defaultConfig}},saveConfig(r){try{localStorage.setItem(this.STORAGE_KEY,JSON.stringify(r)),logger.info("[NetworkAccess] 설정 저장됨:",r)}catch(e){logger.error("[NetworkAccess] 설정 저장 실패:",e)}},async getCurrentIP(r){if(this._currentIP&&this._lastCheck&&Date.now()-this._lastCheck<this._cacheTimeout)return this._currentIP;const e=r||this.loadConfig().timeout;try{const t=new AbortController,n=setTimeout(()=>t.abort(),e),i=await fetch("https://api.ipify.org?format=json",{signal:t.signal});clearTimeout(n);const s=await i.json();return this._currentIP=s.ip,this._lastCheck=Date.now(),logger.info("[NetworkAccess] 현재 IP:",this._currentIP),this._currentIP}catch(t){return logger.warn("[NetworkAccess] IP 조회 실패:",t.message),null}},getSubnetPrefix(r){if(!r)return"";const e=r.split(".");return e.length!==4?"":e.slice(0,3).join(".")+"."},async checkAccess(){var i;if(((i=window.electronAPI)==null?void 0:i.isElectron)===!0)return{allowed:!0,reason:"Electron 환경 (항상 허용)",ip:null};if(window.location.protocol==="file:")return{allowed:!0,reason:"Electron 로컬 실행",ip:null};const r=this.getAllowedGateway();if(!r)return logger.warn("[NetworkAccess] 네트워크 설정 없음 - 접근 거부"),{allowed:!1,reason:"네트워크 설정 파일 없음 (network-config.js)",ip:null};const e=this.getSubnetPrefix(r),t=await this.getCurrentIP();if(!t)return logger.warn("[NetworkAccess] IP 확인 불가 - 접근 거부"),{allowed:!1,reason:"IP 확인 불가",ip:null};if(t.startsWith(e))return logger.info("[NetworkAccess] 허용된 네트워크:",t),{allowed:!0,reason:`허용된 네트워크 (${r})`,ip:t};const n=this.loadConfig();return n.adminIPs&&n.adminIPs.includes(t)?{allowed:!0,reason:"관리자 IP",ip:t}:(logger.warn("[NetworkAccess] 허용되지 않은 네트워크:",t),{allowed:!1,reason:`허용되지 않은 네트워크 (허용: ${e}x)`,ip:t})},async isAllowed(){return(await this.checkAccess()).allowed},addAdminIP(r){const e=this.loadConfig();e.adminIPs.includes(r)||(e.adminIPs.push(r),this.saveConfig(e))},removeAdminIP(r){const e=this.loadConfig();e.adminIPs=e.adminIPs.filter(t=>t!==r),this.saveConfig(e)},async registerCurrentAsAdmin(){const r=await this.getCurrentIP();return r?(this.addAdminIP(r),r):null},resetConfig(){localStorage.removeItem(this.STORAGE_KEY),this._currentIP=null,this._lastCheck=null,logger.info("[NetworkAccess] 설정 초기화됨")},async printStatus(){var s;const r=this.loadConfig(),e=await this.getCurrentIP(),t=await this.checkAccess(),n=((s=window.electronAPI)==null?void 0:s.isElectron)===!0||window.location.protocol==="file:",i=this.getAllowedGateway();return console.log("========================================"),logger.info("[NetworkAccess] 현재 상태"),console.log("========================================"),console.log("환경:",n?"Electron (네트워크 체크 안함)":"웹 (네트워크 체크 활성화)"),console.log("허용된 게이트웨이:",i||"설정 없음"),console.log("허용된 서브넷:",i?this.getSubnetPrefix(i)+"x":"없음"),console.log("현재 공인 IP:",e||"확인 불가"),console.log("접근 허용:",t.allowed,`(${t.reason})`),console.log("관리자 IP (예외):",r.adminIPs||[]),console.log("========================================"),{config:r,currentIP:e,access:t,isElectron:n,allowedGateway:i}}};window.NetworkAccess=Hp;var Kp;if(((Kp=window.electronAPI)==null?void 0:Kp.isElectron)===!0||window.location.protocol==="file:")logger.info("[NetworkAccess] Electron 환경 - 네트워크 체크 비활성화 (항상 허용)");else{const r=Hp.getAllowedGateway();logger.info("[NetworkAccess] 웹 환경 - 네트워크 체크 활성화"),r?logger.info(`[NetworkAccess] 허용된 게이트웨이: ${r}`):logger.warn("[NetworkAccess] 네트워크 설정 파일(network-config.js) 없음 - 모든 접근 거부됨"),console.log("  NetworkAccess.printStatus() - 현재 상태 확인"),console.log("  NetworkAccess.registerCurrentAsAdmin() - 현재 IP를 관리자로 등록 (예외 허용)")}const GI=()=>{};var Ld={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qp=function(r){const e=[];let t=0;for(let n=0;n<r.length;n++){let i=r.charCodeAt(n);i<128?e[t++]=i:i<2048?(e[t++]=i>>6|192,e[t++]=i&63|128):(i&64512)===55296&&n+1<r.length&&(r.charCodeAt(n+1)&64512)===56320?(i=65536+((i&1023)<<10)+(r.charCodeAt(++n)&1023),e[t++]=i>>18|240,e[t++]=i>>12&63|128,e[t++]=i>>6&63|128,e[t++]=i&63|128):(e[t++]=i>>12|224,e[t++]=i>>6&63|128,e[t++]=i&63|128)}return e},WI=function(r){const e=[];let t=0,n=0;for(;t<r.length;){const i=r[t++];if(i<128)e[n++]=String.fromCharCode(i);else if(i>191&&i<224){const s=r[t++];e[n++]=String.fromCharCode((i&31)<<6|s&63)}else if(i>239&&i<365){const s=r[t++],o=r[t++],c=r[t++],u=((i&7)<<18|(s&63)<<12|(o&63)<<6|c&63)-65536;e[n++]=String.fromCharCode(55296+(u>>10)),e[n++]=String.fromCharCode(56320+(u&1023))}else{const s=r[t++],o=r[t++];e[n++]=String.fromCharCode((i&15)<<12|(s&63)<<6|o&63)}}return e.join("")},Jp={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(r,e){if(!Array.isArray(r))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,n=[];for(let i=0;i<r.length;i+=3){const s=r[i],o=i+1<r.length,c=o?r[i+1]:0,u=i+2<r.length,l=u?r[i+2]:0,f=s>>2,p=(s&3)<<4|c>>4;let g=(c&15)<<2|l>>6,v=l&63;u||(v=64,o||(g=64)),n.push(t[f],t[p],t[g],t[v])}return n.join("")},encodeString(r,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(r):this.encodeByteArray(Qp(r),e)},decodeString(r,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(r):WI(this.decodeStringToByteArray(r,e))},decodeStringToByteArray(r,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,n=[];for(let i=0;i<r.length;){const s=t[r.charAt(i++)],c=i<r.length?t[r.charAt(i)]:0;++i;const l=i<r.length?t[r.charAt(i)]:64;++i;const p=i<r.length?t[r.charAt(i)]:64;if(++i,s==null||c==null||l==null||p==null)throw new KI;const g=s<<2|c>>4;if(n.push(g),l!==64){const v=c<<4&240|l>>2;if(n.push(v),p!==64){const k=l<<6&192|p;n.push(k)}}}return n},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let r=0;r<this.ENCODED_VALS.length;r++)this.byteToCharMap_[r]=this.ENCODED_VALS.charAt(r),this.charToByteMap_[this.byteToCharMap_[r]]=r,this.byteToCharMapWebSafe_[r]=this.ENCODED_VALS_WEBSAFE.charAt(r),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[r]]=r,r>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(r)]=r,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(r)]=r)}}};class KI extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const HI=function(r){const e=Qp(r);return Jp.encodeByteArray(e,!0)},oa=function(r){return HI(r).replace(/\./g,"")},Hu=function(r){try{return Jp.decodeString(r,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};function aa(r,e){if(!(e instanceof Object))return e;switch(e.constructor){case Date:const t=e;return new Date(t.getTime());case Object:r===void 0&&(r={});break;case Array:r=[];break;default:return e}for(const t in e)!e.hasOwnProperty(t)||!QI(t)||(r[t]=aa(r[t],e[t]));return r}function QI(r){return r!=="__proto__"}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qu(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const JI=()=>Qu().__FIREBASE_DEFAULTS__,YI=()=>{if(typeof process>"u"||typeof Ld>"u")return;const r=Ld.__FIREBASE_DEFAULTS__;if(r)return JSON.parse(r)},XI=()=>{if(typeof document>"u")return;let r;try{r=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=r&&Hu(r[1]);return e&&JSON.parse(e)},Ju=()=>{try{return GI()||JI()||YI()||XI()}catch(r){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${r}`);return}},Yu=()=>{var r;return(r=Ju())==null?void 0:r.config},ZI=r=>{var e;return(e=Ju())==null?void 0:e[`_${r}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ew{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,n)=>{t?this.reject(t):this.resolve(n),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,n))}}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wi(r){try{return(r.startsWith("http://")||r.startsWith("https://")?new URL(r).hostname:r).endsWith(".cloudworkstations.dev")}catch{return!1}}async function Yp(r){return(await fetch(r,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function tw(r,e){if(r.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},n=e||"demo-project",i=r.iat||0,s=r.sub||r.user_id;if(!s)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const o={iss:`https://securetoken.google.com/${n}`,aud:n,iat:i,exp:i+3600,auth_time:i,sub:s,user_id:s,firebase:{sign_in_provider:"custom",identities:{}},...r};return[oa(JSON.stringify(t)),oa(JSON.stringify(o)),""].join(".")}const ds={};function nw(){const r={prod:[],emulator:[]};for(const e of Object.keys(ds))ds[e]?r.emulator.push(e):r.prod.push(e);return r}function rw(r){let e=document.getElementById(r),t=!1;return e||(e=document.createElement("div"),e.setAttribute("id",r),t=!0),{created:t,element:e}}let Fd=!1;function Xp(r,e){if(typeof window>"u"||typeof document>"u"||!wi(window.location.host)||ds[r]===e||ds[r]||Fd)return;ds[r]=e;function t(g){return`__firebase__banner__${g}`}const n="__firebase__banner",s=nw().prod.length>0;function o(){const g=document.getElementById(n);g&&g.remove()}function c(g){g.style.display="flex",g.style.background="#7faaf0",g.style.position="fixed",g.style.bottom="5px",g.style.left="5px",g.style.padding=".5em",g.style.borderRadius="5px",g.style.alignItems="center"}function u(g,v){g.setAttribute("width","24"),g.setAttribute("id",v),g.setAttribute("height","24"),g.setAttribute("viewBox","0 0 24 24"),g.setAttribute("fill","none"),g.style.marginLeft="-6px"}function l(){const g=document.createElement("span");return g.style.cursor="pointer",g.style.marginLeft="16px",g.style.fontSize="24px",g.innerHTML=" &times;",g.onclick=()=>{Fd=!0,o()},g}function f(g,v){g.setAttribute("id",v),g.innerText="Learn more",g.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",g.setAttribute("target","__blank"),g.style.paddingLeft="5px",g.style.textDecoration="underline"}function p(){const g=rw(n),v=t("text"),k=document.getElementById(v)||document.createElement("span"),D=t("learnmore"),N=document.getElementById(D)||document.createElement("a"),q=t("preprendIcon"),j=document.getElementById(q)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(g.created){const $=g.element;c($),f(N,D);const ee=l();u(j,q),$.append(j,k,N,ee),document.body.appendChild($)}s?(k.innerText="Preview backend disconnected.",j.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):(j.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,k.innerText="Preview backend running in this workspace."),k.setAttribute("id",v)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",p):p()}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function me(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function iw(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(me())}function Na(){var e;const r=(e=Ju())==null?void 0:e.forceEnvironment;if(r==="node")return!0;if(r==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function sw(){return typeof window<"u"||Zp()}function Zp(){return typeof WorkerGlobalScope<"u"&&typeof self<"u"&&self instanceof WorkerGlobalScope}function ow(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function em(){const r=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof r=="object"&&r.id!==void 0}function Xu(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function tm(){const r=me();return r.indexOf("MSIE ")>=0||r.indexOf("Trident/")>=0}function nm(){return!Na()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function rm(){return!Na()&&!!navigator.userAgent&&(navigator.userAgent.includes("Safari")||navigator.userAgent.includes("WebKit"))&&!navigator.userAgent.includes("Chrome")}function Ss(){try{return typeof indexedDB=="object"}catch{return!1}}function aw(){return new Promise((r,e)=>{try{let t=!0;const n="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(n);i.onsuccess=()=>{i.result.close(),t||self.indexedDB.deleteDatabase(n),r(!0)},i.onupgradeneeded=()=>{t=!1},i.onerror=()=>{var s;e(((s=i.error)==null?void 0:s.message)||"")}}catch(t){e(t)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cw="FirebaseError";class Qe extends Error{constructor(e,t,n){super(t),this.code=e,this.customData=n,this.name=cw,Object.setPrototypeOf(this,Qe.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Tr.prototype.create)}}class Tr{constructor(e,t,n){this.service=e,this.serviceName=t,this.errors=n}create(e,...t){const n=t[0]||{},i=`${this.service}/${e}`,s=this.errors[e],o=s?uw(s,n):"Error",c=`${this.serviceName}: ${o} (${i}).`;return new Qe(i,c,n)}}function uw(r,e){return r.replace(lw,(t,n)=>{const i=e[n];return i!=null?String(i):`<${n}?>`})}const lw=/\{\$([^}]+)}/g;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ud(r,e){return Object.prototype.hasOwnProperty.call(r,e)}function hw(r){for(const e in r)if(Object.prototype.hasOwnProperty.call(r,e))return!1;return!0}function Tn(r,e){if(r===e)return!0;const t=Object.keys(r),n=Object.keys(e);for(const i of t){if(!n.includes(i))return!1;const s=r[i],o=e[i];if(Bd(s)&&Bd(o)){if(!Tn(s,o))return!1}else if(s!==o)return!1}for(const i of n)if(!t.includes(i))return!1;return!0}function Bd(r){return r!==null&&typeof r=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ei(r){const e=[];for(const[t,n]of Object.entries(r))Array.isArray(n)?n.forEach(i=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(i))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(n));return e.length?"&"+e.join("&"):""}function jr(r){const e={};return r.replace(/^\?/,"").split("&").forEach(n=>{if(n){const[i,s]=n.split("=");e[decodeURIComponent(i)]=decodeURIComponent(s)}}),e}function is(r){const e=r.indexOf("?");if(!e)return"";const t=r.indexOf("#",e);return r.substring(e,t>0?t:void 0)}function im(r,e){const t=new dw(r,e);return t.subscribe.bind(t)}class dw{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(n=>{this.error(n)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,n){let i;if(e===void 0&&t===void 0&&n===void 0)throw new Error("Missing Observer.");fw(e,["next","error","complete"])?i=e:i={next:e,error:t,complete:n},i.next===void 0&&(i.next=qc),i.error===void 0&&(i.error=qc),i.complete===void 0&&(i.complete=qc);const s=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?i.error(this.finalError):i.complete()}catch{}}),this.observers.push(i),s}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(n){typeof console<"u"&&console.error&&console.error(n)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function fw(r,e){if(typeof r!="object"||r===null)return!1;for(const t of e)if(t in r&&typeof r[t]=="function")return!0;return!1}function qc(){}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function z(r){return r&&r._delegate?r._delegate:r}class Lt{constructor(e,t,n){this.name=e,this.instanceFactory=t,this.type=n,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hn="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pw{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const n=new ew;if(this.instancesDeferred.set(t,n),this.isInitialized(t)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:t});i&&n.resolve(i)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){const t=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),n=(e==null?void 0:e.optional)??!1;if(this.isInitialized(t)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:t})}catch(i){if(n)return null;throw i}else{if(n)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(gw(e))try{this.getOrInitializeService({instanceIdentifier:Hn})}catch{}for(const[t,n]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(t);try{const s=this.getOrInitializeService({instanceIdentifier:i});n.resolve(s)}catch{}}}}clearInstance(e=Hn){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=Hn){return this.instances.has(e)}getOptions(e=Hn){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,n=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(n))throw Error(`${this.name}(${n}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:n,options:t});for(const[s,o]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(s);n===c&&o.resolve(i)}return i}onInit(e,t){const n=this.normalizeInstanceIdentifier(t),i=this.onInitCallbacks.get(n)??new Set;i.add(e),this.onInitCallbacks.set(n,i);const s=this.instances.get(n);return s&&e(s,n),()=>{i.delete(e)}}invokeOnInitCallbacks(e,t){const n=this.onInitCallbacks.get(t);if(n)for(const i of n)try{i(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let n=this.instances.get(e);if(!n&&this.component&&(n=this.component.instanceFactory(this.container,{instanceIdentifier:mw(e),options:t}),this.instances.set(e,n),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(n,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,n)}catch{}return n||null}normalizeInstanceIdentifier(e=Hn){return this.component?this.component.multipleInstances?e:Hn:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function mw(r){return r===Hn?void 0:r}function gw(r){return r.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sm{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new pw(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zu=[];var H;(function(r){r[r.DEBUG=0]="DEBUG",r[r.VERBOSE=1]="VERBOSE",r[r.INFO=2]="INFO",r[r.WARN=3]="WARN",r[r.ERROR=4]="ERROR",r[r.SILENT=5]="SILENT"})(H||(H={}));const om={debug:H.DEBUG,verbose:H.VERBOSE,info:H.INFO,warn:H.WARN,error:H.ERROR,silent:H.SILENT},_w=H.INFO,yw={[H.DEBUG]:"log",[H.VERBOSE]:"log",[H.INFO]:"info",[H.WARN]:"warn",[H.ERROR]:"error"},Iw=(r,e,...t)=>{if(e<r.logLevel)return;const n=new Date().toISOString(),i=yw[e];if(i)console[i](`[${n}]  ${r.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class Va{constructor(e){this.name=e,this._logLevel=_w,this._logHandler=Iw,this._userLogHandler=null,Zu.push(this)}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in H))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?om[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,H.DEBUG,...e),this._logHandler(this,H.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,H.VERBOSE,...e),this._logHandler(this,H.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,H.INFO,...e),this._logHandler(this,H.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,H.WARN,...e),this._logHandler(this,H.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,H.ERROR,...e),this._logHandler(this,H.ERROR,...e)}}function ww(r){Zu.forEach(e=>{e.setLogLevel(r)})}function Ew(r,e){for(const t of Zu){let n=null;e&&e.level&&(n=om[e.level]),r===null?t.userLogHandler=null:t.userLogHandler=(i,s,...o)=>{const c=o.map(u=>{if(u==null)return null;if(typeof u=="string")return u;if(typeof u=="number"||typeof u=="boolean")return u.toString();if(u instanceof Error)return u.message;try{return JSON.stringify(u)}catch{return null}}).filter(u=>u).join(" ");s>=(n??i.logLevel)&&r({level:H[s].toLowerCase(),message:c,args:o,type:i.name})}}}const Tw=(r,e)=>e.some(t=>r instanceof t);let qd,$d;function vw(){return qd||(qd=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Aw(){return $d||($d=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const am=new WeakMap,au=new WeakMap,cm=new WeakMap,$c=new WeakMap,el=new WeakMap;function bw(r){const e=new Promise((t,n)=>{const i=()=>{r.removeEventListener("success",s),r.removeEventListener("error",o)},s=()=>{t(_n(r.result)),i()},o=()=>{n(r.error),i()};r.addEventListener("success",s),r.addEventListener("error",o)});return e.then(t=>{t instanceof IDBCursor&&am.set(t,r)}).catch(()=>{}),el.set(e,r),e}function Rw(r){if(au.has(r))return;const e=new Promise((t,n)=>{const i=()=>{r.removeEventListener("complete",s),r.removeEventListener("error",o),r.removeEventListener("abort",o)},s=()=>{t(),i()},o=()=>{n(r.error||new DOMException("AbortError","AbortError")),i()};r.addEventListener("complete",s),r.addEventListener("error",o),r.addEventListener("abort",o)});au.set(r,e)}let cu={get(r,e,t){if(r instanceof IDBTransaction){if(e==="done")return au.get(r);if(e==="objectStoreNames")return r.objectStoreNames||cm.get(r);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return _n(r[e])},set(r,e,t){return r[e]=t,!0},has(r,e){return r instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in r}};function Sw(r){cu=r(cu)}function Pw(r){return r===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const n=r.call(zc(this),e,...t);return cm.set(n,e.sort?e.sort():[e]),_n(n)}:Aw().includes(r)?function(...e){return r.apply(zc(this),e),_n(am.get(this))}:function(...e){return _n(r.apply(zc(this),e))}}function Cw(r){return typeof r=="function"?Pw(r):(r instanceof IDBTransaction&&Rw(r),Tw(r,vw())?new Proxy(r,cu):r)}function _n(r){if(r instanceof IDBRequest)return bw(r);if($c.has(r))return $c.get(r);const e=Cw(r);return e!==r&&($c.set(r,e),el.set(e,r)),e}const zc=r=>el.get(r);function kw(r,e,{blocked:t,upgrade:n,blocking:i,terminated:s}={}){const o=indexedDB.open(r,e),c=_n(o);return n&&o.addEventListener("upgradeneeded",u=>{n(_n(o.result),u.oldVersion,u.newVersion,_n(o.transaction),u)}),t&&o.addEventListener("blocked",u=>t(u.oldVersion,u.newVersion,u)),c.then(u=>{s&&u.addEventListener("close",()=>s()),i&&u.addEventListener("versionchange",l=>i(l.oldVersion,l.newVersion,l))}).catch(()=>{}),c}const Dw=["get","getKey","getAll","getAllKeys","count"],Nw=["put","add","delete","clear"],jc=new Map;function zd(r,e){if(!(r instanceof IDBDatabase&&!(e in r)&&typeof e=="string"))return;if(jc.get(e))return jc.get(e);const t=e.replace(/FromIndex$/,""),n=e!==t,i=Nw.includes(t);if(!(t in(n?IDBIndex:IDBObjectStore).prototype)||!(i||Dw.includes(t)))return;const s=async function(o,...c){const u=this.transaction(o,i?"readwrite":"readonly");let l=u.store;return n&&(l=l.index(c.shift())),(await Promise.all([l[t](...c),i&&u.done]))[0]};return jc.set(e,s),s}Sw(r=>({...r,get:(e,t,n)=>zd(e,t)||r.get(e,t,n),has:(e,t)=>!!zd(e,t)||r.has(e,t)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vw{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(Ow(t)){const n=t.getImmediate();return`${n.library}/${n.version}`}else return null}).filter(t=>t).join(" ")}}function Ow(r){const e=r.getComponent();return(e==null?void 0:e.type)==="VERSION"}const ca="@firebase/app",uu="0.14.6";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const jt=new Va("@firebase/app"),xw="@firebase/app-compat",Mw="@firebase/analytics-compat",Lw="@firebase/analytics",Fw="@firebase/app-check-compat",Uw="@firebase/app-check",Bw="@firebase/auth",qw="@firebase/auth-compat",$w="@firebase/database",zw="@firebase/data-connect",jw="@firebase/database-compat",Gw="@firebase/functions",Ww="@firebase/functions-compat",Kw="@firebase/installations",Hw="@firebase/installations-compat",Qw="@firebase/messaging",Jw="@firebase/messaging-compat",Yw="@firebase/performance",Xw="@firebase/performance-compat",Zw="@firebase/remote-config",eE="@firebase/remote-config-compat",tE="@firebase/storage",nE="@firebase/storage-compat",rE="@firebase/firestore",iE="@firebase/ai",sE="@firebase/firestore-compat",oE="firebase",aE="12.6.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const vn="[DEFAULT]",cE={[ca]:"fire-core",[xw]:"fire-core-compat",[Lw]:"fire-analytics",[Mw]:"fire-analytics-compat",[Uw]:"fire-app-check",[Fw]:"fire-app-check-compat",[Bw]:"fire-auth",[qw]:"fire-auth-compat",[$w]:"fire-rtdb",[zw]:"fire-data-connect",[jw]:"fire-rtdb-compat",[Gw]:"fire-fn",[Ww]:"fire-fn-compat",[Kw]:"fire-iid",[Hw]:"fire-iid-compat",[Qw]:"fire-fcm",[Jw]:"fire-fcm-compat",[Yw]:"fire-perf",[Xw]:"fire-perf-compat",[Zw]:"fire-rc",[eE]:"fire-rc-compat",[tE]:"fire-gcs",[nE]:"fire-gcs-compat",[rE]:"fire-fst",[sE]:"fire-fst-compat",[iE]:"fire-vertex","fire-js":"fire-js",[oE]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const An=new Map,Yr=new Map,Xr=new Map;function Ps(r,e){try{r.container.addComponent(e)}catch(t){jt.debug(`Component ${e.name} failed to register with FirebaseApp ${r.name}`,t)}}function um(r,e){r.container.addOrOverwriteComponent(e)}function bn(r){const e=r.name;if(Xr.has(e))return jt.debug(`There were multiple attempts to register component ${e}.`),!1;Xr.set(e,r);for(const t of An.values())Ps(t,r);for(const t of Yr.values())Ps(t,r);return!0}function lm(r,e){const t=r.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),r.container.getProvider(e)}function uE(r,e,t=vn){lm(r,e).clearInstance(t)}function tl(r){return r.options!==void 0}function hm(r){return tl(r)?!1:"authIdToken"in r||"appCheckToken"in r||"releaseOnDeref"in r||"automaticDataCollectionEnabled"in r}function de(r){return r==null?!1:r.settings!==void 0}function lE(){Xr.clear()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const hE={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},at=new Tr("app","Firebase",hE);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let dm=class{constructor(e,t,n){this._isDeleted=!1,this._options={...e},this._config={...t},this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=n,this.container.addComponent(new Lt("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw at.create("app-deleted",{appName:this._name})}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jd(r,e){const t=Hu(r.split(".")[1]);if(t===null){console.error(`FirebaseServerApp ${e} is invalid: second part could not be parsed.`);return}if(JSON.parse(t).exp===void 0){console.error(`FirebaseServerApp ${e} is invalid: expiration claim could not be parsed`);return}const i=JSON.parse(t).exp*1e3,s=new Date().getTime();i-s<=0&&console.error(`FirebaseServerApp ${e} is invalid: the token has expired.`)}class dE extends dm{constructor(e,t,n,i){const s=t.automaticDataCollectionEnabled!==void 0?t.automaticDataCollectionEnabled:!0,o={name:n,automaticDataCollectionEnabled:s};if(e.apiKey!==void 0)super(e,o,i);else{const c=e;super(c.options,o,i)}this._serverConfig={automaticDataCollectionEnabled:s,...t},this._serverConfig.authIdToken&&jd(this._serverConfig.authIdToken,"authIdToken"),this._serverConfig.appCheckToken&&jd(this._serverConfig.appCheckToken,"appCheckToken"),this._finalizationRegistry=null,typeof FinalizationRegistry<"u"&&(this._finalizationRegistry=new FinalizationRegistry(()=>{this.automaticCleanup()})),this._refCount=0,this.incRefCount(this._serverConfig.releaseOnDeref),this._serverConfig.releaseOnDeref=void 0,t.releaseOnDeref=void 0,It(ca,uu,"serverapp")}toJSON(){}get refCount(){return this._refCount}incRefCount(e){this.isDeleted||(this._refCount++,e!==void 0&&this._finalizationRegistry!==null&&this._finalizationRegistry.register(e,this))}decRefCount(){return this.isDeleted?0:--this._refCount}automaticCleanup(){rl(this)}get settings(){return this.checkDestroyed(),this._serverConfig}checkDestroyed(){if(this.isDeleted)throw at.create("server-app-deleted")}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const On=aE;function nl(r,e={}){let t=r;typeof e!="object"&&(e={name:e});const n={name:vn,automaticDataCollectionEnabled:!0,...e},i=n.name;if(typeof i!="string"||!i)throw at.create("bad-app-name",{appName:String(i)});if(t||(t=Yu()),!t)throw at.create("no-options");const s=An.get(i);if(s){if(Tn(t,s.options)&&Tn(n,s.config))return s;throw at.create("duplicate-app",{appName:i})}const o=new sm(i);for(const u of Xr.values())o.addComponent(u);const c=new dm(t,n,o);return An.set(i,c),c}function fE(r,e={}){if(sw()&&!Zp())throw at.create("invalid-server-app-environment");let t,n=e||{};if(r&&(tl(r)?t=r.options:hm(r)?n=r:t=r),n.automaticDataCollectionEnabled===void 0&&(n.automaticDataCollectionEnabled=!0),t||(t=Yu()),!t)throw at.create("no-options");const i={...n,...t};i.releaseOnDeref!==void 0&&delete i.releaseOnDeref;const s=f=>[...f].reduce((p,g)=>Math.imul(31,p)+g.charCodeAt(0)|0,0);if(n.releaseOnDeref!==void 0&&typeof FinalizationRegistry>"u")throw at.create("finalization-registry-not-supported",{});const o=""+s(JSON.stringify(i)),c=Yr.get(o);if(c)return c.incRefCount(n.releaseOnDeref),c;const u=new sm(o);for(const f of Xr.values())u.addComponent(f);const l=new dE(t,n,o,u);return Yr.set(o,l),l}function pE(r=vn){const e=An.get(r);if(!e&&r===vn&&Yu())return nl();if(!e)throw at.create("no-app",{appName:r});return e}function mE(){return Array.from(An.values())}async function rl(r){let e=!1;const t=r.name;An.has(t)?(e=!0,An.delete(t)):Yr.has(t)&&r.decRefCount()<=0&&(Yr.delete(t),e=!0),e&&(await Promise.all(r.container.getProviders().map(n=>n.delete())),r.isDeleted=!0)}function It(r,e,t){let n=cE[r]??r;t&&(n+=`-${t}`);const i=n.match(/\s|\//),s=e.match(/\s|\//);if(i||s){const o=[`Unable to register library "${n}" with version "${e}":`];i&&o.push(`library name "${n}" contains illegal characters (whitespace or "/")`),i&&s&&o.push("and"),s&&o.push(`version name "${e}" contains illegal characters (whitespace or "/")`),jt.warn(o.join(" "));return}bn(new Lt(`${n}-version`,()=>({library:n,version:e}),"VERSION"))}function fm(r,e){if(r!==null&&typeof r!="function")throw at.create("invalid-log-argument");Ew(r,e)}function pm(r){ww(r)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gE="firebase-heartbeat-database",_E=1,Cs="firebase-heartbeat-store";let Gc=null;function mm(){return Gc||(Gc=kw(gE,_E,{upgrade:(r,e)=>{switch(e){case 0:try{r.createObjectStore(Cs)}catch(t){console.warn(t)}}}}).catch(r=>{throw at.create("idb-open",{originalErrorMessage:r.message})})),Gc}async function yE(r){try{const t=(await mm()).transaction(Cs),n=await t.objectStore(Cs).get(gm(r));return await t.done,n}catch(e){if(e instanceof Qe)jt.warn(e.message);else{const t=at.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});jt.warn(t.message)}}}async function Gd(r,e){try{const n=(await mm()).transaction(Cs,"readwrite");await n.objectStore(Cs).put(e,gm(r)),await n.done}catch(t){if(t instanceof Qe)jt.warn(t.message);else{const n=at.create("idb-set",{originalErrorMessage:t==null?void 0:t.message});jt.warn(n.message)}}}function gm(r){return`${r.name}!${r.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const IE=1024,wE=30;class EE{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new vE(t),this._heartbeatsCachePromise=this._storage.read().then(n=>(this._heartbeatsCache=n,n))}async triggerHeartbeat(){var e,t;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),s=Wd();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===s||this._heartbeatsCache.heartbeats.some(o=>o.date===s))return;if(this._heartbeatsCache.heartbeats.push({date:s,agent:i}),this._heartbeatsCache.heartbeats.length>wE){const o=AE(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(o,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(n){jt.warn(n)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=Wd(),{heartbeatsToSend:n,unsentEntries:i}=TE(this._heartbeatsCache.heartbeats),s=oa(JSON.stringify({version:2,heartbeats:n}));return this._heartbeatsCache.lastSentHeartbeatDate=t,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),s}catch(t){return jt.warn(t),""}}}function Wd(){return new Date().toISOString().substring(0,10)}function TE(r,e=IE){const t=[];let n=r.slice();for(const i of r){const s=t.find(o=>o.agent===i.agent);if(s){if(s.dates.push(i.date),Kd(t)>e){s.dates.pop();break}}else if(t.push({agent:i.agent,dates:[i.date]}),Kd(t)>e){t.pop();break}n=n.slice(1)}return{heartbeatsToSend:t,unsentEntries:n}}class vE{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Ss()?aw().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await yE(this.app);return t!=null&&t.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const n=await this.read();return Gd(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??n.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const n=await this.read();return Gd(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??n.lastSentHeartbeatDate,heartbeats:[...n.heartbeats,...e.heartbeats]})}else return}}function Kd(r){return oa(JSON.stringify({version:2,heartbeats:r})).length}function AE(r){if(r.length===0)return-1;let e=0,t=r[0].date;for(let n=1;n<r.length;n++)r[n].date<t&&(t=r[n].date,e=n);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function bE(r){bn(new Lt("platform-logger",e=>new Vw(e),"PRIVATE")),bn(new Lt("heartbeat",e=>new EE(e),"PRIVATE")),It(ca,uu,r),It(ca,uu,"esm2020"),It("fire-js","")}bE("");const RE=Object.freeze(Object.defineProperty({__proto__:null,FirebaseError:Qe,SDK_VERSION:On,_DEFAULT_ENTRY_NAME:vn,_addComponent:Ps,_addOrOverwriteComponent:um,_apps:An,_clearComponents:lE,_components:Xr,_getProvider:lm,_isFirebaseApp:tl,_isFirebaseServerApp:de,_isFirebaseServerAppSettings:hm,_registerComponent:bn,_removeServiceInstance:uE,_serverApps:Yr,deleteApp:rl,getApp:pE,getApps:mE,initializeApp:nl,initializeServerApp:fE,onLog:fm,registerVersion:It,setLogLevel:pm},Symbol.toStringTag,{value:"Module"}));/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class SE{constructor(e,t){this._delegate=e,this.firebase=t,Ps(e,new Lt("app-compat",()=>this,"PUBLIC")),this.container=e.container}get automaticDataCollectionEnabled(){return this._delegate.automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this._delegate.automaticDataCollectionEnabled=e}get name(){return this._delegate.name}get options(){return this._delegate.options}delete(){return new Promise(e=>{this._delegate.checkDestroyed(),e()}).then(()=>(this.firebase.INTERNAL.removeApp(this.name),rl(this._delegate)))}_getService(e,t=vn){var i;this._delegate.checkDestroyed();const n=this._delegate.container.getProvider(e);return!n.isInitialized()&&((i=n.getComponent())==null?void 0:i.instantiationMode)==="EXPLICIT"&&n.initialize(),n.getImmediate({identifier:t})}_removeServiceInstance(e,t=vn){this._delegate.container.getProvider(e).clearInstance(t)}_addComponent(e){Ps(this._delegate,e)}_addOrOverwriteComponent(e){um(this._delegate,e)}toJSON(){return{name:this.name,automaticDataCollectionEnabled:this.automaticDataCollectionEnabled,options:this.options}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const PE={"no-app":"No Firebase App '{$appName}' has been created - call Firebase App.initializeApp()","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance."},Hd=new Tr("app-compat","Firebase",PE);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function CE(r){const e={},t={__esModule:!0,initializeApp:s,app:i,registerVersion:It,setLogLevel:pm,onLog:fm,apps:null,SDK_VERSION:On,INTERNAL:{registerComponent:c,removeApp:n,useAsService:u,modularAPIs:RE}};t.default=t,Object.defineProperty(t,"apps",{get:o});function n(l){delete e[l]}function i(l){if(l=l||vn,!Ud(e,l))throw Hd.create("no-app",{appName:l});return e[l]}i.App=r;function s(l,f={}){const p=nl(l,f);if(Ud(e,p.name))return e[p.name];const g=new r(p,t);return e[p.name]=g,g}function o(){return Object.keys(e).map(l=>e[l])}function c(l){const f=l.name,p=f.replace("-compat","");if(bn(l)&&l.type==="PUBLIC"){const g=(v=i())=>{if(typeof v[p]!="function")throw Hd.create("invalid-app-argument",{appName:f});return v[p]()};l.serviceProps!==void 0&&aa(g,l.serviceProps),t[p]=g,r.prototype[p]=function(...v){return this._getService.bind(this,f).apply(this,l.multipleInstances?v:[])}}return l.type==="PUBLIC"?t[p]:null}function u(l,f){return f==="serverAuth"?null:f}return t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _m(){const r=CE(SE);r.INTERNAL={...r.INTERNAL,createFirebaseNamespace:_m,extendNamespace:e,createSubscribe:im,ErrorFactory:Tr,deepExtend:aa};function e(t){aa(r,t)}return r}const kE=_m();/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qd=new Va("@firebase/app-compat"),DE="@firebase/app-compat",NE="0.5.6";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function VE(r){It(DE,NE,r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */try{const r=Qu();if(r.firebase!==void 0){Qd.warn(`
      Warning: Firebase is already defined in the global scope. Please make sure
      Firebase library is only loaded once.
    `);const e=r.firebase.SDK_VERSION;e&&e.indexOf("LITE")>=0&&Qd.warn(`
        Warning: You are trying to load Firebase while using Firebase Performance standalone script.
        You should load Firebase Performance with this instance of Firebase to avoid loading duplicate code.
        `)}}catch{}const Pe=kE;VE();var OE="firebase",xE="12.7.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Pe.registerVersion(OE,xE,"app-compat");const Qi={FACEBOOK:"facebook.com",GITHUB:"github.com",GOOGLE:"google.com",PASSWORD:"password",TWITTER:"twitter.com"},Nr={EMAIL_SIGNIN:"EMAIL_SIGNIN",PASSWORD_RESET:"PASSWORD_RESET",RECOVER_EMAIL:"RECOVER_EMAIL",REVERT_SECOND_FACTOR_ADDITION:"REVERT_SECOND_FACTOR_ADDITION",VERIFY_AND_CHANGE_EMAIL:"VERIFY_AND_CHANGE_EMAIL",VERIFY_EMAIL:"VERIFY_EMAIL"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ME(){return{"admin-restricted-operation":"This operation is restricted to administrators only.","argument-error":"","app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","app-not-installed":"The requested mobile application corresponding to the identifier (Android package name or iOS bundle ID) provided is not installed on this device.","captcha-check-failed":"The reCAPTCHA response token provided is either invalid, expired, already used or the domain associated with it does not match the list of whitelisted domains.","code-expired":"The SMS code has expired. Please re-send the verification code to try again.","cordova-not-ready":"Cordova framework is not ready.","cors-unsupported":"This browser is not supported.","credential-already-in-use":"This credential is already associated with a different user account.","custom-token-mismatch":"The custom token corresponds to a different audience.","requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.","dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK.","dynamic-link-not-activated":"Please activate Dynamic Links in the Firebase Console and agree to the terms and conditions.","email-change-needs-verification":"Multi-factor users must always have a verified email.","email-already-in-use":"The email address is already in use by another account.","emulator-config-failed":'Auth instance has already been used to make a network call. Auth can no longer be configured to use the emulator. Try calling "connectAuthEmulator()" sooner.',"expired-action-code":"The action code has expired.","cancelled-popup-request":"This operation has been cancelled due to another conflicting popup being opened.","internal-error":"An internal AuthError has occurred.","invalid-app-credential":"The phone verification request contains an invalid application verifier. The reCAPTCHA token response is either invalid or expired.","invalid-app-id":"The mobile app identifier is not registered for the current project.","invalid-user-token":"This user's credential isn't valid for this project. This can happen if the user's token has been tampered with, or if the user isn't for the project associated with this API key.","invalid-auth-event":"An internal AuthError has occurred.","invalid-verification-code":"The SMS verification code used to create the phone auth credential is invalid. Please resend the verification code sms and be sure to use the verification code provided by the user.","invalid-continue-uri":"The continue URL provided in the request is invalid.","invalid-cordova-configuration":"The following Cordova plugins must be installed to enable OAuth sign-in: cordova-plugin-buildinfo, cordova-universal-links-plugin, cordova-plugin-browsertab, cordova-plugin-inappbrowser and cordova-plugin-customurlscheme.","invalid-custom-token":"The custom token format is incorrect. Please check the documentation.","invalid-dynamic-link-domain":"The provided dynamic link domain is not configured or authorized for the current project.","invalid-email":"The email address is badly formatted.","invalid-emulator-scheme":"Emulator URL must start with a valid scheme (http:// or https://).","invalid-api-key":"Your API key is invalid, please check you have copied it correctly.","invalid-cert-hash":"The SHA-1 certificate hash provided is invalid.","invalid-credential":"The supplied auth credential is incorrect, malformed or has expired.","invalid-message-payload":"The email template corresponding to this action contains invalid characters in its message. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-multi-factor-session":"The request does not contain a valid proof of first factor successful sign-in.","invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","invalid-oauth-client-id":"The OAuth client ID provided is either invalid or does not match the specified API key.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.","invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":"The password is invalid or the user does not have a password.","invalid-persistence-type":"The specified persistence type is invalid. It can only be local, session or none.","invalid-phone-number":"The format of the phone number provided is incorrect. Please enter the phone number in a format that can be parsed into E.164 format. E.164 phone numbers are written in the format [+][country code][subscriber number including area code].","invalid-provider-id":"The specified provider ID is invalid.","invalid-recipient-email":"The email corresponding to this action failed to send as the provided recipient email address is invalid.","invalid-sender":"The email template corresponding to this action contains an invalid sender email or name. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-verification-id":"The verification ID used to create the phone auth credential is invalid.","invalid-tenant-id":"The Auth instance's tenant ID is invalid.","login-blocked":"Login blocked by user-provided method: {$originalMessage}","missing-android-pkg-name":"An Android Package Name must be provided if the Android App is required to be installed.","auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.","missing-app-credential":"The phone verification request is missing an application verifier assertion. A reCAPTCHA response token needs to be provided.","missing-verification-code":"The phone auth credential was created with an empty SMS verification code.","missing-continue-uri":"A continue URL must be provided in the request.","missing-iframe-start":"An internal AuthError has occurred.","missing-ios-bundle-id":"An iOS Bundle ID must be provided if an App Store ID is provided.","missing-or-invalid-nonce":"The request does not contain a valid nonce. This can occur if the SHA-256 hash of the provided raw nonce does not match the hashed nonce in the ID token payload.","missing-password":"A non-empty password must be provided","missing-multi-factor-info":"No second factor identifier is provided.","missing-multi-factor-session":"The request is missing proof of first factor successful sign-in.","missing-phone-number":"To send verification codes, provide a phone number for the recipient.","missing-verification-id":"The phone auth credential was created with an empty verification ID.","app-deleted":"This instance of FirebaseApp has been deleted.","multi-factor-info-not-found":"The user does not have a second factor matching the identifier provided.","multi-factor-auth-required":"Proof of ownership of a second factor is required to complete sign-in.","account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.","network-request-failed":"A network AuthError (such as timeout, interrupted connection or unreachable host) has occurred.","no-auth-event":"An internal AuthError has occurred.","no-such-provider":"User was not linked to an account with the given provider.","null-user":"A null user object was provided as the argument for an operation which requires a non-null user object.","operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":'This operation is not supported in the environment this application is running on. "location.protocol" must be http, https or chrome-extension and web storage must be enabled.',"popup-blocked":"Unable to establish a connection with the popup. It may have been blocked by the browser.","popup-closed-by-user":"The popup has been closed by the user before finalizing the operation.","provider-already-linked":"User can only be linked to one identity for the given provider.","quota-exceeded":"The project's quota for this operation has been exceeded.","redirect-cancelled-by-user":"The redirect operation has been cancelled by the user before finalizing.","redirect-operation-pending":"A redirect sign-in operation is already pending.","rejected-credential":"The request contains malformed or mismatching credentials.","second-factor-already-in-use":"The second factor is already enrolled on this account.","maximum-second-factor-count-exceeded":"The maximum allowed number of second factors on a user has been exceeded.","tenant-id-mismatch":"The provided tenant ID does not match the Auth instance's tenant ID",timeout:"The operation has timed out.","user-token-expired":"The user's credential is no longer valid. The user must sign in again.","too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.","unauthorized-continue-uri":"The domain of the continue URL is not whitelisted.  Please whitelist the domain in the Firebase console.","unsupported-first-factor":"Enrolling a second factor or signing in with a multi-factor account requires sign-in with a supported first factor.","unsupported-persistence-type":"The current environment does not support the specified persistence type.","unsupported-tenant-operation":"This operation is not supported in a multi-tenant context.","unverified-email":"The operation requires a verified email.","user-cancelled":"The user did not grant your application the permissions it requested.","user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.","user-disabled":"The user account has been disabled by an administrator.","user-mismatch":"The supplied credentials do not correspond to the previously signed in user.","user-signed-out":"","weak-password":"The password must be 6 characters long or more.","web-storage-unsupported":"This browser is not supported or 3rd party cookies and data may be disabled.","already-initialized":"initializeAuth() has already been called with different options. To avoid this error, call initializeAuth() with the same options as when it was originally called, or call getAuth() to return the already initialized instance.","missing-recaptcha-token":"The reCAPTCHA token is missing when sending request to the backend.","invalid-recaptcha-token":"The reCAPTCHA token is invalid when sending request to the backend.","invalid-recaptcha-action":"The reCAPTCHA action is invalid when sending request to the backend.","recaptcha-not-enabled":"reCAPTCHA Enterprise integration is not enabled for this project.","missing-client-type":"The reCAPTCHA client type is missing when sending request to the backend.","missing-recaptcha-version":"The reCAPTCHA version is missing when sending request to the backend.","invalid-req-type":"Invalid request parameters.","invalid-recaptcha-version":"The reCAPTCHA version is invalid when sending request to the backend.","unsupported-password-policy-schema-version":"The password policy received from the backend uses a schema version that is not supported by this version of the Firebase SDK.","password-does-not-meet-requirements":"The password does not meet the requirements.","invalid-hosting-link-domain":"The provided Hosting link domain is not configured in Firebase Hosting or is not owned by the current project. This cannot be a default Hosting domain (`web.app` or `firebaseapp.com`)."}}function ym(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const LE=ME,FE=ym,Im=new Tr("auth","Firebase",ym());/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ua=new Va("@firebase/auth");function UE(r,...e){ua.logLevel<=H.WARN&&ua.warn(`Auth (${On}): ${r}`,...e)}function Go(r,...e){ua.logLevel<=H.ERROR&&ua.error(`Auth (${On}): ${r}`,...e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Fe(r,...e){throw sl(r,...e)}function Ce(r,...e){return sl(r,...e)}function il(r,e,t){const n={...FE(),[e]:t};return new Tr("auth","Firebase",n).create(e,{appName:r.name})}function Oe(r){return il(r,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function Ti(r,e,t){const n=t;if(!(e instanceof n))throw n.name!==e.constructor.name&&Fe(r,"argument-error"),il(r,"argument-error",`Type of ${e.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function sl(r,...e){if(typeof r!="string"){const t=e[0],n=[...e.slice(1)];return n[0]&&(n[0].appName=r.name),r._errorFactory.create(t,...n)}return Im.create(r,...e)}function O(r,e,...t){if(!r)throw sl(e,...t)}function Dt(r){const e="INTERNAL ASSERTION FAILED: "+r;throw Go(e),new Error(e)}function Tt(r,e){r||Dt(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ks(){var r;return typeof self<"u"&&((r=self.location)==null?void 0:r.href)||""}function ol(){return Jd()==="http:"||Jd()==="https:"}function Jd(){var r;return typeof self<"u"&&((r=self.location)==null?void 0:r.protocol)||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function BE(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(ol()||em()||"connection"in navigator)?navigator.onLine:!0}function qE(){if(typeof navigator>"u")return null;const r=navigator;return r.languages&&r.languages[0]||r.language||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zs{constructor(e,t){this.shortDelay=e,this.longDelay=t,Tt(t>e,"Short delay should be less than long delay!"),this.isMobile=iw()||Xu()}get(){return BE()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function al(r,e){Tt(r.emulator,"Emulator should always be set here");const{url:t}=r.emulator;return e?`${t}${e.startsWith("/")?e.slice(1):e}`:t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wm{static initialize(e,t,n){this.fetchImpl=e,t&&(this.headersImpl=t),n&&(this.responseImpl=n)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;Dt("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;Dt("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;Dt("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $E={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zE=["/v1/accounts:signInWithCustomToken","/v1/accounts:signInWithEmailLink","/v1/accounts:signInWithIdp","/v1/accounts:signInWithPassword","/v1/accounts:signInWithPhoneNumber","/v1/token"],jE=new Zs(3e4,6e4);function Ie(r,e){return r.tenantId&&!e.tenantId?{...e,tenantId:r.tenantId}:e}async function we(r,e,t,n,i={}){return Em(r,i,async()=>{let s={},o={};n&&(e==="GET"?o=n:s={body:JSON.stringify(n)});const c=Ei({key:r.config.apiKey,...o}).slice(1),u=await r._getAdditionalHeaders();u["Content-Type"]="application/json",r.languageCode&&(u["X-Firebase-Locale"]=r.languageCode);const l={method:e,headers:u,...s};return ow()||(l.referrerPolicy="no-referrer"),r.emulatorConfig&&wi(r.emulatorConfig.host)&&(l.credentials="include"),wm.fetch()(await Tm(r,r.config.apiHost,t,c),l)})}async function Em(r,e,t){r._canInitEmulator=!1;const n={...$E,...e};try{const i=new WE(r),s=await Promise.race([t(),i.promise]);i.clearNetworkTimeout();const o=await s.json();if("needConfirmation"in o)throw ss(r,"account-exists-with-different-credential",o);if(s.ok&&!("errorMessage"in o))return o;{const c=s.ok?o.errorMessage:o.error.message,[u,l]=c.split(" : ");if(u==="FEDERATED_USER_ID_ALREADY_LINKED")throw ss(r,"credential-already-in-use",o);if(u==="EMAIL_EXISTS")throw ss(r,"email-already-in-use",o);if(u==="USER_DISABLED")throw ss(r,"user-disabled",o);const f=n[u]||u.toLowerCase().replace(/[_\s]+/g,"-");if(l)throw il(r,f,l);Fe(r,f)}}catch(i){if(i instanceof Qe)throw i;Fe(r,"network-request-failed",{message:String(i)})}}async function Ht(r,e,t,n,i={}){const s=await we(r,e,t,n,i);return"mfaPendingCredential"in s&&Fe(r,"multi-factor-auth-required",{_serverResponse:s}),s}async function Tm(r,e,t,n){const i=`${e}${t}?${n}`,s=r,o=s.config.emulator?al(r.config,i):`${r.config.apiScheme}://${i}`;return zE.includes(t)&&(await s._persistenceManagerAvailable,s._getPersistenceType()==="COOKIE")?s._getPersistence()._getFinalTarget(o).toString():o}function GE(r){switch(r){case"ENFORCE":return"ENFORCE";case"AUDIT":return"AUDIT";case"OFF":return"OFF";default:return"ENFORCEMENT_STATE_UNSPECIFIED"}}class WE{clearNetworkTimeout(){clearTimeout(this.timer)}constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((t,n)=>{this.timer=setTimeout(()=>n(Ce(this.auth,"network-request-failed")),jE.get())})}}function ss(r,e,t){const n={appName:r.name};t.email&&(n.email=t.email),t.phoneNumber&&(n.phoneNumber=t.phoneNumber);const i=Ce(r,e,n);return i.customData._tokenResponse=t,i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yd(r){return r!==void 0&&r.getResponse!==void 0}function Xd(r){return r!==void 0&&r.enterprise!==void 0}class vm{constructor(e){if(this.siteKey="",this.recaptchaEnforcementState=[],e.recaptchaKey===void 0)throw new Error("recaptchaKey undefined");this.siteKey=e.recaptchaKey.split("/")[3],this.recaptchaEnforcementState=e.recaptchaEnforcementState}getProviderEnforcementState(e){if(!this.recaptchaEnforcementState||this.recaptchaEnforcementState.length===0)return null;for(const t of this.recaptchaEnforcementState)if(t.provider&&t.provider===e)return GE(t.enforcementState);return null}isProviderEnabled(e){return this.getProviderEnforcementState(e)==="ENFORCE"||this.getProviderEnforcementState(e)==="AUDIT"}isAnyProviderEnabled(){return this.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")||this.isProviderEnabled("PHONE_PROVIDER")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function KE(r){return(await we(r,"GET","/v1/recaptchaParams")).recaptchaSiteKey||""}async function Am(r,e){return we(r,"GET","/v2/recaptchaConfig",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function HE(r,e){return we(r,"POST","/v1/accounts:delete",e)}async function QE(r,e){return we(r,"POST","/v1/accounts:update",e)}async function la(r,e){return we(r,"POST","/v1/accounts:lookup",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fs(r){if(r)try{const e=new Date(Number(r));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}async function JE(r,e=!1){const t=z(r),n=await t.getIdToken(e),i=Oa(n);O(i&&i.exp&&i.auth_time&&i.iat,t.auth,"internal-error");const s=typeof i.firebase=="object"?i.firebase:void 0,o=s==null?void 0:s.sign_in_provider;return{claims:i,token:n,authTime:fs(Wc(i.auth_time)),issuedAtTime:fs(Wc(i.iat)),expirationTime:fs(Wc(i.exp)),signInProvider:o||null,signInSecondFactor:(s==null?void 0:s.sign_in_second_factor)||null}}function Wc(r){return Number(r)*1e3}function Oa(r){const[e,t,n]=r.split(".");if(e===void 0||t===void 0||n===void 0)return Go("JWT malformed, contained fewer than 3 sections"),null;try{const i=Hu(t);return i?JSON.parse(i):(Go("Failed to decode base64 JWT payload"),null)}catch(i){return Go("Caught error parsing JWT payload as JSON",i==null?void 0:i.toString()),null}}function Zd(r){const e=Oa(r);return O(e,"internal-error"),O(typeof e.exp<"u","internal-error"),O(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Gt(r,e,t=!1){if(t)return e;try{return await e}catch(n){throw n instanceof Qe&&YE(n)&&r.auth.currentUser===r&&await r.auth.signOut(),n}}function YE({code:r}){return r==="auth/user-disabled"||r==="auth/user-token-expired"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class XE{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){if(e){const t=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),t}else{this.errorBackoff=3e4;const n=(this.user.stsTokenManager.expirationTime??0)-Date.now()-3e5;return Math.max(0,n)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){(e==null?void 0:e.code)==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lu{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=fs(this.lastLoginAt),this.creationTime=fs(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ds(r){var p;const e=r.auth,t=await r.getIdToken(),n=await Gt(r,la(e,{idToken:t}));O(n==null?void 0:n.users.length,e,"internal-error");const i=n.users[0];r._notifyReloadListener(i);const s=(p=i.providerUserInfo)!=null&&p.length?bm(i.providerUserInfo):[],o=eT(r.providerData,s),c=r.isAnonymous,u=!(r.email&&i.passwordHash)&&!(o!=null&&o.length),l=c?u:!1,f={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:o,metadata:new lu(i.createdAt,i.lastLoginAt),isAnonymous:l};Object.assign(r,f)}async function ZE(r){const e=z(r);await Ds(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function eT(r,e){return[...r.filter(n=>!e.some(i=>i.providerId===n.providerId)),...e]}function bm(r){return r.map(({providerId:e,...t})=>({providerId:e,uid:t.rawId||"",displayName:t.displayName||null,email:t.email||null,phoneNumber:t.phoneNumber||null,photoURL:t.photoUrl||null}))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function tT(r,e){const t=await Em(r,{},async()=>{const n=Ei({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:i,apiKey:s}=r.config,o=await Tm(r,i,"/v1/token",`key=${s}`),c=await r._getAdditionalHeaders();c["Content-Type"]="application/x-www-form-urlencoded";const u={method:"POST",headers:c,body:n};return r.emulatorConfig&&wi(r.emulatorConfig.host)&&(u.credentials="include"),wm.fetch()(o,u)});return{accessToken:t.access_token,expiresIn:t.expires_in,refreshToken:t.refresh_token}}async function nT(r,e){return we(r,"POST","/v2/accounts:revokeToken",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gr{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){O(e.idToken,"internal-error"),O(typeof e.idToken<"u","internal-error"),O(typeof e.refreshToken<"u","internal-error");const t="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):Zd(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){O(e.length!==0,"internal-error");const t=Zd(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return!t&&this.accessToken&&!this.isExpired?this.accessToken:(O(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:n,refreshToken:i,expiresIn:s}=await tT(e,t);this.updateTokensAndExpiration(n,i,Number(s))}updateTokensAndExpiration(e,t,n){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+n*1e3}static fromJSON(e,t){const{refreshToken:n,accessToken:i,expirationTime:s}=t,o=new Gr;return n&&(O(typeof n=="string","internal-error",{appName:e}),o.refreshToken=n),i&&(O(typeof i=="string","internal-error",{appName:e}),o.accessToken=i),s&&(O(typeof s=="number","internal-error",{appName:e}),o.expirationTime=s),o}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new Gr,this.toJSON())}_performRefresh(){return Dt("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cn(r,e){O(typeof r=="string"||typeof r>"u","internal-error",{appName:e})}class yt{constructor({uid:e,auth:t,stsTokenManager:n,...i}){this.providerId="firebase",this.proactiveRefresh=new XE(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=e,this.auth=t,this.stsTokenManager=n,this.accessToken=n.accessToken,this.displayName=i.displayName||null,this.email=i.email||null,this.emailVerified=i.emailVerified||!1,this.phoneNumber=i.phoneNumber||null,this.photoURL=i.photoURL||null,this.isAnonymous=i.isAnonymous||!1,this.tenantId=i.tenantId||null,this.providerData=i.providerData?[...i.providerData]:[],this.metadata=new lu(i.createdAt||void 0,i.lastLoginAt||void 0)}async getIdToken(e){const t=await Gt(this,this.stsTokenManager.getToken(this.auth,e));return O(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return JE(this,e)}reload(){return ZE(this)}_assign(e){this!==e&&(O(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(t=>({...t})),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new yt({...this,auth:e,stsTokenManager:this.stsTokenManager._clone()});return t.metadata._copy(this.metadata),t}_onReload(e){O(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let n=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),n=!0),t&&await Ds(this),await this.auth._persistUserIfCurrent(this),n&&this.auth._notifyListenersIfCurrent(this)}async delete(){if(de(this.auth.app))return Promise.reject(Oe(this.auth));const e=await this.getIdToken();return await Gt(this,HE(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return{uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>({...e})),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId,...this.metadata.toJSON(),apiKey:this.auth.config.apiKey,appName:this.auth.name}}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,t){const n=t.displayName??void 0,i=t.email??void 0,s=t.phoneNumber??void 0,o=t.photoURL??void 0,c=t.tenantId??void 0,u=t._redirectEventId??void 0,l=t.createdAt??void 0,f=t.lastLoginAt??void 0,{uid:p,emailVerified:g,isAnonymous:v,providerData:k,stsTokenManager:D}=t;O(p&&D,e,"internal-error");const N=Gr.fromJSON(this.name,D);O(typeof p=="string",e,"internal-error"),cn(n,e.name),cn(i,e.name),O(typeof g=="boolean",e,"internal-error"),O(typeof v=="boolean",e,"internal-error"),cn(s,e.name),cn(o,e.name),cn(c,e.name),cn(u,e.name),cn(l,e.name),cn(f,e.name);const q=new yt({uid:p,auth:e,email:i,emailVerified:g,displayName:n,isAnonymous:v,photoURL:o,phoneNumber:s,tenantId:c,stsTokenManager:N,createdAt:l,lastLoginAt:f});return k&&Array.isArray(k)&&(q.providerData=k.map(j=>({...j}))),u&&(q._redirectEventId=u),q}static async _fromIdTokenResponse(e,t,n=!1){const i=new Gr;i.updateFromServerResponse(t);const s=new yt({uid:t.localId,auth:e,stsTokenManager:i,isAnonymous:n});return await Ds(s),s}static async _fromGetAccountInfoResponse(e,t,n){const i=t.users[0];O(i.localId!==void 0,"internal-error");const s=i.providerUserInfo!==void 0?bm(i.providerUserInfo):[],o=!(i.email&&i.passwordHash)&&!(s!=null&&s.length),c=new Gr;c.updateFromIdToken(n);const u=new yt({uid:i.localId,auth:e,stsTokenManager:c,isAnonymous:o}),l={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:s,metadata:new lu(i.createdAt,i.lastLoginAt),isAnonymous:!(i.email&&i.passwordHash)&&!(s!=null&&s.length)};return Object.assign(u,l),u}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ef=new Map;function ot(r){Tt(r instanceof Function,"Expected a class definition");let e=ef.get(r);return e?(Tt(e instanceof r,"Instance stored in cache mismatched with class"),e):(e=new r,ef.set(r,e),e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rm{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return t===void 0?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}Rm.type="NONE";const Zr=Rm;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function or(r,e,t){return`firebase:${r}:${e}:${t}`}class Wr{constructor(e,t,n){this.persistence=e,this.auth=t,this.userKey=n;const{config:i,name:s}=this.auth;this.fullUserKey=or(this.userKey,i.apiKey,s),this.fullPersistenceKey=or("persistence",i.apiKey,s),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);if(!e)return null;if(typeof e=="string"){const t=await la(this.auth,{idToken:e}).catch(()=>{});return t?yt._fromGetAccountInfoResponse(this.auth,t,e):null}return yt._fromJSON(this.auth,e)}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,t)return this.setCurrentUser(t)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,n="authUser"){if(!t.length)return new Wr(ot(Zr),e,n);const i=(await Promise.all(t.map(async l=>{if(await l._isAvailable())return l}))).filter(l=>l);let s=i[0]||ot(Zr);const o=or(n,e.config.apiKey,e.name);let c=null;for(const l of t)try{const f=await l._get(o);if(f){let p;if(typeof f=="string"){const g=await la(e,{idToken:f}).catch(()=>{});if(!g)break;p=await yt._fromGetAccountInfoResponse(e,g,f)}else p=yt._fromJSON(e,f);l!==s&&(c=p),s=l;break}}catch{}const u=i.filter(l=>l._shouldAllowMigration);return!s._shouldAllowMigration||!u.length?new Wr(s,e,n):(s=u[0],c&&await s._set(o,c.toJSON()),await Promise.all(t.map(async l=>{if(l!==s)try{await l._remove(o)}catch{}})),new Wr(s,e,n))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function tf(r){const e=r.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(km(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(Sm(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(Dm(e))return"Blackberry";if(Nm(e))return"Webos";if(Pm(e))return"Safari";if((e.includes("chrome/")||Cm(e))&&!e.includes("edge/"))return"Chrome";if(eo(e))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,n=r.match(t);if((n==null?void 0:n.length)===2)return n[1]}return"Other"}function Sm(r=me()){return/firefox\//i.test(r)}function Pm(r=me()){const e=r.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function Cm(r=me()){return/crios\//i.test(r)}function km(r=me()){return/iemobile/i.test(r)}function eo(r=me()){return/android/i.test(r)}function Dm(r=me()){return/blackberry/i.test(r)}function Nm(r=me()){return/webos/i.test(r)}function to(r=me()){return/iphone|ipad|ipod/i.test(r)||/macintosh/i.test(r)&&/mobile/i.test(r)}function rT(r=me()){return/(iPad|iPhone|iPod).*OS 7_\d/i.test(r)||/(iPad|iPhone|iPod).*OS 8_\d/i.test(r)}function iT(r=me()){var e;return to(r)&&!!((e=window.navigator)!=null&&e.standalone)}function sT(){return tm()&&document.documentMode===10}function Vm(r=me()){return to(r)||eo(r)||Nm(r)||Dm(r)||/windows phone/i.test(r)||km(r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Om(r,e=[]){let t;switch(r){case"Browser":t=tf(me());break;case"Worker":t=`${tf(me())}-${r}`;break;default:t=r}const n=e.length?e.join(","):"FirebaseCore-web";return`${t}/JsCore/${On}/${n}`}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class oT{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const n=s=>new Promise((o,c)=>{try{const u=e(s);o(u)}catch(u){c(u)}});n.onAbort=t,this.queue.push(n);const i=this.queue.length-1;return()=>{this.queue[i]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const n of this.queue)await n(e),n.onAbort&&t.push(n.onAbort)}catch(n){t.reverse();for(const i of t)try{i()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:n==null?void 0:n.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function aT(r,e={}){return we(r,"GET","/v2/passwordPolicy",Ie(r,e))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cT=6;class uT{constructor(e){var n;const t=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=t.minPasswordLength??cT,t.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=t.maxPasswordLength),t.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=t.containsLowercaseCharacter),t.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=t.containsUppercaseCharacter),t.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=t.containsNumericCharacter),t.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=t.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=((n=e.allowedNonAlphanumericCharacters)==null?void 0:n.join(""))??"",this.forceUpgradeOnSignin=e.forceUpgradeOnSignin??!1,this.schemaVersion=e.schemaVersion}validatePassword(e){const t={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,t),this.validatePasswordCharacterOptions(e,t),t.isValid&&(t.isValid=t.meetsMinPasswordLength??!0),t.isValid&&(t.isValid=t.meetsMaxPasswordLength??!0),t.isValid&&(t.isValid=t.containsLowercaseLetter??!0),t.isValid&&(t.isValid=t.containsUppercaseLetter??!0),t.isValid&&(t.isValid=t.containsNumericCharacter??!0),t.isValid&&(t.isValid=t.containsNonAlphanumericCharacter??!0),t}validatePasswordLengthOptions(e,t){const n=this.customStrengthOptions.minPasswordLength,i=this.customStrengthOptions.maxPasswordLength;n&&(t.meetsMinPasswordLength=e.length>=n),i&&(t.meetsMaxPasswordLength=e.length<=i)}validatePasswordCharacterOptions(e,t){this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);let n;for(let i=0;i<e.length;i++)n=e.charAt(i),this.updatePasswordCharacterOptionsStatuses(t,n>="a"&&n<="z",n>="A"&&n<="Z",n>="0"&&n<="9",this.allowedNonAlphanumericCharacters.includes(n))}updatePasswordCharacterOptionsStatuses(e,t,n,i,s){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=n)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=i)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=s))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lT{constructor(e,t,n,i){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=n,this.config=i,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new nf(this),this.idTokenSubscription=new nf(this),this.beforeStateQueue=new oT(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=Im,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this._resolvePersistenceManagerAvailable=void 0,this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=i.sdkClientVersion,this._persistenceManagerAvailable=new Promise(s=>this._resolvePersistenceManagerAvailable=s)}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=ot(t)),this._initializationPromise=this.queue(async()=>{var n,i,s;if(!this._deleted&&(this.persistenceManager=await Wr.create(this,e),(n=this._resolvePersistenceManagerAvailable)==null||n.call(this),!this._deleted)){if((i=this._popupRedirectResolver)!=null&&i._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(t),this.lastNotifiedUid=((s=this.currentUser)==null?void 0:s.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const t=await la(this,{idToken:e}),n=await yt._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(n)}catch(t){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",t),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var s;if(de(this.app)){const o=this.app.settings.authIdToken;return o?new Promise(c=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(o).then(c,c))}):this.directlySetCurrentUser(null)}const t=await this.assertedPersistence.getCurrentUser();let n=t,i=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const o=(s=this.redirectUser)==null?void 0:s._redirectEventId,c=n==null?void 0:n._redirectEventId,u=await this.tryRedirectSignIn(e);(!o||o===c)&&(u!=null&&u.user)&&(n=u.user,i=!0)}if(!n)return this.directlySetCurrentUser(null);if(!n._redirectEventId){if(i)try{await this.beforeStateQueue.runMiddleware(n)}catch(o){n=t,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(o))}return n?this.reloadAndSetCurrentUserOrClear(n):this.directlySetCurrentUser(null)}return O(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===n._redirectEventId?this.directlySetCurrentUser(n):this.reloadAndSetCurrentUserOrClear(n)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await Ds(e)}catch(t){if((t==null?void 0:t.code)!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=qE()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if(de(this.app))return Promise.reject(Oe(this));const t=e?z(e):null;return t&&O(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&O(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return de(this.app)?Promise.reject(Oe(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return de(this.app)?Promise.reject(Oe(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(ot(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await aT(this),t=new uT(e);this.tenantId===null?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistenceType(){return this.assertedPersistence.persistence.type}_getPersistence(){return this.assertedPersistence.persistence}_updateErrorMap(e){this._errorFactory=new Tr("auth","Firebase",e())}onAuthStateChanged(e,t,n){return this.registerStateListener(this.authStateSubscription,e,t,n)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,n){return this.registerStateListener(this.idTokenSubscription,e,t,n)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const n=this.onAuthStateChanged(()=>{n(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t=await this.currentUser.getIdToken(),n={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:t};this.tenantId!=null&&(n.tenantId=this.tenantId),await nT(this,n)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)==null?void 0:e.toJSON()}}async _setRedirectUser(e,t){const n=await this.getOrInitRedirectPersistenceManager(t);return e===null?n.removeCurrentUser():n.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&ot(e)||this._popupRedirectResolver;O(t,this,"argument-error"),this.redirectPersistenceManager=await Wr.create(this,[ot(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var t,n;return this._isInitialized&&await this.queue(async()=>{}),((t=this._currentUser)==null?void 0:t._redirectEventId)===e?this._currentUser:((n=this.redirectUser)==null?void 0:n._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var t;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const e=((t=this.currentUser)==null?void 0:t.uid)??null;this.lastNotifiedUid!==e&&(this.lastNotifiedUid=e,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,n,i){if(this._deleted)return()=>{};const s=typeof t=="function"?t:t.next.bind(t);let o=!1;const c=this._isInitialized?Promise.resolve():this._initializationPromise;if(O(c,this,"internal-error"),c.then(()=>{o||s(this.currentUser)}),typeof t=="function"){const u=e.addObserver(t,n,i);return()=>{o=!0,u()}}else{const u=e.addObserver(t);return()=>{o=!0,u()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return O(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=Om(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var i;const e={"X-Client-Version":this.clientVersion};this.app.options.appId&&(e["X-Firebase-gmpid"]=this.app.options.appId);const t=await((i=this.heartbeatServiceProvider.getImmediate({optional:!0}))==null?void 0:i.getHeartbeatsHeader());t&&(e["X-Firebase-Client"]=t);const n=await this._getAppCheckToken();return n&&(e["X-Firebase-AppCheck"]=n),e}async _getAppCheckToken(){var t;if(de(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=await((t=this.appCheckServiceProvider.getImmediate({optional:!0}))==null?void 0:t.getToken());return e!=null&&e.error&&UE(`Error while retrieving App Check token: ${e.error}`),e==null?void 0:e.token}}function ge(r){return z(r)}class nf{constructor(e){this.auth=e,this.observer=null,this.addObserver=im(t=>this.observer=t)}get next(){return O(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let no={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function hT(r){no=r}function cl(r){return no.loadJS(r)}function dT(){return no.recaptchaV2Script}function fT(){return no.recaptchaEnterpriseScript}function pT(){return no.gapiScript}function xm(r){return`__${r}${Math.floor(Math.random()*1e6)}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mT=500,gT=6e4,Lo=1e12;class _T{constructor(e){this.auth=e,this.counter=Lo,this._widgets=new Map}render(e,t){const n=this.counter;return this._widgets.set(n,new wT(e,this.auth.name,t||{})),this.counter++,n}reset(e){var n;const t=e||Lo;(n=this._widgets.get(t))==null||n.delete(),this._widgets.delete(t)}getResponse(e){var n;const t=e||Lo;return((n=this._widgets.get(t))==null?void 0:n.getResponse())||""}async execute(e){var n;const t=e||Lo;return(n=this._widgets.get(t))==null||n.execute(),""}}class yT{constructor(){this.enterprise=new IT}ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}class IT{ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}class wT{constructor(e,t,n){this.params=n,this.timerId=null,this.deleted=!1,this.responseToken=null,this.clickHandler=()=>{this.execute()};const i=typeof e=="string"?document.getElementById(e):e;O(i,"argument-error",{appName:t}),this.container=i,this.isVisible=this.params.size!=="invisible",this.isVisible?this.execute():this.container.addEventListener("click",this.clickHandler)}getResponse(){return this.checkIfDeleted(),this.responseToken}delete(){this.checkIfDeleted(),this.deleted=!0,this.timerId&&(clearTimeout(this.timerId),this.timerId=null),this.container.removeEventListener("click",this.clickHandler)}execute(){this.checkIfDeleted(),!this.timerId&&(this.timerId=window.setTimeout(()=>{this.responseToken=ET(50);const{callback:e,"expired-callback":t}=this.params;if(e)try{e(this.responseToken)}catch{}this.timerId=window.setTimeout(()=>{if(this.timerId=null,this.responseToken=null,t)try{t()}catch{}this.isVisible&&this.execute()},gT)},mT))}checkIfDeleted(){if(this.deleted)throw new Error("reCAPTCHA mock was already deleted!")}}function ET(r){const e=[],t="1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";for(let n=0;n<r;n++)e.push(t.charAt(Math.floor(Math.random()*t.length)));return e.join("")}const TT="recaptcha-enterprise",ps="NO_RECAPTCHA";class Mm{constructor(e){this.type=TT,this.auth=ge(e)}async verify(e="verify",t=!1){async function n(s){if(!t){if(s.tenantId==null&&s._agentRecaptchaConfig!=null)return s._agentRecaptchaConfig.siteKey;if(s.tenantId!=null&&s._tenantRecaptchaConfigs[s.tenantId]!==void 0)return s._tenantRecaptchaConfigs[s.tenantId].siteKey}return new Promise(async(o,c)=>{Am(s,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}).then(u=>{if(u.recaptchaKey===void 0)c(new Error("recaptcha Enterprise site key undefined"));else{const l=new vm(u);return s.tenantId==null?s._agentRecaptchaConfig=l:s._tenantRecaptchaConfigs[s.tenantId]=l,o(l.siteKey)}}).catch(u=>{c(u)})})}function i(s,o,c){const u=window.grecaptcha;Xd(u)?u.enterprise.ready(()=>{u.enterprise.execute(s,{action:e}).then(l=>{o(l)}).catch(()=>{o(ps)})}):c(Error("No reCAPTCHA enterprise script loaded."))}return this.auth.settings.appVerificationDisabledForTesting?new yT().execute("siteKey",{action:"verify"}):new Promise((s,o)=>{n(this.auth).then(c=>{if(!t&&Xd(window.grecaptcha))i(c,s,o);else{if(typeof window>"u"){o(new Error("RecaptchaVerifier is only supported in browser"));return}let u=fT();u.length!==0&&(u+=c),cl(u).then(()=>{i(c,s,o)}).catch(l=>{o(l)})}}).catch(c=>{o(c)})})}}async function Ji(r,e,t,n=!1,i=!1){const s=new Mm(r);let o;if(i)o=ps;else try{o=await s.verify(t)}catch{o=await s.verify(t,!0)}const c={...e};if(t==="mfaSmsEnrollment"||t==="mfaSmsSignIn"){if("phoneEnrollmentInfo"in c){const u=c.phoneEnrollmentInfo.phoneNumber,l=c.phoneEnrollmentInfo.recaptchaToken;Object.assign(c,{phoneEnrollmentInfo:{phoneNumber:u,recaptchaToken:l,captchaResponse:o,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}else if("phoneSignInInfo"in c){const u=c.phoneSignInInfo.recaptchaToken;Object.assign(c,{phoneSignInInfo:{recaptchaToken:u,captchaResponse:o,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}return c}return n?Object.assign(c,{captchaResp:o}):Object.assign(c,{captchaResponse:o}),Object.assign(c,{clientType:"CLIENT_TYPE_WEB"}),Object.assign(c,{recaptchaVersion:"RECAPTCHA_ENTERPRISE"}),c}async function yn(r,e,t,n,i){var s,o;if(i==="EMAIL_PASSWORD_PROVIDER")if((s=r._getRecaptchaConfig())!=null&&s.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")){const c=await Ji(r,e,t,t==="getOobCode");return n(r,c)}else return n(r,e).catch(async c=>{if(c.code==="auth/missing-recaptcha-token"){console.log(`${t} is protected by reCAPTCHA Enterprise for this project. Automatically triggering the reCAPTCHA flow and restarting the flow.`);const u=await Ji(r,e,t,t==="getOobCode");return n(r,u)}else return Promise.reject(c)});else if(i==="PHONE_PROVIDER")if((o=r._getRecaptchaConfig())!=null&&o.isProviderEnabled("PHONE_PROVIDER")){const c=await Ji(r,e,t);return n(r,c).catch(async u=>{var l;if(((l=r._getRecaptchaConfig())==null?void 0:l.getProviderEnforcementState("PHONE_PROVIDER"))==="AUDIT"&&(u.code==="auth/missing-recaptcha-token"||u.code==="auth/invalid-app-credential")){console.log(`Failed to verify with reCAPTCHA Enterprise. Automatically triggering the reCAPTCHA v2 flow to complete the ${t} flow.`);const f=await Ji(r,e,t,!1,!0);return n(r,f)}return Promise.reject(u)})}else{const c=await Ji(r,e,t,!1,!0);return n(r,c)}else return Promise.reject(i+" provider is not supported.")}async function vT(r){const e=ge(r),t=await Am(e,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}),n=new vm(t);e.tenantId==null?e._agentRecaptchaConfig=n:e._tenantRecaptchaConfigs[e.tenantId]=n,n.isAnyProviderEnabled()&&new Mm(e).verify()}function AT(r,e){const t=(e==null?void 0:e.persistence)||[],n=(Array.isArray(t)?t:[t]).map(ot);e!=null&&e.errorMap&&r._updateErrorMap(e.errorMap),r._initializeWithPersistence(n,e==null?void 0:e.popupRedirectResolver)}function bT(r,e,t){const n=ge(r);O(/^https?:\/\//.test(e),n,"invalid-emulator-scheme");const i=!!(t!=null&&t.disableWarnings),s=Lm(e),{host:o,port:c}=RT(e),u=c===null?"":`:${c}`,l={url:`${s}//${o}${u}/`},f=Object.freeze({host:o,port:c,protocol:s.replace(":",""),options:Object.freeze({disableWarnings:i})});if(!n._canInitEmulator){O(n.config.emulator&&n.emulatorConfig,n,"emulator-config-failed"),O(Tn(l,n.config.emulator)&&Tn(f,n.emulatorConfig),n,"emulator-config-failed");return}n.config.emulator=l,n.emulatorConfig=f,n.settings.appVerificationDisabledForTesting=!0,wi(o)?(Yp(`${s}//${o}${u}`),Xp("Auth",!0)):i||ST()}function Lm(r){const e=r.indexOf(":");return e<0?"":r.substr(0,e+1)}function RT(r){const e=Lm(r),t=/(\/\/)?([^?#/]+)/.exec(r.substr(e.length));if(!t)return{host:"",port:null};const n=t[2].split("@").pop()||"",i=/^(\[[^\]]+\])(:|$)/.exec(n);if(i){const s=i[1];return{host:s,port:rf(n.substr(s.length+1))}}else{const[s,o]=n.split(":");return{host:s,port:rf(o)}}}function rf(r){if(!r)return null;const e=Number(r);return isNaN(e)?null:e}function ST(){function r(){const e=document.createElement("p"),t=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",t.position="fixed",t.width="100%",t.backgroundColor="#ffffff",t.border=".1em solid #000000",t.color="#b50000",t.bottom="0px",t.left="0px",t.margin="0px",t.zIndex="10000",t.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",r):r())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vi{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return Dt("not implemented")}_getIdTokenResponse(e){return Dt("not implemented")}_linkToIdToken(e,t){return Dt("not implemented")}_getReauthenticationResolver(e){return Dt("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Fm(r,e){return we(r,"POST","/v1/accounts:resetPassword",Ie(r,e))}async function PT(r,e){return we(r,"POST","/v1/accounts:update",e)}async function CT(r,e){return we(r,"POST","/v1/accounts:signUp",e)}async function kT(r,e){return we(r,"POST","/v1/accounts:update",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function DT(r,e){return Ht(r,"POST","/v1/accounts:signInWithPassword",Ie(r,e))}async function xa(r,e){return we(r,"POST","/v1/accounts:sendOobCode",Ie(r,e))}async function NT(r,e){return xa(r,e)}async function VT(r,e){return xa(r,e)}async function OT(r,e){return xa(r,e)}async function xT(r,e){return xa(r,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function MT(r,e){return Ht(r,"POST","/v1/accounts:signInWithEmailLink",Ie(r,e))}async function LT(r,e){return Ht(r,"POST","/v1/accounts:signInWithEmailLink",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ns extends vi{constructor(e,t,n,i=null){super("password",n),this._email=e,this._password=t,this._tenantId=i}static _fromEmailAndPassword(e,t){return new Ns(e,t,"password")}static _fromEmailAndCode(e,t,n=null){return new Ns(e,t,"emailLink",n)}toJSON(){return{email:this._email,password:this._password,signInMethod:this.signInMethod,tenantId:this._tenantId}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;if(t!=null&&t.email&&(t!=null&&t.password)){if(t.signInMethod==="password")return this._fromEmailAndPassword(t.email,t.password);if(t.signInMethod==="emailLink")return this._fromEmailAndCode(t.email,t.password,t.tenantId)}return null}async _getIdTokenResponse(e){switch(this.signInMethod){case"password":const t={returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return yn(e,t,"signInWithPassword",DT,"EMAIL_PASSWORD_PROVIDER");case"emailLink":return MT(e,{email:this._email,oobCode:this._password});default:Fe(e,"internal-error")}}async _linkToIdToken(e,t){switch(this.signInMethod){case"password":const n={idToken:t,returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return yn(e,n,"signUpPassword",CT,"EMAIL_PASSWORD_PROVIDER");case"emailLink":return LT(e,{idToken:t,email:this._email,oobCode:this._password});default:Fe(e,"internal-error")}}_getReauthenticationResolver(e){return this._getIdTokenResponse(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function zt(r,e){return Ht(r,"POST","/v1/accounts:signInWithIdp",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const FT="http://localhost";class Ft extends vi{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new Ft(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):Fe("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:n,signInMethod:i,...s}=t;if(!n||!i)return null;const o=new Ft(n,i);return o.idToken=s.idToken||void 0,o.accessToken=s.accessToken||void 0,o.secret=s.secret,o.nonce=s.nonce,o.pendingToken=s.pendingToken||null,o}_getIdTokenResponse(e){const t=this.buildRequest();return zt(e,t)}_linkToIdToken(e,t){const n=this.buildRequest();return n.idToken=t,zt(e,n)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,zt(e,t)}buildRequest(){const e={requestUri:FT,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=Ei(t)}return e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function sf(r,e){return we(r,"POST","/v1/accounts:sendVerificationCode",Ie(r,e))}async function UT(r,e){return Ht(r,"POST","/v1/accounts:signInWithPhoneNumber",Ie(r,e))}async function BT(r,e){const t=await Ht(r,"POST","/v1/accounts:signInWithPhoneNumber",Ie(r,e));if(t.temporaryProof)throw ss(r,"account-exists-with-different-credential",t);return t}const qT={USER_NOT_FOUND:"user-not-found"};async function $T(r,e){const t={...e,operation:"REAUTH"};return Ht(r,"POST","/v1/accounts:signInWithPhoneNumber",Ie(r,t),qT)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ar extends vi{constructor(e){super("phone","phone"),this.params=e}static _fromVerification(e,t){return new ar({verificationId:e,verificationCode:t})}static _fromTokenResponse(e,t){return new ar({phoneNumber:e,temporaryProof:t})}_getIdTokenResponse(e){return UT(e,this._makeVerificationRequest())}_linkToIdToken(e,t){return BT(e,{idToken:t,...this._makeVerificationRequest()})}_getReauthenticationResolver(e){return $T(e,this._makeVerificationRequest())}_makeVerificationRequest(){const{temporaryProof:e,phoneNumber:t,verificationId:n,verificationCode:i}=this.params;return e&&t?{temporaryProof:e,phoneNumber:t}:{sessionInfo:n,code:i}}toJSON(){const e={providerId:this.providerId};return this.params.phoneNumber&&(e.phoneNumber=this.params.phoneNumber),this.params.temporaryProof&&(e.temporaryProof=this.params.temporaryProof),this.params.verificationCode&&(e.verificationCode=this.params.verificationCode),this.params.verificationId&&(e.verificationId=this.params.verificationId),e}static fromJSON(e){typeof e=="string"&&(e=JSON.parse(e));const{verificationId:t,verificationCode:n,phoneNumber:i,temporaryProof:s}=e;return!n&&!t&&!i&&!s?null:new ar({verificationId:t,verificationCode:n,phoneNumber:i,temporaryProof:s})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zT(r){switch(r){case"recoverEmail":return"RECOVER_EMAIL";case"resetPassword":return"PASSWORD_RESET";case"signIn":return"EMAIL_SIGNIN";case"verifyEmail":return"VERIFY_EMAIL";case"verifyAndChangeEmail":return"VERIFY_AND_CHANGE_EMAIL";case"revertSecondFactorAddition":return"REVERT_SECOND_FACTOR_ADDITION";default:return null}}function jT(r){const e=jr(is(r)).link,t=e?jr(is(e)).deep_link_id:null,n=jr(is(r)).deep_link_id;return(n?jr(is(n)).link:null)||n||t||e||r}class Ma{constructor(e){const t=jr(is(e)),n=t.apiKey??null,i=t.oobCode??null,s=zT(t.mode??null);O(n&&i&&s,"argument-error"),this.apiKey=n,this.operation=s,this.code=i,this.continueUrl=t.continueUrl??null,this.languageCode=t.lang??null,this.tenantId=t.tenantId??null}static parseLink(e){const t=jT(e);try{return new Ma(t)}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xn{constructor(){this.providerId=xn.PROVIDER_ID}static credential(e,t){return Ns._fromEmailAndPassword(e,t)}static credentialWithLink(e,t){const n=Ma.parseLink(t);return O(n,"argument-error"),Ns._fromEmailAndCode(e,n.code,n.tenantId)}}xn.PROVIDER_ID="password";xn.EMAIL_PASSWORD_SIGN_IN_METHOD="password";xn.EMAIL_LINK_SIGN_IN_METHOD="emailLink";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qt{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ai extends Qt{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}class Kr extends Ai{static credentialFromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;return O("providerId"in t&&"signInMethod"in t,"argument-error"),Ft._fromParams(t)}credential(e){return this._credential({...e,nonce:e.rawNonce})}_credential(e){return O(e.idToken||e.accessToken,"argument-error"),Ft._fromParams({...e,providerId:this.providerId,signInMethod:this.providerId})}static credentialFromResult(e){return Kr.oauthCredentialFromTaggedObject(e)}static credentialFromError(e){return Kr.oauthCredentialFromTaggedObject(e.customData||{})}static oauthCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:n,oauthTokenSecret:i,pendingToken:s,nonce:o,providerId:c}=e;if(!n&&!i&&!t&&!s||!c)return null;try{return new Kr(c)._credential({idToken:t,accessToken:n,nonce:o,pendingToken:s})}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class St extends Ai{constructor(){super("facebook.com")}static credential(e){return Ft._fromParams({providerId:St.PROVIDER_ID,signInMethod:St.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return St.credentialFromTaggedObject(e)}static credentialFromError(e){return St.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return St.credential(e.oauthAccessToken)}catch{return null}}}St.FACEBOOK_SIGN_IN_METHOD="facebook.com";St.PROVIDER_ID="facebook.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pt extends Ai{constructor(){super("google.com"),this.addScope("profile")}static credential(e,t){return Ft._fromParams({providerId:Pt.PROVIDER_ID,signInMethod:Pt.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return Pt.credentialFromTaggedObject(e)}static credentialFromError(e){return Pt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:n}=e;if(!t&&!n)return null;try{return Pt.credential(t,n)}catch{return null}}}Pt.GOOGLE_SIGN_IN_METHOD="google.com";Pt.PROVIDER_ID="google.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ct extends Ai{constructor(){super("github.com")}static credential(e){return Ft._fromParams({providerId:Ct.PROVIDER_ID,signInMethod:Ct.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Ct.credentialFromTaggedObject(e)}static credentialFromError(e){return Ct.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return Ct.credential(e.oauthAccessToken)}catch{return null}}}Ct.GITHUB_SIGN_IN_METHOD="github.com";Ct.PROVIDER_ID="github.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const GT="http://localhost";class ei extends vi{constructor(e,t){super(e,e),this.pendingToken=t}_getIdTokenResponse(e){const t=this.buildRequest();return zt(e,t)}_linkToIdToken(e,t){const n=this.buildRequest();return n.idToken=t,zt(e,n)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,zt(e,t)}toJSON(){return{signInMethod:this.signInMethod,providerId:this.providerId,pendingToken:this.pendingToken}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:n,signInMethod:i,pendingToken:s}=t;return!n||!i||!s||n!==i?null:new ei(n,s)}static _create(e,t){return new ei(e,t)}buildRequest(){return{requestUri:GT,returnSecureToken:!0,pendingToken:this.pendingToken}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const WT="saml.";class ha extends Qt{constructor(e){O(e.startsWith(WT),"argument-error"),super(e)}static credentialFromResult(e){return ha.samlCredentialFromTaggedObject(e)}static credentialFromError(e){return ha.samlCredentialFromTaggedObject(e.customData||{})}static credentialFromJSON(e){const t=ei.fromJSON(e);return O(t,"argument-error"),t}static samlCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{pendingToken:t,providerId:n}=e;if(!t||!n)return null;try{return ei._create(n,t)}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kt extends Ai{constructor(){super("twitter.com")}static credential(e,t){return Ft._fromParams({providerId:kt.PROVIDER_ID,signInMethod:kt.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return kt.credentialFromTaggedObject(e)}static credentialFromError(e){return kt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:n}=e;if(!t||!n)return null;try{return kt.credential(t,n)}catch{return null}}}kt.TWITTER_SIGN_IN_METHOD="twitter.com";kt.PROVIDER_ID="twitter.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Um(r,e){return Ht(r,"POST","/v1/accounts:signUp",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pt{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,n,i=!1){const s=await yt._fromIdTokenResponse(e,n,i),o=of(n);return new pt({user:s,providerId:o,_tokenResponse:n,operationType:t})}static async _forOperation(e,t,n){await e._updateTokensIfNecessary(n,!0);const i=of(n);return new pt({user:e,providerId:i,_tokenResponse:n,operationType:t})}}function of(r){return r.providerId?r.providerId:"phoneNumber"in r?"phone":null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function KT(r){var i;if(de(r.app))return Promise.reject(Oe(r));const e=ge(r);if(await e._initializationPromise,(i=e.currentUser)!=null&&i.isAnonymous)return new pt({user:e.currentUser,providerId:null,operationType:"signIn"});const t=await Um(e,{returnSecureToken:!0}),n=await pt._fromIdTokenResponse(e,"signIn",t,!0);return await e._updateCurrentUser(n.user),n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class da extends Qe{constructor(e,t,n,i){super(t.code,t.message),this.operationType=n,this.user=i,Object.setPrototypeOf(this,da.prototype),this.customData={appName:e.name,tenantId:e.tenantId??void 0,_serverResponse:t.customData._serverResponse,operationType:n}}static _fromErrorAndOperation(e,t,n,i){return new da(e,t,n,i)}}function Bm(r,e,t,n){return(e==="reauthenticate"?t._getReauthenticationResolver(r):t._getIdTokenResponse(r)).catch(s=>{throw s.code==="auth/multi-factor-auth-required"?da._fromErrorAndOperation(r,s,e,n):s})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qm(r){return new Set(r.map(({providerId:e})=>e).filter(e=>!!e))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function HT(r,e){const t=z(r);await La(!0,t,e);const{providerUserInfo:n}=await QE(t.auth,{idToken:await t.getIdToken(),deleteProvider:[e]}),i=qm(n||[]);return t.providerData=t.providerData.filter(s=>i.has(s.providerId)),i.has("phone")||(t.phoneNumber=null),await t.auth._persistUserIfCurrent(t),t}async function ul(r,e,t=!1){const n=await Gt(r,e._linkToIdToken(r.auth,await r.getIdToken()),t);return pt._forOperation(r,"link",n)}async function La(r,e,t){await Ds(e);const n=qm(e.providerData),i=r===!1?"provider-already-linked":"no-such-provider";O(n.has(t)===r,e.auth,i)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function $m(r,e,t=!1){const{auth:n}=r;if(de(n.app))return Promise.reject(Oe(n));const i="reauthenticate";try{const s=await Gt(r,Bm(n,i,e,r),t);O(s.idToken,n,"internal-error");const o=Oa(s.idToken);O(o,n,"internal-error");const{sub:c}=o;return O(r.uid===c,n,"user-mismatch"),pt._forOperation(r,i,s)}catch(s){throw(s==null?void 0:s.code)==="auth/user-not-found"&&Fe(n,"user-mismatch"),s}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function zm(r,e,t=!1){if(de(r.app))return Promise.reject(Oe(r));const n="signIn",i=await Bm(r,n,e),s=await pt._fromIdTokenResponse(r,n,i);return t||await r._updateCurrentUser(s.user),s}async function Fa(r,e){return zm(ge(r),e)}async function jm(r,e){const t=z(r);return await La(!1,t,e.providerId),ul(t,e)}async function Gm(r,e){return $m(z(r),e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function QT(r,e){return Ht(r,"POST","/v1/accounts:signInWithCustomToken",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function JT(r,e){if(de(r.app))return Promise.reject(Oe(r));const t=ge(r),n=await QT(t,{token:e,returnSecureToken:!0}),i=await pt._fromIdTokenResponse(t,"signIn",n);return await t._updateCurrentUser(i.user),i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ro{constructor(e,t){this.factorId=e,this.uid=t.mfaEnrollmentId,this.enrollmentTime=new Date(t.enrolledAt).toUTCString(),this.displayName=t.displayName}static _fromServerResponse(e,t){return"phoneInfo"in t?ll._fromServerResponse(e,t):"totpInfo"in t?hl._fromServerResponse(e,t):Fe(e,"internal-error")}}class ll extends ro{constructor(e){super("phone",e),this.phoneNumber=e.phoneInfo}static _fromServerResponse(e,t){return new ll(t)}}class hl extends ro{constructor(e){super("totp",e)}static _fromServerResponse(e,t){return new hl(t)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ua(r,e,t){var n;O(((n=t.url)==null?void 0:n.length)>0,r,"invalid-continue-uri"),O(typeof t.dynamicLinkDomain>"u"||t.dynamicLinkDomain.length>0,r,"invalid-dynamic-link-domain"),O(typeof t.linkDomain>"u"||t.linkDomain.length>0,r,"invalid-hosting-link-domain"),e.continueUrl=t.url,e.dynamicLinkDomain=t.dynamicLinkDomain,e.linkDomain=t.linkDomain,e.canHandleCodeInApp=t.handleCodeInApp,t.iOS&&(O(t.iOS.bundleId.length>0,r,"missing-ios-bundle-id"),e.iOSBundleId=t.iOS.bundleId),t.android&&(O(t.android.packageName.length>0,r,"missing-android-pkg-name"),e.androidInstallApp=t.android.installApp,e.androidMinimumVersionCode=t.android.minimumVersion,e.androidPackageName=t.android.packageName)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function dl(r){const e=ge(r);e._getPasswordPolicyInternal()&&await e._updatePasswordPolicy()}async function YT(r,e,t){const n=ge(r),i={requestType:"PASSWORD_RESET",email:e,clientType:"CLIENT_TYPE_WEB"};t&&Ua(n,i,t),await yn(n,i,"getOobCode",VT,"EMAIL_PASSWORD_PROVIDER")}async function XT(r,e,t){await Fm(z(r),{oobCode:e,newPassword:t}).catch(async n=>{throw n.code==="auth/password-does-not-meet-requirements"&&dl(r),n})}async function ZT(r,e){await kT(z(r),{oobCode:e})}async function Wm(r,e){const t=z(r),n=await Fm(t,{oobCode:e}),i=n.requestType;switch(O(i,t,"internal-error"),i){case"EMAIL_SIGNIN":break;case"VERIFY_AND_CHANGE_EMAIL":O(n.newEmail,t,"internal-error");break;case"REVERT_SECOND_FACTOR_ADDITION":O(n.mfaInfo,t,"internal-error");default:O(n.email,t,"internal-error")}let s=null;return n.mfaInfo&&(s=ro._fromServerResponse(ge(t),n.mfaInfo)),{data:{email:(n.requestType==="VERIFY_AND_CHANGE_EMAIL"?n.newEmail:n.email)||null,previousEmail:(n.requestType==="VERIFY_AND_CHANGE_EMAIL"?n.email:n.newEmail)||null,multiFactorInfo:s},operation:i}}async function ev(r,e){const{data:t}=await Wm(z(r),e);return t.email}async function tv(r,e,t){if(de(r.app))return Promise.reject(Oe(r));const n=ge(r),o=await yn(n,{returnSecureToken:!0,email:e,password:t,clientType:"CLIENT_TYPE_WEB"},"signUpPassword",Um,"EMAIL_PASSWORD_PROVIDER").catch(u=>{throw u.code==="auth/password-does-not-meet-requirements"&&dl(r),u}),c=await pt._fromIdTokenResponse(n,"signIn",o);return await n._updateCurrentUser(c.user),c}function nv(r,e,t){return de(r.app)?Promise.reject(Oe(r)):Fa(z(r),xn.credential(e,t)).catch(async n=>{throw n.code==="auth/password-does-not-meet-requirements"&&dl(r),n})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function rv(r,e,t){const n=ge(r),i={requestType:"EMAIL_SIGNIN",email:e,clientType:"CLIENT_TYPE_WEB"};function s(o,c){O(c.handleCodeInApp,n,"argument-error"),c&&Ua(n,o,c)}s(i,t),await yn(n,i,"getOobCode",OT,"EMAIL_PASSWORD_PROVIDER")}function iv(r,e){const t=Ma.parseLink(e);return(t==null?void 0:t.operation)==="EMAIL_SIGNIN"}async function sv(r,e,t){if(de(r.app))return Promise.reject(Oe(r));const n=z(r),i=xn.credentialWithLink(e,t||ks());return O(i._tenantId===(n.tenantId||null),n,"tenant-id-mismatch"),Fa(n,i)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ov(r,e){return we(r,"POST","/v1/accounts:createAuthUri",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function av(r,e){const t=ol()?ks():"http://localhost",n={identifier:e,continueUri:t},{signinMethods:i}=await ov(z(r),n);return i||[]}async function cv(r,e){const t=z(r),i={requestType:"VERIFY_EMAIL",idToken:await r.getIdToken()};e&&Ua(t.auth,i,e);const{email:s}=await NT(t.auth,i);s!==r.email&&await r.reload()}async function uv(r,e,t){const n=z(r),s={requestType:"VERIFY_AND_CHANGE_EMAIL",idToken:await r.getIdToken(),newEmail:e};t&&Ua(n.auth,s,t);const{email:o}=await xT(n.auth,s);o!==r.email&&await r.reload()}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function lv(r,e){return we(r,"POST","/v1/accounts:update",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function hv(r,{displayName:e,photoURL:t}){if(e===void 0&&t===void 0)return;const n=z(r),s={idToken:await n.getIdToken(),displayName:e,photoUrl:t,returnSecureToken:!0},o=await Gt(n,lv(n.auth,s));n.displayName=o.displayName||null,n.photoURL=o.photoUrl||null;const c=n.providerData.find(({providerId:u})=>u==="password");c&&(c.displayName=n.displayName,c.photoURL=n.photoURL),await n._updateTokensIfNecessary(o)}function dv(r,e){const t=z(r);return de(t.auth.app)?Promise.reject(Oe(t.auth)):Km(t,e,null)}function fv(r,e){return Km(z(r),null,e)}async function Km(r,e,t){const{auth:n}=r,s={idToken:await r.getIdToken(),returnSecureToken:!0};e&&(s.email=e),t&&(s.password=t);const o=await Gt(r,PT(n,s));await r._updateTokensIfNecessary(o,!0)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pv(r){var i,s;if(!r)return null;const{providerId:e}=r,t=r.rawUserInfo?JSON.parse(r.rawUserInfo):{},n=r.isNewUser||r.kind==="identitytoolkit#SignupNewUserResponse";if(!e&&(r!=null&&r.idToken)){const o=(s=(i=Oa(r.idToken))==null?void 0:i.firebase)==null?void 0:s.sign_in_provider;if(o){const c=o!=="anonymous"&&o!=="custom"?o:null;return new Hr(n,c)}}if(!e)return null;switch(e){case"facebook.com":return new mv(n,t);case"github.com":return new gv(n,t);case"google.com":return new _v(n,t);case"twitter.com":return new yv(n,t,r.screenName||null);case"custom":case"anonymous":return new Hr(n,null);default:return new Hr(n,e,t)}}class Hr{constructor(e,t,n={}){this.isNewUser=e,this.providerId=t,this.profile=n}}class Hm extends Hr{constructor(e,t,n,i){super(e,t,n),this.username=i}}class mv extends Hr{constructor(e,t){super(e,"facebook.com",t)}}class gv extends Hm{constructor(e,t){super(e,"github.com",t,typeof(t==null?void 0:t.login)=="string"?t==null?void 0:t.login:null)}}class _v extends Hr{constructor(e,t){super(e,"google.com",t)}}class yv extends Hm{constructor(e,t,n){super(e,"twitter.com",t,n)}}function Iv(r){const{user:e,_tokenResponse:t}=r;return e.isAnonymous&&!t?{providerId:null,isNewUser:!1,profile:null}:pv(t)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nr{constructor(e,t,n){this.type=e,this.credential=t,this.user=n}static _fromIdtoken(e,t){return new nr("enroll",e,t)}static _fromMfaPendingCredential(e){return new nr("signin",e)}toJSON(){return{multiFactorSession:{[this.type==="enroll"?"idToken":"pendingCredential"]:this.credential}}}static fromJSON(e){var t,n;if(e!=null&&e.multiFactorSession){if((t=e.multiFactorSession)!=null&&t.pendingCredential)return nr._fromMfaPendingCredential(e.multiFactorSession.pendingCredential);if((n=e.multiFactorSession)!=null&&n.idToken)return nr._fromIdtoken(e.multiFactorSession.idToken)}return null}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fl{constructor(e,t,n){this.session=e,this.hints=t,this.signInResolver=n}static _fromError(e,t){const n=ge(e),i=t.customData._serverResponse,s=(i.mfaInfo||[]).map(c=>ro._fromServerResponse(n,c));O(i.mfaPendingCredential,n,"internal-error");const o=nr._fromMfaPendingCredential(i.mfaPendingCredential);return new fl(o,s,async c=>{const u=await c._process(n,o);delete i.mfaInfo,delete i.mfaPendingCredential;const l={...i,idToken:u.idToken,refreshToken:u.refreshToken};switch(t.operationType){case"signIn":const f=await pt._fromIdTokenResponse(n,t.operationType,l);return await n._updateCurrentUser(f.user),f;case"reauthenticate":return O(t.user,n,"internal-error"),pt._forOperation(t.user,t.operationType,l);default:Fe(n,"internal-error")}})}async resolveSignIn(e){const t=e;return this.signInResolver(t)}}function wv(r,e){var i;const t=z(r),n=e;return O(e.customData.operationType,t,"argument-error"),O((i=n.customData._serverResponse)==null?void 0:i.mfaPendingCredential,t,"argument-error"),fl._fromError(t,n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function af(r,e){return we(r,"POST","/v2/accounts/mfaEnrollment:start",Ie(r,e))}function Ev(r,e){return we(r,"POST","/v2/accounts/mfaEnrollment:finalize",Ie(r,e))}function Tv(r,e){return we(r,"POST","/v2/accounts/mfaEnrollment:withdraw",Ie(r,e))}class pl{constructor(e){this.user=e,this.enrolledFactors=[],e._onReload(t=>{t.mfaInfo&&(this.enrolledFactors=t.mfaInfo.map(n=>ro._fromServerResponse(e.auth,n)))})}static _fromUser(e){return new pl(e)}async getSession(){return nr._fromIdtoken(await this.user.getIdToken(),this.user)}async enroll(e,t){const n=e,i=await this.getSession(),s=await Gt(this.user,n._process(this.user.auth,i,t));return await this.user._updateTokensIfNecessary(s),this.user.reload()}async unenroll(e){const t=typeof e=="string"?e:e.uid,n=await this.user.getIdToken();try{const i=await Gt(this.user,Tv(this.user.auth,{idToken:n,mfaEnrollmentId:t}));this.enrolledFactors=this.enrolledFactors.filter(({uid:s})=>s!==t),await this.user._updateTokensIfNecessary(i),await this.user.reload()}catch(i){throw i}}}const Kc=new WeakMap;function vv(r){const e=z(r);return Kc.has(e)||Kc.set(e,pl._fromUser(e)),Kc.get(e)}const fa="__sak";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qm{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(fa,"1"),this.storage.removeItem(fa),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Av=1e3,bv=10;class Jm extends Qm{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=Vm(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const n=this.storage.getItem(t),i=this.localCache[t];n!==i&&e(t,i,n)}}onStorageEvent(e,t=!1){if(!e.key){this.forAllChangedKeys((o,c,u)=>{this.notifyListeners(o,u)});return}const n=e.key;t?this.detachListener():this.stopPolling();const i=()=>{const o=this.storage.getItem(n);!t&&this.localCache[n]===o||this.notifyListeners(n,o)},s=this.storage.getItem(n);sT()&&s!==e.newValue&&e.newValue!==e.oldValue?setTimeout(i,bv):i()}notifyListeners(e,t){this.localCache[e]=t;const n=this.listeners[e];if(n)for(const i of Array.from(n))i(t&&JSON.parse(t))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,n)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:t,newValue:n}),!0)})},Av)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,t){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}Jm.type="LOCAL";const ml=Jm;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ym extends Qm{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}Ym.type="SESSION";const lr=Ym;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Rv(r){return Promise.all(r.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(t){return{fulfilled:!1,reason:t}}}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ba{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(i=>i.isListeningto(e));if(t)return t;const n=new Ba(e);return this.receivers.push(n),n}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:n,eventType:i,data:s}=t.data,o=this.handlersMap[i];if(!(o!=null&&o.size))return;t.ports[0].postMessage({status:"ack",eventId:n,eventType:i});const c=Array.from(o).map(async l=>l(t.origin,s)),u=await Rv(c);t.ports[0].postMessage({status:"done",eventId:n,eventType:i,response:u})}_subscribe(e,t){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),(!t||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}Ba.receivers=[];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function io(r="",e=10){let t="";for(let n=0;n<e;n++)t+=Math.floor(Math.random()*10);return r+t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sv{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,n=50){const i=typeof MessageChannel<"u"?new MessageChannel:null;if(!i)throw new Error("connection_unavailable");let s,o;return new Promise((c,u)=>{const l=io("",20);i.port1.start();const f=setTimeout(()=>{u(new Error("unsupported_event"))},n);o={messageChannel:i,onMessage(p){const g=p;if(g.data.eventId===l)switch(g.data.status){case"ack":clearTimeout(f),s=setTimeout(()=>{u(new Error("timeout"))},3e3);break;case"done":clearTimeout(s),c(g.data.response);break;default:clearTimeout(f),clearTimeout(s),u(new Error("invalid_response"));break}}},this.handlers.add(o),i.port1.addEventListener("message",o.onMessage),this.target.postMessage({eventType:e,eventId:l,data:t},[i.port2])}).finally(()=>{o&&this.removeMessageHandler(o)})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function be(){return window}function Pv(r){be().location.href=r}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gl(){return typeof be().WorkerGlobalScope<"u"&&typeof be().importScripts=="function"}async function Cv(){if(!(navigator!=null&&navigator.serviceWorker))return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function kv(){var r;return((r=navigator==null?void 0:navigator.serviceWorker)==null?void 0:r.controller)||null}function Dv(){return gl()?self:null}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xm="firebaseLocalStorageDb",Nv=1,pa="firebaseLocalStorage",Zm="fbase_key";class so{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{t(this.request.error)})})}}function qa(r,e){return r.transaction([pa],e?"readwrite":"readonly").objectStore(pa)}function Vv(){const r=indexedDB.deleteDatabase(Xm);return new so(r).toPromise()}function hu(){const r=indexedDB.open(Xm,Nv);return new Promise((e,t)=>{r.addEventListener("error",()=>{t(r.error)}),r.addEventListener("upgradeneeded",()=>{const n=r.result;try{n.createObjectStore(pa,{keyPath:Zm})}catch(i){t(i)}}),r.addEventListener("success",async()=>{const n=r.result;n.objectStoreNames.contains(pa)?e(n):(n.close(),await Vv(),e(await hu()))})})}async function cf(r,e,t){const n=qa(r,!0).put({[Zm]:e,value:t});return new so(n).toPromise()}async function Ov(r,e){const t=qa(r,!1).get(e),n=await new so(t).toPromise();return n===void 0?null:n.value}function uf(r,e){const t=qa(r,!0).delete(e);return new so(t).toPromise()}const xv=800,Mv=3;class eg{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db?this.db:(this.db=await hu(),this.db)}async _withRetries(e){let t=0;for(;;)try{const n=await this._openDb();return await e(n)}catch(n){if(t++>Mv)throw n;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return gl()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=Ba._getInstance(Dv()),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){var t,n;if(this.activeServiceWorker=await Cv(),!this.activeServiceWorker)return;this.sender=new Sv(this.activeServiceWorker);const e=await this.sender._send("ping",{},800);e&&(t=e[0])!=null&&t.fulfilled&&(n=e[0])!=null&&n.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||kv()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await hu();return await cf(e,fa,"1"),await uf(e,fa),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(n=>cf(n,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(n=>Ov(n,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>uf(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(i=>{const s=qa(i,!1).getAll();return new so(s).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const t=[],n=new Set;if(e.length!==0)for(const{fbase_key:i,value:s}of e)n.add(i),JSON.stringify(this.localCache[i])!==JSON.stringify(s)&&(this.notifyListeners(i,s),t.push(i));for(const i of Object.keys(this.localCache))this.localCache[i]&&!n.has(i)&&(this.notifyListeners(i,null),t.push(i));return t}notifyListeners(e,t){this.localCache[e]=t;const n=this.listeners[e];if(n)for(const i of Array.from(n))i(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),xv)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}eg.type="LOCAL";const Vs=eg;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function lf(r,e){return we(r,"POST","/v2/accounts/mfaSignIn:start",Ie(r,e))}function Lv(r,e){return we(r,"POST","/v2/accounts/mfaSignIn:finalize",Ie(r,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hc=xm("rcb"),Fv=new Zs(3e4,6e4);class Uv{constructor(){var e;this.hostLanguage="",this.counter=0,this.librarySeparatelyLoaded=!!((e=be().grecaptcha)!=null&&e.render)}load(e,t=""){return O(Bv(t),e,"argument-error"),this.shouldResolveImmediately(t)&&Yd(be().grecaptcha)?Promise.resolve(be().grecaptcha):new Promise((n,i)=>{const s=be().setTimeout(()=>{i(Ce(e,"network-request-failed"))},Fv.get());be()[Hc]=()=>{be().clearTimeout(s),delete be()[Hc];const c=be().grecaptcha;if(!c||!Yd(c)){i(Ce(e,"internal-error"));return}const u=c.render;c.render=(l,f)=>{const p=u(l,f);return this.counter++,p},this.hostLanguage=t,n(c)};const o=`${dT()}?${Ei({onload:Hc,render:"explicit",hl:t})}`;cl(o).catch(()=>{clearTimeout(s),i(Ce(e,"internal-error"))})})}clearedOneInstance(){this.counter--}shouldResolveImmediately(e){var t;return!!((t=be().grecaptcha)!=null&&t.render)&&(e===this.hostLanguage||this.counter>0||this.librarySeparatelyLoaded)}}function Bv(r){return r.length<=6&&/^\s*[a-zA-Z0-9\-]*\s*$/.test(r)}class qv{async load(e){return new _T(e)}clearedOneInstance(){}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ms="recaptcha",$v={theme:"light",type:"image"};let zv=class{constructor(e,t,n={...$v}){this.parameters=n,this.type=ms,this.destroyed=!1,this.widgetId=null,this.tokenChangeListeners=new Set,this.renderPromise=null,this.recaptcha=null,this.auth=ge(e),this.isInvisible=this.parameters.size==="invisible",O(typeof document<"u",this.auth,"operation-not-supported-in-this-environment");const i=typeof t=="string"?document.getElementById(t):t;O(i,this.auth,"argument-error"),this.container=i,this.parameters.callback=this.makeTokenCallback(this.parameters.callback),this._recaptchaLoader=this.auth.settings.appVerificationDisabledForTesting?new qv:new Uv,this.validateStartingState()}async verify(){this.assertNotDestroyed();const e=await this.render(),t=this.getAssertedRecaptcha(),n=t.getResponse(e);return n||new Promise(i=>{const s=o=>{o&&(this.tokenChangeListeners.delete(s),i(o))};this.tokenChangeListeners.add(s),this.isInvisible&&t.execute(e)})}render(){try{this.assertNotDestroyed()}catch(e){return Promise.reject(e)}return this.renderPromise?this.renderPromise:(this.renderPromise=this.makeRenderPromise().catch(e=>{throw this.renderPromise=null,e}),this.renderPromise)}_reset(){this.assertNotDestroyed(),this.widgetId!==null&&this.getAssertedRecaptcha().reset(this.widgetId)}clear(){this.assertNotDestroyed(),this.destroyed=!0,this._recaptchaLoader.clearedOneInstance(),this.isInvisible||this.container.childNodes.forEach(e=>{this.container.removeChild(e)})}validateStartingState(){O(!this.parameters.sitekey,this.auth,"argument-error"),O(this.isInvisible||!this.container.hasChildNodes(),this.auth,"argument-error"),O(typeof document<"u",this.auth,"operation-not-supported-in-this-environment")}makeTokenCallback(e){return t=>{if(this.tokenChangeListeners.forEach(n=>n(t)),typeof e=="function")e(t);else if(typeof e=="string"){const n=be()[e];typeof n=="function"&&n(t)}}}assertNotDestroyed(){O(!this.destroyed,this.auth,"internal-error")}async makeRenderPromise(){if(await this.init(),!this.widgetId){let e=this.container;if(!this.isInvisible){const t=document.createElement("div");e.appendChild(t),e=t}this.widgetId=this.getAssertedRecaptcha().render(e,this.parameters)}return this.widgetId}async init(){O(ol()&&!gl(),this.auth,"internal-error"),await jv(),this.recaptcha=await this._recaptchaLoader.load(this.auth,this.auth.languageCode||void 0);const e=await KE(this.auth);O(e,this.auth,"internal-error"),this.parameters.sitekey=e}getAssertedRecaptcha(){return O(this.recaptcha,this.auth,"internal-error"),this.recaptcha}};function jv(){let r=null;return new Promise(e=>{if(document.readyState==="complete"){e();return}r=()=>e(),window.addEventListener("load",r)}).catch(e=>{throw r&&window.removeEventListener("load",r),e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _l{constructor(e,t){this.verificationId=e,this.onConfirmation=t}confirm(e){const t=ar._fromVerification(this.verificationId,e);return this.onConfirmation(t)}}async function Gv(r,e,t){if(de(r.app))return Promise.reject(Oe(r));const n=ge(r),i=await $a(n,e,z(t));return new _l(i,s=>Fa(n,s))}async function Wv(r,e,t){const n=z(r);await La(!1,n,"phone");const i=await $a(n.auth,e,z(t));return new _l(i,s=>jm(n,s))}async function Kv(r,e,t){const n=z(r);if(de(n.auth.app))return Promise.reject(Oe(n.auth));const i=await $a(n.auth,e,z(t));return new _l(i,s=>Gm(n,s))}async function $a(r,e,t){var n;if(!r._getRecaptchaConfig())try{await vT(r)}catch{console.log("Failed to initialize reCAPTCHA Enterprise config. Triggering the reCAPTCHA v2 verification.")}try{let i;if(typeof e=="string"?i={phoneNumber:e}:i=e,"session"in i){const s=i.session;if("phoneNumber"in i){O(s.type==="enroll",r,"internal-error");const o={idToken:s.credential,phoneEnrollmentInfo:{phoneNumber:i.phoneNumber,clientType:"CLIENT_TYPE_WEB"}};return(await yn(r,o,"mfaSmsEnrollment",async(f,p)=>{if(p.phoneEnrollmentInfo.captchaResponse===ps){O((t==null?void 0:t.type)===ms,f,"argument-error");const g=await Qc(f,p,t);return af(f,g)}return af(f,p)},"PHONE_PROVIDER").catch(f=>Promise.reject(f))).phoneSessionInfo.sessionInfo}else{O(s.type==="signin",r,"internal-error");const o=((n=i.multiFactorHint)==null?void 0:n.uid)||i.multiFactorUid;O(o,r,"missing-multi-factor-info");const c={mfaPendingCredential:s.credential,mfaEnrollmentId:o,phoneSignInInfo:{clientType:"CLIENT_TYPE_WEB"}};return(await yn(r,c,"mfaSmsSignIn",async(p,g)=>{if(g.phoneSignInInfo.captchaResponse===ps){O((t==null?void 0:t.type)===ms,p,"argument-error");const v=await Qc(p,g,t);return lf(p,v)}return lf(p,g)},"PHONE_PROVIDER").catch(p=>Promise.reject(p))).phoneResponseInfo.sessionInfo}}else{const s={phoneNumber:i.phoneNumber,clientType:"CLIENT_TYPE_WEB"};return(await yn(r,s,"sendVerificationCode",async(l,f)=>{if(f.captchaResponse===ps){O((t==null?void 0:t.type)===ms,l,"argument-error");const p=await Qc(l,f,t);return sf(l,p)}return sf(l,f)},"PHONE_PROVIDER").catch(l=>Promise.reject(l))).sessionInfo}}finally{t==null||t._reset()}}async function Hv(r,e){const t=z(r);if(de(t.auth.app))return Promise.reject(Oe(t.auth));await ul(t,e)}async function Qc(r,e,t){O(t.type===ms,r,"argument-error");const n=await t.verify();O(typeof n=="string",r,"argument-error");const i={...e};if("phoneEnrollmentInfo"in i){const s=i.phoneEnrollmentInfo.phoneNumber,o=i.phoneEnrollmentInfo.captchaResponse,c=i.phoneEnrollmentInfo.clientType,u=i.phoneEnrollmentInfo.recaptchaVersion;return Object.assign(i,{phoneEnrollmentInfo:{phoneNumber:s,recaptchaToken:n,captchaResponse:o,clientType:c,recaptchaVersion:u}}),i}else if("phoneSignInInfo"in i){const s=i.phoneSignInInfo.captchaResponse,o=i.phoneSignInInfo.clientType,c=i.phoneSignInInfo.recaptchaVersion;return Object.assign(i,{phoneSignInInfo:{recaptchaToken:n,captchaResponse:s,clientType:o,recaptchaVersion:c}}),i}else return Object.assign(i,{recaptchaToken:n}),i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let hr=class Wo{constructor(e){this.providerId=Wo.PROVIDER_ID,this.auth=ge(e)}verifyPhoneNumber(e,t){return $a(this.auth,e,z(t))}static credential(e,t){return ar._fromVerification(e,t)}static credentialFromResult(e){const t=e;return Wo.credentialFromTaggedObject(t)}static credentialFromError(e){return Wo.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{phoneNumber:t,temporaryProof:n}=e;return t&&n?ar._fromTokenResponse(t,n):null}};hr.PROVIDER_ID="phone";hr.PHONE_SIGN_IN_METHOD="phone";/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vr(r,e){return e?ot(e):(O(r._popupRedirectResolver,r,"argument-error"),r._popupRedirectResolver)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yl extends vi{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return zt(e,this._buildIdpRequest())}_linkToIdToken(e,t){return zt(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return zt(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function Qv(r){return zm(r.auth,new yl(r),r.bypassAuthState)}function Jv(r){const{auth:e,user:t}=r;return O(t,e,"internal-error"),$m(t,new yl(r),r.bypassAuthState)}async function Yv(r){const{auth:e,user:t}=r;return O(t,e,"internal-error"),ul(t,new yl(r),r.bypassAuthState)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tg{constructor(e,t,n,i,s=!1){this.auth=e,this.resolver=n,this.user=i,this.bypassAuthState=s,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(n){this.reject(n)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:n,postBody:i,tenantId:s,error:o,type:c}=e;if(o){this.reject(o);return}const u={auth:this.auth,requestUri:t,sessionId:n,tenantId:s||void 0,postBody:i||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(c)(u))}catch(l){this.reject(l)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return Qv;case"linkViaPopup":case"linkViaRedirect":return Yv;case"reauthViaPopup":case"reauthViaRedirect":return Jv;default:Fe(this.auth,"internal-error")}}resolve(e){Tt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){Tt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xv=new Zs(2e3,1e4);async function Zv(r,e,t){if(de(r.app))return Promise.reject(Ce(r,"operation-not-supported-in-this-environment"));const n=ge(r);Ti(r,e,Qt);const i=vr(n,t);return new qt(n,"signInViaPopup",e,i).executeNotNull()}async function eA(r,e,t){const n=z(r);if(de(n.auth.app))return Promise.reject(Ce(n.auth,"operation-not-supported-in-this-environment"));Ti(n.auth,e,Qt);const i=vr(n.auth,t);return new qt(n.auth,"reauthViaPopup",e,i,n).executeNotNull()}async function tA(r,e,t){const n=z(r);Ti(n.auth,e,Qt);const i=vr(n.auth,t);return new qt(n.auth,"linkViaPopup",e,i,n).executeNotNull()}class qt extends tg{constructor(e,t,n,i,s){super(e,t,i,s),this.provider=n,this.authWindow=null,this.pollId=null,qt.currentPopupAction&&qt.currentPopupAction.cancel(),qt.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return O(e,this.auth,"internal-error"),e}async onExecution(){Tt(this.filter.length===1,"Popup operations only handle one event");const e=io();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(t=>{this.reject(t)}),this.resolver._isIframeWebStorageSupported(this.auth,t=>{t||this.reject(Ce(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)==null?void 0:e.associatedEvent)||null}cancel(){this.reject(Ce(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,qt.currentPopupAction=null}pollUserCancellation(){const e=()=>{var t,n;if((n=(t=this.authWindow)==null?void 0:t.window)!=null&&n.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(Ce(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,Xv.get())};e()}}qt.currentPopupAction=null;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nA="pendingRedirect",gs=new Map;class rA extends tg{constructor(e,t,n=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,n),this.eventId=null}async execute(){let e=gs.get(this.auth._key());if(!e){try{const n=await iA(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(n)}catch(t){e=()=>Promise.reject(t)}gs.set(this.auth._key(),e)}return this.bypassAuthState||gs.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function iA(r,e){const t=rg(e),n=ng(r);if(!await n._isAvailable())return!1;const i=await n._get(t)==="true";return await n._remove(t),i}async function Il(r,e){return ng(r)._set(rg(e),"true")}function sA(){gs.clear()}function wl(r,e){gs.set(r._key(),e)}function ng(r){return ot(r._redirectPersistence)}function rg(r){return or(nA,r.config.apiKey,r.name)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oA(r,e,t){return aA(r,e,t)}async function aA(r,e,t){if(de(r.app))return Promise.reject(Oe(r));const n=ge(r);Ti(r,e,Qt),await n._initializationPromise;const i=vr(n,t);return await Il(i,n),i._openRedirect(n,e,"signInViaRedirect")}function cA(r,e,t){return uA(r,e,t)}async function uA(r,e,t){const n=z(r);if(Ti(n.auth,e,Qt),de(n.auth.app))return Promise.reject(Oe(n.auth));await n.auth._initializationPromise;const i=vr(n.auth,t);await Il(i,n.auth);const s=await ig(n);return i._openRedirect(n.auth,e,"reauthViaRedirect",s)}function lA(r,e,t){return hA(r,e,t)}async function hA(r,e,t){const n=z(r);Ti(n.auth,e,Qt),await n.auth._initializationPromise;const i=vr(n.auth,t);await La(!1,n,e.providerId),await Il(i,n.auth);const s=await ig(n);return i._openRedirect(n.auth,e,"linkViaRedirect",s)}async function dA(r,e){return await ge(r)._initializationPromise,za(r,e,!1)}async function za(r,e,t=!1){if(de(r.app))return Promise.reject(Oe(r));const n=ge(r),i=vr(n,e),o=await new rA(n,i,t).execute();return o&&!t&&(delete o.user._redirectEventId,await n._persistUserIfCurrent(o.user),await n._setRedirectUser(null,e)),o}async function ig(r){const e=io(`${r.uid}:::`);return r._redirectEventId=e,await r.auth._setRedirectUser(r),await r.auth._persistUserIfCurrent(r),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fA=10*60*1e3;class sg{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(n=>{this.isEventForConsumer(e,n)&&(t=!0,this.sendToConsumer(e,n),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!pA(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){var n;if(e.error&&!og(e)){const i=((n=e.error.code)==null?void 0:n.split("auth/")[1])||"internal-error";t.onError(Ce(this.auth,i))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const n=t.eventId===null||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&n}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=fA&&this.cachedEventUids.clear(),this.cachedEventUids.has(hf(e))}saveEventToCache(e){this.cachedEventUids.add(hf(e)),this.lastProcessedEventTime=Date.now()}}function hf(r){return[r.type,r.eventId,r.sessionId,r.tenantId].filter(e=>e).join("-")}function og({type:r,error:e}){return r==="unknown"&&(e==null?void 0:e.code)==="auth/no-auth-event"}function pA(r){switch(r.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return og(r);default:return!1}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ag(r,e={}){return we(r,"GET","/v1/projects",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mA=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,gA=/^https?/;async function _A(r){if(r.config.emulator)return;const{authorizedDomains:e}=await ag(r);for(const t of e)try{if(yA(t))return}catch{}Fe(r,"unauthorized-domain")}function yA(r){const e=ks(),{protocol:t,hostname:n}=new URL(e);if(r.startsWith("chrome-extension://")){const o=new URL(r);return o.hostname===""&&n===""?t==="chrome-extension:"&&r.replace("chrome-extension://","")===e.replace("chrome-extension://",""):t==="chrome-extension:"&&o.hostname===n}if(!gA.test(t))return!1;if(mA.test(r))return n===r;const i=r.replace(/\./g,"\\.");return new RegExp("^(.+\\."+i+"|"+i+")$","i").test(n)}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const IA=new Zs(3e4,6e4);function df(){const r=be().___jsl;if(r!=null&&r.H){for(const e of Object.keys(r.H))if(r.H[e].r=r.H[e].r||[],r.H[e].L=r.H[e].L||[],r.H[e].r=[...r.H[e].L],r.CP)for(let t=0;t<r.CP.length;t++)r.CP[t]=null}}function wA(r){return new Promise((e,t)=>{var i,s,o;function n(){df(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{df(),t(Ce(r,"network-request-failed"))},timeout:IA.get()})}if((s=(i=be().gapi)==null?void 0:i.iframes)!=null&&s.Iframe)e(gapi.iframes.getContext());else if((o=be().gapi)!=null&&o.load)n();else{const c=xm("iframefcb");return be()[c]=()=>{gapi.load?n():t(Ce(r,"network-request-failed"))},cl(`${pT()}?onload=${c}`).catch(u=>t(u))}}).catch(e=>{throw Ko=null,e})}let Ko=null;function EA(r){return Ko=Ko||wA(r),Ko}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const TA=new Zs(5e3,15e3),vA="__/auth/iframe",AA="emulator/auth/iframe",bA={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},RA=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function SA(r){const e=r.config;O(e.authDomain,r,"auth-domain-config-required");const t=e.emulator?al(e,AA):`https://${r.config.authDomain}/${vA}`,n={apiKey:e.apiKey,appName:r.name,v:On},i=RA.get(r.config.apiHost);i&&(n.eid=i);const s=r._getFrameworks();return s.length&&(n.fw=s.join(",")),`${t}?${Ei(n).slice(1)}`}async function PA(r){const e=await EA(r),t=be().gapi;return O(t,r,"internal-error"),e.open({where:document.body,url:SA(r),messageHandlersFilter:t.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:bA,dontclear:!0},n=>new Promise(async(i,s)=>{await n.restyle({setHideOnLeave:!1});const o=Ce(r,"network-request-failed"),c=be().setTimeout(()=>{s(o)},TA.get());function u(){be().clearTimeout(c),i(n)}n.ping(u).then(u,()=>{s(o)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const CA={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},kA=500,DA=600,NA="_blank",VA="http://localhost";class ff{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function OA(r,e,t,n=kA,i=DA){const s=Math.max((window.screen.availHeight-i)/2,0).toString(),o=Math.max((window.screen.availWidth-n)/2,0).toString();let c="";const u={...CA,width:n.toString(),height:i.toString(),top:s,left:o},l=me().toLowerCase();t&&(c=Cm(l)?NA:t),Sm(l)&&(e=e||VA,u.scrollbars="yes");const f=Object.entries(u).reduce((g,[v,k])=>`${g}${v}=${k},`,"");if(iT(l)&&c!=="_self")return xA(e||"",c),new ff(null);const p=window.open(e||"",c,f);O(p,r,"popup-blocked");try{p.focus()}catch{}return new ff(p)}function xA(r,e){const t=document.createElement("a");t.href=r,t.target=e;const n=document.createEvent("MouseEvent");n.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),t.dispatchEvent(n)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const MA="__/auth/handler",LA="emulator/auth/handler",FA=encodeURIComponent("fac");async function du(r,e,t,n,i,s){O(r.config.authDomain,r,"auth-domain-config-required"),O(r.config.apiKey,r,"invalid-api-key");const o={apiKey:r.config.apiKey,appName:r.name,authType:t,redirectUrl:n,v:On,eventId:i};if(e instanceof Qt){e.setDefaultLanguage(r.languageCode),o.providerId=e.providerId||"",hw(e.getCustomParameters())||(o.customParameters=JSON.stringify(e.getCustomParameters()));for(const[f,p]of Object.entries(s||{}))o[f]=p}if(e instanceof Ai){const f=e.getScopes().filter(p=>p!=="");f.length>0&&(o.scopes=f.join(","))}r.tenantId&&(o.tid=r.tenantId);const c=o;for(const f of Object.keys(c))c[f]===void 0&&delete c[f];const u=await r._getAppCheckToken(),l=u?`#${FA}=${encodeURIComponent(u)}`:"";return`${UA(r)}?${Ei(c).slice(1)}${l}`}function UA({config:r}){return r.emulator?al(r,LA):`https://${r.authDomain}/${MA}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Jc="webStorageSupport";class BA{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=lr,this._completeRedirectFn=za,this._overrideRedirectResult=wl}async _openPopup(e,t,n,i){var o;Tt((o=this.eventManagers[e._key()])==null?void 0:o.manager,"_initialize() not called before _openPopup()");const s=await du(e,t,n,ks(),i);return OA(e,s,io())}async _openRedirect(e,t,n,i){await this._originValidation(e);const s=await du(e,t,n,ks(),i);return Pv(s),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:i,promise:s}=this.eventManagers[t];return i?Promise.resolve(i):(Tt(s,"If manager is not set, promise should be"),s)}const n=this.initAndGetManager(e);return this.eventManagers[t]={promise:n},n.catch(()=>{delete this.eventManagers[t]}),n}async initAndGetManager(e){const t=await PA(e),n=new sg(e);return t.register("authEvent",i=>(O(i==null?void 0:i.authEvent,e,"invalid-auth-event"),{status:n.onEvent(i.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:n},this.iframes[e._key()]=t,n}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(Jc,{type:Jc},i=>{var o;const s=(o=i==null?void 0:i[0])==null?void 0:o[Jc];s!==void 0&&t(!!s),Fe(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=_A(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return Vm()||Pm()||to()}}const qA=BA;class $A{constructor(e){this.factorId=e}_process(e,t,n){switch(t.type){case"enroll":return this._finalizeEnroll(e,t.credential,n);case"signin":return this._finalizeSignIn(e,t.credential);default:return Dt("unexpected MultiFactorSessionType")}}}class El extends $A{constructor(e){super("phone"),this.credential=e}static _fromCredential(e){return new El(e)}_finalizeEnroll(e,t,n){return Ev(e,{idToken:t,displayName:n,phoneVerificationInfo:this.credential._makeVerificationRequest()})}_finalizeSignIn(e,t){return Lv(e,{mfaPendingCredential:t,phoneVerificationInfo:this.credential._makeVerificationRequest()})}}class cg{constructor(){}static assertion(e){return El._fromCredential(e)}}cg.FACTOR_ID="phone";var pf="@firebase/auth",mf="1.12.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zA{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)==null?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(n=>{e((n==null?void 0:n.stsTokenManager.accessToken)||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){O(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jA(r){switch(r){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function GA(r){bn(new Lt("auth",(e,{options:t})=>{const n=e.getProvider("app").getImmediate(),i=e.getProvider("heartbeat"),s=e.getProvider("app-check-internal"),{apiKey:o,authDomain:c}=n.options;O(o&&!o.includes(":"),"invalid-api-key",{appName:n.name});const u={apiKey:o,authDomain:c,clientPlatform:r,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:Om(r)},l=new lT(n,i,s,u);return AT(l,t),l},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,n)=>{e.getProvider("auth-internal").initialize()})),bn(new Lt("auth-internal",e=>{const t=ge(e.getProvider("auth").getImmediate());return(n=>new zA(n))(t)},"PRIVATE").setInstantiationMode("EXPLICIT")),It(pf,mf,jA(r)),It(pf,mf,"esm2020")}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const WA=5*60;ZI("authIdTokenMaxAge");function KA(){var r;return((r=document.getElementsByTagName("head"))==null?void 0:r[0])??document}hT({loadJS(r){return new Promise((e,t)=>{const n=document.createElement("script");n.setAttribute("src",r),n.onload=e,n.onerror=i=>{const s=Ce("internal-error");s.customData=i,t(s)},n.type="text/javascript",n.charset="UTF-8",KA().appendChild(n)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});GA("Browser");/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function dr(){return window}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const HA=2e3;async function QA(r,e,t){const{BuildInfo:n}=dr();Tt(e.sessionId,"AuthEvent did not contain a session ID");const i=await eb(e.sessionId),s={};return to()?s.ibi=n.packageName:eo()?s.apn=n.packageName:Fe(r,"operation-not-supported-in-this-environment"),n.displayName&&(s.appDisplayName=n.displayName),s.sessionId=i,du(r,t,e.type,void 0,e.eventId??void 0,s)}async function JA(r){const{BuildInfo:e}=dr(),t={};to()?t.iosBundleId=e.packageName:eo()?t.androidPackageName=e.packageName:Fe(r,"operation-not-supported-in-this-environment"),await ag(r,t)}function YA(r){const{cordova:e}=dr();return new Promise(t=>{e.plugins.browsertab.isAvailable(n=>{let i=null;n?e.plugins.browsertab.openUrl(r):i=e.InAppBrowser.open(r,rT()?"_blank":"_system","location=yes"),t(i)})})}async function XA(r,e,t){const{cordova:n}=dr();let i=()=>{};try{await new Promise((s,o)=>{let c=null;function u(){var g;s();const p=(g=n.plugins.browsertab)==null?void 0:g.close;typeof p=="function"&&p(),typeof(t==null?void 0:t.close)=="function"&&t.close()}function l(){c||(c=window.setTimeout(()=>{o(Ce(r,"redirect-cancelled-by-user"))},HA))}function f(){(document==null?void 0:document.visibilityState)==="visible"&&l()}e.addPassiveListener(u),document.addEventListener("resume",l,!1),eo()&&document.addEventListener("visibilitychange",f,!1),i=()=>{e.removePassiveListener(u),document.removeEventListener("resume",l,!1),document.removeEventListener("visibilitychange",f,!1),c&&window.clearTimeout(c)}})}finally{i()}}function ZA(r){var t,n,i,s,o,c,u,l,f,p;const e=dr();O(typeof((t=e==null?void 0:e.universalLinks)==null?void 0:t.subscribe)=="function",r,"invalid-cordova-configuration",{missingPlugin:"cordova-universal-links-plugin-fix"}),O(typeof((n=e==null?void 0:e.BuildInfo)==null?void 0:n.packageName)<"u",r,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-buildInfo"}),O(typeof((o=(s=(i=e==null?void 0:e.cordova)==null?void 0:i.plugins)==null?void 0:s.browsertab)==null?void 0:o.openUrl)=="function",r,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-browsertab"}),O(typeof((l=(u=(c=e==null?void 0:e.cordova)==null?void 0:c.plugins)==null?void 0:u.browsertab)==null?void 0:l.isAvailable)=="function",r,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-browsertab"}),O(typeof((p=(f=e==null?void 0:e.cordova)==null?void 0:f.InAppBrowser)==null?void 0:p.open)=="function",r,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-inappbrowser"})}async function eb(r){const e=tb(r),t=await crypto.subtle.digest("SHA-256",e);return Array.from(new Uint8Array(t)).map(i=>i.toString(16).padStart(2,"0")).join("")}function tb(r){if(Tt(/[0-9a-zA-Z]+/.test(r),"Can only convert alpha-numeric strings"),typeof TextEncoder<"u")return new TextEncoder().encode(r);const e=new ArrayBuffer(r.length),t=new Uint8Array(e);for(let n=0;n<r.length;n++)t[n]=r.charCodeAt(n);return t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nb=20;class rb extends sg{constructor(){super(...arguments),this.passiveListeners=new Set,this.initPromise=new Promise(e=>{this.resolveInitialized=e})}addPassiveListener(e){this.passiveListeners.add(e)}removePassiveListener(e){this.passiveListeners.delete(e)}resetRedirect(){this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1}onEvent(e){return this.resolveInitialized(),this.passiveListeners.forEach(t=>t(e)),super.onEvent(e)}async initialized(){await this.initPromise}}function ib(r,e,t=null){return{type:e,eventId:t,urlResponse:null,sessionId:ab(),postBody:null,tenantId:r.tenantId,error:Ce(r,"no-auth-event")}}function sb(r,e){return fu()._set(pu(r),e)}async function gf(r){const e=await fu()._get(pu(r));return e&&await fu()._remove(pu(r)),e}function ob(r,e){var n,i;const t=ub(e);if(t.includes("/__/auth/callback")){const s=Ho(t),o=s.firebaseError?cb(decodeURIComponent(s.firebaseError)):null,c=(i=(n=o==null?void 0:o.code)==null?void 0:n.split("auth/"))==null?void 0:i[1],u=c?Ce(c):null;return u?{type:r.type,eventId:r.eventId,tenantId:r.tenantId,error:u,urlResponse:null,sessionId:null,postBody:null}:{type:r.type,eventId:r.eventId,tenantId:r.tenantId,sessionId:r.sessionId,urlResponse:t,postBody:null}}return null}function ab(){const r=[],e="1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";for(let t=0;t<nb;t++){const n=Math.floor(Math.random()*e.length);r.push(e.charAt(n))}return r.join("")}function fu(){return ot(ml)}function pu(r){return or("authEvent",r.config.apiKey,r.name)}function cb(r){try{return JSON.parse(r)}catch{return null}}function ub(r){const e=Ho(r),t=e.link?decodeURIComponent(e.link):void 0,n=Ho(t).link,i=e.deep_link_id?decodeURIComponent(e.deep_link_id):void 0;return Ho(i).link||i||n||t||r}function Ho(r){if(!(r!=null&&r.includes("?")))return{};const[e,...t]=r.split("?");return jr(t.join("?"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lb=500;class hb{constructor(){this._redirectPersistence=lr,this._shouldInitProactively=!0,this.eventManagers=new Map,this.originValidationPromises={},this._completeRedirectFn=za,this._overrideRedirectResult=wl}async _initialize(e){const t=e._key();let n=this.eventManagers.get(t);return n||(n=new rb(e),this.eventManagers.set(t,n),this.attachCallbackListeners(e,n)),n}_openPopup(e){Fe(e,"operation-not-supported-in-this-environment")}async _openRedirect(e,t,n,i){ZA(e);const s=await this._initialize(e);await s.initialized(),s.resetRedirect(),sA(),await this._originValidation(e);const o=ib(e,n,i);await sb(e,o);const c=await QA(e,o,t),u=await YA(c);return XA(e,s,u)}_isIframeWebStorageSupported(e,t){throw new Error("Method not implemented.")}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=JA(e)),this.originValidationPromises[t]}attachCallbackListeners(e,t){const{universalLinks:n,handleOpenURL:i,BuildInfo:s}=dr(),o=setTimeout(async()=>{await gf(e),t.onEvent(_f())},lb),c=async f=>{clearTimeout(o);const p=await gf(e);let g=null;p&&(f!=null&&f.url)&&(g=ob(p,f.url)),t.onEvent(g||_f())};typeof n<"u"&&typeof n.subscribe=="function"&&n.subscribe(null,c);const u=i,l=`${s.packageName.toLowerCase()}://`;dr().handleOpenURL=async f=>{if(f.toLowerCase().startsWith(l)&&c({url:f}),typeof u=="function")try{u(f)}catch(p){console.error(p)}}}}const db=hb;function _f(){return{type:"unknown",eventId:null,sessionId:null,urlResponse:null,postBody:null,tenantId:null,error:Ce("no-auth-event")}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fb(r,e){ge(r)._logFramework(e)}var pb="@firebase/auth-compat",mb="0.6.2";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gb=1e3;function _s(){var r;return((r=self==null?void 0:self.location)==null?void 0:r.protocol)||null}function _b(){return _s()==="http:"||_s()==="https:"}function ug(r=me()){return!!((_s()==="file:"||_s()==="ionic:"||_s()==="capacitor:")&&r.toLowerCase().match(/iphone|ipad|ipod|android/))}function yb(){return Xu()||Na()}function Ib(){return tm()&&(document==null?void 0:document.documentMode)===11}function wb(r=me()){return/Edge\/\d+/.test(r)}function Eb(r=me()){return Ib()||wb(r)}function lg(){try{const r=self.localStorage,e=io();if(r)return r.setItem(e,"1"),r.removeItem(e),Eb()?Ss():!0}catch{return Tl()&&Ss()}return!1}function Tl(){return typeof global<"u"&&"WorkerGlobalScope"in global&&"importScripts"in global}function Yc(){return(_b()||em()||ug())&&!yb()&&lg()&&!Tl()}function hg(){return ug()&&typeof document<"u"}async function Tb(){return hg()?new Promise(r=>{const e=setTimeout(()=>{r(!1)},gb);document.addEventListener("deviceready",()=>{clearTimeout(e),r(!0)})}):!1}function vb(){return typeof window<"u"?window:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const st={LOCAL:"local",NONE:"none",SESSION:"session"},Yi=O,dg="persistence";function Ab(r,e){if(Yi(Object.values(st).includes(e),r,"invalid-persistence-type"),Xu()){Yi(e!==st.SESSION,r,"unsupported-persistence-type");return}if(Na()){Yi(e===st.NONE,r,"unsupported-persistence-type");return}if(Tl()){Yi(e===st.NONE||e===st.LOCAL&&Ss(),r,"unsupported-persistence-type");return}Yi(e===st.NONE||lg(),r,"unsupported-persistence-type")}async function mu(r){await r._initializationPromise;const e=fg(),t=or(dg,r.config.apiKey,r.name);e&&e.setItem(t,r._getPersistenceType())}function bb(r,e){const t=fg();if(!t)return[];const n=or(dg,r,e);switch(t.getItem(n)){case st.NONE:return[Zr];case st.LOCAL:return[Vs,lr];case st.SESSION:return[lr];default:return[]}}function fg(){var r;try{return((r=vb())==null?void 0:r.sessionStorage)||null}catch{return null}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rb=O;class pn{constructor(){this.browserResolver=ot(qA),this.cordovaResolver=ot(db),this.underlyingResolver=null,this._redirectPersistence=lr,this._completeRedirectFn=za,this._overrideRedirectResult=wl}async _initialize(e){return await this.selectUnderlyingResolver(),this.assertedUnderlyingResolver._initialize(e)}async _openPopup(e,t,n,i){return await this.selectUnderlyingResolver(),this.assertedUnderlyingResolver._openPopup(e,t,n,i)}async _openRedirect(e,t,n,i){return await this.selectUnderlyingResolver(),this.assertedUnderlyingResolver._openRedirect(e,t,n,i)}_isIframeWebStorageSupported(e,t){this.assertedUnderlyingResolver._isIframeWebStorageSupported(e,t)}_originValidation(e){return this.assertedUnderlyingResolver._originValidation(e)}get _shouldInitProactively(){return hg()||this.browserResolver._shouldInitProactively}get assertedUnderlyingResolver(){return Rb(this.underlyingResolver,"internal-error"),this.underlyingResolver}async selectUnderlyingResolver(){if(this.underlyingResolver)return;const e=await Tb();this.underlyingResolver=e?this.cordovaResolver:this.browserResolver}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pg(r){return r.unwrap()}function Sb(r){return r.wrapped()}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pb(r){return mg(r)}function Cb(r,e){var n;const t=(n=e.customData)==null?void 0:n._tokenResponse;if((e==null?void 0:e.code)==="auth/multi-factor-auth-required"){const i=e;i.resolver=new kb(r,wv(r,e))}else if(t){const i=mg(e),s=e;i&&(s.credential=i,s.tenantId=t.tenantId||void 0,s.email=t.email||void 0,s.phoneNumber=t.phoneNumber||void 0)}}function mg(r){const{_tokenResponse:e}=r instanceof Qe?r.customData:r;if(!e)return null;if(!(r instanceof Qe)&&"temporaryProof"in e&&"phoneNumber"in e)return hr.credentialFromResult(r);const t=e.providerId;if(!t||t===Qi.PASSWORD)return null;let n;switch(t){case Qi.GOOGLE:n=Pt;break;case Qi.FACEBOOK:n=St;break;case Qi.GITHUB:n=Ct;break;case Qi.TWITTER:n=kt;break;default:const{oauthIdToken:i,oauthAccessToken:s,oauthTokenSecret:o,pendingToken:c,nonce:u}=e;return!s&&!o&&!i&&!c?null:c?t.startsWith("saml.")?ei._create(t,c):Ft._fromParams({providerId:t,signInMethod:t,pendingToken:c,idToken:i,accessToken:s}):new Kr(t).credential({idToken:i,accessToken:s,rawNonce:u})}return r instanceof Qe?n.credentialFromError(r):n.credentialFromResult(r)}function Ze(r,e){return e.catch(t=>{throw t instanceof Qe&&Cb(r,t),t}).then(t=>{const n=t.operationType,i=t.user;return{operationType:n,credential:Pb(t),additionalUserInfo:Iv(t),user:ja.getOrCreate(i)}})}async function gu(r,e){const t=await e;return{verificationId:t.verificationId,confirm:n=>Ze(r,t.confirm(n))}}class kb{constructor(e,t){this.resolver=t,this.auth=Sb(e)}get session(){return this.resolver.session}get hints(){return this.resolver.hints}resolveSignIn(e){return Ze(pg(this.auth),this.resolver.resolveSignIn(e))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let ja=class os{constructor(e){this._delegate=e,this.multiFactor=vv(e)}static getOrCreate(e){return os.USER_MAP.has(e)||os.USER_MAP.set(e,new os(e)),os.USER_MAP.get(e)}delete(){return this._delegate.delete()}reload(){return this._delegate.reload()}toJSON(){return this._delegate.toJSON()}getIdTokenResult(e){return this._delegate.getIdTokenResult(e)}getIdToken(e){return this._delegate.getIdToken(e)}linkAndRetrieveDataWithCredential(e){return this.linkWithCredential(e)}async linkWithCredential(e){return Ze(this.auth,jm(this._delegate,e))}async linkWithPhoneNumber(e,t){return gu(this.auth,Wv(this._delegate,e,t))}async linkWithPopup(e){return Ze(this.auth,tA(this._delegate,e,pn))}async linkWithRedirect(e){return await mu(ge(this.auth)),lA(this._delegate,e,pn)}reauthenticateAndRetrieveDataWithCredential(e){return this.reauthenticateWithCredential(e)}async reauthenticateWithCredential(e){return Ze(this.auth,Gm(this._delegate,e))}reauthenticateWithPhoneNumber(e,t){return gu(this.auth,Kv(this._delegate,e,t))}reauthenticateWithPopup(e){return Ze(this.auth,eA(this._delegate,e,pn))}async reauthenticateWithRedirect(e){return await mu(ge(this.auth)),cA(this._delegate,e,pn)}sendEmailVerification(e){return cv(this._delegate,e)}async unlink(e){return await HT(this._delegate,e),this}updateEmail(e){return dv(this._delegate,e)}updatePassword(e){return fv(this._delegate,e)}updatePhoneNumber(e){return Hv(this._delegate,e)}updateProfile(e){return hv(this._delegate,e)}verifyBeforeUpdateEmail(e,t){return uv(this._delegate,e,t)}get emailVerified(){return this._delegate.emailVerified}get isAnonymous(){return this._delegate.isAnonymous}get metadata(){return this._delegate.metadata}get phoneNumber(){return this._delegate.phoneNumber}get providerData(){return this._delegate.providerData}get refreshToken(){return this._delegate.refreshToken}get tenantId(){return this._delegate.tenantId}get displayName(){return this._delegate.displayName}get email(){return this._delegate.email}get photoURL(){return this._delegate.photoURL}get providerId(){return this._delegate.providerId}get uid(){return this._delegate.uid}get auth(){return this._delegate.auth}};ja.USER_MAP=new WeakMap;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xi=O;class _u{constructor(e,t){if(this.app=e,t.isInitialized()){this._delegate=t.getImmediate(),this.linkUnderlyingAuth();return}const{apiKey:n}=e.options;Xi(n,"invalid-api-key",{appName:e.name}),Xi(n,"invalid-api-key",{appName:e.name});const i=typeof window<"u"?pn:void 0;this._delegate=t.initialize({options:{persistence:Db(n,e.name),popupRedirectResolver:i}}),this._delegate._updateErrorMap(LE),this.linkUnderlyingAuth()}get emulatorConfig(){return this._delegate.emulatorConfig}get currentUser(){return this._delegate.currentUser?ja.getOrCreate(this._delegate.currentUser):null}get languageCode(){return this._delegate.languageCode}set languageCode(e){this._delegate.languageCode=e}get settings(){return this._delegate.settings}get tenantId(){return this._delegate.tenantId}set tenantId(e){this._delegate.tenantId=e}useDeviceLanguage(){this._delegate.useDeviceLanguage()}signOut(){return this._delegate.signOut()}useEmulator(e,t){bT(this._delegate,e,t)}applyActionCode(e){return ZT(this._delegate,e)}checkActionCode(e){return Wm(this._delegate,e)}confirmPasswordReset(e,t){return XT(this._delegate,e,t)}async createUserWithEmailAndPassword(e,t){return Ze(this._delegate,tv(this._delegate,e,t))}fetchProvidersForEmail(e){return this.fetchSignInMethodsForEmail(e)}fetchSignInMethodsForEmail(e){return av(this._delegate,e)}isSignInWithEmailLink(e){return iv(this._delegate,e)}async getRedirectResult(){Xi(Yc(),this._delegate,"operation-not-supported-in-this-environment");const e=await dA(this._delegate,pn);return e?Ze(this._delegate,Promise.resolve(e)):{credential:null,user:null}}addFrameworkForLogging(e){fb(this._delegate,e)}onAuthStateChanged(e,t,n){const{next:i,error:s,complete:o}=yf(e,t,n);return this._delegate.onAuthStateChanged(i,s,o)}onIdTokenChanged(e,t,n){const{next:i,error:s,complete:o}=yf(e,t,n);return this._delegate.onIdTokenChanged(i,s,o)}sendSignInLinkToEmail(e,t){return rv(this._delegate,e,t)}sendPasswordResetEmail(e,t){return YT(this._delegate,e,t||void 0)}async setPersistence(e){Ab(this._delegate,e);let t;switch(e){case st.SESSION:t=lr;break;case st.LOCAL:t=await ot(Vs)._isAvailable()?Vs:ml;break;case st.NONE:t=Zr;break;default:return Fe("argument-error",{appName:this._delegate.name})}return this._delegate.setPersistence(t)}signInAndRetrieveDataWithCredential(e){return this.signInWithCredential(e)}signInAnonymously(){return Ze(this._delegate,KT(this._delegate))}signInWithCredential(e){return Ze(this._delegate,Fa(this._delegate,e))}signInWithCustomToken(e){return Ze(this._delegate,JT(this._delegate,e))}signInWithEmailAndPassword(e,t){return Ze(this._delegate,nv(this._delegate,e,t))}signInWithEmailLink(e,t){return Ze(this._delegate,sv(this._delegate,e,t))}signInWithPhoneNumber(e,t){return gu(this._delegate,Gv(this._delegate,e,t))}async signInWithPopup(e){return Xi(Yc(),this._delegate,"operation-not-supported-in-this-environment"),Ze(this._delegate,Zv(this._delegate,e,pn))}async signInWithRedirect(e){return Xi(Yc(),this._delegate,"operation-not-supported-in-this-environment"),await mu(this._delegate),oA(this._delegate,e,pn)}updateCurrentUser(e){return this._delegate.updateCurrentUser(e)}verifyPasswordResetCode(e){return ev(this._delegate,e)}unwrap(){return this._delegate}_delete(){return this._delegate._delete()}linkUnderlyingAuth(){this._delegate.wrapped=()=>this}}_u.Persistence=st;function yf(r,e,t){let n=r;typeof r!="function"&&({next:n,error:e,complete:t}=r);const i=n;return{next:o=>i(o&&ja.getOrCreate(o)),error:e,complete:t}}function Db(r,e){const t=bb(r,e);if(typeof self<"u"&&!t.includes(Vs)&&t.push(Vs),typeof window<"u")for(const n of[ml,lr])t.includes(n)||t.push(n);return t.includes(Zr)||t.push(Zr),t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vl{static credential(e,t){return hr.credential(e,t)}constructor(){this.providerId="phone",this._delegate=new hr(pg(Pe.auth()))}verifyPhoneNumber(e,t){return this._delegate.verifyPhoneNumber(e,t)}unwrap(){return this._delegate}}vl.PHONE_SIGN_IN_METHOD=hr.PHONE_SIGN_IN_METHOD;vl.PROVIDER_ID=hr.PROVIDER_ID;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nb=O;class Vb{constructor(e,t,n=Pe.app()){var i;Nb((i=n.options)==null?void 0:i.apiKey,"invalid-api-key",{appName:n.name}),this._delegate=new zv(n.auth(),e,t),this.type=this._delegate.type}clear(){this._delegate.clear()}render(){return this._delegate.render()}verify(){return this._delegate.verify()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ob="auth-compat";function xb(r){r.INTERNAL.registerComponent(new Lt(Ob,e=>{const t=e.getProvider("app-compat").getImmediate(),n=e.getProvider("auth");return new _u(t,n)},"PUBLIC").setServiceProps({ActionCodeInfo:{Operation:{EMAIL_SIGNIN:Nr.EMAIL_SIGNIN,PASSWORD_RESET:Nr.PASSWORD_RESET,RECOVER_EMAIL:Nr.RECOVER_EMAIL,REVERT_SECOND_FACTOR_ADDITION:Nr.REVERT_SECOND_FACTOR_ADDITION,VERIFY_AND_CHANGE_EMAIL:Nr.VERIFY_AND_CHANGE_EMAIL,VERIFY_EMAIL:Nr.VERIFY_EMAIL}},EmailAuthProvider:xn,FacebookAuthProvider:St,GithubAuthProvider:Ct,GoogleAuthProvider:Pt,OAuthProvider:Kr,SAMLAuthProvider:ha,PhoneAuthProvider:vl,PhoneMultiFactorGenerator:cg,RecaptchaVerifier:Vb,TwitterAuthProvider:kt,Auth:_u,AuthCredential:vi,Error:Qe}).setInstantiationMode("LAZY").setMultipleInstances(!1)),r.registerVersion(pb,mb)}xb(Pe);var Mb={};const Lb=(()=>{var r;if(typeof process<"u"&&Mb)return(r=process.argv)==null?void 0:r.includes("--dev");try{return localStorage.getItem("DEBUG_MODE")==="true"}catch{return!1}})(),oe=(...r)=>Lb&&console.log("[Firebase]",...r);let gt=null,cr=null,Os=!1,Al=!1,xs=!1,lt=null;const bl="firebase_config",gg={encode:r=>{try{return btoa(encodeURIComponent(r))}catch{return r}},decode:r=>{try{return decodeURIComponent(atob(r))}catch{return r}}};async function Fb(){var r,e,t;if(!((r=window.electronAPI)!=null&&r.isElectron))return oe("웹 환경 - 인증 파일 사용 불가"),null;try{if(!((e=window.electronAPI)!=null&&e.readAuthFile))return oe("readAuthFile API 없음"),null;const n=await window.electronAPI.readAuthFile();if(!n.exists)return oe("인증 파일 없음 - 로컬 모드로 동작"),null;const i=JSON.parse(n.content);return i.apiKey&&i.projectId?(oe("인증 파일에서 Firebase 설정 로드됨"),i):(oe("인증 파일에 필수 설정 없음"),null)}catch(n){return(((t=window.logger)==null?void 0:t.error)||console.error)("[Firebase] 인증 파일 로드 실패:",n),null}}function Ub(){var r;try{const e=localStorage.getItem(bl);if(e){let t;if(e.startsWith("eyJ"))try{t=JSON.parse(gg.decode(e))}catch{t=JSON.parse(e)}else t=JSON.parse(e);if(t.apiKey&&t.projectId)return t}}catch(e){(((r=window.logger)==null?void 0:r.error)||console.error)("Firebase 설정 로드 실패:",e)}return null}async function Bb(){const r=await Fb();if(r)return r;const e=Ub();return e?(oe("localStorage에서 설정 로드됨"),e):(oe("Firebase 설정 없음 - 로컬 모드로 동작"),null)}function _g(r){return r?r.apiKey&&r.apiKey.trim()!==""&&r.projectId&&r.projectId.trim()!=="":!1}async function yg(){var r,e,t,n,i,s,o,c,u,l,f,p;if(oe("초기화 시작..."),Os&&gt)return oe("이미 초기화됨"),!0;if(!navigator.onLine)return oe("오프라인 상태 - 로컬 모드로 동작"),(((r=window.logger)==null?void 0:r.info)||console.info)("[Firebase] 인터넷 연결 없음. 로컬 모드로 동작합니다."),!1;if(window.NetworkAccess){const g=await window.NetworkAccess.checkAccess();if(oe("네트워크 접근 체크:",g),!g.allowed)return oe("네트워크 접근 거부:",g.reason),(((e=window.logger)==null?void 0:e.warn)||console.warn)("[Firebase] 허용되지 않은 네트워크입니다. 로컬 모드로 동작합니다."),!1}if(typeof Pe>"u")return(((t=window.logger)==null?void 0:t.error)||console.error)("[Firebase] SDK가 로드되지 않았습니다. firebase-app-compat.js를 먼저 로드하세요."),!1;if(lt=await Bb(),oe("로드된 설정:",lt?"있음":"없음"),!lt)return oe("설정이 없습니다. 로컬 모드로 동작합니다."),!1;if(oe("설정값 확인:",{apiKey:lt.apiKey?lt.apiKey.substring(0,10)+"...":"없음",projectId:lt.projectId||"없음",authDomain:lt.authDomain||"없음"}),!_g(lt))return oe("설정이 유효하지 않습니다."),!1;try{oe("앱 초기화 중..."),Pe.apps.length||Pe.initializeApp(lt),gt=Pe.firestore(),gt.settings({cacheSizeBytes:Pe.firestore.CACHE_SIZE_UNLIMITED,merge:!0}),oe("Firestore 연결됨");try{cr=Pe.auth();const g=await cr.signInAnonymously();xs=!0,oe("익명 인증 성공:",g.user.uid)}catch(g){(((n=window.logger)==null?void 0:n.error)||console.error)("[Firebase] 익명 인증 실패:",g),xs=!1;const v=g.code||"";if(v==="auth/operation-not-allowed")return(((i=window.logger)==null?void 0:i.error)||console.error)("[Firebase] 익명 인증이 비활성화되어 있습니다. Firebase Console에서 활성화하세요."),!1;v==="auth/network-request-failed"?(((s=window.logger)==null?void 0:s.warn)||console.warn)("[Firebase] 네트워크 오류로 인증 실패. 오프라인 모드로 계속 진행합니다."):(((o=window.logger)==null?void 0:o.warn)||console.warn)("[Firebase] 인증 없이 계속 진행 (보안 규칙에 따라 제한될 수 있음)")}try{await gt.enablePersistence({synchronizeTabs:!0}),Al=!0,oe("오프라인 지원 활성화됨")}catch(g){(((c=window.logger)==null?void 0:c.warn)||console.warn)("[Firebase] 오프라인 지원 에러:",g.code,g.message),g.code==="failed-precondition"?(((u=window.logger)==null?void 0:u.warn)||console.warn)("[Firebase] 여러 탭이 열려 있어 오프라인 지원이 제한됩니다."):g.code==="unimplemented"&&(((l=window.logger)==null?void 0:l.warn)||console.warn)("[Firebase] 이 브라우저는 오프라인 지원을 지원하지 않습니다.")}return Os=!0,oe("초기화 완료:",lt.projectId),window.addEventListener("offline",()=>{oe("네트워크 끊김 감지 - Firestore 네트워크 비활성화"),gt&&gt.disableNetwork().catch(()=>{})}),window.addEventListener("online",()=>{oe("네트워크 복구 감지 - Firestore 네트워크 활성화"),gt&&gt.enableNetwork().catch(()=>{})}),!0}catch(g){return(((f=window.logger)==null?void 0:f.error)||console.error)("[Firebase] 초기화 실패:",g),(((p=window.logger)==null?void 0:p.error)||console.error)("[Firebase] 에러 상세:",g.message,g.stack),!1}}function qb(){return gt}function $b(){return Os}function zb(){return Al}function jb(){return xs}function Gb(){var r;return((r=cr==null?void 0:cr.currentUser)==null?void 0:r.uid)||null}function Wb(r){var e;try{const t=gg.encode(JSON.stringify(r));localStorage.setItem(bl,t),oe("설정 저장됨 (난독화)")}catch(t){(((e=window.logger)==null?void 0:e.error)||console.error)("Firebase 설정 저장 실패:",t)}}function Kb(){localStorage.removeItem(bl),Os=!1,xs=!1,gt=null,cr=null,lt=null,oe("설정 초기화됨")}async function Hb(){var r;if(oe("재초기화 시작..."),Os=!1,xs=!1,Al=!1,gt=null,cr=null,lt=null,typeof Pe<"u"&&Pe.apps.length>0)try{await Pe.app().delete(),oe("기존 Firebase 앱 삭제됨")}catch(e){(((r=window.logger)==null?void 0:r.warn)||console.warn)("[Firebase] 앱 삭제 실패:",e)}return await yg()}window.firebaseConfig={initialize:yg,reinitialize:Hb,getDb:qb,isEnabled:$b,isOfflineSupported:zb,isAuthenticated:jb,getCurrentUserId:Gb,isConfigValid:_g,saveConfig:Wb,resetConfig:Kb};var If=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var In,Ig;(function(){var r;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(w,_){function I(){}I.prototype=_.prototype,w.F=_.prototype,w.prototype=new I,w.prototype.constructor=w,w.D=function(T,E,R){for(var y=Array(arguments.length-2),Xe=2;Xe<arguments.length;Xe++)y[Xe-2]=arguments[Xe];return _.prototype[E].apply(T,y)}}function t(){this.blockSize=-1}function n(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}e(n,t),n.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(w,_,I){I||(I=0);const T=Array(16);if(typeof _=="string")for(var E=0;E<16;++E)T[E]=_.charCodeAt(I++)|_.charCodeAt(I++)<<8|_.charCodeAt(I++)<<16|_.charCodeAt(I++)<<24;else for(E=0;E<16;++E)T[E]=_[I++]|_[I++]<<8|_[I++]<<16|_[I++]<<24;_=w.g[0],I=w.g[1],E=w.g[2];let R=w.g[3],y;y=_+(R^I&(E^R))+T[0]+3614090360&4294967295,_=I+(y<<7&4294967295|y>>>25),y=R+(E^_&(I^E))+T[1]+3905402710&4294967295,R=_+(y<<12&4294967295|y>>>20),y=E+(I^R&(_^I))+T[2]+606105819&4294967295,E=R+(y<<17&4294967295|y>>>15),y=I+(_^E&(R^_))+T[3]+3250441966&4294967295,I=E+(y<<22&4294967295|y>>>10),y=_+(R^I&(E^R))+T[4]+4118548399&4294967295,_=I+(y<<7&4294967295|y>>>25),y=R+(E^_&(I^E))+T[5]+1200080426&4294967295,R=_+(y<<12&4294967295|y>>>20),y=E+(I^R&(_^I))+T[6]+2821735955&4294967295,E=R+(y<<17&4294967295|y>>>15),y=I+(_^E&(R^_))+T[7]+4249261313&4294967295,I=E+(y<<22&4294967295|y>>>10),y=_+(R^I&(E^R))+T[8]+1770035416&4294967295,_=I+(y<<7&4294967295|y>>>25),y=R+(E^_&(I^E))+T[9]+2336552879&4294967295,R=_+(y<<12&4294967295|y>>>20),y=E+(I^R&(_^I))+T[10]+4294925233&4294967295,E=R+(y<<17&4294967295|y>>>15),y=I+(_^E&(R^_))+T[11]+2304563134&4294967295,I=E+(y<<22&4294967295|y>>>10),y=_+(R^I&(E^R))+T[12]+1804603682&4294967295,_=I+(y<<7&4294967295|y>>>25),y=R+(E^_&(I^E))+T[13]+4254626195&4294967295,R=_+(y<<12&4294967295|y>>>20),y=E+(I^R&(_^I))+T[14]+2792965006&4294967295,E=R+(y<<17&4294967295|y>>>15),y=I+(_^E&(R^_))+T[15]+1236535329&4294967295,I=E+(y<<22&4294967295|y>>>10),y=_+(E^R&(I^E))+T[1]+4129170786&4294967295,_=I+(y<<5&4294967295|y>>>27),y=R+(I^E&(_^I))+T[6]+3225465664&4294967295,R=_+(y<<9&4294967295|y>>>23),y=E+(_^I&(R^_))+T[11]+643717713&4294967295,E=R+(y<<14&4294967295|y>>>18),y=I+(R^_&(E^R))+T[0]+3921069994&4294967295,I=E+(y<<20&4294967295|y>>>12),y=_+(E^R&(I^E))+T[5]+3593408605&4294967295,_=I+(y<<5&4294967295|y>>>27),y=R+(I^E&(_^I))+T[10]+38016083&4294967295,R=_+(y<<9&4294967295|y>>>23),y=E+(_^I&(R^_))+T[15]+3634488961&4294967295,E=R+(y<<14&4294967295|y>>>18),y=I+(R^_&(E^R))+T[4]+3889429448&4294967295,I=E+(y<<20&4294967295|y>>>12),y=_+(E^R&(I^E))+T[9]+568446438&4294967295,_=I+(y<<5&4294967295|y>>>27),y=R+(I^E&(_^I))+T[14]+3275163606&4294967295,R=_+(y<<9&4294967295|y>>>23),y=E+(_^I&(R^_))+T[3]+4107603335&4294967295,E=R+(y<<14&4294967295|y>>>18),y=I+(R^_&(E^R))+T[8]+1163531501&4294967295,I=E+(y<<20&4294967295|y>>>12),y=_+(E^R&(I^E))+T[13]+2850285829&4294967295,_=I+(y<<5&4294967295|y>>>27),y=R+(I^E&(_^I))+T[2]+4243563512&4294967295,R=_+(y<<9&4294967295|y>>>23),y=E+(_^I&(R^_))+T[7]+1735328473&4294967295,E=R+(y<<14&4294967295|y>>>18),y=I+(R^_&(E^R))+T[12]+2368359562&4294967295,I=E+(y<<20&4294967295|y>>>12),y=_+(I^E^R)+T[5]+4294588738&4294967295,_=I+(y<<4&4294967295|y>>>28),y=R+(_^I^E)+T[8]+2272392833&4294967295,R=_+(y<<11&4294967295|y>>>21),y=E+(R^_^I)+T[11]+1839030562&4294967295,E=R+(y<<16&4294967295|y>>>16),y=I+(E^R^_)+T[14]+4259657740&4294967295,I=E+(y<<23&4294967295|y>>>9),y=_+(I^E^R)+T[1]+2763975236&4294967295,_=I+(y<<4&4294967295|y>>>28),y=R+(_^I^E)+T[4]+1272893353&4294967295,R=_+(y<<11&4294967295|y>>>21),y=E+(R^_^I)+T[7]+4139469664&4294967295,E=R+(y<<16&4294967295|y>>>16),y=I+(E^R^_)+T[10]+3200236656&4294967295,I=E+(y<<23&4294967295|y>>>9),y=_+(I^E^R)+T[13]+681279174&4294967295,_=I+(y<<4&4294967295|y>>>28),y=R+(_^I^E)+T[0]+3936430074&4294967295,R=_+(y<<11&4294967295|y>>>21),y=E+(R^_^I)+T[3]+3572445317&4294967295,E=R+(y<<16&4294967295|y>>>16),y=I+(E^R^_)+T[6]+76029189&4294967295,I=E+(y<<23&4294967295|y>>>9),y=_+(I^E^R)+T[9]+3654602809&4294967295,_=I+(y<<4&4294967295|y>>>28),y=R+(_^I^E)+T[12]+3873151461&4294967295,R=_+(y<<11&4294967295|y>>>21),y=E+(R^_^I)+T[15]+530742520&4294967295,E=R+(y<<16&4294967295|y>>>16),y=I+(E^R^_)+T[2]+3299628645&4294967295,I=E+(y<<23&4294967295|y>>>9),y=_+(E^(I|~R))+T[0]+4096336452&4294967295,_=I+(y<<6&4294967295|y>>>26),y=R+(I^(_|~E))+T[7]+1126891415&4294967295,R=_+(y<<10&4294967295|y>>>22),y=E+(_^(R|~I))+T[14]+2878612391&4294967295,E=R+(y<<15&4294967295|y>>>17),y=I+(R^(E|~_))+T[5]+4237533241&4294967295,I=E+(y<<21&4294967295|y>>>11),y=_+(E^(I|~R))+T[12]+1700485571&4294967295,_=I+(y<<6&4294967295|y>>>26),y=R+(I^(_|~E))+T[3]+2399980690&4294967295,R=_+(y<<10&4294967295|y>>>22),y=E+(_^(R|~I))+T[10]+4293915773&4294967295,E=R+(y<<15&4294967295|y>>>17),y=I+(R^(E|~_))+T[1]+2240044497&4294967295,I=E+(y<<21&4294967295|y>>>11),y=_+(E^(I|~R))+T[8]+1873313359&4294967295,_=I+(y<<6&4294967295|y>>>26),y=R+(I^(_|~E))+T[15]+4264355552&4294967295,R=_+(y<<10&4294967295|y>>>22),y=E+(_^(R|~I))+T[6]+2734768916&4294967295,E=R+(y<<15&4294967295|y>>>17),y=I+(R^(E|~_))+T[13]+1309151649&4294967295,I=E+(y<<21&4294967295|y>>>11),y=_+(E^(I|~R))+T[4]+4149444226&4294967295,_=I+(y<<6&4294967295|y>>>26),y=R+(I^(_|~E))+T[11]+3174756917&4294967295,R=_+(y<<10&4294967295|y>>>22),y=E+(_^(R|~I))+T[2]+718787259&4294967295,E=R+(y<<15&4294967295|y>>>17),y=I+(R^(E|~_))+T[9]+3951481745&4294967295,w.g[0]=w.g[0]+_&4294967295,w.g[1]=w.g[1]+(E+(y<<21&4294967295|y>>>11))&4294967295,w.g[2]=w.g[2]+E&4294967295,w.g[3]=w.g[3]+R&4294967295}n.prototype.v=function(w,_){_===void 0&&(_=w.length);const I=_-this.blockSize,T=this.C;let E=this.h,R=0;for(;R<_;){if(E==0)for(;R<=I;)i(this,w,R),R+=this.blockSize;if(typeof w=="string"){for(;R<_;)if(T[E++]=w.charCodeAt(R++),E==this.blockSize){i(this,T),E=0;break}}else for(;R<_;)if(T[E++]=w[R++],E==this.blockSize){i(this,T),E=0;break}}this.h=E,this.o+=_},n.prototype.A=function(){var w=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);w[0]=128;for(var _=1;_<w.length-8;++_)w[_]=0;_=this.o*8;for(var I=w.length-8;I<w.length;++I)w[I]=_&255,_/=256;for(this.v(w),w=Array(16),_=0,I=0;I<4;++I)for(let T=0;T<32;T+=8)w[_++]=this.g[I]>>>T&255;return w};function s(w,_){var I=c;return Object.prototype.hasOwnProperty.call(I,w)?I[w]:I[w]=_(w)}function o(w,_){this.h=_;const I=[];let T=!0;for(let E=w.length-1;E>=0;E--){const R=w[E]|0;T&&R==_||(I[E]=R,T=!1)}this.g=I}var c={};function u(w){return-128<=w&&w<128?s(w,function(_){return new o([_|0],_<0?-1:0)}):new o([w|0],w<0?-1:0)}function l(w){if(isNaN(w)||!isFinite(w))return p;if(w<0)return N(l(-w));const _=[];let I=1;for(let T=0;w>=I;T++)_[T]=w/I|0,I*=4294967296;return new o(_,0)}function f(w,_){if(w.length==0)throw Error("number format error: empty string");if(_=_||10,_<2||36<_)throw Error("radix out of range: "+_);if(w.charAt(0)=="-")return N(f(w.substring(1),_));if(w.indexOf("-")>=0)throw Error('number format error: interior "-" character');const I=l(Math.pow(_,8));let T=p;for(let R=0;R<w.length;R+=8){var E=Math.min(8,w.length-R);const y=parseInt(w.substring(R,R+E),_);E<8?(E=l(Math.pow(_,E)),T=T.j(E).add(l(y))):(T=T.j(I),T=T.add(l(y)))}return T}var p=u(0),g=u(1),v=u(16777216);r=o.prototype,r.m=function(){if(D(this))return-N(this).m();let w=0,_=1;for(let I=0;I<this.g.length;I++){const T=this.i(I);w+=(T>=0?T:4294967296+T)*_,_*=4294967296}return w},r.toString=function(w){if(w=w||10,w<2||36<w)throw Error("radix out of range: "+w);if(k(this))return"0";if(D(this))return"-"+N(this).toString(w);const _=l(Math.pow(w,6));var I=this;let T="";for(;;){const E=ee(I,_).g;I=q(I,E.j(_));let R=((I.g.length>0?I.g[0]:I.h)>>>0).toString(w);if(I=E,k(I))return R+T;for(;R.length<6;)R="0"+R;T=R+T}},r.i=function(w){return w<0?0:w<this.g.length?this.g[w]:this.h};function k(w){if(w.h!=0)return!1;for(let _=0;_<w.g.length;_++)if(w.g[_]!=0)return!1;return!0}function D(w){return w.h==-1}r.l=function(w){return w=q(this,w),D(w)?-1:k(w)?0:1};function N(w){const _=w.g.length,I=[];for(let T=0;T<_;T++)I[T]=~w.g[T];return new o(I,~w.h).add(g)}r.abs=function(){return D(this)?N(this):this},r.add=function(w){const _=Math.max(this.g.length,w.g.length),I=[];let T=0;for(let E=0;E<=_;E++){let R=T+(this.i(E)&65535)+(w.i(E)&65535),y=(R>>>16)+(this.i(E)>>>16)+(w.i(E)>>>16);T=y>>>16,R&=65535,y&=65535,I[E]=y<<16|R}return new o(I,I[I.length-1]&-2147483648?-1:0)};function q(w,_){return w.add(N(_))}r.j=function(w){if(k(this)||k(w))return p;if(D(this))return D(w)?N(this).j(N(w)):N(N(this).j(w));if(D(w))return N(this.j(N(w)));if(this.l(v)<0&&w.l(v)<0)return l(this.m()*w.m());const _=this.g.length+w.g.length,I=[];for(var T=0;T<2*_;T++)I[T]=0;for(T=0;T<this.g.length;T++)for(let E=0;E<w.g.length;E++){const R=this.i(T)>>>16,y=this.i(T)&65535,Xe=w.i(E)>>>16,qn=w.i(E)&65535;I[2*T+2*E]+=y*qn,j(I,2*T+2*E),I[2*T+2*E+1]+=R*qn,j(I,2*T+2*E+1),I[2*T+2*E+1]+=y*Xe,j(I,2*T+2*E+1),I[2*T+2*E+2]+=R*Xe,j(I,2*T+2*E+2)}for(w=0;w<_;w++)I[w]=I[2*w+1]<<16|I[2*w];for(w=_;w<2*_;w++)I[w]=0;return new o(I,0)};function j(w,_){for(;(w[_]&65535)!=w[_];)w[_+1]+=w[_]>>>16,w[_]&=65535,_++}function $(w,_){this.g=w,this.h=_}function ee(w,_){if(k(_))throw Error("division by zero");if(k(w))return new $(p,p);if(D(w))return _=ee(N(w),_),new $(N(_.g),N(_.h));if(D(_))return _=ee(w,N(_)),new $(N(_.g),_.h);if(w.g.length>30){if(D(w)||D(_))throw Error("slowDivide_ only works with positive integers.");for(var I=g,T=_;T.l(w)<=0;)I=te(I),T=te(T);var E=Y(I,1),R=Y(T,1);for(T=Y(T,2),I=Y(I,2);!k(T);){var y=R.add(T);y.l(w)<=0&&(E=E.add(I),R=y),T=Y(T,1),I=Y(I,1)}return _=q(w,E.j(_)),new $(E,_)}for(E=p;w.l(_)>=0;){for(I=Math.max(1,Math.floor(w.m()/_.m())),T=Math.ceil(Math.log(I)/Math.LN2),T=T<=48?1:Math.pow(2,T-48),R=l(I),y=R.j(_);D(y)||y.l(w)>0;)I-=T,R=l(I),y=R.j(_);k(R)&&(R=g),E=E.add(R),w=q(w,y)}return new $(E,w)}r.B=function(w){return ee(this,w).h},r.and=function(w){const _=Math.max(this.g.length,w.g.length),I=[];for(let T=0;T<_;T++)I[T]=this.i(T)&w.i(T);return new o(I,this.h&w.h)},r.or=function(w){const _=Math.max(this.g.length,w.g.length),I=[];for(let T=0;T<_;T++)I[T]=this.i(T)|w.i(T);return new o(I,this.h|w.h)},r.xor=function(w){const _=Math.max(this.g.length,w.g.length),I=[];for(let T=0;T<_;T++)I[T]=this.i(T)^w.i(T);return new o(I,this.h^w.h)};function te(w){const _=w.g.length+1,I=[];for(let T=0;T<_;T++)I[T]=w.i(T)<<1|w.i(T-1)>>>31;return new o(I,w.h)}function Y(w,_){const I=_>>5;_%=32;const T=w.g.length-I,E=[];for(let R=0;R<T;R++)E[R]=_>0?w.i(R+I)>>>_|w.i(R+I+1)<<32-_:w.i(R+I);return new o(E,w.h)}n.prototype.digest=n.prototype.A,n.prototype.reset=n.prototype.u,n.prototype.update=n.prototype.v,Ig=n,o.prototype.add=o.prototype.add,o.prototype.multiply=o.prototype.j,o.prototype.modulo=o.prototype.B,o.prototype.compare=o.prototype.l,o.prototype.toNumber=o.prototype.m,o.prototype.toString=o.prototype.toString,o.prototype.getBits=o.prototype.i,o.fromNumber=l,o.fromString=f,In=o}).apply(typeof If<"u"?If:typeof self<"u"?self:typeof window<"u"?window:{});var Fo=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var wg,as,Eg,Qo,yu,Tg,vg,Ag;(function(){var r,e=Object.defineProperty;function t(a){a=[typeof globalThis=="object"&&globalThis,a,typeof window=="object"&&window,typeof self=="object"&&self,typeof Fo=="object"&&Fo];for(var h=0;h<a.length;++h){var d=a[h];if(d&&d.Math==Math)return d}throw Error("Cannot find global object")}var n=t(this);function i(a,h){if(h)e:{var d=n;a=a.split(".");for(var m=0;m<a.length-1;m++){var b=a[m];if(!(b in d))break e;d=d[b]}a=a[a.length-1],m=d[a],h=h(m),h!=m&&h!=null&&e(d,a,{configurable:!0,writable:!0,value:h})}}i("Symbol.dispose",function(a){return a||Symbol("Symbol.dispose")}),i("Array.prototype.values",function(a){return a||function(){return this[Symbol.iterator]()}}),i("Object.entries",function(a){return a||function(h){var d=[],m;for(m in h)Object.prototype.hasOwnProperty.call(h,m)&&d.push([m,h[m]]);return d}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var s=s||{},o=this||self;function c(a){var h=typeof a;return h=="object"&&a!=null||h=="function"}function u(a,h,d){return a.call.apply(a.bind,arguments)}function l(a,h,d){return l=u,l.apply(null,arguments)}function f(a,h){var d=Array.prototype.slice.call(arguments,1);return function(){var m=d.slice();return m.push.apply(m,arguments),a.apply(this,m)}}function p(a,h){function d(){}d.prototype=h.prototype,a.Z=h.prototype,a.prototype=new d,a.prototype.constructor=a,a.Ob=function(m,b,P){for(var M=Array(arguments.length-2),K=2;K<arguments.length;K++)M[K-2]=arguments[K];return h.prototype[b].apply(m,M)}}var g=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?a=>a&&AsyncContext.Snapshot.wrap(a):a=>a;function v(a){const h=a.length;if(h>0){const d=Array(h);for(let m=0;m<h;m++)d[m]=a[m];return d}return[]}function k(a,h){for(let m=1;m<arguments.length;m++){const b=arguments[m];var d=typeof b;if(d=d!="object"?d:b?Array.isArray(b)?"array":d:"null",d=="array"||d=="object"&&typeof b.length=="number"){d=a.length||0;const P=b.length||0;a.length=d+P;for(let M=0;M<P;M++)a[d+M]=b[M]}else a.push(b)}}class D{constructor(h,d){this.i=h,this.j=d,this.h=0,this.g=null}get(){let h;return this.h>0?(this.h--,h=this.g,this.g=h.next,h.next=null):h=this.i(),h}}function N(a){o.setTimeout(()=>{throw a},0)}function q(){var a=w;let h=null;return a.g&&(h=a.g,a.g=a.g.next,a.g||(a.h=null),h.next=null),h}class j{constructor(){this.h=this.g=null}add(h,d){const m=$.get();m.set(h,d),this.h?this.h.next=m:this.g=m,this.h=m}}var $=new D(()=>new ee,a=>a.reset());class ee{constructor(){this.next=this.g=this.h=null}set(h,d){this.h=h,this.g=d,this.next=null}reset(){this.next=this.g=this.h=null}}let te,Y=!1,w=new j,_=()=>{const a=Promise.resolve(void 0);te=()=>{a.then(I)}};function I(){for(var a;a=q();){try{a.h.call(a.g)}catch(d){N(d)}var h=$;h.j(a),h.h<100&&(h.h++,a.next=h.g,h.g=a)}Y=!1}function T(){this.u=this.u,this.C=this.C}T.prototype.u=!1,T.prototype.dispose=function(){this.u||(this.u=!0,this.N())},T.prototype[Symbol.dispose]=function(){this.dispose()},T.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function E(a,h){this.type=a,this.g=this.target=h,this.defaultPrevented=!1}E.prototype.h=function(){this.defaultPrevented=!0};var R=function(){if(!o.addEventListener||!Object.defineProperty)return!1;var a=!1,h=Object.defineProperty({},"passive",{get:function(){a=!0}});try{const d=()=>{};o.addEventListener("test",d,h),o.removeEventListener("test",d,h)}catch{}return a}();function y(a){return/^[\s\xa0]*$/.test(a)}function Xe(a,h){E.call(this,a?a.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,a&&this.init(a,h)}p(Xe,E),Xe.prototype.init=function(a,h){const d=this.type=a.type,m=a.changedTouches&&a.changedTouches.length?a.changedTouches[0]:null;this.target=a.target||a.srcElement,this.g=h,h=a.relatedTarget,h||(d=="mouseover"?h=a.fromElement:d=="mouseout"&&(h=a.toElement)),this.relatedTarget=h,m?(this.clientX=m.clientX!==void 0?m.clientX:m.pageX,this.clientY=m.clientY!==void 0?m.clientY:m.pageY,this.screenX=m.screenX||0,this.screenY=m.screenY||0):(this.clientX=a.clientX!==void 0?a.clientX:a.pageX,this.clientY=a.clientY!==void 0?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0),this.button=a.button,this.key=a.key||"",this.ctrlKey=a.ctrlKey,this.altKey=a.altKey,this.shiftKey=a.shiftKey,this.metaKey=a.metaKey,this.pointerId=a.pointerId||0,this.pointerType=a.pointerType,this.state=a.state,this.i=a,a.defaultPrevented&&Xe.Z.h.call(this)},Xe.prototype.h=function(){Xe.Z.h.call(this);const a=this.i;a.preventDefault?a.preventDefault():a.returnValue=!1};var qn="closure_listenable_"+(Math.random()*1e6|0),fI=0;function pI(a,h,d,m,b){this.listener=a,this.proxy=null,this.src=h,this.type=d,this.capture=!!m,this.ha=b,this.key=++fI,this.da=this.fa=!1}function To(a){a.da=!0,a.listener=null,a.proxy=null,a.src=null,a.ha=null}function vo(a,h,d){for(const m in a)h.call(d,a[m],m,a)}function mI(a,h){for(const d in a)h.call(void 0,a[d],d,a)}function Mh(a){const h={};for(const d in a)h[d]=a[d];return h}const Lh="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function Fh(a,h){let d,m;for(let b=1;b<arguments.length;b++){m=arguments[b];for(d in m)a[d]=m[d];for(let P=0;P<Lh.length;P++)d=Lh[P],Object.prototype.hasOwnProperty.call(m,d)&&(a[d]=m[d])}}function Ao(a){this.src=a,this.g={},this.h=0}Ao.prototype.add=function(a,h,d,m,b){const P=a.toString();a=this.g[P],a||(a=this.g[P]=[],this.h++);const M=yc(a,h,m,b);return M>-1?(h=a[M],d||(h.fa=!1)):(h=new pI(h,this.src,P,!!m,b),h.fa=d,a.push(h)),h};function _c(a,h){const d=h.type;if(d in a.g){var m=a.g[d],b=Array.prototype.indexOf.call(m,h,void 0),P;(P=b>=0)&&Array.prototype.splice.call(m,b,1),P&&(To(h),a.g[d].length==0&&(delete a.g[d],a.h--))}}function yc(a,h,d,m){for(let b=0;b<a.length;++b){const P=a[b];if(!P.da&&P.listener==h&&P.capture==!!d&&P.ha==m)return b}return-1}var Ic="closure_lm_"+(Math.random()*1e6|0),wc={};function Uh(a,h,d,m,b){if(Array.isArray(h)){for(let P=0;P<h.length;P++)Uh(a,h[P],d,m,b);return null}return d=$h(d),a&&a[qn]?a.J(h,d,c(m)?!!m.capture:!1,b):gI(a,h,d,!1,m,b)}function gI(a,h,d,m,b,P){if(!h)throw Error("Invalid event type");const M=c(b)?!!b.capture:!!b;let K=Tc(a);if(K||(a[Ic]=K=new Ao(a)),d=K.add(h,d,m,M,P),d.proxy)return d;if(m=_I(),d.proxy=m,m.src=a,m.listener=d,a.addEventListener)R||(b=M),b===void 0&&(b=!1),a.addEventListener(h.toString(),m,b);else if(a.attachEvent)a.attachEvent(qh(h.toString()),m);else if(a.addListener&&a.removeListener)a.addListener(m);else throw Error("addEventListener and attachEvent are unavailable.");return d}function _I(){function a(d){return h.call(a.src,a.listener,d)}const h=yI;return a}function Bh(a,h,d,m,b){if(Array.isArray(h))for(var P=0;P<h.length;P++)Bh(a,h[P],d,m,b);else m=c(m)?!!m.capture:!!m,d=$h(d),a&&a[qn]?(a=a.i,P=String(h).toString(),P in a.g&&(h=a.g[P],d=yc(h,d,m,b),d>-1&&(To(h[d]),Array.prototype.splice.call(h,d,1),h.length==0&&(delete a.g[P],a.h--)))):a&&(a=Tc(a))&&(h=a.g[h.toString()],a=-1,h&&(a=yc(h,d,m,b)),(d=a>-1?h[a]:null)&&Ec(d))}function Ec(a){if(typeof a!="number"&&a&&!a.da){var h=a.src;if(h&&h[qn])_c(h.i,a);else{var d=a.type,m=a.proxy;h.removeEventListener?h.removeEventListener(d,m,a.capture):h.detachEvent?h.detachEvent(qh(d),m):h.addListener&&h.removeListener&&h.removeListener(m),(d=Tc(h))?(_c(d,a),d.h==0&&(d.src=null,h[Ic]=null)):To(a)}}}function qh(a){return a in wc?wc[a]:wc[a]="on"+a}function yI(a,h){if(a.da)a=!0;else{h=new Xe(h,this);const d=a.listener,m=a.ha||a.src;a.fa&&Ec(a),a=d.call(m,h)}return a}function Tc(a){return a=a[Ic],a instanceof Ao?a:null}var vc="__closure_events_fn_"+(Math.random()*1e9>>>0);function $h(a){return typeof a=="function"?a:(a[vc]||(a[vc]=function(h){return a.handleEvent(h)}),a[vc])}function Ue(){T.call(this),this.i=new Ao(this),this.M=this,this.G=null}p(Ue,T),Ue.prototype[qn]=!0,Ue.prototype.removeEventListener=function(a,h,d,m){Bh(this,a,h,d,m)};function Ge(a,h){var d,m=a.G;if(m)for(d=[];m;m=m.G)d.push(m);if(a=a.M,m=h.type||h,typeof h=="string")h=new E(h,a);else if(h instanceof E)h.target=h.target||a;else{var b=h;h=new E(m,a),Fh(h,b)}b=!0;let P,M;if(d)for(M=d.length-1;M>=0;M--)P=h.g=d[M],b=bo(P,m,!0,h)&&b;if(P=h.g=a,b=bo(P,m,!0,h)&&b,b=bo(P,m,!1,h)&&b,d)for(M=0;M<d.length;M++)P=h.g=d[M],b=bo(P,m,!1,h)&&b}Ue.prototype.N=function(){if(Ue.Z.N.call(this),this.i){var a=this.i;for(const h in a.g){const d=a.g[h];for(let m=0;m<d.length;m++)To(d[m]);delete a.g[h],a.h--}}this.G=null},Ue.prototype.J=function(a,h,d,m){return this.i.add(String(a),h,!1,d,m)},Ue.prototype.K=function(a,h,d,m){return this.i.add(String(a),h,!0,d,m)};function bo(a,h,d,m){if(h=a.i.g[String(h)],!h)return!0;h=h.concat();let b=!0;for(let P=0;P<h.length;++P){const M=h[P];if(M&&!M.da&&M.capture==d){const K=M.listener,Se=M.ha||M.src;M.fa&&_c(a.i,M),b=K.call(Se,m)!==!1&&b}}return b&&!m.defaultPrevented}function II(a,h){if(typeof a!="function")if(a&&typeof a.handleEvent=="function")a=l(a.handleEvent,a);else throw Error("Invalid listener argument");return Number(h)>2147483647?-1:o.setTimeout(a,h||0)}function zh(a){a.g=II(()=>{a.g=null,a.i&&(a.i=!1,zh(a))},a.l);const h=a.h;a.h=null,a.m.apply(null,h)}class wI extends T{constructor(h,d){super(),this.m=h,this.l=d,this.h=null,this.i=!1,this.g=null}j(h){this.h=arguments,this.g?this.i=!0:zh(this)}N(){super.N(),this.g&&(o.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Vi(a){T.call(this),this.h=a,this.g={}}p(Vi,T);var jh=[];function Gh(a){vo(a.g,function(h,d){this.g.hasOwnProperty(d)&&Ec(h)},a),a.g={}}Vi.prototype.N=function(){Vi.Z.N.call(this),Gh(this)},Vi.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Ac=o.JSON.stringify,EI=o.JSON.parse,TI=class{stringify(a){return o.JSON.stringify(a,void 0)}parse(a){return o.JSON.parse(a,void 0)}};function Wh(){}function Kh(){}var Oi={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function bc(){E.call(this,"d")}p(bc,E);function Rc(){E.call(this,"c")}p(Rc,E);var $n={},Hh=null;function Ro(){return Hh=Hh||new Ue}$n.Ia="serverreachability";function Qh(a){E.call(this,$n.Ia,a)}p(Qh,E);function xi(a){const h=Ro();Ge(h,new Qh(h))}$n.STAT_EVENT="statevent";function Jh(a,h){E.call(this,$n.STAT_EVENT,a),this.stat=h}p(Jh,E);function We(a){const h=Ro();Ge(h,new Jh(h,a))}$n.Ja="timingevent";function Yh(a,h){E.call(this,$n.Ja,a),this.size=h}p(Yh,E);function Mi(a,h){if(typeof a!="function")throw Error("Fn must not be null and must be a function");return o.setTimeout(function(){a()},h)}function Li(){this.g=!0}Li.prototype.ua=function(){this.g=!1};function vI(a,h,d,m,b,P){a.info(function(){if(a.g)if(P){var M="",K=P.split("&");for(let se=0;se<K.length;se++){var Se=K[se].split("=");if(Se.length>1){const De=Se[0];Se=Se[1];const At=De.split("_");M=At.length>=2&&At[1]=="type"?M+(De+"="+Se+"&"):M+(De+"=redacted&")}}}else M=null;else M=P;return"XMLHTTP REQ ("+m+") [attempt "+b+"]: "+h+`
`+d+`
`+M})}function AI(a,h,d,m,b,P,M){a.info(function(){return"XMLHTTP RESP ("+m+") [ attempt "+b+"]: "+h+`
`+d+`
`+P+" "+M})}function Cr(a,h,d,m){a.info(function(){return"XMLHTTP TEXT ("+h+"): "+RI(a,d)+(m?" "+m:"")})}function bI(a,h){a.info(function(){return"TIMEOUT: "+h})}Li.prototype.info=function(){};function RI(a,h){if(!a.g)return h;if(!h)return null;try{const P=JSON.parse(h);if(P){for(a=0;a<P.length;a++)if(Array.isArray(P[a])){var d=P[a];if(!(d.length<2)){var m=d[1];if(Array.isArray(m)&&!(m.length<1)){var b=m[0];if(b!="noop"&&b!="stop"&&b!="close")for(let M=1;M<m.length;M++)m[M]=""}}}}return Ac(P)}catch{return h}}var So={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},Xh={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},Zh;function Sc(){}p(Sc,Wh),Sc.prototype.g=function(){return new XMLHttpRequest},Zh=new Sc;function Fi(a){return encodeURIComponent(String(a))}function SI(a){var h=1;a=a.split(":");const d=[];for(;h>0&&a.length;)d.push(a.shift()),h--;return a.length&&d.push(a.join(":")),d}function tn(a,h,d,m){this.j=a,this.i=h,this.l=d,this.S=m||1,this.V=new Vi(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new ed}function ed(){this.i=null,this.g="",this.h=!1}var td={},Pc={};function Cc(a,h,d){a.M=1,a.A=Co(vt(h)),a.u=d,a.R=!0,nd(a,null)}function nd(a,h){a.F=Date.now(),Po(a),a.B=vt(a.A);var d=a.B,m=a.S;Array.isArray(m)||(m=[String(m)]),md(d.i,"t",m),a.C=0,d=a.j.L,a.h=new ed,a.g=Vd(a.j,d?h:null,!a.u),a.P>0&&(a.O=new wI(l(a.Y,a,a.g),a.P)),h=a.V,d=a.g,m=a.ba;var b="readystatechange";Array.isArray(b)||(b&&(jh[0]=b.toString()),b=jh);for(let P=0;P<b.length;P++){const M=Uh(d,b[P],m||h.handleEvent,!1,h.h||h);if(!M)break;h.g[M.key]=M}h=a.J?Mh(a.J):{},a.u?(a.v||(a.v="POST"),h["Content-Type"]="application/x-www-form-urlencoded",a.g.ea(a.B,a.v,a.u,h)):(a.v="GET",a.g.ea(a.B,a.v,null,h)),xi(),vI(a.i,a.v,a.B,a.l,a.S,a.u)}tn.prototype.ba=function(a){a=a.target;const h=this.O;h&&sn(a)==3?h.j():this.Y(a)},tn.prototype.Y=function(a){try{if(a==this.g)e:{const K=sn(this.g),Se=this.g.ya(),se=this.g.ca();if(!(K<3)&&(K!=3||this.g&&(this.h.h||this.g.la()||Td(this.g)))){this.K||K!=4||Se==7||(Se==8||se<=0?xi(3):xi(2)),kc(this);var h=this.g.ca();this.X=h;var d=PI(this);if(this.o=h==200,AI(this.i,this.v,this.B,this.l,this.S,K,h),this.o){if(this.U&&!this.L){t:{if(this.g){var m,b=this.g;if((m=b.g?b.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!y(m)){var P=m;break t}}P=null}if(a=P)Cr(this.i,this.l,a,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Dc(this,a);else{this.o=!1,this.m=3,We(12),zn(this),Ui(this);break e}}if(this.R){a=!0;let De;for(;!this.K&&this.C<d.length;)if(De=CI(this,d),De==Pc){K==4&&(this.m=4,We(14),a=!1),Cr(this.i,this.l,null,"[Incomplete Response]");break}else if(De==td){this.m=4,We(15),Cr(this.i,this.l,d,"[Invalid Chunk]"),a=!1;break}else Cr(this.i,this.l,De,null),Dc(this,De);if(rd(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),K!=4||d.length!=0||this.h.h||(this.m=1,We(16),a=!1),this.o=this.o&&a,!a)Cr(this.i,this.l,d,"[Invalid Chunked Response]"),zn(this),Ui(this);else if(d.length>0&&!this.W){this.W=!0;var M=this.j;M.g==this&&M.aa&&!M.P&&(M.j.info("Great, no buffering proxy detected. Bytes received: "+d.length),Uc(M),M.P=!0,We(11))}}else Cr(this.i,this.l,d,null),Dc(this,d);K==4&&zn(this),this.o&&!this.K&&(K==4?Cd(this.j,this):(this.o=!1,Po(this)))}else zI(this.g),h==400&&d.indexOf("Unknown SID")>0?(this.m=3,We(12)):(this.m=0,We(13)),zn(this),Ui(this)}}}catch{}finally{}};function PI(a){if(!rd(a))return a.g.la();const h=Td(a.g);if(h==="")return"";let d="";const m=h.length,b=sn(a.g)==4;if(!a.h.i){if(typeof TextDecoder>"u")return zn(a),Ui(a),"";a.h.i=new o.TextDecoder}for(let P=0;P<m;P++)a.h.h=!0,d+=a.h.i.decode(h[P],{stream:!(b&&P==m-1)});return h.length=0,a.h.g+=d,a.C=0,a.h.g}function rd(a){return a.g?a.v=="GET"&&a.M!=2&&a.j.Aa:!1}function CI(a,h){var d=a.C,m=h.indexOf(`
`,d);return m==-1?Pc:(d=Number(h.substring(d,m)),isNaN(d)?td:(m+=1,m+d>h.length?Pc:(h=h.slice(m,m+d),a.C=m+d,h)))}tn.prototype.cancel=function(){this.K=!0,zn(this)};function Po(a){a.T=Date.now()+a.H,id(a,a.H)}function id(a,h){if(a.D!=null)throw Error("WatchDog timer not null");a.D=Mi(l(a.aa,a),h)}function kc(a){a.D&&(o.clearTimeout(a.D),a.D=null)}tn.prototype.aa=function(){this.D=null;const a=Date.now();a-this.T>=0?(bI(this.i,this.B),this.M!=2&&(xi(),We(17)),zn(this),this.m=2,Ui(this)):id(this,this.T-a)};function Ui(a){a.j.I==0||a.K||Cd(a.j,a)}function zn(a){kc(a);var h=a.O;h&&typeof h.dispose=="function"&&h.dispose(),a.O=null,Gh(a.V),a.g&&(h=a.g,a.g=null,h.abort(),h.dispose())}function Dc(a,h){try{var d=a.j;if(d.I!=0&&(d.g==a||Nc(d.h,a))){if(!a.L&&Nc(d.h,a)&&d.I==3){try{var m=d.Ba.g.parse(h)}catch{m=null}if(Array.isArray(m)&&m.length==3){var b=m;if(b[0]==0){e:if(!d.v){if(d.g)if(d.g.F+3e3<a.F)Oo(d),No(d);else break e;Fc(d),We(18)}}else d.xa=b[1],0<d.xa-d.K&&b[2]<37500&&d.F&&d.A==0&&!d.C&&(d.C=Mi(l(d.Va,d),6e3));ad(d.h)<=1&&d.ta&&(d.ta=void 0)}else Gn(d,11)}else if((a.L||d.g==a)&&Oo(d),!y(h))for(b=d.Ba.g.parse(h),h=0;h<b.length;h++){let se=b[h];const De=se[0];if(!(De<=d.K))if(d.K=De,se=se[1],d.I==2)if(se[0]=="c"){d.M=se[1],d.ba=se[2];const At=se[3];At!=null&&(d.ka=At,d.j.info("VER="+d.ka));const Wn=se[4];Wn!=null&&(d.za=Wn,d.j.info("SVER="+d.za));const on=se[5];on!=null&&typeof on=="number"&&on>0&&(m=1.5*on,d.O=m,d.j.info("backChannelRequestTimeoutMs_="+m)),m=d;const an=a.g;if(an){const Mo=an.g?an.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(Mo){var P=m.h;P.g||Mo.indexOf("spdy")==-1&&Mo.indexOf("quic")==-1&&Mo.indexOf("h2")==-1||(P.j=P.l,P.g=new Set,P.h&&(Vc(P,P.h),P.h=null))}if(m.G){const Bc=an.g?an.g.getResponseHeader("X-HTTP-Session-Id"):null;Bc&&(m.wa=Bc,ue(m.J,m.G,Bc))}}d.I=3,d.l&&d.l.ra(),d.aa&&(d.T=Date.now()-a.F,d.j.info("Handshake RTT: "+d.T+"ms")),m=d;var M=a;if(m.na=Nd(m,m.L?m.ba:null,m.W),M.L){cd(m.h,M);var K=M,Se=m.O;Se&&(K.H=Se),K.D&&(kc(K),Po(K)),m.g=M}else Sd(m);d.i.length>0&&Vo(d)}else se[0]!="stop"&&se[0]!="close"||Gn(d,7);else d.I==3&&(se[0]=="stop"||se[0]=="close"?se[0]=="stop"?Gn(d,7):Lc(d):se[0]!="noop"&&d.l&&d.l.qa(se),d.A=0)}}xi(4)}catch{}}var kI=class{constructor(a,h){this.g=a,this.map=h}};function sd(a){this.l=a||10,o.PerformanceNavigationTiming?(a=o.performance.getEntriesByType("navigation"),a=a.length>0&&(a[0].nextHopProtocol=="hq"||a[0].nextHopProtocol=="h2")):a=!!(o.chrome&&o.chrome.loadTimes&&o.chrome.loadTimes()&&o.chrome.loadTimes().wasFetchedViaSpdy),this.j=a?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function od(a){return a.h?!0:a.g?a.g.size>=a.j:!1}function ad(a){return a.h?1:a.g?a.g.size:0}function Nc(a,h){return a.h?a.h==h:a.g?a.g.has(h):!1}function Vc(a,h){a.g?a.g.add(h):a.h=h}function cd(a,h){a.h&&a.h==h?a.h=null:a.g&&a.g.has(h)&&a.g.delete(h)}sd.prototype.cancel=function(){if(this.i=ud(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const a of this.g.values())a.cancel();this.g.clear()}};function ud(a){if(a.h!=null)return a.i.concat(a.h.G);if(a.g!=null&&a.g.size!==0){let h=a.i;for(const d of a.g.values())h=h.concat(d.G);return h}return v(a.i)}var ld=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function DI(a,h){if(a){a=a.split("&");for(let d=0;d<a.length;d++){const m=a[d].indexOf("=");let b,P=null;m>=0?(b=a[d].substring(0,m),P=a[d].substring(m+1)):b=a[d],h(b,P?decodeURIComponent(P.replace(/\+/g," ")):"")}}}function nn(a){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let h;a instanceof nn?(this.l=a.l,Bi(this,a.j),this.o=a.o,this.g=a.g,qi(this,a.u),this.h=a.h,Oc(this,gd(a.i)),this.m=a.m):a&&(h=String(a).match(ld))?(this.l=!1,Bi(this,h[1]||"",!0),this.o=$i(h[2]||""),this.g=$i(h[3]||"",!0),qi(this,h[4]),this.h=$i(h[5]||"",!0),Oc(this,h[6]||"",!0),this.m=$i(h[7]||"")):(this.l=!1,this.i=new ji(null,this.l))}nn.prototype.toString=function(){const a=[];var h=this.j;h&&a.push(zi(h,hd,!0),":");var d=this.g;return(d||h=="file")&&(a.push("//"),(h=this.o)&&a.push(zi(h,hd,!0),"@"),a.push(Fi(d).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),d=this.u,d!=null&&a.push(":",String(d))),(d=this.h)&&(this.g&&d.charAt(0)!="/"&&a.push("/"),a.push(zi(d,d.charAt(0)=="/"?OI:VI,!0))),(d=this.i.toString())&&a.push("?",d),(d=this.m)&&a.push("#",zi(d,MI)),a.join("")},nn.prototype.resolve=function(a){const h=vt(this);let d=!!a.j;d?Bi(h,a.j):d=!!a.o,d?h.o=a.o:d=!!a.g,d?h.g=a.g:d=a.u!=null;var m=a.h;if(d)qi(h,a.u);else if(d=!!a.h){if(m.charAt(0)!="/")if(this.g&&!this.h)m="/"+m;else{var b=h.h.lastIndexOf("/");b!=-1&&(m=h.h.slice(0,b+1)+m)}if(b=m,b==".."||b==".")m="";else if(b.indexOf("./")!=-1||b.indexOf("/.")!=-1){m=b.lastIndexOf("/",0)==0,b=b.split("/");const P=[];for(let M=0;M<b.length;){const K=b[M++];K=="."?m&&M==b.length&&P.push(""):K==".."?((P.length>1||P.length==1&&P[0]!="")&&P.pop(),m&&M==b.length&&P.push("")):(P.push(K),m=!0)}m=P.join("/")}else m=b}return d?h.h=m:d=a.i.toString()!=="",d?Oc(h,gd(a.i)):d=!!a.m,d&&(h.m=a.m),h};function vt(a){return new nn(a)}function Bi(a,h,d){a.j=d?$i(h,!0):h,a.j&&(a.j=a.j.replace(/:$/,""))}function qi(a,h){if(h){if(h=Number(h),isNaN(h)||h<0)throw Error("Bad port number "+h);a.u=h}else a.u=null}function Oc(a,h,d){h instanceof ji?(a.i=h,LI(a.i,a.l)):(d||(h=zi(h,xI)),a.i=new ji(h,a.l))}function ue(a,h,d){a.i.set(h,d)}function Co(a){return ue(a,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),a}function $i(a,h){return a?h?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""}function zi(a,h,d){return typeof a=="string"?(a=encodeURI(a).replace(h,NI),d&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null}function NI(a){return a=a.charCodeAt(0),"%"+(a>>4&15).toString(16)+(a&15).toString(16)}var hd=/[#\/\?@]/g,VI=/[#\?:]/g,OI=/[#\?]/g,xI=/[#\?@]/g,MI=/#/g;function ji(a,h){this.h=this.g=null,this.i=a||null,this.j=!!h}function jn(a){a.g||(a.g=new Map,a.h=0,a.i&&DI(a.i,function(h,d){a.add(decodeURIComponent(h.replace(/\+/g," ")),d)}))}r=ji.prototype,r.add=function(a,h){jn(this),this.i=null,a=kr(this,a);let d=this.g.get(a);return d||this.g.set(a,d=[]),d.push(h),this.h+=1,this};function dd(a,h){jn(a),h=kr(a,h),a.g.has(h)&&(a.i=null,a.h-=a.g.get(h).length,a.g.delete(h))}function fd(a,h){return jn(a),h=kr(a,h),a.g.has(h)}r.forEach=function(a,h){jn(this),this.g.forEach(function(d,m){d.forEach(function(b){a.call(h,b,m,this)},this)},this)};function pd(a,h){jn(a);let d=[];if(typeof h=="string")fd(a,h)&&(d=d.concat(a.g.get(kr(a,h))));else for(a=Array.from(a.g.values()),h=0;h<a.length;h++)d=d.concat(a[h]);return d}r.set=function(a,h){return jn(this),this.i=null,a=kr(this,a),fd(this,a)&&(this.h-=this.g.get(a).length),this.g.set(a,[h]),this.h+=1,this},r.get=function(a,h){return a?(a=pd(this,a),a.length>0?String(a[0]):h):h};function md(a,h,d){dd(a,h),d.length>0&&(a.i=null,a.g.set(kr(a,h),v(d)),a.h+=d.length)}r.toString=function(){if(this.i)return this.i;if(!this.g)return"";const a=[],h=Array.from(this.g.keys());for(let m=0;m<h.length;m++){var d=h[m];const b=Fi(d);d=pd(this,d);for(let P=0;P<d.length;P++){let M=b;d[P]!==""&&(M+="="+Fi(d[P])),a.push(M)}}return this.i=a.join("&")};function gd(a){const h=new ji;return h.i=a.i,a.g&&(h.g=new Map(a.g),h.h=a.h),h}function kr(a,h){return h=String(h),a.j&&(h=h.toLowerCase()),h}function LI(a,h){h&&!a.j&&(jn(a),a.i=null,a.g.forEach(function(d,m){const b=m.toLowerCase();m!=b&&(dd(this,m),md(this,b,d))},a)),a.j=h}function FI(a,h){const d=new Li;if(o.Image){const m=new Image;m.onload=f(rn,d,"TestLoadImage: loaded",!0,h,m),m.onerror=f(rn,d,"TestLoadImage: error",!1,h,m),m.onabort=f(rn,d,"TestLoadImage: abort",!1,h,m),m.ontimeout=f(rn,d,"TestLoadImage: timeout",!1,h,m),o.setTimeout(function(){m.ontimeout&&m.ontimeout()},1e4),m.src=a}else h(!1)}function UI(a,h){const d=new Li,m=new AbortController,b=setTimeout(()=>{m.abort(),rn(d,"TestPingServer: timeout",!1,h)},1e4);fetch(a,{signal:m.signal}).then(P=>{clearTimeout(b),P.ok?rn(d,"TestPingServer: ok",!0,h):rn(d,"TestPingServer: server error",!1,h)}).catch(()=>{clearTimeout(b),rn(d,"TestPingServer: error",!1,h)})}function rn(a,h,d,m,b){try{b&&(b.onload=null,b.onerror=null,b.onabort=null,b.ontimeout=null),m(d)}catch{}}function BI(){this.g=new TI}function xc(a){this.i=a.Sb||null,this.h=a.ab||!1}p(xc,Wh),xc.prototype.g=function(){return new ko(this.i,this.h)};function ko(a,h){Ue.call(this),this.H=a,this.o=h,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}p(ko,Ue),r=ko.prototype,r.open=function(a,h){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=a,this.D=h,this.readyState=1,Wi(this)},r.send=function(a){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const h={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};a&&(h.body=a),(this.H||o).fetch(new Request(this.D,h)).then(this.Pa.bind(this),this.ga.bind(this))},r.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,Gi(this)),this.readyState=0},r.Pa=function(a){if(this.g&&(this.l=a,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=a.headers,this.readyState=2,Wi(this)),this.g&&(this.readyState=3,Wi(this),this.g)))if(this.responseType==="arraybuffer")a.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof o.ReadableStream<"u"&&"body"in a){if(this.j=a.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;_d(this)}else a.text().then(this.Oa.bind(this),this.ga.bind(this))};function _d(a){a.j.read().then(a.Ma.bind(a)).catch(a.ga.bind(a))}r.Ma=function(a){if(this.g){if(this.o&&a.value)this.response.push(a.value);else if(!this.o){var h=a.value?a.value:new Uint8Array(0);(h=this.B.decode(h,{stream:!a.done}))&&(this.response=this.responseText+=h)}a.done?Gi(this):Wi(this),this.readyState==3&&_d(this)}},r.Oa=function(a){this.g&&(this.response=this.responseText=a,Gi(this))},r.Na=function(a){this.g&&(this.response=a,Gi(this))},r.ga=function(){this.g&&Gi(this)};function Gi(a){a.readyState=4,a.l=null,a.j=null,a.B=null,Wi(a)}r.setRequestHeader=function(a,h){this.A.append(a,h)},r.getResponseHeader=function(a){return this.h&&this.h.get(a.toLowerCase())||""},r.getAllResponseHeaders=function(){if(!this.h)return"";const a=[],h=this.h.entries();for(var d=h.next();!d.done;)d=d.value,a.push(d[0]+": "+d[1]),d=h.next();return a.join(`\r
`)};function Wi(a){a.onreadystatechange&&a.onreadystatechange.call(a)}Object.defineProperty(ko.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(a){this.m=a?"include":"same-origin"}});function yd(a){let h="";return vo(a,function(d,m){h+=m,h+=":",h+=d,h+=`\r
`}),h}function Mc(a,h,d){e:{for(m in d){var m=!1;break e}m=!0}m||(d=yd(d),typeof a=="string"?d!=null&&Fi(d):ue(a,h,d))}function _e(a){Ue.call(this),this.headers=new Map,this.L=a||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}p(_e,Ue);var qI=/^https?$/i,$I=["POST","PUT"];r=_e.prototype,r.Fa=function(a){this.H=a},r.ea=function(a,h,d,m){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+a);h=h?h.toUpperCase():"GET",this.D=a,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():Zh.g(),this.g.onreadystatechange=g(l(this.Ca,this));try{this.B=!0,this.g.open(h,String(a),!0),this.B=!1}catch(P){Id(this,P);return}if(a=d||"",d=new Map(this.headers),m)if(Object.getPrototypeOf(m)===Object.prototype)for(var b in m)d.set(b,m[b]);else if(typeof m.keys=="function"&&typeof m.get=="function")for(const P of m.keys())d.set(P,m.get(P));else throw Error("Unknown input type for opt_headers: "+String(m));m=Array.from(d.keys()).find(P=>P.toLowerCase()=="content-type"),b=o.FormData&&a instanceof o.FormData,!(Array.prototype.indexOf.call($I,h,void 0)>=0)||m||b||d.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[P,M]of d)this.g.setRequestHeader(P,M);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(a),this.v=!1}catch(P){Id(this,P)}};function Id(a,h){a.h=!1,a.g&&(a.j=!0,a.g.abort(),a.j=!1),a.l=h,a.o=5,wd(a),Do(a)}function wd(a){a.A||(a.A=!0,Ge(a,"complete"),Ge(a,"error"))}r.abort=function(a){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=a||7,Ge(this,"complete"),Ge(this,"abort"),Do(this))},r.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Do(this,!0)),_e.Z.N.call(this)},r.Ca=function(){this.u||(this.B||this.v||this.j?Ed(this):this.Xa())},r.Xa=function(){Ed(this)};function Ed(a){if(a.h&&typeof s<"u"){if(a.v&&sn(a)==4)setTimeout(a.Ca.bind(a),0);else if(Ge(a,"readystatechange"),sn(a)==4){a.h=!1;try{const P=a.ca();e:switch(P){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var h=!0;break e;default:h=!1}var d;if(!(d=h)){var m;if(m=P===0){let M=String(a.D).match(ld)[1]||null;!M&&o.self&&o.self.location&&(M=o.self.location.protocol.slice(0,-1)),m=!qI.test(M?M.toLowerCase():"")}d=m}if(d)Ge(a,"complete"),Ge(a,"success");else{a.o=6;try{var b=sn(a)>2?a.g.statusText:""}catch{b=""}a.l=b+" ["+a.ca()+"]",wd(a)}}finally{Do(a)}}}}function Do(a,h){if(a.g){a.m&&(clearTimeout(a.m),a.m=null);const d=a.g;a.g=null,h||Ge(a,"ready");try{d.onreadystatechange=null}catch{}}}r.isActive=function(){return!!this.g};function sn(a){return a.g?a.g.readyState:0}r.ca=function(){try{return sn(this)>2?this.g.status:-1}catch{return-1}},r.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},r.La=function(a){if(this.g){var h=this.g.responseText;return a&&h.indexOf(a)==0&&(h=h.substring(a.length)),EI(h)}};function Td(a){try{if(!a.g)return null;if("response"in a.g)return a.g.response;switch(a.F){case"":case"text":return a.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in a.g)return a.g.mozResponseArrayBuffer}return null}catch{return null}}function zI(a){const h={};a=(a.g&&sn(a)>=2&&a.g.getAllResponseHeaders()||"").split(`\r
`);for(let m=0;m<a.length;m++){if(y(a[m]))continue;var d=SI(a[m]);const b=d[0];if(d=d[1],typeof d!="string")continue;d=d.trim();const P=h[b]||[];h[b]=P,P.push(d)}mI(h,function(m){return m.join(", ")})}r.ya=function(){return this.o},r.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function Ki(a,h,d){return d&&d.internalChannelParams&&d.internalChannelParams[a]||h}function vd(a){this.za=0,this.i=[],this.j=new Li,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=Ki("failFast",!1,a),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=Ki("baseRetryDelayMs",5e3,a),this.Za=Ki("retryDelaySeedMs",1e4,a),this.Ta=Ki("forwardChannelMaxRetries",2,a),this.va=Ki("forwardChannelRequestTimeoutMs",2e4,a),this.ma=a&&a.xmlHttpFactory||void 0,this.Ua=a&&a.Rb||void 0,this.Aa=a&&a.useFetchStreams||!1,this.O=void 0,this.L=a&&a.supportsCrossDomainXhr||!1,this.M="",this.h=new sd(a&&a.concurrentRequestLimit),this.Ba=new BI,this.S=a&&a.fastHandshake||!1,this.R=a&&a.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=a&&a.Pb||!1,a&&a.ua&&this.j.ua(),a&&a.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&a&&a.detectBufferingProxy||!1,this.ia=void 0,a&&a.longPollingTimeout&&a.longPollingTimeout>0&&(this.ia=a.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}r=vd.prototype,r.ka=8,r.I=1,r.connect=function(a,h,d,m){We(0),this.W=a,this.H=h||{},d&&m!==void 0&&(this.H.OSID=d,this.H.OAID=m),this.F=this.X,this.J=Nd(this,null,this.W),Vo(this)};function Lc(a){if(Ad(a),a.I==3){var h=a.V++,d=vt(a.J);if(ue(d,"SID",a.M),ue(d,"RID",h),ue(d,"TYPE","terminate"),Hi(a,d),h=new tn(a,a.j,h),h.M=2,h.A=Co(vt(d)),d=!1,o.navigator&&o.navigator.sendBeacon)try{d=o.navigator.sendBeacon(h.A.toString(),"")}catch{}!d&&o.Image&&(new Image().src=h.A,d=!0),d||(h.g=Vd(h.j,null),h.g.ea(h.A)),h.F=Date.now(),Po(h)}Dd(a)}function No(a){a.g&&(Uc(a),a.g.cancel(),a.g=null)}function Ad(a){No(a),a.v&&(o.clearTimeout(a.v),a.v=null),Oo(a),a.h.cancel(),a.m&&(typeof a.m=="number"&&o.clearTimeout(a.m),a.m=null)}function Vo(a){if(!od(a.h)&&!a.m){a.m=!0;var h=a.Ea;te||_(),Y||(te(),Y=!0),w.add(h,a),a.D=0}}function jI(a,h){return ad(a.h)>=a.h.j-(a.m?1:0)?!1:a.m?(a.i=h.G.concat(a.i),!0):a.I==1||a.I==2||a.D>=(a.Sa?0:a.Ta)?!1:(a.m=Mi(l(a.Ea,a,h),kd(a,a.D)),a.D++,!0)}r.Ea=function(a){if(this.m)if(this.m=null,this.I==1){if(!a){this.V=Math.floor(Math.random()*1e5),a=this.V++;const b=new tn(this,this.j,a);let P=this.o;if(this.U&&(P?(P=Mh(P),Fh(P,this.U)):P=this.U),this.u!==null||this.R||(b.J=P,P=null),this.S)e:{for(var h=0,d=0;d<this.i.length;d++){t:{var m=this.i[d];if("__data__"in m.map&&(m=m.map.__data__,typeof m=="string")){m=m.length;break t}m=void 0}if(m===void 0)break;if(h+=m,h>4096){h=d;break e}if(h===4096||d===this.i.length-1){h=d+1;break e}}h=1e3}else h=1e3;h=Rd(this,b,h),d=vt(this.J),ue(d,"RID",a),ue(d,"CVER",22),this.G&&ue(d,"X-HTTP-Session-Id",this.G),Hi(this,d),P&&(this.R?h="headers="+Fi(yd(P))+"&"+h:this.u&&Mc(d,this.u,P)),Vc(this.h,b),this.Ra&&ue(d,"TYPE","init"),this.S?(ue(d,"$req",h),ue(d,"SID","null"),b.U=!0,Cc(b,d,null)):Cc(b,d,h),this.I=2}}else this.I==3&&(a?bd(this,a):this.i.length==0||od(this.h)||bd(this))};function bd(a,h){var d;h?d=h.l:d=a.V++;const m=vt(a.J);ue(m,"SID",a.M),ue(m,"RID",d),ue(m,"AID",a.K),Hi(a,m),a.u&&a.o&&Mc(m,a.u,a.o),d=new tn(a,a.j,d,a.D+1),a.u===null&&(d.J=a.o),h&&(a.i=h.G.concat(a.i)),h=Rd(a,d,1e3),d.H=Math.round(a.va*.5)+Math.round(a.va*.5*Math.random()),Vc(a.h,d),Cc(d,m,h)}function Hi(a,h){a.H&&vo(a.H,function(d,m){ue(h,m,d)}),a.l&&vo({},function(d,m){ue(h,m,d)})}function Rd(a,h,d){d=Math.min(a.i.length,d);const m=a.l?l(a.l.Ka,a.l,a):null;e:{var b=a.i;let K=-1;for(;;){const Se=["count="+d];K==-1?d>0?(K=b[0].g,Se.push("ofs="+K)):K=0:Se.push("ofs="+K);let se=!0;for(let De=0;De<d;De++){var P=b[De].g;const At=b[De].map;if(P-=K,P<0)K=Math.max(0,b[De].g-100),se=!1;else try{P="req"+P+"_"||"";try{var M=At instanceof Map?At:Object.entries(At);for(const[Wn,on]of M){let an=on;c(on)&&(an=Ac(on)),Se.push(P+Wn+"="+encodeURIComponent(an))}}catch(Wn){throw Se.push(P+"type="+encodeURIComponent("_badmap")),Wn}}catch{m&&m(At)}}if(se){M=Se.join("&");break e}}M=void 0}return a=a.i.splice(0,d),h.G=a,M}function Sd(a){if(!a.g&&!a.v){a.Y=1;var h=a.Da;te||_(),Y||(te(),Y=!0),w.add(h,a),a.A=0}}function Fc(a){return a.g||a.v||a.A>=3?!1:(a.Y++,a.v=Mi(l(a.Da,a),kd(a,a.A)),a.A++,!0)}r.Da=function(){if(this.v=null,Pd(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var a=4*this.T;this.j.info("BP detection timer enabled: "+a),this.B=Mi(l(this.Wa,this),a)}},r.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,We(10),No(this),Pd(this))};function Uc(a){a.B!=null&&(o.clearTimeout(a.B),a.B=null)}function Pd(a){a.g=new tn(a,a.j,"rpc",a.Y),a.u===null&&(a.g.J=a.o),a.g.P=0;var h=vt(a.na);ue(h,"RID","rpc"),ue(h,"SID",a.M),ue(h,"AID",a.K),ue(h,"CI",a.F?"0":"1"),!a.F&&a.ia&&ue(h,"TO",a.ia),ue(h,"TYPE","xmlhttp"),Hi(a,h),a.u&&a.o&&Mc(h,a.u,a.o),a.O&&(a.g.H=a.O);var d=a.g;a=a.ba,d.M=1,d.A=Co(vt(h)),d.u=null,d.R=!0,nd(d,a)}r.Va=function(){this.C!=null&&(this.C=null,No(this),Fc(this),We(19))};function Oo(a){a.C!=null&&(o.clearTimeout(a.C),a.C=null)}function Cd(a,h){var d=null;if(a.g==h){Oo(a),Uc(a),a.g=null;var m=2}else if(Nc(a.h,h))d=h.G,cd(a.h,h),m=1;else return;if(a.I!=0){if(h.o)if(m==1){d=h.u?h.u.length:0,h=Date.now()-h.F;var b=a.D;m=Ro(),Ge(m,new Yh(m,d)),Vo(a)}else Sd(a);else if(b=h.m,b==3||b==0&&h.X>0||!(m==1&&jI(a,h)||m==2&&Fc(a)))switch(d&&d.length>0&&(h=a.h,h.i=h.i.concat(d)),b){case 1:Gn(a,5);break;case 4:Gn(a,10);break;case 3:Gn(a,6);break;default:Gn(a,2)}}}function kd(a,h){let d=a.Qa+Math.floor(Math.random()*a.Za);return a.isActive()||(d*=2),d*h}function Gn(a,h){if(a.j.info("Error code "+h),h==2){var d=l(a.bb,a),m=a.Ua;const b=!m;m=new nn(m||"//www.google.com/images/cleardot.gif"),o.location&&o.location.protocol=="http"||Bi(m,"https"),Co(m),b?FI(m.toString(),d):UI(m.toString(),d)}else We(2);a.I=0,a.l&&a.l.pa(h),Dd(a),Ad(a)}r.bb=function(a){a?(this.j.info("Successfully pinged google.com"),We(2)):(this.j.info("Failed to ping google.com"),We(1))};function Dd(a){if(a.I=0,a.ja=[],a.l){const h=ud(a.h);(h.length!=0||a.i.length!=0)&&(k(a.ja,h),k(a.ja,a.i),a.h.i.length=0,v(a.i),a.i.length=0),a.l.oa()}}function Nd(a,h,d){var m=d instanceof nn?vt(d):new nn(d);if(m.g!="")h&&(m.g=h+"."+m.g),qi(m,m.u);else{var b=o.location;m=b.protocol,h=h?h+"."+b.hostname:b.hostname,b=+b.port;const P=new nn(null);m&&Bi(P,m),h&&(P.g=h),b&&qi(P,b),d&&(P.h=d),m=P}return d=a.G,h=a.wa,d&&h&&ue(m,d,h),ue(m,"VER",a.ka),Hi(a,m),m}function Vd(a,h,d){if(h&&!a.L)throw Error("Can't create secondary domain capable XhrIo object.");return h=a.Aa&&!a.ma?new _e(new xc({ab:d})):new _e(a.ma),h.Fa(a.L),h}r.isActive=function(){return!!this.l&&this.l.isActive(this)};function Od(){}r=Od.prototype,r.ra=function(){},r.qa=function(){},r.pa=function(){},r.oa=function(){},r.isActive=function(){return!0},r.Ka=function(){};function xo(){}xo.prototype.g=function(a,h){return new rt(a,h)};function rt(a,h){Ue.call(this),this.g=new vd(h),this.l=a,this.h=h&&h.messageUrlParams||null,a=h&&h.messageHeaders||null,h&&h.clientProtocolHeaderRequired&&(a?a["X-Client-Protocol"]="webchannel":a={"X-Client-Protocol":"webchannel"}),this.g.o=a,a=h&&h.initMessageHeaders||null,h&&h.messageContentType&&(a?a["X-WebChannel-Content-Type"]=h.messageContentType:a={"X-WebChannel-Content-Type":h.messageContentType}),h&&h.sa&&(a?a["X-WebChannel-Client-Profile"]=h.sa:a={"X-WebChannel-Client-Profile":h.sa}),this.g.U=a,(a=h&&h.Qb)&&!y(a)&&(this.g.u=a),this.A=h&&h.supportsCrossDomainXhr||!1,this.v=h&&h.sendRawJson||!1,(h=h&&h.httpSessionIdParam)&&!y(h)&&(this.g.G=h,a=this.h,a!==null&&h in a&&(a=this.h,h in a&&delete a[h])),this.j=new Dr(this)}p(rt,Ue),rt.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},rt.prototype.close=function(){Lc(this.g)},rt.prototype.o=function(a){var h=this.g;if(typeof a=="string"){var d={};d.__data__=a,a=d}else this.v&&(d={},d.__data__=Ac(a),a=d);h.i.push(new kI(h.Ya++,a)),h.I==3&&Vo(h)},rt.prototype.N=function(){this.g.l=null,delete this.j,Lc(this.g),delete this.g,rt.Z.N.call(this)};function xd(a){bc.call(this),a.__headers__&&(this.headers=a.__headers__,this.statusCode=a.__status__,delete a.__headers__,delete a.__status__);var h=a.__sm__;if(h){e:{for(const d in h){a=d;break e}a=void 0}(this.i=a)&&(a=this.i,h=h!==null&&a in h?h[a]:void 0),this.data=h}else this.data=a}p(xd,bc);function Md(){Rc.call(this),this.status=1}p(Md,Rc);function Dr(a){this.g=a}p(Dr,Od),Dr.prototype.ra=function(){Ge(this.g,"a")},Dr.prototype.qa=function(a){Ge(this.g,new xd(a))},Dr.prototype.pa=function(a){Ge(this.g,new Md)},Dr.prototype.oa=function(){Ge(this.g,"b")},xo.prototype.createWebChannel=xo.prototype.g,rt.prototype.send=rt.prototype.o,rt.prototype.open=rt.prototype.m,rt.prototype.close=rt.prototype.close,Ag=function(){return new xo},vg=function(){return Ro()},Tg=$n,yu={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},So.NO_ERROR=0,So.TIMEOUT=8,So.HTTP_ERROR=6,Qo=So,Xh.COMPLETE="complete",Eg=Xh,Kh.EventType=Oi,Oi.OPEN="a",Oi.CLOSE="b",Oi.ERROR="c",Oi.MESSAGE="d",Ue.prototype.listen=Ue.prototype.J,as=Kh,_e.prototype.listenOnce=_e.prototype.K,_e.prototype.getLastError=_e.prototype.Ha,_e.prototype.getLastErrorCode=_e.prototype.ya,_e.prototype.getStatus=_e.prototype.ca,_e.prototype.getResponseJson=_e.prototype.La,_e.prototype.getResponseText=_e.prototype.la,_e.prototype.send=_e.prototype.ea,_e.prototype.setWithCredentials=_e.prototype.Fa,wg=_e}).apply(typeof Fo<"u"?Fo:typeof self<"u"?self:typeof window<"u"?window:{});const wf="@firebase/firestore",Ef="4.9.3";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ve{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}Ve.UNAUTHENTICATED=new Ve(null),Ve.GOOGLE_CREDENTIALS=new Ve("google-credentials-uid"),Ve.FIRST_PARTY=new Ve("first-party-uid"),Ve.MOCK_USER=new Ve("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let bi="12.7.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rn=new Va("@firebase/firestore");function Ur(){return Rn.logLevel}function Qb(r){Rn.setLogLevel(r)}function V(r,...e){if(Rn.logLevel<=H.DEBUG){const t=e.map(Rl);Rn.debug(`Firestore (${bi}): ${r}`,...t)}}function Ee(r,...e){if(Rn.logLevel<=H.ERROR){const t=e.map(Rl);Rn.error(`Firestore (${bi}): ${r}`,...t)}}function Ut(r,...e){if(Rn.logLevel<=H.WARN){const t=e.map(Rl);Rn.warn(`Firestore (${bi}): ${r}`,...t)}}function Rl(r){if(typeof r=="string")return r;try{/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/return function(t){return JSON.stringify(t)}(r)}catch{return r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function F(r,e,t){let n="Unexpected state";typeof e=="string"?n=e:t=e,bg(r,n,t)}function bg(r,e,t){let n=`FIRESTORE (${bi}) INTERNAL ASSERTION FAILED: ${e} (ID: ${r.toString(16)})`;if(t!==void 0)try{n+=" CONTEXT: "+JSON.stringify(t)}catch{n+=" CONTEXT: "+t}throw Ee(n),new Error(n)}function U(r,e,t,n){let i="Unexpected state";typeof t=="string"?i=t:n=t,r||bg(e,i,n)}function Jb(r,e){r||F(57014,e)}function L(r,e){return r}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const S={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class C extends Qe{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Le{constructor(){this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rg{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class Yb{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable(()=>t(Ve.UNAUTHENTICATED))}shutdown(){}}class Xb{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable(()=>t(this.token.user))}shutdown(){this.changeListener=null}}class Zb{constructor(e){this.t=e,this.currentUser=Ve.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,t){U(this.o===void 0,42304);let n=this.i;const i=u=>this.i!==n?(n=this.i,t(u)):Promise.resolve();let s=new Le;this.o=()=>{this.i++,this.currentUser=this.u(),s.resolve(),s=new Le,e.enqueueRetryable(()=>i(this.currentUser))};const o=()=>{const u=s;e.enqueueRetryable(async()=>{await u.promise,await i(this.currentUser)})},c=u=>{V("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=u,this.o&&(this.auth.addAuthTokenListener(this.o),o())};this.t.onInit(u=>c(u)),setTimeout(()=>{if(!this.auth){const u=this.t.getImmediate({optional:!0});u?c(u):(V("FirebaseAuthCredentialsProvider","Auth not yet detected"),s.resolve(),s=new Le)}},0),o()}getToken(){const e=this.i,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then(n=>this.i!==e?(V("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):n?(U(typeof n.accessToken=="string",31837,{l:n}),new Rg(n.accessToken,this.currentUser)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const e=this.auth&&this.auth.getUid();return U(e===null||typeof e=="string",2055,{h:e}),new Ve(e)}}class eR{constructor(e,t,n){this.P=e,this.T=t,this.I=n,this.type="FirstParty",this.user=Ve.FIRST_PARTY,this.A=new Map}R(){return this.I?this.I():null}get headers(){this.A.set("X-Goog-AuthUser",this.P);const e=this.R();return e&&this.A.set("Authorization",e),this.T&&this.A.set("X-Goog-Iam-Authorization-Token",this.T),this.A}}class tR{constructor(e,t,n){this.P=e,this.T=t,this.I=n}getToken(){return Promise.resolve(new eR(this.P,this.T,this.I))}start(e,t){e.enqueueRetryable(()=>t(Ve.FIRST_PARTY))}shutdown(){}invalidateToken(){}}class Tf{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class nR{constructor(e,t){this.V=t,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,de(e)&&e.settings.appCheckToken&&(this.p=e.settings.appCheckToken)}start(e,t){U(this.o===void 0,3512);const n=s=>{s.error!=null&&V("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${s.error.message}`);const o=s.token!==this.m;return this.m=s.token,V("FirebaseAppCheckTokenProvider",`Received ${o?"new":"existing"} token.`),o?t(s.token):Promise.resolve()};this.o=s=>{e.enqueueRetryable(()=>n(s))};const i=s=>{V("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=s,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit(s=>i(s)),setTimeout(()=>{if(!this.appCheck){const s=this.V.getImmediate({optional:!0});s?i(s):V("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}},0)}getToken(){if(this.p)return Promise.resolve(new Tf(this.p));const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then(t=>t?(U(typeof t.token=="string",44558,{tokenResult:t}),this.m=t.token,new Tf(t.token)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rR(r){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(r);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let n=0;n<r;n++)t[n]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sl{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516);let n="";for(;n.length<20;){const i=rR(40);for(let s=0;s<i.length;++s)n.length<20&&i[s]<t&&(n+=e.charAt(i[s]%62))}return n}}function G(r,e){return r<e?-1:r>e?1:0}function Iu(r,e){const t=Math.min(r.length,e.length);for(let n=0;n<t;n++){const i=r.charAt(n),s=e.charAt(n);if(i!==s)return Xc(i)===Xc(s)?G(i,s):Xc(i)?1:-1}return G(r.length,e.length)}const iR=55296,sR=57343;function Xc(r){const e=r.charCodeAt(0);return e>=iR&&e<=sR}function ti(r,e,t){return r.length===e.length&&r.every((n,i)=>t(n,e[i]))}function Sg(r){return r+"\0"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const vf="__name__";class bt{constructor(e,t,n){t===void 0?t=0:t>e.length&&F(637,{offset:t,range:e.length}),n===void 0?n=e.length-t:n>e.length-t&&F(1746,{length:n,range:e.length-t}),this.segments=e,this.offset=t,this.len=n}get length(){return this.len}isEqual(e){return bt.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof bt?e.forEach(n=>{t.push(n)}):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,n=this.limit();t<n;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const n=Math.min(e.length,t.length);for(let i=0;i<n;i++){const s=bt.compareSegments(e.get(i),t.get(i));if(s!==0)return s}return G(e.length,t.length)}static compareSegments(e,t){const n=bt.isNumericId(e),i=bt.isNumericId(t);return n&&!i?-1:!n&&i?1:n&&i?bt.extractNumericId(e).compare(bt.extractNumericId(t)):Iu(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return In.fromString(e.substring(4,e.length-2))}}class Q extends bt{construct(e,t,n){return new Q(e,t,n)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const n of e){if(n.indexOf("//")>=0)throw new C(S.INVALID_ARGUMENT,`Invalid segment (${n}). Paths must not contain // in them.`);t.push(...n.split("/").filter(i=>i.length>0))}return new Q(t)}static emptyPath(){return new Q([])}}const oR=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class fe extends bt{construct(e,t,n){return new fe(e,t,n)}static isValidIdentifier(e){return oR.test(e)}canonicalString(){return this.toArray().map(e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),fe.isValidIdentifier(e)||(e="`"+e+"`"),e)).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===vf}static keyField(){return new fe([vf])}static fromServerFormat(e){const t=[];let n="",i=0;const s=()=>{if(n.length===0)throw new C(S.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(n),n=""};let o=!1;for(;i<e.length;){const c=e[i];if(c==="\\"){if(i+1===e.length)throw new C(S.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const u=e[i+1];if(u!=="\\"&&u!=="."&&u!=="`")throw new C(S.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);n+=u,i+=2}else c==="`"?(o=!o,i++):c!=="."||o?(n+=c,i++):(s(),i++)}if(s(),o)throw new C(S.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new fe(t)}static emptyPath(){return new fe([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class x{constructor(e){this.path=e}static fromPath(e){return new x(Q.fromString(e))}static fromName(e){return new x(Q.fromString(e).popFirst(5))}static empty(){return new x(Q.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&Q.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return Q.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new x(new Q(e.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pl(r,e,t){if(!t)throw new C(S.INVALID_ARGUMENT,`Function ${r}() cannot be called with an empty ${e}.`)}function Pg(r,e,t,n){if(e===!0&&n===!0)throw new C(S.INVALID_ARGUMENT,`${r} and ${t} cannot be used together.`)}function Af(r){if(!x.isDocumentKey(r))throw new C(S.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${r} has ${r.length}.`)}function bf(r){if(x.isDocumentKey(r))throw new C(S.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${r} has ${r.length}.`)}function Cg(r){return typeof r=="object"&&r!==null&&(Object.getPrototypeOf(r)===Object.prototype||Object.getPrototypeOf(r)===null)}function Ga(r){if(r===void 0)return"undefined";if(r===null)return"null";if(typeof r=="string")return r.length>20&&(r=`${r.substring(0,20)}...`),JSON.stringify(r);if(typeof r=="number"||typeof r=="boolean")return""+r;if(typeof r=="object"){if(r instanceof Array)return"an array";{const e=function(n){return n.constructor?n.constructor.name:null}(r);return e?`a custom ${e} object`:"an object"}}return typeof r=="function"?"a function":F(12329,{type:typeof r})}function Z(r,e){if("_delegate"in r&&(r=r._delegate),!(r instanceof e)){if(e.name===r.constructor.name)throw new C(S.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=Ga(r);throw new C(S.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return r}function kg(r,e){if(e<=0)throw new C(S.INVALID_ARGUMENT,`Function ${r}() requires a positive number, but it was: ${e}.`)}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Re(r,e){const t={typeString:r};return e&&(t.value=e),t}function oo(r,e){if(!Cg(r))throw new C(S.INVALID_ARGUMENT,"JSON must be an object");let t;for(const n in e)if(e[n]){const i=e[n].typeString,s="value"in e[n]?{value:e[n].value}:void 0;if(!(n in r)){t=`JSON missing required field: '${n}'`;break}const o=r[n];if(i&&typeof o!==i){t=`JSON field '${n}' must be a ${i}.`;break}if(s!==void 0&&o!==s.value){t=`Expected '${n}' field to equal '${s.value}'`;break}}if(t)throw new C(S.INVALID_ARGUMENT,t);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rf=-62135596800,Sf=1e6;class ne{static now(){return ne.fromMillis(Date.now())}static fromDate(e){return ne.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),n=Math.floor((e-1e3*t)*Sf);return new ne(t,n)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new C(S.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new C(S.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<Rf)throw new C(S.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new C(S.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/Sf}_compareTo(e){return this.seconds===e.seconds?G(this.nanoseconds,e.nanoseconds):G(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:ne._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(oo(e,ne._jsonSchema))return new ne(e.seconds,e.nanoseconds)}valueOf(){const e=this.seconds-Rf;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}ne._jsonSchemaVersion="firestore/timestamp/1.0",ne._jsonSchema={type:Re("string",ne._jsonSchemaVersion),seconds:Re("number"),nanoseconds:Re("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class B{static fromTimestamp(e){return new B(e)}static min(){return new B(new ne(0,0))}static max(){return new B(new ne(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ni=-1;class ma{constructor(e,t,n,i){this.indexId=e,this.collectionGroup=t,this.fields=n,this.indexState=i}}function wu(r){return r.fields.find(e=>e.kind===2)}function Qn(r){return r.fields.filter(e=>e.kind!==2)}ma.UNKNOWN_ID=-1;class Jo{constructor(e,t){this.fieldPath=e,this.kind=t}}class Ms{constructor(e,t){this.sequenceNumber=e,this.offset=t}static empty(){return new Ms(0,ut.min())}}function Dg(r,e){const t=r.toTimestamp().seconds,n=r.toTimestamp().nanoseconds+1,i=B.fromTimestamp(n===1e9?new ne(t+1,0):new ne(t,n));return new ut(i,x.empty(),e)}function Ng(r){return new ut(r.readTime,r.key,ni)}class ut{constructor(e,t,n){this.readTime=e,this.documentKey=t,this.largestBatchId=n}static min(){return new ut(B.min(),x.empty(),ni)}static max(){return new ut(B.max(),x.empty(),ni)}}function Cl(r,e){let t=r.readTime.compareTo(e.readTime);return t!==0?t:(t=x.comparator(r.documentKey,e.documentKey),t!==0?t:G(r.largestBatchId,e.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vg="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class Og{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach(e=>e())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Mn(r){if(r.code!==S.FAILED_PRECONDITION||r.message!==Vg)throw r;V("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class A{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e(t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)},t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)})}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&F(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new A((n,i)=>{this.nextCallback=s=>{this.wrapSuccess(e,s).next(n,i)},this.catchCallback=s=>{this.wrapFailure(t,s).next(n,i)}})}toPromise(){return new Promise((e,t)=>{this.next(e,t)})}wrapUserFunction(e){try{const t=e();return t instanceof A?t:A.resolve(t)}catch(t){return A.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction(()=>e(t)):A.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction(()=>e(t)):A.reject(t)}static resolve(e){return new A((t,n)=>{t(e)})}static reject(e){return new A((t,n)=>{n(e)})}static waitFor(e){return new A((t,n)=>{let i=0,s=0,o=!1;e.forEach(c=>{++i,c.next(()=>{++s,o&&s===i&&t()},u=>n(u))}),o=!0,s===i&&t()})}static or(e){let t=A.resolve(!1);for(const n of e)t=t.next(i=>i?A.resolve(i):n());return t}static forEach(e,t){const n=[];return e.forEach((i,s)=>{n.push(t.call(this,i,s))}),this.waitFor(n)}static mapArray(e,t){return new A((n,i)=>{const s=e.length,o=new Array(s);let c=0;for(let u=0;u<s;u++){const l=u;t(e[l]).next(f=>{o[l]=f,++c,c===s&&n(o)},f=>i(f))}})}static doWhile(e,t){return new A((n,i)=>{const s=()=>{e()===!0?t().next(()=>{s()},i):n()};s()})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const it="SimpleDb";class Wa{static open(e,t,n,i){try{return new Wa(t,e.transaction(i,n))}catch(s){throw new ys(t,s)}}constructor(e,t){this.action=e,this.transaction=t,this.aborted=!1,this.S=new Le,this.transaction.oncomplete=()=>{this.S.resolve()},this.transaction.onabort=()=>{t.error?this.S.reject(new ys(e,t.error)):this.S.resolve()},this.transaction.onerror=n=>{const i=kl(n.target.error);this.S.reject(new ys(e,i))}}get D(){return this.S.promise}abort(e){e&&this.S.reject(e),this.aborted||(V(it,"Aborting transaction:",e?e.message:"Client-initiated abort"),this.aborted=!0,this.transaction.abort())}C(){const e=this.transaction;this.aborted||typeof e.commit!="function"||e.commit()}store(e){const t=this.transaction.objectStore(e);return new cR(t)}}class Ot{static delete(e){return V(it,"Removing database:",e),Yn(Qu().indexedDB.deleteDatabase(e)).toPromise()}static v(){if(!Ss())return!1;if(Ot.F())return!0;const e=me(),t=Ot.M(e),n=0<t&&t<10,i=xg(e),s=0<i&&i<4.5;return!(e.indexOf("MSIE ")>0||e.indexOf("Trident/")>0||e.indexOf("Edge/")>0||n||s)}static F(){var e;return typeof process<"u"&&((e=process.__PRIVATE_env)==null?void 0:e.__PRIVATE_USE_MOCK_PERSISTENCE)==="YES"}static O(e,t){return e.store(t)}static M(e){const t=e.match(/i(?:phone|pad|pod) os ([\d_]+)/i),n=t?t[1].split("_").slice(0,2).join("."):"-1";return Number(n)}constructor(e,t,n){this.name=e,this.version=t,this.N=n,this.B=null,Ot.M(me())===12.2&&Ee("Firestore persistence suffers from a bug in iOS 12.2 Safari that may cause your app to stop working. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.")}async L(e){return this.db||(V(it,"Opening database:",this.name),this.db=await new Promise((t,n)=>{const i=indexedDB.open(this.name,this.version);i.onsuccess=s=>{const o=s.target.result;t(o)},i.onblocked=()=>{n(new ys(e,"Cannot upgrade IndexedDB schema while another tab is open. Close all tabs that access Firestore and reload this page to proceed."))},i.onerror=s=>{const o=s.target.error;o.name==="VersionError"?n(new C(S.FAILED_PRECONDITION,"A newer version of the Firestore SDK was previously used and so the persisted data is not compatible with the version of the SDK you are now using. The SDK will operate with persistence disabled. If you need persistence, please re-upgrade to a newer version of the SDK or else clear the persisted IndexedDB data for your app to start fresh.")):o.name==="InvalidStateError"?n(new C(S.FAILED_PRECONDITION,"Unable to open an IndexedDB connection. This could be due to running in a private browsing session on a browser whose private browsing sessions do not support IndexedDB: "+o)):n(new ys(e,o))},i.onupgradeneeded=s=>{V(it,'Database "'+this.name+'" requires upgrade from version:',s.oldVersion);const o=s.target.result;this.N.k(o,i.transaction,s.oldVersion,this.version).next(()=>{V(it,"Database upgrade to version "+this.version+" complete")})}})),this.q&&(this.db.onversionchange=t=>this.q(t)),this.db}$(e){this.q=e,this.db&&(this.db.onversionchange=t=>e(t))}async runTransaction(e,t,n,i){const s=t==="readonly";let o=0;for(;;){++o;try{this.db=await this.L(e);const c=Wa.open(this.db,e,s?"readonly":"readwrite",n),u=i(c).next(l=>(c.C(),l)).catch(l=>(c.abort(l),A.reject(l))).toPromise();return u.catch(()=>{}),await c.D,u}catch(c){const u=c,l=u.name!=="FirebaseError"&&o<3;if(V(it,"Transaction failed with error:",u.message,"Retrying:",l),this.close(),!l)return Promise.reject(u)}}}close(){this.db&&this.db.close(),this.db=void 0}}function xg(r){const e=r.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}class aR{constructor(e){this.U=e,this.K=!1,this.W=null}get isDone(){return this.K}get G(){return this.W}set cursor(e){this.U=e}done(){this.K=!0}j(e){this.W=e}delete(){return Yn(this.U.delete())}}class ys extends C{constructor(e,t){super(S.UNAVAILABLE,`IndexedDB transaction '${e}' failed: ${t}`),this.name="IndexedDbTransactionError"}}function Ln(r){return r.name==="IndexedDbTransactionError"}class cR{constructor(e){this.store=e}put(e,t){let n;return t!==void 0?(V(it,"PUT",this.store.name,e,t),n=this.store.put(t,e)):(V(it,"PUT",this.store.name,"<auto-key>",e),n=this.store.put(e)),Yn(n)}add(e){return V(it,"ADD",this.store.name,e,e),Yn(this.store.add(e))}get(e){return Yn(this.store.get(e)).next(t=>(t===void 0&&(t=null),V(it,"GET",this.store.name,e,t),t))}delete(e){return V(it,"DELETE",this.store.name,e),Yn(this.store.delete(e))}count(){return V(it,"COUNT",this.store.name),Yn(this.store.count())}J(e,t){const n=this.options(e,t),i=n.index?this.store.index(n.index):this.store;if(typeof i.getAll=="function"){const s=i.getAll(n.range);return new A((o,c)=>{s.onerror=u=>{c(u.target.error)},s.onsuccess=u=>{o(u.target.result)}})}{const s=this.cursor(n),o=[];return this.H(s,(c,u)=>{o.push(u)}).next(()=>o)}}Y(e,t){const n=this.store.getAll(e,t===null?void 0:t);return new A((i,s)=>{n.onerror=o=>{s(o.target.error)},n.onsuccess=o=>{i(o.target.result)}})}Z(e,t){V(it,"DELETE ALL",this.store.name);const n=this.options(e,t);n.X=!1;const i=this.cursor(n);return this.H(i,(s,o,c)=>c.delete())}ee(e,t){let n;t?n=e:(n={},t=e);const i=this.cursor(n);return this.H(i,t)}te(e){const t=this.cursor({});return new A((n,i)=>{t.onerror=s=>{const o=kl(s.target.error);i(o)},t.onsuccess=s=>{const o=s.target.result;o?e(o.primaryKey,o.value).next(c=>{c?o.continue():n()}):n()}})}H(e,t){const n=[];return new A((i,s)=>{e.onerror=o=>{s(o.target.error)},e.onsuccess=o=>{const c=o.target.result;if(!c)return void i();const u=new aR(c),l=t(c.primaryKey,c.value,u);if(l instanceof A){const f=l.catch(p=>(u.done(),A.reject(p)));n.push(f)}u.isDone?i():u.G===null?c.continue():c.continue(u.G)}}).next(()=>A.waitFor(n))}options(e,t){let n;return e!==void 0&&(typeof e=="string"?n=e:t=e),{index:n,range:t}}cursor(e){let t="next";if(e.reverse&&(t="prev"),e.index){const n=this.store.index(e.index);return e.X?n.openKeyCursor(e.range,t):n.openCursor(e.range,t)}return this.store.openCursor(e.range,t)}}function Yn(r){return new A((e,t)=>{r.onsuccess=n=>{const i=n.target.result;e(i)},r.onerror=n=>{const i=kl(n.target.error);t(i)}})}let Pf=!1;function kl(r){const e=Ot.M(me());if(e>=12.2&&e<13){const t="An internal error was encountered in the Indexed Database server";if(r.message.indexOf(t)>=0){const n=new C("internal",`IOS_INDEXEDDB_BUG1: IndexedDb has thrown '${t}'. This is likely due to an unavoidable bug in iOS. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.`);return Pf||(Pf=!0,setTimeout(()=>{throw n},0)),n}}return r}const Is="IndexBackfiller";class uR{constructor(e,t){this.asyncQueue=e,this.ne=t,this.task=null}start(){this.re(15e3)}stop(){this.task&&(this.task.cancel(),this.task=null)}get started(){return this.task!==null}re(e){V(Is,`Scheduled in ${e}ms`),this.task=this.asyncQueue.enqueueAfterDelay("index_backfill",e,async()=>{this.task=null;try{const t=await this.ne.ie();V(Is,`Documents written: ${t}`)}catch(t){Ln(t)?V(Is,"Ignoring IndexedDB error during index backfill: ",t):await Mn(t)}await this.re(6e4)})}}class lR{constructor(e,t){this.localStore=e,this.persistence=t}async ie(e=50){return this.persistence.runTransaction("Backfill Indexes","readwrite-primary",t=>this.se(t,e))}se(e,t){const n=new Set;let i=t,s=!0;return A.doWhile(()=>s===!0&&i>0,()=>this.localStore.indexManager.getNextCollectionGroupToUpdate(e).next(o=>{if(o!==null&&!n.has(o))return V(Is,`Processing collection: ${o}`),this.oe(e,o,i).next(c=>{i-=c,n.add(o)});s=!1})).next(()=>t-i)}oe(e,t,n){return this.localStore.indexManager.getMinOffsetFromCollectionGroup(e,t).next(i=>this.localStore.localDocuments.getNextDocuments(e,t,i,n).next(s=>{const o=s.changes;return this.localStore.indexManager.updateIndexEntries(e,o).next(()=>this._e(i,s)).next(c=>(V(Is,`Updating offset: ${c}`),this.localStore.indexManager.updateCollectionGroup(e,t,c))).next(()=>o.size)}))}_e(e,t){let n=e;return t.changes.forEach((i,s)=>{const o=Ng(s);Cl(o,n)>0&&(n=o)}),new ut(n.readTime,n.documentKey,Math.max(t.batchId,e.largestBatchId))}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class et{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=n=>this.ae(n),this.ue=n=>t.writeSequenceNumber(n))}ae(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.ue&&this.ue(e),e}}et.ce=-1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wn=-1;function ao(r){return r==null}function Ls(r){return r===0&&1/r==-1/0}function Mg(r){return typeof r=="number"&&Number.isInteger(r)&&!Ls(r)&&r<=Number.MAX_SAFE_INTEGER&&r>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ga="";function ze(r){let e="";for(let t=0;t<r.length;t++)e.length>0&&(e=Cf(e)),e=hR(r.get(t),e);return Cf(e)}function hR(r,e){let t=e;const n=r.length;for(let i=0;i<n;i++){const s=r.charAt(i);switch(s){case"\0":t+="";break;case ga:t+="";break;default:t+=s}}return t}function Cf(r){return r+ga+""}function Nt(r){const e=r.length;if(U(e>=2,64408,{path:r}),e===2)return U(r.charAt(0)===ga&&r.charAt(1)==="",56145,{path:r}),Q.emptyPath();const t=e-2,n=[];let i="";for(let s=0;s<e;){const o=r.indexOf(ga,s);switch((o<0||o>t)&&F(50515,{path:r}),r.charAt(o+1)){case"":const c=r.substring(s,o);let u;i.length===0?u=c:(i+=c,u=i,i=""),n.push(u);break;case"":i+=r.substring(s,o),i+="\0";break;case"":i+=r.substring(s,o+1);break;default:F(61167,{path:r})}s=o+2}return new Q(n)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Jn="remoteDocuments",co="owner",Vr="owner",Fs="mutationQueues",dR="userId",_t="mutations",kf="batchId",rr="userMutationsIndex",Df=["userId","batchId"];/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yo(r,e){return[r,ze(e)]}function Lg(r,e,t){return[r,ze(e),t]}const fR={},ri="documentMutations",_a="remoteDocumentsV14",pR=["prefixPath","collectionGroup","readTime","documentId"],Xo="documentKeyIndex",mR=["prefixPath","collectionGroup","documentId"],Fg="collectionGroupIndex",gR=["collectionGroup","readTime","prefixPath","documentId"],Us="remoteDocumentGlobal",Eu="remoteDocumentGlobalKey",ii="targets",Ug="queryTargetsIndex",_R=["canonicalId","targetId"],si="targetDocuments",yR=["targetId","path"],Dl="documentTargetsIndex",IR=["path","targetId"],ya="targetGlobalKey",ur="targetGlobal",Bs="collectionParents",wR=["collectionId","parent"],oi="clientMetadata",ER="clientId",Ka="bundles",TR="bundleId",Ha="namedQueries",vR="name",Nl="indexConfiguration",AR="indexId",Tu="collectionGroupIndex",bR="collectionGroup",ws="indexState",RR=["indexId","uid"],Bg="sequenceNumberIndex",SR=["uid","sequenceNumber"],Es="indexEntries",PR=["indexId","uid","arrayValue","directionalValue","orderedDocumentKey","documentKey"],qg="documentKeyIndex",CR=["indexId","uid","orderedDocumentKey"],Qa="documentOverlays",kR=["userId","collectionPath","documentId"],vu="collectionPathOverlayIndex",DR=["userId","collectionPath","largestBatchId"],$g="collectionGroupOverlayIndex",NR=["userId","collectionGroup","largestBatchId"],Vl="globals",VR="name",zg=[Fs,_t,ri,Jn,ii,co,ur,si,oi,Us,Bs,Ka,Ha],OR=[...zg,Qa],jg=[Fs,_t,ri,_a,ii,co,ur,si,oi,Us,Bs,Ka,Ha,Qa],Gg=jg,Ol=[...Gg,Nl,ws,Es],xR=Ol,Wg=[...Ol,Vl],MR=Wg;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Au extends Og{constructor(e,t){super(),this.le=e,this.currentSequenceNumber=t}}function ke(r,e){const t=L(r);return Ot.O(t.le,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Nf(r){let e=0;for(const t in r)Object.prototype.hasOwnProperty.call(r,t)&&e++;return e}function Fn(r,e){for(const t in r)Object.prototype.hasOwnProperty.call(r,t)&&e(t,r[t])}function Kg(r){for(const e in r)if(Object.prototype.hasOwnProperty.call(r,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ce{constructor(e,t){this.comparator=e,this.root=t||xe.EMPTY}insert(e,t){return new ce(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,xe.BLACK,null,null))}remove(e){return new ce(this.comparator,this.root.remove(e,this.comparator).copy(null,null,xe.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const n=this.comparator(e,t.key);if(n===0)return t.value;n<0?t=t.left:n>0&&(t=t.right)}return null}indexOf(e){let t=0,n=this.root;for(;!n.isEmpty();){const i=this.comparator(e,n.key);if(i===0)return t+n.left.size;i<0?n=n.left:(t+=n.left.size+1,n=n.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal((t,n)=>(e(t,n),!1))}toString(){const e=[];return this.inorderTraversal((t,n)=>(e.push(`${t}:${n}`),!1)),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new Uo(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new Uo(this.root,e,this.comparator,!1)}getReverseIterator(){return new Uo(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new Uo(this.root,e,this.comparator,!0)}}class Uo{constructor(e,t,n,i){this.isReverse=i,this.nodeStack=[];let s=1;for(;!e.isEmpty();)if(s=t?n(e.key,t):1,t&&i&&(s*=-1),s<0)e=this.isReverse?e.left:e.right;else{if(s===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class xe{constructor(e,t,n,i,s){this.key=e,this.value=t,this.color=n??xe.RED,this.left=i??xe.EMPTY,this.right=s??xe.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,n,i,s){return new xe(e??this.key,t??this.value,n??this.color,i??this.left,s??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,n){let i=this;const s=n(e,i.key);return i=s<0?i.copy(null,null,null,i.left.insert(e,t,n),null):s===0?i.copy(null,t,null,null,null):i.copy(null,null,null,null,i.right.insert(e,t,n)),i.fixUp()}removeMin(){if(this.left.isEmpty())return xe.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let n,i=this;if(t(e,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),t(e,i.key)===0){if(i.right.isEmpty())return xe.EMPTY;n=i.right.min(),i=i.copy(n.key,n.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,xe.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,xe.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw F(43730,{key:this.key,value:this.value});if(this.right.isRed())throw F(14113,{key:this.key,value:this.value});const e=this.left.check();if(e!==this.right.check())throw F(27949);return e+(this.isRed()?0:1)}}xe.EMPTY=null,xe.RED=!0,xe.BLACK=!1;xe.EMPTY=new class{constructor(){this.size=0}get key(){throw F(57766)}get value(){throw F(16141)}get color(){throw F(16727)}get left(){throw F(29726)}get right(){throw F(36894)}copy(e,t,n,i,s){return this}insert(e,t,n){return new xe(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ie{constructor(e){this.comparator=e,this.data=new ce(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal((t,n)=>(e(t),!1))}forEachInRange(e,t){const n=this.data.getIteratorFrom(e[0]);for(;n.hasNext();){const i=n.getNext();if(this.comparator(i.key,e[1])>=0)return;t(i.key)}}forEachWhile(e,t){let n;for(n=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();n.hasNext();)if(!e(n.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new Vf(this.data.getIterator())}getIteratorFrom(e){return new Vf(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach(n=>{t=t.add(n)}),t}isEqual(e){if(!(e instanceof ie)||this.size!==e.size)return!1;const t=this.data.getIterator(),n=e.data.getIterator();for(;t.hasNext();){const i=t.getNext().key,s=n.getNext().key;if(this.comparator(i,s)!==0)return!1}return!0}toArray(){const e=[];return this.forEach(t=>{e.push(t)}),e}toString(){const e=[];return this.forEach(t=>e.push(t)),"SortedSet("+e.toString()+")"}copy(e){const t=new ie(this.comparator);return t.data=e,t}}class Vf{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}function Or(r){return r.hasNext()?r.getNext():void 0}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tt{constructor(e){this.fields=e,e.sort(fe.comparator)}static empty(){return new tt([])}unionWith(e){let t=new ie(fe.comparator);for(const n of this.fields)t=t.add(n);for(const n of e)t=t.add(n);return new tt(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return ti(this.fields,e.fields,(t,n)=>t.isEqual(n))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hg extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function LR(){return typeof atob<"u"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ye{constructor(e){this.binaryString=e}static fromBase64String(e){const t=function(i){try{return atob(i)}catch(s){throw typeof DOMException<"u"&&s instanceof DOMException?new Hg("Invalid base64 string: "+s):s}}(e);return new ye(t)}static fromUint8Array(e){const t=function(i){let s="";for(let o=0;o<i.length;++o)s+=String.fromCharCode(i[o]);return s}(e);return new ye(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return function(t){return btoa(t)}(this.binaryString)}toUint8Array(){return function(t){const n=new Uint8Array(t.length);for(let i=0;i<t.length;i++)n[i]=t.charCodeAt(i);return n}(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return G(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}ye.EMPTY_BYTE_STRING=new ye("");const FR=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function Wt(r){if(U(!!r,39018),typeof r=="string"){let e=0;const t=FR.exec(r);if(U(!!t,46558,{timestamp:r}),t[1]){let i=t[1];i=(i+"000000000").substr(0,9),e=Number(i)}const n=new Date(r);return{seconds:Math.floor(n.getTime()/1e3),nanos:e}}return{seconds:he(r.seconds),nanos:he(r.nanos)}}function he(r){return typeof r=="number"?r:typeof r=="string"?Number(r):0}function Kt(r){return typeof r=="string"?ye.fromBase64String(r):ye.fromUint8Array(r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qg="server_timestamp",Jg="__type__",Yg="__previous_value__",Xg="__local_write_time__";function Ja(r){var t,n;return((n=(((t=r==null?void 0:r.mapValue)==null?void 0:t.fields)||{})[Jg])==null?void 0:n.stringValue)===Qg}function Ya(r){const e=r.mapValue.fields[Yg];return Ja(e)?Ya(e):e}function qs(r){const e=Wt(r.mapValue.fields[Xg].timestampValue);return new ne(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class UR{constructor(e,t,n,i,s,o,c,u,l,f){this.databaseId=e,this.appId=t,this.persistenceKey=n,this.host=i,this.ssl=s,this.forceLongPolling=o,this.autoDetectLongPolling=c,this.longPollingOptions=u,this.useFetchStreams=l,this.isUsingEmulator=f}}const bu="(default)";class Sn{constructor(e,t){this.projectId=e,this.database=t||bu}static empty(){return new Sn("","")}get isDefaultDatabase(){return this.database===bu}isEqual(e){return e instanceof Sn&&e.projectId===this.projectId&&e.database===this.database}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xl="__type__",Zg="__max__",mn={mapValue:{fields:{__type__:{stringValue:Zg}}}},Ml="__vector__",ai="value",Zo={nullValue:"NULL_VALUE"};function Pn(r){return"nullValue"in r?0:"booleanValue"in r?1:"integerValue"in r||"doubleValue"in r?2:"timestampValue"in r?3:"stringValue"in r?5:"bytesValue"in r?6:"referenceValue"in r?7:"geoPointValue"in r?8:"arrayValue"in r?9:"mapValue"in r?Ja(r)?4:e_(r)?9007199254740991:Xa(r)?10:11:F(28295,{value:r})}function Bt(r,e){if(r===e)return!0;const t=Pn(r);if(t!==Pn(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return r.booleanValue===e.booleanValue;case 4:return qs(r).isEqual(qs(e));case 3:return function(i,s){if(typeof i.timestampValue=="string"&&typeof s.timestampValue=="string"&&i.timestampValue.length===s.timestampValue.length)return i.timestampValue===s.timestampValue;const o=Wt(i.timestampValue),c=Wt(s.timestampValue);return o.seconds===c.seconds&&o.nanos===c.nanos}(r,e);case 5:return r.stringValue===e.stringValue;case 6:return function(i,s){return Kt(i.bytesValue).isEqual(Kt(s.bytesValue))}(r,e);case 7:return r.referenceValue===e.referenceValue;case 8:return function(i,s){return he(i.geoPointValue.latitude)===he(s.geoPointValue.latitude)&&he(i.geoPointValue.longitude)===he(s.geoPointValue.longitude)}(r,e);case 2:return function(i,s){if("integerValue"in i&&"integerValue"in s)return he(i.integerValue)===he(s.integerValue);if("doubleValue"in i&&"doubleValue"in s){const o=he(i.doubleValue),c=he(s.doubleValue);return o===c?Ls(o)===Ls(c):isNaN(o)&&isNaN(c)}return!1}(r,e);case 9:return ti(r.arrayValue.values||[],e.arrayValue.values||[],Bt);case 10:case 11:return function(i,s){const o=i.mapValue.fields||{},c=s.mapValue.fields||{};if(Nf(o)!==Nf(c))return!1;for(const u in o)if(o.hasOwnProperty(u)&&(c[u]===void 0||!Bt(o[u],c[u])))return!1;return!0}(r,e);default:return F(52216,{left:r})}}function $s(r,e){return(r.values||[]).find(t=>Bt(t,e))!==void 0}function Cn(r,e){if(r===e)return 0;const t=Pn(r),n=Pn(e);if(t!==n)return G(t,n);switch(t){case 0:case 9007199254740991:return 0;case 1:return G(r.booleanValue,e.booleanValue);case 2:return function(s,o){const c=he(s.integerValue||s.doubleValue),u=he(o.integerValue||o.doubleValue);return c<u?-1:c>u?1:c===u?0:isNaN(c)?isNaN(u)?0:-1:1}(r,e);case 3:return Of(r.timestampValue,e.timestampValue);case 4:return Of(qs(r),qs(e));case 5:return Iu(r.stringValue,e.stringValue);case 6:return function(s,o){const c=Kt(s),u=Kt(o);return c.compareTo(u)}(r.bytesValue,e.bytesValue);case 7:return function(s,o){const c=s.split("/"),u=o.split("/");for(let l=0;l<c.length&&l<u.length;l++){const f=G(c[l],u[l]);if(f!==0)return f}return G(c.length,u.length)}(r.referenceValue,e.referenceValue);case 8:return function(s,o){const c=G(he(s.latitude),he(o.latitude));return c!==0?c:G(he(s.longitude),he(o.longitude))}(r.geoPointValue,e.geoPointValue);case 9:return xf(r.arrayValue,e.arrayValue);case 10:return function(s,o){var g,v,k,D;const c=s.fields||{},u=o.fields||{},l=(g=c[ai])==null?void 0:g.arrayValue,f=(v=u[ai])==null?void 0:v.arrayValue,p=G(((k=l==null?void 0:l.values)==null?void 0:k.length)||0,((D=f==null?void 0:f.values)==null?void 0:D.length)||0);return p!==0?p:xf(l,f)}(r.mapValue,e.mapValue);case 11:return function(s,o){if(s===mn.mapValue&&o===mn.mapValue)return 0;if(s===mn.mapValue)return 1;if(o===mn.mapValue)return-1;const c=s.fields||{},u=Object.keys(c),l=o.fields||{},f=Object.keys(l);u.sort(),f.sort();for(let p=0;p<u.length&&p<f.length;++p){const g=Iu(u[p],f[p]);if(g!==0)return g;const v=Cn(c[u[p]],l[f[p]]);if(v!==0)return v}return G(u.length,f.length)}(r.mapValue,e.mapValue);default:throw F(23264,{he:t})}}function Of(r,e){if(typeof r=="string"&&typeof e=="string"&&r.length===e.length)return G(r,e);const t=Wt(r),n=Wt(e),i=G(t.seconds,n.seconds);return i!==0?i:G(t.nanos,n.nanos)}function xf(r,e){const t=r.values||[],n=e.values||[];for(let i=0;i<t.length&&i<n.length;++i){const s=Cn(t[i],n[i]);if(s)return s}return G(t.length,n.length)}function ci(r){return Ru(r)}function Ru(r){return"nullValue"in r?"null":"booleanValue"in r?""+r.booleanValue:"integerValue"in r?""+r.integerValue:"doubleValue"in r?""+r.doubleValue:"timestampValue"in r?function(t){const n=Wt(t);return`time(${n.seconds},${n.nanos})`}(r.timestampValue):"stringValue"in r?r.stringValue:"bytesValue"in r?function(t){return Kt(t).toBase64()}(r.bytesValue):"referenceValue"in r?function(t){return x.fromName(t).toString()}(r.referenceValue):"geoPointValue"in r?function(t){return`geo(${t.latitude},${t.longitude})`}(r.geoPointValue):"arrayValue"in r?function(t){let n="[",i=!0;for(const s of t.values||[])i?i=!1:n+=",",n+=Ru(s);return n+"]"}(r.arrayValue):"mapValue"in r?function(t){const n=Object.keys(t.fields||{}).sort();let i="{",s=!0;for(const o of n)s?s=!1:i+=",",i+=`${o}:${Ru(t.fields[o])}`;return i+"}"}(r.mapValue):F(61005,{value:r})}function ea(r){switch(Pn(r)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const e=Ya(r);return e?16+ea(e):16;case 5:return 2*r.stringValue.length;case 6:return Kt(r.bytesValue).approximateByteSize();case 7:return r.referenceValue.length;case 9:return function(n){return(n.values||[]).reduce((i,s)=>i+ea(s),0)}(r.arrayValue);case 10:case 11:return function(n){let i=0;return Fn(n.fields,(s,o)=>{i+=s.length+ea(o)}),i}(r.mapValue);default:throw F(13486,{value:r})}}function fr(r,e){return{referenceValue:`projects/${r.projectId}/databases/${r.database}/documents/${e.path.canonicalString()}`}}function Su(r){return!!r&&"integerValue"in r}function zs(r){return!!r&&"arrayValue"in r}function Mf(r){return!!r&&"nullValue"in r}function Lf(r){return!!r&&"doubleValue"in r&&isNaN(Number(r.doubleValue))}function ta(r){return!!r&&"mapValue"in r}function Xa(r){var t,n;return((n=(((t=r==null?void 0:r.mapValue)==null?void 0:t.fields)||{})[xl])==null?void 0:n.stringValue)===Ml}function Ts(r){if(r.geoPointValue)return{geoPointValue:{...r.geoPointValue}};if(r.timestampValue&&typeof r.timestampValue=="object")return{timestampValue:{...r.timestampValue}};if(r.mapValue){const e={mapValue:{fields:{}}};return Fn(r.mapValue.fields,(t,n)=>e.mapValue.fields[t]=Ts(n)),e}if(r.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(r.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=Ts(r.arrayValue.values[t]);return e}return{...r}}function e_(r){return(((r.mapValue||{}).fields||{}).__type__||{}).stringValue===Zg}const t_={mapValue:{fields:{[xl]:{stringValue:Ml},[ai]:{arrayValue:{}}}}};function BR(r){return"nullValue"in r?Zo:"booleanValue"in r?{booleanValue:!1}:"integerValue"in r||"doubleValue"in r?{doubleValue:NaN}:"timestampValue"in r?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"stringValue"in r?{stringValue:""}:"bytesValue"in r?{bytesValue:""}:"referenceValue"in r?fr(Sn.empty(),x.empty()):"geoPointValue"in r?{geoPointValue:{latitude:-90,longitude:-180}}:"arrayValue"in r?{arrayValue:{}}:"mapValue"in r?Xa(r)?t_:{mapValue:{}}:F(35942,{value:r})}function qR(r){return"nullValue"in r?{booleanValue:!1}:"booleanValue"in r?{doubleValue:NaN}:"integerValue"in r||"doubleValue"in r?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"timestampValue"in r?{stringValue:""}:"stringValue"in r?{bytesValue:""}:"bytesValue"in r?fr(Sn.empty(),x.empty()):"referenceValue"in r?{geoPointValue:{latitude:-90,longitude:-180}}:"geoPointValue"in r?{arrayValue:{}}:"arrayValue"in r?t_:"mapValue"in r?Xa(r)?{mapValue:{}}:mn:F(61959,{value:r})}function Ff(r,e){const t=Cn(r.value,e.value);return t!==0?t:r.inclusive&&!e.inclusive?-1:!r.inclusive&&e.inclusive?1:0}function Uf(r,e){const t=Cn(r.value,e.value);return t!==0?t:r.inclusive&&!e.inclusive?1:!r.inclusive&&e.inclusive?-1:0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Me{constructor(e){this.value=e}static empty(){return new Me({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let n=0;n<e.length-1;++n)if(t=(t.mapValue.fields||{})[e.get(n)],!ta(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=Ts(t)}setAll(e){let t=fe.emptyPath(),n={},i=[];e.forEach((o,c)=>{if(!t.isImmediateParentOf(c)){const u=this.getFieldsMap(t);this.applyChanges(u,n,i),n={},i=[],t=c.popLast()}o?n[c.lastSegment()]=Ts(o):i.push(c.lastSegment())});const s=this.getFieldsMap(t);this.applyChanges(s,n,i)}delete(e){const t=this.field(e.popLast());ta(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return Bt(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let n=0;n<e.length;++n){let i=t.mapValue.fields[e.get(n)];ta(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},t.mapValue.fields[e.get(n)]=i),t=i}return t.mapValue.fields}applyChanges(e,t,n){Fn(t,(i,s)=>e[i]=s);for(const i of n)delete e[i]}clone(){return new Me(Ts(this.value))}}function n_(r){const e=[];return Fn(r.fields,(t,n)=>{const i=new fe([t]);if(ta(n)){const s=n_(n.mapValue).fields;if(s.length===0)e.push(i);else for(const o of s)e.push(i.child(o))}else e.push(i)}),new tt(e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class le{constructor(e,t,n,i,s,o,c){this.key=e,this.documentType=t,this.version=n,this.readTime=i,this.createTime=s,this.data=o,this.documentState=c}static newInvalidDocument(e){return new le(e,0,B.min(),B.min(),B.min(),Me.empty(),0)}static newFoundDocument(e,t,n,i){return new le(e,1,t,B.min(),n,i,0)}static newNoDocument(e,t){return new le(e,2,t,B.min(),B.min(),Me.empty(),0)}static newUnknownDocument(e,t){return new le(e,3,t,B.min(),B.min(),Me.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(B.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=Me.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=Me.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=B.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof le&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new le(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kn{constructor(e,t){this.position=e,this.inclusive=t}}function Bf(r,e,t){let n=0;for(let i=0;i<r.position.length;i++){const s=e[i],o=r.position[i];if(s.field.isKeyField()?n=x.comparator(x.fromName(o.referenceValue),t.key):n=Cn(o,t.data.field(s.field)),s.dir==="desc"&&(n*=-1),n!==0)break}return n}function qf(r,e){if(r===null)return e===null;if(e===null||r.inclusive!==e.inclusive||r.position.length!==e.position.length)return!1;for(let t=0;t<r.position.length;t++)if(!Bt(r.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class js{constructor(e,t="asc"){this.field=e,this.dir=t}}function $R(r,e){return r.dir===e.dir&&r.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class r_{}class J extends r_{constructor(e,t,n){super(),this.field=e,this.op=t,this.value=n}static create(e,t,n){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,n):new zR(e,t,n):t==="array-contains"?new WR(e,n):t==="in"?new u_(e,n):t==="not-in"?new KR(e,n):t==="array-contains-any"?new HR(e,n):new J(e,t,n)}static createKeyFieldInFilter(e,t,n){return t==="in"?new jR(e,n):new GR(e,n)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(Cn(t,this.value)):t!==null&&Pn(this.value)===Pn(t)&&this.matchesComparison(Cn(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return F(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class re extends r_{constructor(e,t){super(),this.filters=e,this.op=t,this.Pe=null}static create(e,t){return new re(e,t)}matches(e){return ui(this)?this.filters.find(t=>!t.matches(e))===void 0:this.filters.find(t=>t.matches(e))!==void 0}getFlattenedFilters(){return this.Pe!==null||(this.Pe=this.filters.reduce((e,t)=>e.concat(t.getFlattenedFilters()),[])),this.Pe}getFilters(){return Object.assign([],this.filters)}}function ui(r){return r.op==="and"}function Pu(r){return r.op==="or"}function Ll(r){return i_(r)&&ui(r)}function i_(r){for(const e of r.filters)if(e instanceof re)return!1;return!0}function Cu(r){if(r instanceof J)return r.field.canonicalString()+r.op.toString()+ci(r.value);if(Ll(r))return r.filters.map(e=>Cu(e)).join(",");{const e=r.filters.map(t=>Cu(t)).join(",");return`${r.op}(${e})`}}function s_(r,e){return r instanceof J?function(n,i){return i instanceof J&&n.op===i.op&&n.field.isEqual(i.field)&&Bt(n.value,i.value)}(r,e):r instanceof re?function(n,i){return i instanceof re&&n.op===i.op&&n.filters.length===i.filters.length?n.filters.reduce((s,o,c)=>s&&s_(o,i.filters[c]),!0):!1}(r,e):void F(19439)}function o_(r,e){const t=r.filters.concat(e);return re.create(t,r.op)}function a_(r){return r instanceof J?function(t){return`${t.field.canonicalString()} ${t.op} ${ci(t.value)}`}(r):r instanceof re?function(t){return t.op.toString()+" {"+t.getFilters().map(a_).join(" ,")+"}"}(r):"Filter"}class zR extends J{constructor(e,t,n){super(e,t,n),this.key=x.fromName(n.referenceValue)}matches(e){const t=x.comparator(e.key,this.key);return this.matchesComparison(t)}}class jR extends J{constructor(e,t){super(e,"in",t),this.keys=c_("in",t)}matches(e){return this.keys.some(t=>t.isEqual(e.key))}}class GR extends J{constructor(e,t){super(e,"not-in",t),this.keys=c_("not-in",t)}matches(e){return!this.keys.some(t=>t.isEqual(e.key))}}function c_(r,e){var t;return(((t=e.arrayValue)==null?void 0:t.values)||[]).map(n=>x.fromName(n.referenceValue))}class WR extends J{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return zs(t)&&$s(t.arrayValue,this.value)}}class u_ extends J{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&$s(this.value.arrayValue,t)}}class KR extends J{constructor(e,t){super(e,"not-in",t)}matches(e){if($s(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!$s(this.value.arrayValue,t)}}class HR extends J{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!zs(t)||!t.arrayValue.values)&&t.arrayValue.values.some(n=>$s(this.value.arrayValue,n))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class QR{constructor(e,t=null,n=[],i=[],s=null,o=null,c=null){this.path=e,this.collectionGroup=t,this.orderBy=n,this.filters=i,this.limit=s,this.startAt=o,this.endAt=c,this.Te=null}}function ku(r,e=null,t=[],n=[],i=null,s=null,o=null){return new QR(r,e,t,n,i,s,o)}function pr(r){const e=L(r);if(e.Te===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map(n=>Cu(n)).join(","),t+="|ob:",t+=e.orderBy.map(n=>function(s){return s.field.canonicalString()+s.dir}(n)).join(","),ao(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map(n=>ci(n)).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map(n=>ci(n)).join(",")),e.Te=t}return e.Te}function uo(r,e){if(r.limit!==e.limit||r.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<r.orderBy.length;t++)if(!$R(r.orderBy[t],e.orderBy[t]))return!1;if(r.filters.length!==e.filters.length)return!1;for(let t=0;t<r.filters.length;t++)if(!s_(r.filters[t],e.filters[t]))return!1;return r.collectionGroup===e.collectionGroup&&!!r.path.isEqual(e.path)&&!!qf(r.startAt,e.startAt)&&qf(r.endAt,e.endAt)}function Ia(r){return x.isDocumentKey(r.path)&&r.collectionGroup===null&&r.filters.length===0}function wa(r,e){return r.filters.filter(t=>t instanceof J&&t.field.isEqual(e))}function $f(r,e,t){let n=Zo,i=!0;for(const s of wa(r,e)){let o=Zo,c=!0;switch(s.op){case"<":case"<=":o=BR(s.value);break;case"==":case"in":case">=":o=s.value;break;case">":o=s.value,c=!1;break;case"!=":case"not-in":o=Zo}Ff({value:n,inclusive:i},{value:o,inclusive:c})<0&&(n=o,i=c)}if(t!==null){for(let s=0;s<r.orderBy.length;++s)if(r.orderBy[s].field.isEqual(e)){const o=t.position[s];Ff({value:n,inclusive:i},{value:o,inclusive:t.inclusive})<0&&(n=o,i=t.inclusive);break}}return{value:n,inclusive:i}}function zf(r,e,t){let n=mn,i=!0;for(const s of wa(r,e)){let o=mn,c=!0;switch(s.op){case">=":case">":o=qR(s.value),c=!1;break;case"==":case"in":case"<=":o=s.value;break;case"<":o=s.value,c=!1;break;case"!=":case"not-in":o=mn}Uf({value:n,inclusive:i},{value:o,inclusive:c})>0&&(n=o,i=c)}if(t!==null){for(let s=0;s<r.orderBy.length;++s)if(r.orderBy[s].field.isEqual(e)){const o=t.position[s];Uf({value:n,inclusive:i},{value:o,inclusive:t.inclusive})>0&&(n=o,i=t.inclusive);break}}return{value:n,inclusive:i}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jt{constructor(e,t=null,n=[],i=[],s=null,o="F",c=null,u=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=n,this.filters=i,this.limit=s,this.limitType=o,this.startAt=c,this.endAt=u,this.Ie=null,this.Ee=null,this.de=null,this.startAt,this.endAt}}function l_(r,e,t,n,i,s,o,c){return new Jt(r,e,t,n,i,s,o,c)}function Ri(r){return new Jt(r)}function jf(r){return r.filters.length===0&&r.limit===null&&r.startAt==null&&r.endAt==null&&(r.explicitOrderBy.length===0||r.explicitOrderBy.length===1&&r.explicitOrderBy[0].field.isKeyField())}function Fl(r){return r.collectionGroup!==null}function Qr(r){const e=L(r);if(e.Ie===null){e.Ie=[];const t=new Set;for(const s of e.explicitOrderBy)e.Ie.push(s),t.add(s.field.canonicalString());const n=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(o){let c=new ie(fe.comparator);return o.filters.forEach(u=>{u.getFlattenedFilters().forEach(l=>{l.isInequality()&&(c=c.add(l.field))})}),c})(e).forEach(s=>{t.has(s.canonicalString())||s.isKeyField()||e.Ie.push(new js(s,n))}),t.has(fe.keyField().canonicalString())||e.Ie.push(new js(fe.keyField(),n))}return e.Ie}function Je(r){const e=L(r);return e.Ee||(e.Ee=JR(e,Qr(r))),e.Ee}function JR(r,e){if(r.limitType==="F")return ku(r.path,r.collectionGroup,e,r.filters,r.limit,r.startAt,r.endAt);{e=e.map(i=>{const s=i.dir==="desc"?"asc":"desc";return new js(i.field,s)});const t=r.endAt?new kn(r.endAt.position,r.endAt.inclusive):null,n=r.startAt?new kn(r.startAt.position,r.startAt.inclusive):null;return ku(r.path,r.collectionGroup,e,r.filters,r.limit,t,n)}}function Du(r,e){const t=r.filters.concat([e]);return new Jt(r.path,r.collectionGroup,r.explicitOrderBy.slice(),t,r.limit,r.limitType,r.startAt,r.endAt)}function Ea(r,e,t){return new Jt(r.path,r.collectionGroup,r.explicitOrderBy.slice(),r.filters.slice(),e,t,r.startAt,r.endAt)}function lo(r,e){return uo(Je(r),Je(e))&&r.limitType===e.limitType}function h_(r){return`${pr(Je(r))}|lt:${r.limitType}`}function Br(r){return`Query(target=${function(t){let n=t.path.canonicalString();return t.collectionGroup!==null&&(n+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(n+=`, filters: [${t.filters.map(i=>a_(i)).join(", ")}]`),ao(t.limit)||(n+=", limit: "+t.limit),t.orderBy.length>0&&(n+=`, orderBy: [${t.orderBy.map(i=>function(o){return`${o.field.canonicalString()} (${o.dir})`}(i)).join(", ")}]`),t.startAt&&(n+=", startAt: ",n+=t.startAt.inclusive?"b:":"a:",n+=t.startAt.position.map(i=>ci(i)).join(",")),t.endAt&&(n+=", endAt: ",n+=t.endAt.inclusive?"a:":"b:",n+=t.endAt.position.map(i=>ci(i)).join(",")),`Target(${n})`}(Je(r))}; limitType=${r.limitType})`}function ho(r,e){return e.isFoundDocument()&&function(n,i){const s=i.key.path;return n.collectionGroup!==null?i.key.hasCollectionId(n.collectionGroup)&&n.path.isPrefixOf(s):x.isDocumentKey(n.path)?n.path.isEqual(s):n.path.isImmediateParentOf(s)}(r,e)&&function(n,i){for(const s of Qr(n))if(!s.field.isKeyField()&&i.data.field(s.field)===null)return!1;return!0}(r,e)&&function(n,i){for(const s of n.filters)if(!s.matches(i))return!1;return!0}(r,e)&&function(n,i){return!(n.startAt&&!function(o,c,u){const l=Bf(o,c,u);return o.inclusive?l<=0:l<0}(n.startAt,Qr(n),i)||n.endAt&&!function(o,c,u){const l=Bf(o,c,u);return o.inclusive?l>=0:l>0}(n.endAt,Qr(n),i))}(r,e)}function d_(r){return r.collectionGroup||(r.path.length%2==1?r.path.lastSegment():r.path.get(r.path.length-2))}function f_(r){return(e,t)=>{let n=!1;for(const i of Qr(r)){const s=YR(i,e,t);if(s!==0)return s;n=n||i.field.isKeyField()}return 0}}function YR(r,e,t){const n=r.field.isKeyField()?x.comparator(e.key,t.key):function(s,o,c){const u=o.data.field(s),l=c.data.field(s);return u!==null&&l!==null?Cn(u,l):F(42886)}(r.field,e,t);switch(r.dir){case"asc":return n;case"desc":return-1*n;default:return F(19790,{direction:r.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yt{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){const t=this.mapKeyFn(e),n=this.inner[t];if(n!==void 0){for(const[i,s]of n)if(this.equalsFn(i,e))return s}}has(e){return this.get(e)!==void 0}set(e,t){const n=this.mapKeyFn(e),i=this.inner[n];if(i===void 0)return this.inner[n]=[[e,t]],void this.innerSize++;for(let s=0;s<i.length;s++)if(this.equalsFn(i[s][0],e))return void(i[s]=[e,t]);i.push([e,t]),this.innerSize++}delete(e){const t=this.mapKeyFn(e),n=this.inner[t];if(n===void 0)return!1;for(let i=0;i<n.length;i++)if(this.equalsFn(n[i][0],e))return n.length===1?delete this.inner[t]:n.splice(i,1),this.innerSize--,!0;return!1}forEach(e){Fn(this.inner,(t,n)=>{for(const[i,s]of n)e(i,s)})}isEmpty(){return Kg(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const XR=new ce(x.comparator);function nt(){return XR}const p_=new ce(x.comparator);function cs(...r){let e=p_;for(const t of r)e=e.insert(t.key,t);return e}function m_(r){let e=p_;return r.forEach((t,n)=>e=e.insert(t,n.overlayedDocument)),e}function Vt(){return vs()}function g_(){return vs()}function vs(){return new Yt(r=>r.toString(),(r,e)=>r.isEqual(e))}const ZR=new ce(x.comparator),eS=new ie(x.comparator);function W(...r){let e=eS;for(const t of r)e=e.add(t);return e}const tS=new ie(G);function Ul(){return tS}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bl(r,e){if(r.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:Ls(e)?"-0":e}}function __(r){return{integerValue:""+r}}function y_(r,e){return Mg(e)?__(e):Bl(r,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Za{constructor(){this._=void 0}}function nS(r,e,t){return r instanceof li?function(i,s){const o={fields:{[Jg]:{stringValue:Qg},[Xg]:{timestampValue:{seconds:i.seconds,nanos:i.nanoseconds}}}};return s&&Ja(s)&&(s=Ya(s)),s&&(o.fields[Yg]=s),{mapValue:o}}(t,e):r instanceof mr?w_(r,e):r instanceof gr?E_(r,e):function(i,s){const o=I_(i,s),c=Gf(o)+Gf(i.Ae);return Su(o)&&Su(i.Ae)?__(c):Bl(i.serializer,c)}(r,e)}function rS(r,e,t){return r instanceof mr?w_(r,e):r instanceof gr?E_(r,e):t}function I_(r,e){return r instanceof hi?function(n){return Su(n)||function(s){return!!s&&"doubleValue"in s}(n)}(e)?e:{integerValue:0}:null}class li extends Za{}class mr extends Za{constructor(e){super(),this.elements=e}}function w_(r,e){const t=T_(e);for(const n of r.elements)t.some(i=>Bt(i,n))||t.push(n);return{arrayValue:{values:t}}}class gr extends Za{constructor(e){super(),this.elements=e}}function E_(r,e){let t=T_(e);for(const n of r.elements)t=t.filter(i=>!Bt(i,n));return{arrayValue:{values:t}}}class hi extends Za{constructor(e,t){super(),this.serializer=e,this.Ae=t}}function Gf(r){return he(r.integerValue||r.doubleValue)}function T_(r){return zs(r)&&r.arrayValue.values?r.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fo{constructor(e,t){this.field=e,this.transform=t}}function iS(r,e){return r.field.isEqual(e.field)&&function(n,i){return n instanceof mr&&i instanceof mr||n instanceof gr&&i instanceof gr?ti(n.elements,i.elements,Bt):n instanceof hi&&i instanceof hi?Bt(n.Ae,i.Ae):n instanceof li&&i instanceof li}(r.transform,e.transform)}class sS{constructor(e,t){this.version=e,this.transformResults=t}}class pe{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new pe}static exists(e){return new pe(void 0,e)}static updateTime(e){return new pe(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function na(r,e){return r.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(r.updateTime):r.exists===void 0||r.exists===e.isFoundDocument()}class ec{}function v_(r,e){if(!r.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return r.isNoDocument()?new Pi(r.key,pe.none()):new Si(r.key,r.data,pe.none());{const t=r.data,n=Me.empty();let i=new ie(fe.comparator);for(let s of e.fields)if(!i.has(s)){let o=t.field(s);o===null&&s.length>1&&(s=s.popLast(),o=t.field(s)),o===null?n.delete(s):n.set(s,o),i=i.add(s)}return new Xt(r.key,n,new tt(i.toArray()),pe.none())}}function oS(r,e,t){r instanceof Si?function(i,s,o){const c=i.value.clone(),u=Kf(i.fieldTransforms,s,o.transformResults);c.setAll(u),s.convertToFoundDocument(o.version,c).setHasCommittedMutations()}(r,e,t):r instanceof Xt?function(i,s,o){if(!na(i.precondition,s))return void s.convertToUnknownDocument(o.version);const c=Kf(i.fieldTransforms,s,o.transformResults),u=s.data;u.setAll(A_(i)),u.setAll(c),s.convertToFoundDocument(o.version,u).setHasCommittedMutations()}(r,e,t):function(i,s,o){s.convertToNoDocument(o.version).setHasCommittedMutations()}(0,e,t)}function As(r,e,t,n){return r instanceof Si?function(s,o,c,u){if(!na(s.precondition,o))return c;const l=s.value.clone(),f=Hf(s.fieldTransforms,u,o);return l.setAll(f),o.convertToFoundDocument(o.version,l).setHasLocalMutations(),null}(r,e,t,n):r instanceof Xt?function(s,o,c,u){if(!na(s.precondition,o))return c;const l=Hf(s.fieldTransforms,u,o),f=o.data;return f.setAll(A_(s)),f.setAll(l),o.convertToFoundDocument(o.version,f).setHasLocalMutations(),c===null?null:c.unionWith(s.fieldMask.fields).unionWith(s.fieldTransforms.map(p=>p.field))}(r,e,t,n):function(s,o,c){return na(s.precondition,o)?(o.convertToNoDocument(o.version).setHasLocalMutations(),null):c}(r,e,t)}function aS(r,e){let t=null;for(const n of r.fieldTransforms){const i=e.data.field(n.field),s=I_(n.transform,i||null);s!=null&&(t===null&&(t=Me.empty()),t.set(n.field,s))}return t||null}function Wf(r,e){return r.type===e.type&&!!r.key.isEqual(e.key)&&!!r.precondition.isEqual(e.precondition)&&!!function(n,i){return n===void 0&&i===void 0||!(!n||!i)&&ti(n,i,(s,o)=>iS(s,o))}(r.fieldTransforms,e.fieldTransforms)&&(r.type===0?r.value.isEqual(e.value):r.type!==1||r.data.isEqual(e.data)&&r.fieldMask.isEqual(e.fieldMask))}class Si extends ec{constructor(e,t,n,i=[]){super(),this.key=e,this.value=t,this.precondition=n,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class Xt extends ec{constructor(e,t,n,i,s=[]){super(),this.key=e,this.data=t,this.fieldMask=n,this.precondition=i,this.fieldTransforms=s,this.type=1}getFieldMask(){return this.fieldMask}}function A_(r){const e=new Map;return r.fieldMask.fields.forEach(t=>{if(!t.isEmpty()){const n=r.data.field(t);e.set(t,n)}}),e}function Kf(r,e,t){const n=new Map;U(r.length===t.length,32656,{Re:t.length,Ve:r.length});for(let i=0;i<t.length;i++){const s=r[i],o=s.transform,c=e.data.field(s.field);n.set(s.field,rS(o,c,t[i]))}return n}function Hf(r,e,t){const n=new Map;for(const i of r){const s=i.transform,o=t.data.field(i.field);n.set(i.field,nS(s,o,e))}return n}class Pi extends ec{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class ql extends ec{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $l{constructor(e,t,n,i){this.batchId=e,this.localWriteTime=t,this.baseMutations=n,this.mutations=i}applyToRemoteDocument(e,t){const n=t.mutationResults;for(let i=0;i<this.mutations.length;i++){const s=this.mutations[i];s.key.isEqual(e.key)&&oS(s,e,n[i])}}applyToLocalView(e,t){for(const n of this.baseMutations)n.key.isEqual(e.key)&&(t=As(n,e,t,this.localWriteTime));for(const n of this.mutations)n.key.isEqual(e.key)&&(t=As(n,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){const n=g_();return this.mutations.forEach(i=>{const s=e.get(i.key),o=s.overlayedDocument;let c=this.applyToLocalView(o,s.mutatedFields);c=t.has(i.key)?null:c;const u=v_(o,c);u!==null&&n.set(i.key,u),o.isValidDocument()||o.convertToNoDocument(B.min())}),n}keys(){return this.mutations.reduce((e,t)=>e.add(t.key),W())}isEqual(e){return this.batchId===e.batchId&&ti(this.mutations,e.mutations,(t,n)=>Wf(t,n))&&ti(this.baseMutations,e.baseMutations,(t,n)=>Wf(t,n))}}class zl{constructor(e,t,n,i){this.batch=e,this.commitVersion=t,this.mutationResults=n,this.docVersions=i}static from(e,t,n){U(e.mutations.length===n.length,58842,{me:e.mutations.length,fe:n.length});let i=function(){return ZR}();const s=e.mutations;for(let o=0;o<s.length;o++)i=i.insert(s[o].key,n[o].version);return new zl(e,t,n,i)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jl{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cS{constructor(e,t){this.count=e,this.unchangedNames=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ae,X;function b_(r){switch(r){case S.OK:return F(64938);case S.CANCELLED:case S.UNKNOWN:case S.DEADLINE_EXCEEDED:case S.RESOURCE_EXHAUSTED:case S.INTERNAL:case S.UNAVAILABLE:case S.UNAUTHENTICATED:return!1;case S.INVALID_ARGUMENT:case S.NOT_FOUND:case S.ALREADY_EXISTS:case S.PERMISSION_DENIED:case S.FAILED_PRECONDITION:case S.ABORTED:case S.OUT_OF_RANGE:case S.UNIMPLEMENTED:case S.DATA_LOSS:return!0;default:return F(15467,{code:r})}}function R_(r){if(r===void 0)return Ee("GRPC error has no .code"),S.UNKNOWN;switch(r){case Ae.OK:return S.OK;case Ae.CANCELLED:return S.CANCELLED;case Ae.UNKNOWN:return S.UNKNOWN;case Ae.DEADLINE_EXCEEDED:return S.DEADLINE_EXCEEDED;case Ae.RESOURCE_EXHAUSTED:return S.RESOURCE_EXHAUSTED;case Ae.INTERNAL:return S.INTERNAL;case Ae.UNAVAILABLE:return S.UNAVAILABLE;case Ae.UNAUTHENTICATED:return S.UNAUTHENTICATED;case Ae.INVALID_ARGUMENT:return S.INVALID_ARGUMENT;case Ae.NOT_FOUND:return S.NOT_FOUND;case Ae.ALREADY_EXISTS:return S.ALREADY_EXISTS;case Ae.PERMISSION_DENIED:return S.PERMISSION_DENIED;case Ae.FAILED_PRECONDITION:return S.FAILED_PRECONDITION;case Ae.ABORTED:return S.ABORTED;case Ae.OUT_OF_RANGE:return S.OUT_OF_RANGE;case Ae.UNIMPLEMENTED:return S.UNIMPLEMENTED;case Ae.DATA_LOSS:return S.DATA_LOSS;default:return F(39323,{code:r})}}(X=Ae||(Ae={}))[X.OK=0]="OK",X[X.CANCELLED=1]="CANCELLED",X[X.UNKNOWN=2]="UNKNOWN",X[X.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",X[X.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",X[X.NOT_FOUND=5]="NOT_FOUND",X[X.ALREADY_EXISTS=6]="ALREADY_EXISTS",X[X.PERMISSION_DENIED=7]="PERMISSION_DENIED",X[X.UNAUTHENTICATED=16]="UNAUTHENTICATED",X[X.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",X[X.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",X[X.ABORTED=10]="ABORTED",X[X.OUT_OF_RANGE=11]="OUT_OF_RANGE",X[X.UNIMPLEMENTED=12]="UNIMPLEMENTED",X[X.INTERNAL=13]="INTERNAL",X[X.UNAVAILABLE=14]="UNAVAILABLE",X[X.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function S_(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const uS=new In([4294967295,4294967295],0);function Qf(r){const e=S_().encode(r),t=new Ig;return t.update(e),new Uint8Array(t.digest())}function Jf(r){const e=new DataView(r.buffer),t=e.getUint32(0,!0),n=e.getUint32(4,!0),i=e.getUint32(8,!0),s=e.getUint32(12,!0);return[new In([t,n],0),new In([i,s],0)]}class Gl{constructor(e,t,n){if(this.bitmap=e,this.padding=t,this.hashCount=n,t<0||t>=8)throw new us(`Invalid padding: ${t}`);if(n<0)throw new us(`Invalid hash count: ${n}`);if(e.length>0&&this.hashCount===0)throw new us(`Invalid hash count: ${n}`);if(e.length===0&&t!==0)throw new us(`Invalid padding when bitmap length is 0: ${t}`);this.ge=8*e.length-t,this.pe=In.fromNumber(this.ge)}ye(e,t,n){let i=e.add(t.multiply(In.fromNumber(n)));return i.compare(uS)===1&&(i=new In([i.getBits(0),i.getBits(1)],0)),i.modulo(this.pe).toNumber()}we(e){return!!(this.bitmap[Math.floor(e/8)]&1<<e%8)}mightContain(e){if(this.ge===0)return!1;const t=Qf(e),[n,i]=Jf(t);for(let s=0;s<this.hashCount;s++){const o=this.ye(n,i,s);if(!this.we(o))return!1}return!0}static create(e,t,n){const i=e%8==0?0:8-e%8,s=new Uint8Array(Math.ceil(e/8)),o=new Gl(s,i,t);return n.forEach(c=>o.insert(c)),o}insert(e){if(this.ge===0)return;const t=Qf(e),[n,i]=Jf(t);for(let s=0;s<this.hashCount;s++){const o=this.ye(n,i,s);this.Se(o)}}Se(e){const t=Math.floor(e/8),n=e%8;this.bitmap[t]|=1<<n}}class us extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class po{constructor(e,t,n,i,s){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=n,this.documentUpdates=i,this.resolvedLimboDocuments=s}static createSynthesizedRemoteEventForCurrentChange(e,t,n){const i=new Map;return i.set(e,mo.createSynthesizedTargetChangeForCurrentChange(e,t,n)),new po(B.min(),i,new ce(G),nt(),W())}}class mo{constructor(e,t,n,i,s){this.resumeToken=e,this.current=t,this.addedDocuments=n,this.modifiedDocuments=i,this.removedDocuments=s}static createSynthesizedTargetChangeForCurrentChange(e,t,n){return new mo(n,t,W(),W(),W())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ra{constructor(e,t,n,i){this.be=e,this.removedTargetIds=t,this.key=n,this.De=i}}class P_{constructor(e,t){this.targetId=e,this.Ce=t}}class C_{constructor(e,t,n=ye.EMPTY_BYTE_STRING,i=null){this.state=e,this.targetIds=t,this.resumeToken=n,this.cause=i}}class Yf{constructor(){this.ve=0,this.Fe=Xf(),this.Me=ye.EMPTY_BYTE_STRING,this.xe=!1,this.Oe=!0}get current(){return this.xe}get resumeToken(){return this.Me}get Ne(){return this.ve!==0}get Be(){return this.Oe}Le(e){e.approximateByteSize()>0&&(this.Oe=!0,this.Me=e)}ke(){let e=W(),t=W(),n=W();return this.Fe.forEach((i,s)=>{switch(s){case 0:e=e.add(i);break;case 2:t=t.add(i);break;case 1:n=n.add(i);break;default:F(38017,{changeType:s})}}),new mo(this.Me,this.xe,e,t,n)}qe(){this.Oe=!1,this.Fe=Xf()}Qe(e,t){this.Oe=!0,this.Fe=this.Fe.insert(e,t)}$e(e){this.Oe=!0,this.Fe=this.Fe.remove(e)}Ue(){this.ve+=1}Ke(){this.ve-=1,U(this.ve>=0,3241,{ve:this.ve})}We(){this.Oe=!0,this.xe=!0}}class lS{constructor(e){this.Ge=e,this.ze=new Map,this.je=nt(),this.Je=Bo(),this.He=Bo(),this.Ye=new ce(G)}Ze(e){for(const t of e.be)e.De&&e.De.isFoundDocument()?this.Xe(t,e.De):this.et(t,e.key,e.De);for(const t of e.removedTargetIds)this.et(t,e.key,e.De)}tt(e){this.forEachTarget(e,t=>{const n=this.nt(t);switch(e.state){case 0:this.rt(t)&&n.Le(e.resumeToken);break;case 1:n.Ke(),n.Ne||n.qe(),n.Le(e.resumeToken);break;case 2:n.Ke(),n.Ne||this.removeTarget(t);break;case 3:this.rt(t)&&(n.We(),n.Le(e.resumeToken));break;case 4:this.rt(t)&&(this.it(t),n.Le(e.resumeToken));break;default:F(56790,{state:e.state})}})}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.ze.forEach((n,i)=>{this.rt(i)&&t(i)})}st(e){const t=e.targetId,n=e.Ce.count,i=this.ot(t);if(i){const s=i.target;if(Ia(s))if(n===0){const o=new x(s.path);this.et(t,o,le.newNoDocument(o,B.min()))}else U(n===1,20013,{expectedCount:n});else{const o=this._t(t);if(o!==n){const c=this.ut(e),u=c?this.ct(c,e,o):1;if(u!==0){this.it(t);const l=u===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Ye=this.Ye.insert(t,l)}}}}}ut(e){const t=e.Ce.unchangedNames;if(!t||!t.bits)return null;const{bits:{bitmap:n="",padding:i=0},hashCount:s=0}=t;let o,c;try{o=Kt(n).toUint8Array()}catch(u){if(u instanceof Hg)return Ut("Decoding the base64 bloom filter in existence filter failed ("+u.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw u}try{c=new Gl(o,i,s)}catch(u){return Ut(u instanceof us?"BloomFilter error: ":"Applying bloom filter failed: ",u),null}return c.ge===0?null:c}ct(e,t,n){return t.Ce.count===n-this.Pt(e,t.targetId)?0:2}Pt(e,t){const n=this.Ge.getRemoteKeysForTarget(t);let i=0;return n.forEach(s=>{const o=this.Ge.ht(),c=`projects/${o.projectId}/databases/${o.database}/documents/${s.path.canonicalString()}`;e.mightContain(c)||(this.et(t,s,null),i++)}),i}Tt(e){const t=new Map;this.ze.forEach((s,o)=>{const c=this.ot(o);if(c){if(s.current&&Ia(c.target)){const u=new x(c.target.path);this.It(u).has(o)||this.Et(o,u)||this.et(o,u,le.newNoDocument(u,e))}s.Be&&(t.set(o,s.ke()),s.qe())}});let n=W();this.He.forEach((s,o)=>{let c=!0;o.forEachWhile(u=>{const l=this.ot(u);return!l||l.purpose==="TargetPurposeLimboResolution"||(c=!1,!1)}),c&&(n=n.add(s))}),this.je.forEach((s,o)=>o.setReadTime(e));const i=new po(e,t,this.Ye,this.je,n);return this.je=nt(),this.Je=Bo(),this.He=Bo(),this.Ye=new ce(G),i}Xe(e,t){if(!this.rt(e))return;const n=this.Et(e,t.key)?2:0;this.nt(e).Qe(t.key,n),this.je=this.je.insert(t.key,t),this.Je=this.Je.insert(t.key,this.It(t.key).add(e)),this.He=this.He.insert(t.key,this.dt(t.key).add(e))}et(e,t,n){if(!this.rt(e))return;const i=this.nt(e);this.Et(e,t)?i.Qe(t,1):i.$e(t),this.He=this.He.insert(t,this.dt(t).delete(e)),this.He=this.He.insert(t,this.dt(t).add(e)),n&&(this.je=this.je.insert(t,n))}removeTarget(e){this.ze.delete(e)}_t(e){const t=this.nt(e).ke();return this.Ge.getRemoteKeysForTarget(e).size+t.addedDocuments.size-t.removedDocuments.size}Ue(e){this.nt(e).Ue()}nt(e){let t=this.ze.get(e);return t||(t=new Yf,this.ze.set(e,t)),t}dt(e){let t=this.He.get(e);return t||(t=new ie(G),this.He=this.He.insert(e,t)),t}It(e){let t=this.Je.get(e);return t||(t=new ie(G),this.Je=this.Je.insert(e,t)),t}rt(e){const t=this.ot(e)!==null;return t||V("WatchChangeAggregator","Detected inactive target",e),t}ot(e){const t=this.ze.get(e);return t&&t.Ne?null:this.Ge.At(e)}it(e){this.ze.set(e,new Yf),this.Ge.getRemoteKeysForTarget(e).forEach(t=>{this.et(e,t,null)})}Et(e,t){return this.Ge.getRemoteKeysForTarget(e).has(t)}}function Bo(){return new ce(x.comparator)}function Xf(){return new ce(x.comparator)}const hS={asc:"ASCENDING",desc:"DESCENDING"},dS={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},fS={and:"AND",or:"OR"};class pS{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function Nu(r,e){return r.useProto3Json||ao(e)?e:{value:e}}function di(r,e){return r.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function k_(r,e){return r.useProto3Json?e.toBase64():e.toUint8Array()}function mS(r,e){return di(r,e.toTimestamp())}function Te(r){return U(!!r,49232),B.fromTimestamp(function(t){const n=Wt(t);return new ne(n.seconds,n.nanos)}(r))}function Wl(r,e){return Vu(r,e).canonicalString()}function Vu(r,e){const t=function(i){return new Q(["projects",i.projectId,"databases",i.database])}(r).child("documents");return e===void 0?t:t.child(e)}function D_(r){const e=Q.fromString(r);return U(q_(e),10190,{key:e.toString()}),e}function Gs(r,e){return Wl(r.databaseId,e.path)}function xt(r,e){const t=D_(e);if(t.get(1)!==r.databaseId.projectId)throw new C(S.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+r.databaseId.projectId);if(t.get(3)!==r.databaseId.database)throw new C(S.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+r.databaseId.database);return new x(O_(t))}function N_(r,e){return Wl(r.databaseId,e)}function V_(r){const e=D_(r);return e.length===4?Q.emptyPath():O_(e)}function Ou(r){return new Q(["projects",r.databaseId.projectId,"databases",r.databaseId.database]).canonicalString()}function O_(r){return U(r.length>4&&r.get(4)==="documents",29091,{key:r.toString()}),r.popFirst(5)}function Zf(r,e,t){return{name:Gs(r,e),fields:t.value.mapValue.fields}}function x_(r,e,t){const n=xt(r,e.name),i=Te(e.updateTime),s=e.createTime?Te(e.createTime):B.min(),o=new Me({mapValue:{fields:e.fields}}),c=le.newFoundDocument(n,i,s,o);return t&&c.setHasCommittedMutations(),t?c.setHasCommittedMutations():c}function gS(r,e){return"found"in e?function(n,i){U(!!i.found,43571),i.found.name,i.found.updateTime;const s=xt(n,i.found.name),o=Te(i.found.updateTime),c=i.found.createTime?Te(i.found.createTime):B.min(),u=new Me({mapValue:{fields:i.found.fields}});return le.newFoundDocument(s,o,c,u)}(r,e):"missing"in e?function(n,i){U(!!i.missing,3894),U(!!i.readTime,22933);const s=xt(n,i.missing),o=Te(i.readTime);return le.newNoDocument(s,o)}(r,e):F(7234,{result:e})}function _S(r,e){let t;if("targetChange"in e){e.targetChange;const n=function(l){return l==="NO_CHANGE"?0:l==="ADD"?1:l==="REMOVE"?2:l==="CURRENT"?3:l==="RESET"?4:F(39313,{state:l})}(e.targetChange.targetChangeType||"NO_CHANGE"),i=e.targetChange.targetIds||[],s=function(l,f){return l.useProto3Json?(U(f===void 0||typeof f=="string",58123),ye.fromBase64String(f||"")):(U(f===void 0||f instanceof Buffer||f instanceof Uint8Array,16193),ye.fromUint8Array(f||new Uint8Array))}(r,e.targetChange.resumeToken),o=e.targetChange.cause,c=o&&function(l){const f=l.code===void 0?S.UNKNOWN:R_(l.code);return new C(f,l.message||"")}(o);t=new C_(n,i,s,c||null)}else if("documentChange"in e){e.documentChange;const n=e.documentChange;n.document,n.document.name,n.document.updateTime;const i=xt(r,n.document.name),s=Te(n.document.updateTime),o=n.document.createTime?Te(n.document.createTime):B.min(),c=new Me({mapValue:{fields:n.document.fields}}),u=le.newFoundDocument(i,s,o,c),l=n.targetIds||[],f=n.removedTargetIds||[];t=new ra(l,f,u.key,u)}else if("documentDelete"in e){e.documentDelete;const n=e.documentDelete;n.document;const i=xt(r,n.document),s=n.readTime?Te(n.readTime):B.min(),o=le.newNoDocument(i,s),c=n.removedTargetIds||[];t=new ra([],c,o.key,o)}else if("documentRemove"in e){e.documentRemove;const n=e.documentRemove;n.document;const i=xt(r,n.document),s=n.removedTargetIds||[];t=new ra([],s,i,null)}else{if(!("filter"in e))return F(11601,{Rt:e});{e.filter;const n=e.filter;n.targetId;const{count:i=0,unchangedNames:s}=n,o=new cS(i,s),c=n.targetId;t=new P_(c,o)}}return t}function Ws(r,e){let t;if(e instanceof Si)t={update:Zf(r,e.key,e.value)};else if(e instanceof Pi)t={delete:Gs(r,e.key)};else if(e instanceof Xt)t={update:Zf(r,e.key,e.data),updateMask:vS(e.fieldMask)};else{if(!(e instanceof ql))return F(16599,{Vt:e.type});t={verify:Gs(r,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map(n=>function(s,o){const c=o.transform;if(c instanceof li)return{fieldPath:o.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(c instanceof mr)return{fieldPath:o.field.canonicalString(),appendMissingElements:{values:c.elements}};if(c instanceof gr)return{fieldPath:o.field.canonicalString(),removeAllFromArray:{values:c.elements}};if(c instanceof hi)return{fieldPath:o.field.canonicalString(),increment:c.Ae};throw F(20930,{transform:o.transform})}(0,n))),e.precondition.isNone||(t.currentDocument=function(i,s){return s.updateTime!==void 0?{updateTime:mS(i,s.updateTime)}:s.exists!==void 0?{exists:s.exists}:F(27497)}(r,e.precondition)),t}function xu(r,e){const t=e.currentDocument?function(s){return s.updateTime!==void 0?pe.updateTime(Te(s.updateTime)):s.exists!==void 0?pe.exists(s.exists):pe.none()}(e.currentDocument):pe.none(),n=e.updateTransforms?e.updateTransforms.map(i=>function(o,c){let u=null;if("setToServerValue"in c)U(c.setToServerValue==="REQUEST_TIME",16630,{proto:c}),u=new li;else if("appendMissingElements"in c){const f=c.appendMissingElements.values||[];u=new mr(f)}else if("removeAllFromArray"in c){const f=c.removeAllFromArray.values||[];u=new gr(f)}else"increment"in c?u=new hi(o,c.increment):F(16584,{proto:c});const l=fe.fromServerFormat(c.fieldPath);return new fo(l,u)}(r,i)):[];if(e.update){e.update.name;const i=xt(r,e.update.name),s=new Me({mapValue:{fields:e.update.fields}});if(e.updateMask){const o=function(u){const l=u.fieldPaths||[];return new tt(l.map(f=>fe.fromServerFormat(f)))}(e.updateMask);return new Xt(i,s,o,t,n)}return new Si(i,s,t,n)}if(e.delete){const i=xt(r,e.delete);return new Pi(i,t)}if(e.verify){const i=xt(r,e.verify);return new ql(i,t)}return F(1463,{proto:e})}function yS(r,e){return r&&r.length>0?(U(e!==void 0,14353),r.map(t=>function(i,s){let o=i.updateTime?Te(i.updateTime):Te(s);return o.isEqual(B.min())&&(o=Te(s)),new sS(o,i.transformResults||[])}(t,e))):[]}function M_(r,e){return{documents:[N_(r,e.path)]}}function L_(r,e){const t={structuredQuery:{}},n=e.path;let i;e.collectionGroup!==null?(i=n,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(i=n.popLast(),t.structuredQuery.from=[{collectionId:n.lastSegment()}]),t.parent=N_(r,i);const s=function(l){if(l.length!==0)return B_(re.create(l,"and"))}(e.filters);s&&(t.structuredQuery.where=s);const o=function(l){if(l.length!==0)return l.map(f=>function(g){return{field:qr(g.field),direction:wS(g.dir)}}(f))}(e.orderBy);o&&(t.structuredQuery.orderBy=o);const c=Nu(r,e.limit);return c!==null&&(t.structuredQuery.limit=c),e.startAt&&(t.structuredQuery.startAt=function(l){return{before:l.inclusive,values:l.position}}(e.startAt)),e.endAt&&(t.structuredQuery.endAt=function(l){return{before:!l.inclusive,values:l.position}}(e.endAt)),{ft:t,parent:i}}function F_(r){let e=V_(r.parent);const t=r.structuredQuery,n=t.from?t.from.length:0;let i=null;if(n>0){U(n===1,65062);const f=t.from[0];f.allDescendants?i=f.collectionId:e=e.child(f.collectionId)}let s=[];t.where&&(s=function(p){const g=U_(p);return g instanceof re&&Ll(g)?g.getFilters():[g]}(t.where));let o=[];t.orderBy&&(o=function(p){return p.map(g=>function(k){return new js($r(k.field),function(N){switch(N){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}}(k.direction))}(g))}(t.orderBy));let c=null;t.limit&&(c=function(p){let g;return g=typeof p=="object"?p.value:p,ao(g)?null:g}(t.limit));let u=null;t.startAt&&(u=function(p){const g=!!p.before,v=p.values||[];return new kn(v,g)}(t.startAt));let l=null;return t.endAt&&(l=function(p){const g=!p.before,v=p.values||[];return new kn(v,g)}(t.endAt)),l_(e,i,o,s,c,"F",u,l)}function IS(r,e){const t=function(i){switch(i){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return F(28987,{purpose:i})}}(e.purpose);return t==null?null:{"goog-listen-tags":t}}function U_(r){return r.unaryFilter!==void 0?function(t){switch(t.unaryFilter.op){case"IS_NAN":const n=$r(t.unaryFilter.field);return J.create(n,"==",{doubleValue:NaN});case"IS_NULL":const i=$r(t.unaryFilter.field);return J.create(i,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const s=$r(t.unaryFilter.field);return J.create(s,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const o=$r(t.unaryFilter.field);return J.create(o,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return F(61313);default:return F(60726)}}(r):r.fieldFilter!==void 0?function(t){return J.create($r(t.fieldFilter.field),function(i){switch(i){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return F(58110);default:return F(50506)}}(t.fieldFilter.op),t.fieldFilter.value)}(r):r.compositeFilter!==void 0?function(t){return re.create(t.compositeFilter.filters.map(n=>U_(n)),function(i){switch(i){case"AND":return"and";case"OR":return"or";default:return F(1026)}}(t.compositeFilter.op))}(r):F(30097,{filter:r})}function wS(r){return hS[r]}function ES(r){return dS[r]}function TS(r){return fS[r]}function qr(r){return{fieldPath:r.canonicalString()}}function $r(r){return fe.fromServerFormat(r.fieldPath)}function B_(r){return r instanceof J?function(t){if(t.op==="=="){if(Lf(t.value))return{unaryFilter:{field:qr(t.field),op:"IS_NAN"}};if(Mf(t.value))return{unaryFilter:{field:qr(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(Lf(t.value))return{unaryFilter:{field:qr(t.field),op:"IS_NOT_NAN"}};if(Mf(t.value))return{unaryFilter:{field:qr(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:qr(t.field),op:ES(t.op),value:t.value}}}(r):r instanceof re?function(t){const n=t.getFilters().map(i=>B_(i));return n.length===1?n[0]:{compositeFilter:{op:TS(t.op),filters:n}}}(r):F(54877,{filter:r})}function vS(r){const e=[];return r.fields.forEach(t=>e.push(t.canonicalString())),{fieldPaths:e}}function q_(r){return r.length>=4&&r.get(0)==="projects"&&r.get(2)==="databases"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $t{constructor(e,t,n,i,s=B.min(),o=B.min(),c=ye.EMPTY_BYTE_STRING,u=null){this.target=e,this.targetId=t,this.purpose=n,this.sequenceNumber=i,this.snapshotVersion=s,this.lastLimboFreeSnapshotVersion=o,this.resumeToken=c,this.expectedCount=u}withSequenceNumber(e){return new $t(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new $t(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new $t(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new $t(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $_{constructor(e){this.yt=e}}function AS(r,e){let t;if(e.document)t=x_(r.yt,e.document,!!e.hasCommittedMutations);else if(e.noDocument){const n=x.fromSegments(e.noDocument.path),i=yr(e.noDocument.readTime);t=le.newNoDocument(n,i),e.hasCommittedMutations&&t.setHasCommittedMutations()}else{if(!e.unknownDocument)return F(56709);{const n=x.fromSegments(e.unknownDocument.path),i=yr(e.unknownDocument.version);t=le.newUnknownDocument(n,i)}}return e.readTime&&t.setReadTime(function(i){const s=new ne(i[0],i[1]);return B.fromTimestamp(s)}(e.readTime)),t}function ep(r,e){const t=e.key,n={prefixPath:t.getCollectionPath().popLast().toArray(),collectionGroup:t.collectionGroup,documentId:t.path.lastSegment(),readTime:Ta(e.readTime),hasCommittedMutations:e.hasCommittedMutations};if(e.isFoundDocument())n.document=function(s,o){return{name:Gs(s,o.key),fields:o.data.value.mapValue.fields,updateTime:di(s,o.version.toTimestamp()),createTime:di(s,o.createTime.toTimestamp())}}(r.yt,e);else if(e.isNoDocument())n.noDocument={path:t.path.toArray(),readTime:_r(e.version)};else{if(!e.isUnknownDocument())return F(57904,{document:e});n.unknownDocument={path:t.path.toArray(),version:_r(e.version)}}return n}function Ta(r){const e=r.toTimestamp();return[e.seconds,e.nanoseconds]}function _r(r){const e=r.toTimestamp();return{seconds:e.seconds,nanoseconds:e.nanoseconds}}function yr(r){const e=new ne(r.seconds,r.nanoseconds);return B.fromTimestamp(e)}function Xn(r,e){const t=(e.baseMutations||[]).map(s=>xu(r.yt,s));for(let s=0;s<e.mutations.length-1;++s){const o=e.mutations[s];if(s+1<e.mutations.length&&e.mutations[s+1].transform!==void 0){const c=e.mutations[s+1];o.updateTransforms=c.transform.fieldTransforms,e.mutations.splice(s+1,1),++s}}const n=e.mutations.map(s=>xu(r.yt,s)),i=ne.fromMillis(e.localWriteTimeMs);return new $l(e.batchId,i,t,n)}function ls(r){const e=yr(r.readTime),t=r.lastLimboFreeSnapshotVersion!==void 0?yr(r.lastLimboFreeSnapshotVersion):B.min();let n;return n=function(s){return s.documents!==void 0}(r.query)?function(s){const o=s.documents.length;return U(o===1,1966,{count:o}),Je(Ri(V_(s.documents[0])))}(r.query):function(s){return Je(F_(s))}(r.query),new $t(n,r.targetId,"TargetPurposeListen",r.lastListenSequenceNumber,e,t,ye.fromBase64String(r.resumeToken))}function z_(r,e){const t=_r(e.snapshotVersion),n=_r(e.lastLimboFreeSnapshotVersion);let i;i=Ia(e.target)?M_(r.yt,e.target):L_(r.yt,e.target).ft;const s=e.resumeToken.toBase64();return{targetId:e.targetId,canonicalId:pr(e.target),readTime:t,resumeToken:s,lastListenSequenceNumber:e.sequenceNumber,lastLimboFreeSnapshotVersion:n,query:i}}function Kl(r){const e=F_({parent:r.parent,structuredQuery:r.structuredQuery});return r.limitType==="LAST"?Ea(e,e.limit,"L"):e}function Zc(r,e){return new jl(e.largestBatchId,xu(r.yt,e.overlayMutation))}function tp(r,e){const t=e.path.lastSegment();return[r,ze(e.path.popLast()),t]}function np(r,e,t,n){return{indexId:r,uid:e,sequenceNumber:t,readTime:_r(n.readTime),documentKey:ze(n.documentKey.path),largestBatchId:n.largestBatchId}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bS{getBundleMetadata(e,t){return rp(e).get(t).next(n=>{if(n)return function(s){return{id:s.bundleId,createTime:yr(s.createTime),version:s.version}}(n)})}saveBundleMetadata(e,t){return rp(e).put(function(i){return{bundleId:i.id,createTime:_r(Te(i.createTime)),version:i.version}}(t))}getNamedQuery(e,t){return ip(e).get(t).next(n=>{if(n)return function(s){return{name:s.name,query:Kl(s.bundledQuery),readTime:yr(s.readTime)}}(n)})}saveNamedQuery(e,t){return ip(e).put(function(i){return{name:i.name,readTime:_r(Te(i.readTime)),bundledQuery:i.bundledQuery}}(t))}}function rp(r){return ke(r,Ka)}function ip(r){return ke(r,Ha)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tc{constructor(e,t){this.serializer=e,this.userId=t}static wt(e,t){const n=t.uid||"";return new tc(e,n)}getOverlay(e,t){return Zi(e).get(tp(this.userId,t)).next(n=>n?Zc(this.serializer,n):null)}getOverlays(e,t){const n=Vt();return A.forEach(t,i=>this.getOverlay(e,i).next(s=>{s!==null&&n.set(i,s)})).next(()=>n)}saveOverlays(e,t,n){const i=[];return n.forEach((s,o)=>{const c=new jl(t,o);i.push(this.St(e,c))}),A.waitFor(i)}removeOverlaysForBatchId(e,t,n){const i=new Set;t.forEach(o=>i.add(ze(o.getCollectionPath())));const s=[];return i.forEach(o=>{const c=IDBKeyRange.bound([this.userId,o,n],[this.userId,o,n+1],!1,!0);s.push(Zi(e).Z(vu,c))}),A.waitFor(s)}getOverlaysForCollection(e,t,n){const i=Vt(),s=ze(t),o=IDBKeyRange.bound([this.userId,s,n],[this.userId,s,Number.POSITIVE_INFINITY],!0);return Zi(e).J(vu,o).next(c=>{for(const u of c){const l=Zc(this.serializer,u);i.set(l.getKey(),l)}return i})}getOverlaysForCollectionGroup(e,t,n,i){const s=Vt();let o;const c=IDBKeyRange.bound([this.userId,t,n],[this.userId,t,Number.POSITIVE_INFINITY],!0);return Zi(e).ee({index:$g,range:c},(u,l,f)=>{const p=Zc(this.serializer,l);s.size()<i||p.largestBatchId===o?(s.set(p.getKey(),p),o=p.largestBatchId):f.done()}).next(()=>s)}St(e,t){return Zi(e).put(function(i,s,o){const[c,u,l]=tp(s,o.mutation.key);return{userId:s,collectionPath:u,documentId:l,collectionGroup:o.mutation.key.getCollectionGroup(),largestBatchId:o.largestBatchId,overlayMutation:Ws(i.yt,o.mutation)}}(this.serializer,this.userId,t))}}function Zi(r){return ke(r,Qa)}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class RS{bt(e){return ke(e,Vl)}getSessionToken(e){return this.bt(e).get("sessionToken").next(t=>{const n=t==null?void 0:t.value;return n?ye.fromUint8Array(n):ye.EMPTY_BYTE_STRING})}setSessionToken(e,t){return this.bt(e).put({name:"sessionToken",value:t.toUint8Array()})}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zn{constructor(){}Dt(e,t){this.Ct(e,t),t.vt()}Ct(e,t){if("nullValue"in e)this.Ft(t,5);else if("booleanValue"in e)this.Ft(t,10),t.Mt(e.booleanValue?1:0);else if("integerValue"in e)this.Ft(t,15),t.Mt(he(e.integerValue));else if("doubleValue"in e){const n=he(e.doubleValue);isNaN(n)?this.Ft(t,13):(this.Ft(t,15),Ls(n)?t.Mt(0):t.Mt(n))}else if("timestampValue"in e){let n=e.timestampValue;this.Ft(t,20),typeof n=="string"&&(n=Wt(n)),t.xt(`${n.seconds||""}`),t.Mt(n.nanos||0)}else if("stringValue"in e)this.Ot(e.stringValue,t),this.Nt(t);else if("bytesValue"in e)this.Ft(t,30),t.Bt(Kt(e.bytesValue)),this.Nt(t);else if("referenceValue"in e)this.Lt(e.referenceValue,t);else if("geoPointValue"in e){const n=e.geoPointValue;this.Ft(t,45),t.Mt(n.latitude||0),t.Mt(n.longitude||0)}else"mapValue"in e?e_(e)?this.Ft(t,Number.MAX_SAFE_INTEGER):Xa(e)?this.kt(e.mapValue,t):(this.qt(e.mapValue,t),this.Nt(t)):"arrayValue"in e?(this.Qt(e.arrayValue,t),this.Nt(t)):F(19022,{$t:e})}Ot(e,t){this.Ft(t,25),this.Ut(e,t)}Ut(e,t){t.xt(e)}qt(e,t){const n=e.fields||{};this.Ft(t,55);for(const i of Object.keys(n))this.Ot(i,t),this.Ct(n[i],t)}kt(e,t){var o,c;const n=e.fields||{};this.Ft(t,53);const i=ai,s=((c=(o=n[i].arrayValue)==null?void 0:o.values)==null?void 0:c.length)||0;this.Ft(t,15),t.Mt(he(s)),this.Ot(i,t),this.Ct(n[i],t)}Qt(e,t){const n=e.values||[];this.Ft(t,50);for(const i of n)this.Ct(i,t)}Lt(e,t){this.Ft(t,37),x.fromName(e).path.forEach(n=>{this.Ft(t,60),this.Ut(n,t)})}Ft(e,t){e.Mt(t)}Nt(e){e.Mt(2)}}Zn.Kt=new Zn;/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law | agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES | CONDITIONS OF ANY KIND, either express | implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xr=255;function SS(r){if(r===0)return 8;let e=0;return r>>4||(e+=4,r<<=4),r>>6||(e+=2,r<<=2),r>>7||(e+=1),e}function sp(r){const e=64-function(n){let i=0;for(let s=0;s<8;++s){const o=SS(255&n[s]);if(i+=o,o!==8)break}return i}(r);return Math.ceil(e/8)}class PS{constructor(){this.buffer=new Uint8Array(1024),this.position=0}Wt(e){const t=e[Symbol.iterator]();let n=t.next();for(;!n.done;)this.Gt(n.value),n=t.next();this.zt()}jt(e){const t=e[Symbol.iterator]();let n=t.next();for(;!n.done;)this.Jt(n.value),n=t.next();this.Ht()}Yt(e){for(const t of e){const n=t.charCodeAt(0);if(n<128)this.Gt(n);else if(n<2048)this.Gt(960|n>>>6),this.Gt(128|63&n);else if(t<"\uD800"||"\uDBFF"<t)this.Gt(480|n>>>12),this.Gt(128|63&n>>>6),this.Gt(128|63&n);else{const i=t.codePointAt(0);this.Gt(240|i>>>18),this.Gt(128|63&i>>>12),this.Gt(128|63&i>>>6),this.Gt(128|63&i)}}this.zt()}Zt(e){for(const t of e){const n=t.charCodeAt(0);if(n<128)this.Jt(n);else if(n<2048)this.Jt(960|n>>>6),this.Jt(128|63&n);else if(t<"\uD800"||"\uDBFF"<t)this.Jt(480|n>>>12),this.Jt(128|63&n>>>6),this.Jt(128|63&n);else{const i=t.codePointAt(0);this.Jt(240|i>>>18),this.Jt(128|63&i>>>12),this.Jt(128|63&i>>>6),this.Jt(128|63&i)}}this.Ht()}Xt(e){const t=this.en(e),n=sp(t);this.tn(1+n),this.buffer[this.position++]=255&n;for(let i=t.length-n;i<t.length;++i)this.buffer[this.position++]=255&t[i]}nn(e){const t=this.en(e),n=sp(t);this.tn(1+n),this.buffer[this.position++]=~(255&n);for(let i=t.length-n;i<t.length;++i)this.buffer[this.position++]=~(255&t[i])}rn(){this.sn(xr),this.sn(255)}_n(){this.an(xr),this.an(255)}reset(){this.position=0}seed(e){this.tn(e.length),this.buffer.set(e,this.position),this.position+=e.length}un(){return this.buffer.slice(0,this.position)}en(e){const t=function(s){const o=new DataView(new ArrayBuffer(8));return o.setFloat64(0,s,!1),new Uint8Array(o.buffer)}(e),n=!!(128&t[0]);t[0]^=n?255:128;for(let i=1;i<t.length;++i)t[i]^=n?255:0;return t}Gt(e){const t=255&e;t===0?(this.sn(0),this.sn(255)):t===xr?(this.sn(xr),this.sn(0)):this.sn(t)}Jt(e){const t=255&e;t===0?(this.an(0),this.an(255)):t===xr?(this.an(xr),this.an(0)):this.an(e)}zt(){this.sn(0),this.sn(1)}Ht(){this.an(0),this.an(1)}sn(e){this.tn(1),this.buffer[this.position++]=e}an(e){this.tn(1),this.buffer[this.position++]=~e}tn(e){const t=e+this.position;if(t<=this.buffer.length)return;let n=2*this.buffer.length;n<t&&(n=t);const i=new Uint8Array(n);i.set(this.buffer),this.buffer=i}}class CS{constructor(e){this.cn=e}Bt(e){this.cn.Wt(e)}xt(e){this.cn.Yt(e)}Mt(e){this.cn.Xt(e)}vt(){this.cn.rn()}}class kS{constructor(e){this.cn=e}Bt(e){this.cn.jt(e)}xt(e){this.cn.Zt(e)}Mt(e){this.cn.nn(e)}vt(){this.cn._n()}}class es{constructor(){this.cn=new PS,this.ln=new CS(this.cn),this.hn=new kS(this.cn)}seed(e){this.cn.seed(e)}Pn(e){return e===0?this.ln:this.hn}un(){return this.cn.un()}reset(){this.cn.reset()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class er{constructor(e,t,n,i){this.Tn=e,this.In=t,this.En=n,this.dn=i}An(){const e=this.dn.length,t=e===0||this.dn[e-1]===255?e+1:e,n=new Uint8Array(t);return n.set(this.dn,0),t!==e?n.set([0],this.dn.length):++n[n.length-1],new er(this.Tn,this.In,this.En,n)}Rn(e,t,n){return{indexId:this.Tn,uid:e,arrayValue:ia(this.En),directionalValue:ia(this.dn),orderedDocumentKey:ia(t),documentKey:n.path.toArray()}}Vn(e,t,n){const i=this.Rn(e,t,n);return[i.indexId,i.uid,i.arrayValue,i.directionalValue,i.orderedDocumentKey,i.documentKey]}}function un(r,e){let t=r.Tn-e.Tn;return t!==0?t:(t=op(r.En,e.En),t!==0?t:(t=op(r.dn,e.dn),t!==0?t:x.comparator(r.In,e.In)))}function op(r,e){for(let t=0;t<r.length&&t<e.length;++t){const n=r[t]-e[t];if(n!==0)return n}return r.length-e.length}function ia(r){return rm()?function(t){let n="";for(let i=0;i<t.length;i++)n+=String.fromCharCode(t[i]);return n}(r):r}function ap(r){return typeof r!="string"?r:function(t){const n=new Uint8Array(t.length);for(let i=0;i<t.length;i++)n[i]=t.charCodeAt(i);return n}(r)}class cp{constructor(e){this.mn=new ie((t,n)=>fe.comparator(t.field,n.field)),this.collectionId=e.collectionGroup!=null?e.collectionGroup:e.path.lastSegment(),this.fn=e.orderBy,this.gn=[];for(const t of e.filters){const n=t;n.isInequality()?this.mn=this.mn.add(n):this.gn.push(n)}}get pn(){return this.mn.size>1}yn(e){if(U(e.collectionGroup===this.collectionId,49279),this.pn)return!1;const t=wu(e);if(t!==void 0&&!this.wn(t))return!1;const n=Qn(e);let i=new Set,s=0,o=0;for(;s<n.length&&this.wn(n[s]);++s)i=i.add(n[s].fieldPath.canonicalString());if(s===n.length)return!0;if(this.mn.size>0){const c=this.mn.getIterator().getNext();if(!i.has(c.field.canonicalString())){const u=n[s];if(!this.Sn(c,u)||!this.bn(this.fn[o++],u))return!1}++s}for(;s<n.length;++s){const c=n[s];if(o>=this.fn.length||!this.bn(this.fn[o++],c))return!1}return!0}Dn(){if(this.pn)return null;let e=new ie(fe.comparator);const t=[];for(const n of this.gn)if(!n.field.isKeyField())if(n.op==="array-contains"||n.op==="array-contains-any")t.push(new Jo(n.field,2));else{if(e.has(n.field))continue;e=e.add(n.field),t.push(new Jo(n.field,0))}for(const n of this.fn)n.field.isKeyField()||e.has(n.field)||(e=e.add(n.field),t.push(new Jo(n.field,n.dir==="asc"?0:1)));return new ma(ma.UNKNOWN_ID,this.collectionId,t,Ms.empty())}wn(e){for(const t of this.gn)if(this.Sn(t,e))return!0;return!1}Sn(e,t){if(e===void 0||!e.field.isEqual(t.fieldPath))return!1;const n=e.op==="array-contains"||e.op==="array-contains-any";return t.kind===2===n}bn(e,t){return!!e.field.isEqual(t.fieldPath)&&(t.kind===0&&e.dir==="asc"||t.kind===1&&e.dir==="desc")}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function j_(r){var t,n;if(U(r instanceof J||r instanceof re,20012),r instanceof J){if(r instanceof u_){const i=((n=(t=r.value.arrayValue)==null?void 0:t.values)==null?void 0:n.map(s=>J.create(r.field,"==",s)))||[];return re.create(i,"or")}return r}const e=r.filters.map(i=>j_(i));return re.create(e,r.op)}function DS(r){if(r.getFilters().length===0)return[];const e=Fu(j_(r));return U(G_(e),7391),Mu(e)||Lu(e)?[e]:e.getFilters()}function Mu(r){return r instanceof J}function Lu(r){return r instanceof re&&Ll(r)}function G_(r){return Mu(r)||Lu(r)||function(t){if(t instanceof re&&Pu(t)){for(const n of t.getFilters())if(!Mu(n)&&!Lu(n))return!1;return!0}return!1}(r)}function Fu(r){if(U(r instanceof J||r instanceof re,34018),r instanceof J)return r;if(r.filters.length===1)return Fu(r.filters[0]);const e=r.filters.map(n=>Fu(n));let t=re.create(e,r.op);return t=va(t),G_(t)?t:(U(t instanceof re,64498),U(ui(t),40251),U(t.filters.length>1,57927),t.filters.reduce((n,i)=>Hl(n,i)))}function Hl(r,e){let t;return U(r instanceof J||r instanceof re,38388),U(e instanceof J||e instanceof re,25473),t=r instanceof J?e instanceof J?function(i,s){return re.create([i,s],"and")}(r,e):up(r,e):e instanceof J?up(e,r):function(i,s){if(U(i.filters.length>0&&s.filters.length>0,48005),ui(i)&&ui(s))return o_(i,s.getFilters());const o=Pu(i)?i:s,c=Pu(i)?s:i,u=o.filters.map(l=>Hl(l,c));return re.create(u,"or")}(r,e),va(t)}function up(r,e){if(ui(e))return o_(e,r.getFilters());{const t=e.filters.map(n=>Hl(r,n));return re.create(t,"or")}}function va(r){if(U(r instanceof J||r instanceof re,11850),r instanceof J)return r;const e=r.getFilters();if(e.length===1)return va(e[0]);if(i_(r))return r;const t=e.map(i=>va(i)),n=[];return t.forEach(i=>{i instanceof J?n.push(i):i instanceof re&&(i.op===r.op?n.push(...i.filters):n.push(i))}),n.length===1?n[0]:re.create(n,r.op)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class NS{constructor(){this.Cn=new Ql}addToCollectionParentIndex(e,t){return this.Cn.add(t),A.resolve()}getCollectionParents(e,t){return A.resolve(this.Cn.getEntries(t))}addFieldIndex(e,t){return A.resolve()}deleteFieldIndex(e,t){return A.resolve()}deleteAllFieldIndexes(e){return A.resolve()}createTargetIndexes(e,t){return A.resolve()}getDocumentsMatchingTarget(e,t){return A.resolve(null)}getIndexType(e,t){return A.resolve(0)}getFieldIndexes(e,t){return A.resolve([])}getNextCollectionGroupToUpdate(e){return A.resolve(null)}getMinOffset(e,t){return A.resolve(ut.min())}getMinOffsetFromCollectionGroup(e,t){return A.resolve(ut.min())}updateCollectionGroup(e,t,n){return A.resolve()}updateIndexEntries(e,t){return A.resolve()}}class Ql{constructor(){this.index={}}add(e){const t=e.lastSegment(),n=e.popLast(),i=this.index[t]||new ie(Q.comparator),s=!i.has(n);return this.index[t]=i.add(n),s}has(e){const t=e.lastSegment(),n=e.popLast(),i=this.index[t];return i&&i.has(n)}getEntries(e){return(this.index[e]||new ie(Q.comparator)).toArray()}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lp="IndexedDbIndexManager",qo=new Uint8Array(0);class VS{constructor(e,t){this.databaseId=t,this.vn=new Ql,this.Fn=new Yt(n=>pr(n),(n,i)=>uo(n,i)),this.uid=e.uid||""}addToCollectionParentIndex(e,t){if(!this.vn.has(t)){const n=t.lastSegment(),i=t.popLast();e.addOnCommittedListener(()=>{this.vn.add(t)});const s={collectionId:n,parent:ze(i)};return hp(e).put(s)}return A.resolve()}getCollectionParents(e,t){const n=[],i=IDBKeyRange.bound([t,""],[Sg(t),""],!1,!0);return hp(e).J(i).next(s=>{for(const o of s){if(o.collectionId!==t)break;n.push(Nt(o.parent))}return n})}addFieldIndex(e,t){const n=ts(e),i=function(c){return{indexId:c.indexId,collectionGroup:c.collectionGroup,fields:c.fields.map(u=>[u.fieldPath.canonicalString(),u.kind])}}(t);delete i.indexId;const s=n.add(i);if(t.indexState){const o=Lr(e);return s.next(c=>{o.put(np(c,this.uid,t.indexState.sequenceNumber,t.indexState.offset))})}return s.next()}deleteFieldIndex(e,t){const n=ts(e),i=Lr(e),s=Mr(e);return n.delete(t.indexId).next(()=>i.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0))).next(()=>s.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0)))}deleteAllFieldIndexes(e){const t=ts(e),n=Mr(e),i=Lr(e);return t.Z().next(()=>n.Z()).next(()=>i.Z())}createTargetIndexes(e,t){return A.forEach(this.Mn(t),n=>this.getIndexType(e,n).next(i=>{if(i===0||i===1){const s=new cp(n).Dn();if(s!=null)return this.addFieldIndex(e,s)}}))}getDocumentsMatchingTarget(e,t){const n=Mr(e);let i=!0;const s=new Map;return A.forEach(this.Mn(t),o=>this.xn(e,o).next(c=>{i&&(i=!!c),s.set(o,c)})).next(()=>{if(i){let o=W();const c=[];return A.forEach(s,(u,l)=>{V(lp,`Using index ${function($){return`id=${$.indexId}|cg=${$.collectionGroup}|f=${$.fields.map(ee=>`${ee.fieldPath}:${ee.kind}`).join(",")}`}(u)} to execute ${pr(t)}`);const f=function($,ee){const te=wu(ee);if(te===void 0)return null;for(const Y of wa($,te.fieldPath))switch(Y.op){case"array-contains-any":return Y.value.arrayValue.values||[];case"array-contains":return[Y.value]}return null}(l,u),p=function($,ee){const te=new Map;for(const Y of Qn(ee))for(const w of wa($,Y.fieldPath))switch(w.op){case"==":case"in":te.set(Y.fieldPath.canonicalString(),w.value);break;case"not-in":case"!=":return te.set(Y.fieldPath.canonicalString(),w.value),Array.from(te.values())}return null}(l,u),g=function($,ee){const te=[];let Y=!0;for(const w of Qn(ee)){const _=w.kind===0?$f($,w.fieldPath,$.startAt):zf($,w.fieldPath,$.startAt);te.push(_.value),Y&&(Y=_.inclusive)}return new kn(te,Y)}(l,u),v=function($,ee){const te=[];let Y=!0;for(const w of Qn(ee)){const _=w.kind===0?zf($,w.fieldPath,$.endAt):$f($,w.fieldPath,$.endAt);te.push(_.value),Y&&(Y=_.inclusive)}return new kn(te,Y)}(l,u),k=this.On(u,l,g),D=this.On(u,l,v),N=this.Nn(u,l,p),q=this.Bn(u.indexId,f,k,g.inclusive,D,v.inclusive,N);return A.forEach(q,j=>n.Y(j,t.limit).next($=>{$.forEach(ee=>{const te=x.fromSegments(ee.documentKey);o.has(te)||(o=o.add(te),c.push(te))})}))}).next(()=>c)}return A.resolve(null)})}Mn(e){let t=this.Fn.get(e);return t||(e.filters.length===0?t=[e]:t=DS(re.create(e.filters,"and")).map(n=>ku(e.path,e.collectionGroup,e.orderBy,n.getFilters(),e.limit,e.startAt,e.endAt)),this.Fn.set(e,t),t)}Bn(e,t,n,i,s,o,c){const u=(t!=null?t.length:1)*Math.max(n.length,s.length),l=u/(t!=null?t.length:1),f=[];for(let p=0;p<u;++p){const g=t?this.Ln(t[p/l]):qo,v=this.kn(e,g,n[p%l],i),k=this.qn(e,g,s[p%l],o),D=c.map(N=>this.kn(e,g,N,!0));f.push(...this.createRange(v,k,D))}return f}kn(e,t,n,i){const s=new er(e,x.empty(),t,n);return i?s:s.An()}qn(e,t,n,i){const s=new er(e,x.empty(),t,n);return i?s.An():s}xn(e,t){const n=new cp(t),i=t.collectionGroup!=null?t.collectionGroup:t.path.lastSegment();return this.getFieldIndexes(e,i).next(s=>{let o=null;for(const c of s)n.yn(c)&&(!o||c.fields.length>o.fields.length)&&(o=c);return o})}getIndexType(e,t){let n=2;const i=this.Mn(t);return A.forEach(i,s=>this.xn(e,s).next(o=>{o?n!==0&&o.fields.length<function(u){let l=new ie(fe.comparator),f=!1;for(const p of u.filters)for(const g of p.getFlattenedFilters())g.field.isKeyField()||(g.op==="array-contains"||g.op==="array-contains-any"?f=!0:l=l.add(g.field));for(const p of u.orderBy)p.field.isKeyField()||(l=l.add(p.field));return l.size+(f?1:0)}(s)&&(n=1):n=0})).next(()=>function(o){return o.limit!==null}(t)&&i.length>1&&n===2?1:n)}Qn(e,t){const n=new es;for(const i of Qn(e)){const s=t.data.field(i.fieldPath);if(s==null)return null;const o=n.Pn(i.kind);Zn.Kt.Dt(s,o)}return n.un()}Ln(e){const t=new es;return Zn.Kt.Dt(e,t.Pn(0)),t.un()}$n(e,t){const n=new es;return Zn.Kt.Dt(fr(this.databaseId,t),n.Pn(function(s){const o=Qn(s);return o.length===0?0:o[o.length-1].kind}(e))),n.un()}Nn(e,t,n){if(n===null)return[];let i=[];i.push(new es);let s=0;for(const o of Qn(e)){const c=n[s++];for(const u of i)if(this.Un(t,o.fieldPath)&&zs(c))i=this.Kn(i,o,c);else{const l=u.Pn(o.kind);Zn.Kt.Dt(c,l)}}return this.Wn(i)}On(e,t,n){return this.Nn(e,t,n.position)}Wn(e){const t=[];for(let n=0;n<e.length;++n)t[n]=e[n].un();return t}Kn(e,t,n){const i=[...e],s=[];for(const o of n.arrayValue.values||[])for(const c of i){const u=new es;u.seed(c.un()),Zn.Kt.Dt(o,u.Pn(t.kind)),s.push(u)}return s}Un(e,t){return!!e.filters.find(n=>n instanceof J&&n.field.isEqual(t)&&(n.op==="in"||n.op==="not-in"))}getFieldIndexes(e,t){const n=ts(e),i=Lr(e);return(t?n.J(Tu,IDBKeyRange.bound(t,t)):n.J()).next(s=>{const o=[];return A.forEach(s,c=>i.get([c.indexId,this.uid]).next(u=>{o.push(function(f,p){const g=p?new Ms(p.sequenceNumber,new ut(yr(p.readTime),new x(Nt(p.documentKey)),p.largestBatchId)):Ms.empty(),v=f.fields.map(([k,D])=>new Jo(fe.fromServerFormat(k),D));return new ma(f.indexId,f.collectionGroup,v,g)}(c,u))})).next(()=>o)})}getNextCollectionGroupToUpdate(e){return this.getFieldIndexes(e).next(t=>t.length===0?null:(t.sort((n,i)=>{const s=n.indexState.sequenceNumber-i.indexState.sequenceNumber;return s!==0?s:G(n.collectionGroup,i.collectionGroup)}),t[0].collectionGroup))}updateCollectionGroup(e,t,n){const i=ts(e),s=Lr(e);return this.Gn(e).next(o=>i.J(Tu,IDBKeyRange.bound(t,t)).next(c=>A.forEach(c,u=>s.put(np(u.indexId,this.uid,o,n)))))}updateIndexEntries(e,t){const n=new Map;return A.forEach(t,(i,s)=>{const o=n.get(i.collectionGroup);return(o?A.resolve(o):this.getFieldIndexes(e,i.collectionGroup)).next(c=>(n.set(i.collectionGroup,c),A.forEach(c,u=>this.zn(e,i,u).next(l=>{const f=this.jn(s,u);return l.isEqual(f)?A.resolve():this.Jn(e,s,u,l,f)}))))})}Hn(e,t,n,i){return Mr(e).put(i.Rn(this.uid,this.$n(n,t.key),t.key))}Yn(e,t,n,i){return Mr(e).delete(i.Vn(this.uid,this.$n(n,t.key),t.key))}zn(e,t,n){const i=Mr(e);let s=new ie(un);return i.ee({index:qg,range:IDBKeyRange.only([n.indexId,this.uid,ia(this.$n(n,t))])},(o,c)=>{s=s.add(new er(n.indexId,t,ap(c.arrayValue),ap(c.directionalValue)))}).next(()=>s)}jn(e,t){let n=new ie(un);const i=this.Qn(t,e);if(i==null)return n;const s=wu(t);if(s!=null){const o=e.data.field(s.fieldPath);if(zs(o))for(const c of o.arrayValue.values||[])n=n.add(new er(t.indexId,e.key,this.Ln(c),i))}else n=n.add(new er(t.indexId,e.key,qo,i));return n}Jn(e,t,n,i,s){V(lp,"Updating index entries for document '%s'",t.key);const o=[];return function(u,l,f,p,g){const v=u.getIterator(),k=l.getIterator();let D=Or(v),N=Or(k);for(;D||N;){let q=!1,j=!1;if(D&&N){const $=f(D,N);$<0?j=!0:$>0&&(q=!0)}else D!=null?j=!0:q=!0;q?(p(N),N=Or(k)):j?(g(D),D=Or(v)):(D=Or(v),N=Or(k))}}(i,s,un,c=>{o.push(this.Hn(e,t,n,c))},c=>{o.push(this.Yn(e,t,n,c))}),A.waitFor(o)}Gn(e){let t=1;return Lr(e).ee({index:Bg,reverse:!0,range:IDBKeyRange.upperBound([this.uid,Number.MAX_SAFE_INTEGER])},(n,i,s)=>{s.done(),t=i.sequenceNumber+1}).next(()=>t)}createRange(e,t,n){n=n.sort((o,c)=>un(o,c)).filter((o,c,u)=>!c||un(o,u[c-1])!==0);const i=[];i.push(e);for(const o of n){const c=un(o,e),u=un(o,t);if(c===0)i[0]=e.An();else if(c>0&&u<0)i.push(o),i.push(o.An());else if(u>0)break}i.push(t);const s=[];for(let o=0;o<i.length;o+=2){if(this.Zn(i[o],i[o+1]))return[];const c=i[o].Vn(this.uid,qo,x.empty()),u=i[o+1].Vn(this.uid,qo,x.empty());s.push(IDBKeyRange.bound(c,u))}return s}Zn(e,t){return un(e,t)>0}getMinOffsetFromCollectionGroup(e,t){return this.getFieldIndexes(e,t).next(dp)}getMinOffset(e,t){return A.mapArray(this.Mn(t),n=>this.xn(e,n).next(i=>i||F(44426))).next(dp)}}function hp(r){return ke(r,Bs)}function Mr(r){return ke(r,Es)}function ts(r){return ke(r,Nl)}function Lr(r){return ke(r,ws)}function dp(r){U(r.length!==0,28825);let e=r[0].indexState.offset,t=e.largestBatchId;for(let n=1;n<r.length;n++){const i=r[n].indexState.offset;Cl(i,e)<0&&(e=i),t<i.largestBatchId&&(t=i.largestBatchId)}return new ut(e.readTime,e.documentKey,t)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fp={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},W_=41943040;class qe{static withCacheSize(e){return new qe(e,qe.DEFAULT_COLLECTION_PERCENTILE,qe.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(e,t,n){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=t,this.maximumSequenceNumbersToCollect=n}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function K_(r,e,t){const n=r.store(_t),i=r.store(ri),s=[],o=IDBKeyRange.only(t.batchId);let c=0;const u=n.ee({range:o},(f,p,g)=>(c++,g.delete()));s.push(u.next(()=>{U(c===1,47070,{batchId:t.batchId})}));const l=[];for(const f of t.mutations){const p=Lg(e,f.key.path,t.batchId);s.push(i.delete(p)),l.push(f.key)}return A.waitFor(s).next(()=>l)}function Aa(r){if(!r)return 0;let e;if(r.document)e=r.document;else if(r.unknownDocument)e=r.unknownDocument;else{if(!r.noDocument)throw F(14731);e=r.noDocument}return JSON.stringify(e).length}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */qe.DEFAULT_COLLECTION_PERCENTILE=10,qe.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,qe.DEFAULT=new qe(W_,qe.DEFAULT_COLLECTION_PERCENTILE,qe.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),qe.DISABLED=new qe(-1,0,0);class nc{constructor(e,t,n,i){this.userId=e,this.serializer=t,this.indexManager=n,this.referenceDelegate=i,this.Xn={}}static wt(e,t,n,i){U(e.uid!=="",64387);const s=e.isAuthenticated()?e.uid:"";return new nc(s,t,n,i)}checkEmpty(e){let t=!0;const n=IDBKeyRange.bound([this.userId,Number.NEGATIVE_INFINITY],[this.userId,Number.POSITIVE_INFINITY]);return ln(e).ee({index:rr,range:n},(i,s,o)=>{t=!1,o.done()}).next(()=>t)}addMutationBatch(e,t,n,i){const s=zr(e),o=ln(e);return o.add({}).next(c=>{U(typeof c=="number",49019);const u=new $l(c,t,n,i),l=function(v,k,D){const N=D.baseMutations.map(j=>Ws(v.yt,j)),q=D.mutations.map(j=>Ws(v.yt,j));return{userId:k,batchId:D.batchId,localWriteTimeMs:D.localWriteTime.toMillis(),baseMutations:N,mutations:q}}(this.serializer,this.userId,u),f=[];let p=new ie((g,v)=>G(g.canonicalString(),v.canonicalString()));for(const g of i){const v=Lg(this.userId,g.key.path,c);p=p.add(g.key.path.popLast()),f.push(o.put(l)),f.push(s.put(v,fR))}return p.forEach(g=>{f.push(this.indexManager.addToCollectionParentIndex(e,g))}),e.addOnCommittedListener(()=>{this.Xn[c]=u.keys()}),A.waitFor(f).next(()=>u)})}lookupMutationBatch(e,t){return ln(e).get(t).next(n=>n?(U(n.userId===this.userId,48,"Unexpected user for mutation batch",{userId:n.userId,batchId:t}),Xn(this.serializer,n)):null)}er(e,t){return this.Xn[t]?A.resolve(this.Xn[t]):this.lookupMutationBatch(e,t).next(n=>{if(n){const i=n.keys();return this.Xn[t]=i,i}return null})}getNextMutationBatchAfterBatchId(e,t){const n=t+1,i=IDBKeyRange.lowerBound([this.userId,n]);let s=null;return ln(e).ee({index:rr,range:i},(o,c,u)=>{c.userId===this.userId&&(U(c.batchId>=n,47524,{tr:n}),s=Xn(this.serializer,c)),u.done()}).next(()=>s)}getHighestUnacknowledgedBatchId(e){const t=IDBKeyRange.upperBound([this.userId,Number.POSITIVE_INFINITY]);let n=wn;return ln(e).ee({index:rr,range:t,reverse:!0},(i,s,o)=>{n=s.batchId,o.done()}).next(()=>n)}getAllMutationBatches(e){const t=IDBKeyRange.bound([this.userId,wn],[this.userId,Number.POSITIVE_INFINITY]);return ln(e).J(rr,t).next(n=>n.map(i=>Xn(this.serializer,i)))}getAllMutationBatchesAffectingDocumentKey(e,t){const n=Yo(this.userId,t.path),i=IDBKeyRange.lowerBound(n),s=[];return zr(e).ee({range:i},(o,c,u)=>{const[l,f,p]=o,g=Nt(f);if(l===this.userId&&t.path.isEqual(g))return ln(e).get(p).next(v=>{if(!v)throw F(61480,{nr:o,batchId:p});U(v.userId===this.userId,10503,"Unexpected user for mutation batch",{userId:v.userId,batchId:p}),s.push(Xn(this.serializer,v))});u.done()}).next(()=>s)}getAllMutationBatchesAffectingDocumentKeys(e,t){let n=new ie(G);const i=[];return t.forEach(s=>{const o=Yo(this.userId,s.path),c=IDBKeyRange.lowerBound(o),u=zr(e).ee({range:c},(l,f,p)=>{const[g,v,k]=l,D=Nt(v);g===this.userId&&s.path.isEqual(D)?n=n.add(k):p.done()});i.push(u)}),A.waitFor(i).next(()=>this.rr(e,n))}getAllMutationBatchesAffectingQuery(e,t){const n=t.path,i=n.length+1,s=Yo(this.userId,n),o=IDBKeyRange.lowerBound(s);let c=new ie(G);return zr(e).ee({range:o},(u,l,f)=>{const[p,g,v]=u,k=Nt(g);p===this.userId&&n.isPrefixOf(k)?k.length===i&&(c=c.add(v)):f.done()}).next(()=>this.rr(e,c))}rr(e,t){const n=[],i=[];return t.forEach(s=>{i.push(ln(e).get(s).next(o=>{if(o===null)throw F(35274,{batchId:s});U(o.userId===this.userId,9748,"Unexpected user for mutation batch",{userId:o.userId,batchId:s}),n.push(Xn(this.serializer,o))}))}),A.waitFor(i).next(()=>n)}removeMutationBatch(e,t){return K_(e.le,this.userId,t).next(n=>(e.addOnCommittedListener(()=>{this.ir(t.batchId)}),A.forEach(n,i=>this.referenceDelegate.markPotentiallyOrphaned(e,i))))}ir(e){delete this.Xn[e]}performConsistencyCheck(e){return this.checkEmpty(e).next(t=>{if(!t)return A.resolve();const n=IDBKeyRange.lowerBound(function(o){return[o]}(this.userId)),i=[];return zr(e).ee({range:n},(s,o,c)=>{if(s[0]===this.userId){const u=Nt(s[1]);i.push(u)}else c.done()}).next(()=>{U(i.length===0,56720,{sr:i.map(s=>s.canonicalString())})})})}containsKey(e,t){return H_(e,this.userId,t)}_r(e){return Q_(e).get(this.userId).next(t=>t||{userId:this.userId,lastAcknowledgedBatchId:wn,lastStreamToken:""})}}function H_(r,e,t){const n=Yo(e,t.path),i=n[1],s=IDBKeyRange.lowerBound(n);let o=!1;return zr(r).ee({range:s,X:!0},(c,u,l)=>{const[f,p,g]=c;f===e&&p===i&&(o=!0),l.done()}).next(()=>o)}function ln(r){return ke(r,_t)}function zr(r){return ke(r,ri)}function Q_(r){return ke(r,Fs)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ir{constructor(e){this.ar=e}next(){return this.ar+=2,this.ar}static ur(){return new Ir(0)}static cr(){return new Ir(-1)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class OS{constructor(e,t){this.referenceDelegate=e,this.serializer=t}allocateTargetId(e){return this.lr(e).next(t=>{const n=new Ir(t.highestTargetId);return t.highestTargetId=n.next(),this.hr(e,t).next(()=>t.highestTargetId)})}getLastRemoteSnapshotVersion(e){return this.lr(e).next(t=>B.fromTimestamp(new ne(t.lastRemoteSnapshotVersion.seconds,t.lastRemoteSnapshotVersion.nanoseconds)))}getHighestSequenceNumber(e){return this.lr(e).next(t=>t.highestListenSequenceNumber)}setTargetsMetadata(e,t,n){return this.lr(e).next(i=>(i.highestListenSequenceNumber=t,n&&(i.lastRemoteSnapshotVersion=n.toTimestamp()),t>i.highestListenSequenceNumber&&(i.highestListenSequenceNumber=t),this.hr(e,i)))}addTargetData(e,t){return this.Pr(e,t).next(()=>this.lr(e).next(n=>(n.targetCount+=1,this.Tr(t,n),this.hr(e,n))))}updateTargetData(e,t){return this.Pr(e,t)}removeTargetData(e,t){return this.removeMatchingKeysForTargetId(e,t.targetId).next(()=>Fr(e).delete(t.targetId)).next(()=>this.lr(e)).next(n=>(U(n.targetCount>0,8065),n.targetCount-=1,this.hr(e,n)))}removeTargets(e,t,n){let i=0;const s=[];return Fr(e).ee((o,c)=>{const u=ls(c);u.sequenceNumber<=t&&n.get(u.targetId)===null&&(i++,s.push(this.removeTargetData(e,u)))}).next(()=>A.waitFor(s)).next(()=>i)}forEachTarget(e,t){return Fr(e).ee((n,i)=>{const s=ls(i);t(s)})}lr(e){return pp(e).get(ya).next(t=>(U(t!==null,2888),t))}hr(e,t){return pp(e).put(ya,t)}Pr(e,t){return Fr(e).put(z_(this.serializer,t))}Tr(e,t){let n=!1;return e.targetId>t.highestTargetId&&(t.highestTargetId=e.targetId,n=!0),e.sequenceNumber>t.highestListenSequenceNumber&&(t.highestListenSequenceNumber=e.sequenceNumber,n=!0),n}getTargetCount(e){return this.lr(e).next(t=>t.targetCount)}getTargetData(e,t){const n=pr(t),i=IDBKeyRange.bound([n,Number.NEGATIVE_INFINITY],[n,Number.POSITIVE_INFINITY]);let s=null;return Fr(e).ee({range:i,index:Ug},(o,c,u)=>{const l=ls(c);uo(t,l.target)&&(s=l,u.done())}).next(()=>s)}addMatchingKeys(e,t,n){const i=[],s=fn(e);return t.forEach(o=>{const c=ze(o.path);i.push(s.put({targetId:n,path:c})),i.push(this.referenceDelegate.addReference(e,n,o))}),A.waitFor(i)}removeMatchingKeys(e,t,n){const i=fn(e);return A.forEach(t,s=>{const o=ze(s.path);return A.waitFor([i.delete([n,o]),this.referenceDelegate.removeReference(e,n,s)])})}removeMatchingKeysForTargetId(e,t){const n=fn(e),i=IDBKeyRange.bound([t],[t+1],!1,!0);return n.delete(i)}getMatchingKeysForTargetId(e,t){const n=IDBKeyRange.bound([t],[t+1],!1,!0),i=fn(e);let s=W();return i.ee({range:n,X:!0},(o,c,u)=>{const l=Nt(o[1]),f=new x(l);s=s.add(f)}).next(()=>s)}containsKey(e,t){const n=ze(t.path),i=IDBKeyRange.bound([n],[Sg(n)],!1,!0);let s=0;return fn(e).ee({index:Dl,X:!0,range:i},([o,c],u,l)=>{o!==0&&(s++,l.done())}).next(()=>s>0)}At(e,t){return Fr(e).get(t).next(n=>n?ls(n):null)}}function Fr(r){return ke(r,ii)}function pp(r){return ke(r,ur)}function fn(r){return ke(r,si)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mp="LruGarbageCollector",xS=1048576;function gp([r,e],[t,n]){const i=G(r,t);return i===0?G(e,n):i}class MS{constructor(e){this.Ir=e,this.buffer=new ie(gp),this.Er=0}dr(){return++this.Er}Ar(e){const t=[e,this.dr()];if(this.buffer.size<this.Ir)this.buffer=this.buffer.add(t);else{const n=this.buffer.last();gp(t,n)<0&&(this.buffer=this.buffer.delete(n).add(t))}}get maxValue(){return this.buffer.last()[0]}}class J_{constructor(e,t,n){this.garbageCollector=e,this.asyncQueue=t,this.localStore=n,this.Rr=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Vr(6e4)}stop(){this.Rr&&(this.Rr.cancel(),this.Rr=null)}get started(){return this.Rr!==null}Vr(e){V(mp,`Garbage collection scheduled in ${e}ms`),this.Rr=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,async()=>{this.Rr=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(t){Ln(t)?V(mp,"Ignoring IndexedDB error during garbage collection: ",t):await Mn(t)}await this.Vr(3e5)})}}class LS{constructor(e,t){this.mr=e,this.params=t}calculateTargetCount(e,t){return this.mr.gr(e).next(n=>Math.floor(t/100*n))}nthSequenceNumber(e,t){if(t===0)return A.resolve(et.ce);const n=new MS(t);return this.mr.forEachTarget(e,i=>n.Ar(i.sequenceNumber)).next(()=>this.mr.pr(e,i=>n.Ar(i))).next(()=>n.maxValue)}removeTargets(e,t,n){return this.mr.removeTargets(e,t,n)}removeOrphanedDocuments(e,t){return this.mr.removeOrphanedDocuments(e,t)}collect(e,t){return this.params.cacheSizeCollectionThreshold===-1?(V("LruGarbageCollector","Garbage collection skipped; disabled"),A.resolve(fp)):this.getCacheSize(e).next(n=>n<this.params.cacheSizeCollectionThreshold?(V("LruGarbageCollector",`Garbage collection skipped; Cache size ${n} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),fp):this.yr(e,t))}getCacheSize(e){return this.mr.getCacheSize(e)}yr(e,t){let n,i,s,o,c,u,l;const f=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next(p=>(p>this.params.maximumSequenceNumbersToCollect?(V("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${p}`),i=this.params.maximumSequenceNumbersToCollect):i=p,o=Date.now(),this.nthSequenceNumber(e,i))).next(p=>(n=p,c=Date.now(),this.removeTargets(e,n,t))).next(p=>(s=p,u=Date.now(),this.removeOrphanedDocuments(e,n))).next(p=>(l=Date.now(),Ur()<=H.DEBUG&&V("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${o-f}ms
	Determined least recently used ${i} in `+(c-o)+`ms
	Removed ${s} targets in `+(u-c)+`ms
	Removed ${p} documents in `+(l-u)+`ms
Total Duration: ${l-f}ms`),A.resolve({didRun:!0,sequenceNumbersCollected:i,targetsRemoved:s,documentsRemoved:p})))}}function Y_(r,e){return new LS(r,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class FS{constructor(e,t){this.db=e,this.garbageCollector=Y_(this,t)}gr(e){const t=this.wr(e);return this.db.getTargetCache().getTargetCount(e).next(n=>t.next(i=>n+i))}wr(e){let t=0;return this.pr(e,n=>{t++}).next(()=>t)}forEachTarget(e,t){return this.db.getTargetCache().forEachTarget(e,t)}pr(e,t){return this.Sr(e,(n,i)=>t(i))}addReference(e,t,n){return $o(e,n)}removeReference(e,t,n){return $o(e,n)}removeTargets(e,t,n){return this.db.getTargetCache().removeTargets(e,t,n)}markPotentiallyOrphaned(e,t){return $o(e,t)}br(e,t){return function(i,s){let o=!1;return Q_(i).te(c=>H_(i,c,s).next(u=>(u&&(o=!0),A.resolve(!u)))).next(()=>o)}(e,t)}removeOrphanedDocuments(e,t){const n=this.db.getRemoteDocumentCache().newChangeBuffer(),i=[];let s=0;return this.Sr(e,(o,c)=>{if(c<=t){const u=this.br(e,o).next(l=>{if(!l)return s++,n.getEntry(e,o).next(()=>(n.removeEntry(o,B.min()),fn(e).delete(function(p){return[0,ze(p.path)]}(o))))});i.push(u)}}).next(()=>A.waitFor(i)).next(()=>n.apply(e)).next(()=>s)}removeTarget(e,t){const n=t.withSequenceNumber(e.currentSequenceNumber);return this.db.getTargetCache().updateTargetData(e,n)}updateLimboDocument(e,t){return $o(e,t)}Sr(e,t){const n=fn(e);let i,s=et.ce;return n.ee({index:Dl},([o,c],{path:u,sequenceNumber:l})=>{o===0?(s!==et.ce&&t(new x(Nt(i)),s),s=l,i=u):s=et.ce}).next(()=>{s!==et.ce&&t(new x(Nt(i)),s)})}getCacheSize(e){return this.db.getRemoteDocumentCache().getSize(e)}}function $o(r,e){return fn(r).put(function(n,i){return{targetId:0,path:ze(n.path),sequenceNumber:i}}(e,r.currentSequenceNumber))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class X_{constructor(){this.changes=new Yt(e=>e.toString(),(e,t)=>e.isEqual(t)),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,le.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();const n=this.changes.get(t);return n!==void 0?A.resolve(n):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class US{constructor(e){this.serializer=e}setIndexManager(e){this.indexManager=e}addEntry(e,t,n){return Kn(e).put(n)}removeEntry(e,t,n){return Kn(e).delete(function(s,o){const c=s.path.toArray();return[c.slice(0,c.length-2),c[c.length-2],Ta(o),c[c.length-1]]}(t,n))}updateMetadata(e,t){return this.getMetadata(e).next(n=>(n.byteSize+=t,this.Dr(e,n)))}getEntry(e,t){let n=le.newInvalidDocument(t);return Kn(e).ee({index:Xo,range:IDBKeyRange.only(ns(t))},(i,s)=>{n=this.Cr(t,s)}).next(()=>n)}vr(e,t){let n={size:0,document:le.newInvalidDocument(t)};return Kn(e).ee({index:Xo,range:IDBKeyRange.only(ns(t))},(i,s)=>{n={document:this.Cr(t,s),size:Aa(s)}}).next(()=>n)}getEntries(e,t){let n=nt();return this.Fr(e,t,(i,s)=>{const o=this.Cr(i,s);n=n.insert(i,o)}).next(()=>n)}Mr(e,t){let n=nt(),i=new ce(x.comparator);return this.Fr(e,t,(s,o)=>{const c=this.Cr(s,o);n=n.insert(s,c),i=i.insert(s,Aa(o))}).next(()=>({documents:n,Or:i}))}Fr(e,t,n){if(t.isEmpty())return A.resolve();let i=new ie(Ip);t.forEach(u=>i=i.add(u));const s=IDBKeyRange.bound(ns(i.first()),ns(i.last())),o=i.getIterator();let c=o.getNext();return Kn(e).ee({index:Xo,range:s},(u,l,f)=>{const p=x.fromSegments([...l.prefixPath,l.collectionGroup,l.documentId]);for(;c&&Ip(c,p)<0;)n(c,null),c=o.getNext();c&&c.isEqual(p)&&(n(c,l),c=o.hasNext()?o.getNext():null),c?f.j(ns(c)):f.done()}).next(()=>{for(;c;)n(c,null),c=o.hasNext()?o.getNext():null})}getDocumentsMatchingQuery(e,t,n,i,s){const o=t.path,c=[o.popLast().toArray(),o.lastSegment(),Ta(n.readTime),n.documentKey.path.isEmpty()?"":n.documentKey.path.lastSegment()],u=[o.popLast().toArray(),o.lastSegment(),[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER],""];return Kn(e).J(IDBKeyRange.bound(c,u,!0)).next(l=>{s==null||s.incrementDocumentReadCount(l.length);let f=nt();for(const p of l){const g=this.Cr(x.fromSegments(p.prefixPath.concat(p.collectionGroup,p.documentId)),p);g.isFoundDocument()&&(ho(t,g)||i.has(g.key))&&(f=f.insert(g.key,g))}return f})}getAllFromCollectionGroup(e,t,n,i){let s=nt();const o=yp(t,n),c=yp(t,ut.max());return Kn(e).ee({index:Fg,range:IDBKeyRange.bound(o,c,!0)},(u,l,f)=>{const p=this.Cr(x.fromSegments(l.prefixPath.concat(l.collectionGroup,l.documentId)),l);s=s.insert(p.key,p),s.size===i&&f.done()}).next(()=>s)}newChangeBuffer(e){return new BS(this,!!e&&e.trackRemovals)}getSize(e){return this.getMetadata(e).next(t=>t.byteSize)}getMetadata(e){return _p(e).get(Eu).next(t=>(U(!!t,20021),t))}Dr(e,t){return _p(e).put(Eu,t)}Cr(e,t){if(t){const n=AS(this.serializer,t);if(!(n.isNoDocument()&&n.version.isEqual(B.min())))return n}return le.newInvalidDocument(e)}}function Z_(r){return new US(r)}class BS extends X_{constructor(e,t){super(),this.Nr=e,this.trackRemovals=t,this.Br=new Yt(n=>n.toString(),(n,i)=>n.isEqual(i))}applyChanges(e){const t=[];let n=0,i=new ie((s,o)=>G(s.canonicalString(),o.canonicalString()));return this.changes.forEach((s,o)=>{const c=this.Br.get(s);if(t.push(this.Nr.removeEntry(e,s,c.readTime)),o.isValidDocument()){const u=ep(this.Nr.serializer,o);i=i.add(s.path.popLast());const l=Aa(u);n+=l-c.size,t.push(this.Nr.addEntry(e,s,u))}else if(n-=c.size,this.trackRemovals){const u=ep(this.Nr.serializer,o.convertToNoDocument(B.min()));t.push(this.Nr.addEntry(e,s,u))}}),i.forEach(s=>{t.push(this.Nr.indexManager.addToCollectionParentIndex(e,s))}),t.push(this.Nr.updateMetadata(e,n)),A.waitFor(t)}getFromCache(e,t){return this.Nr.vr(e,t).next(n=>(this.Br.set(t,{size:n.size,readTime:n.document.readTime}),n.document))}getAllFromCache(e,t){return this.Nr.Mr(e,t).next(({documents:n,Or:i})=>(i.forEach((s,o)=>{this.Br.set(s,{size:o,readTime:n.get(s).readTime})}),n))}}function _p(r){return ke(r,Us)}function Kn(r){return ke(r,_a)}function ns(r){const e=r.path.toArray();return[e.slice(0,e.length-2),e[e.length-2],e[e.length-1]]}function yp(r,e){const t=e.documentKey.path.toArray();return[r,Ta(e.readTime),t.slice(0,t.length-2),t.length>0?t[t.length-1]:""]}function Ip(r,e){const t=r.path.toArray(),n=e.path.toArray();let i=0;for(let s=0;s<t.length-2&&s<n.length-2;++s)if(i=G(t[s],n[s]),i)return i;return i=G(t.length,n.length),i||(i=G(t[t.length-2],n[n.length-2]),i||G(t[t.length-1],n[n.length-1]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qS{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ey{constructor(e,t,n,i){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=n,this.indexManager=i}getDocument(e,t){let n=null;return this.documentOverlayCache.getOverlay(e,t).next(i=>(n=i,this.remoteDocumentCache.getEntry(e,t))).next(i=>(n!==null&&As(n.mutation,i,tt.empty(),ne.now()),i))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next(n=>this.getLocalViewOfDocuments(e,n,W()).next(()=>n))}getLocalViewOfDocuments(e,t,n=W()){const i=Vt();return this.populateOverlays(e,i,t).next(()=>this.computeViews(e,t,i,n).next(s=>{let o=cs();return s.forEach((c,u)=>{o=o.insert(c,u.overlayedDocument)}),o}))}getOverlayedDocuments(e,t){const n=Vt();return this.populateOverlays(e,n,t).next(()=>this.computeViews(e,t,n,W()))}populateOverlays(e,t,n){const i=[];return n.forEach(s=>{t.has(s)||i.push(s)}),this.documentOverlayCache.getOverlays(e,i).next(s=>{s.forEach((o,c)=>{t.set(o,c)})})}computeViews(e,t,n,i){let s=nt();const o=vs(),c=function(){return vs()}();return t.forEach((u,l)=>{const f=n.get(l.key);i.has(l.key)&&(f===void 0||f.mutation instanceof Xt)?s=s.insert(l.key,l):f!==void 0?(o.set(l.key,f.mutation.getFieldMask()),As(f.mutation,l,f.mutation.getFieldMask(),ne.now())):o.set(l.key,tt.empty())}),this.recalculateAndSaveOverlays(e,s).next(u=>(u.forEach((l,f)=>o.set(l,f)),t.forEach((l,f)=>c.set(l,new qS(f,o.get(l)??null))),c))}recalculateAndSaveOverlays(e,t){const n=vs();let i=new ce((o,c)=>o-c),s=W();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next(o=>{for(const c of o)c.keys().forEach(u=>{const l=t.get(u);if(l===null)return;let f=n.get(u)||tt.empty();f=c.applyToLocalView(l,f),n.set(u,f);const p=(i.get(c.batchId)||W()).add(u);i=i.insert(c.batchId,p)})}).next(()=>{const o=[],c=i.getReverseIterator();for(;c.hasNext();){const u=c.getNext(),l=u.key,f=u.value,p=g_();f.forEach(g=>{if(!s.has(g)){const v=v_(t.get(g),n.get(g));v!==null&&p.set(g,v),s=s.add(g)}}),o.push(this.documentOverlayCache.saveOverlays(e,l,p))}return A.waitFor(o)}).next(()=>n)}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next(n=>this.recalculateAndSaveOverlays(e,n))}getDocumentsMatchingQuery(e,t,n,i){return function(o){return x.isDocumentKey(o.path)&&o.collectionGroup===null&&o.filters.length===0}(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):Fl(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,n,i):this.getDocumentsMatchingCollectionQuery(e,t,n,i)}getNextDocuments(e,t,n,i){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,n,i).next(s=>{const o=i-s.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,n.largestBatchId,i-s.size):A.resolve(Vt());let c=ni,u=s;return o.next(l=>A.forEach(l,(f,p)=>(c<p.largestBatchId&&(c=p.largestBatchId),s.get(f)?A.resolve():this.remoteDocumentCache.getEntry(e,f).next(g=>{u=u.insert(f,g)}))).next(()=>this.populateOverlays(e,l,s)).next(()=>this.computeViews(e,u,l,W())).next(f=>({batchId:c,changes:m_(f)})))})}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new x(t)).next(n=>{let i=cs();return n.isFoundDocument()&&(i=i.insert(n.key,n)),i})}getDocumentsMatchingCollectionGroupQuery(e,t,n,i){const s=t.collectionGroup;let o=cs();return this.indexManager.getCollectionParents(e,s).next(c=>A.forEach(c,u=>{const l=function(p,g){return new Jt(g,null,p.explicitOrderBy.slice(),p.filters.slice(),p.limit,p.limitType,p.startAt,p.endAt)}(t,u.child(s));return this.getDocumentsMatchingCollectionQuery(e,l,n,i).next(f=>{f.forEach((p,g)=>{o=o.insert(p,g)})})}).next(()=>o))}getDocumentsMatchingCollectionQuery(e,t,n,i){let s;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,n.largestBatchId).next(o=>(s=o,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,n,s,i))).next(o=>{s.forEach((u,l)=>{const f=l.getKey();o.get(f)===null&&(o=o.insert(f,le.newInvalidDocument(f)))});let c=cs();return o.forEach((u,l)=>{const f=s.get(u);f!==void 0&&As(f.mutation,l,tt.empty(),ne.now()),ho(t,l)&&(c=c.insert(u,l))}),c})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $S{constructor(e){this.serializer=e,this.Lr=new Map,this.kr=new Map}getBundleMetadata(e,t){return A.resolve(this.Lr.get(t))}saveBundleMetadata(e,t){return this.Lr.set(t.id,function(i){return{id:i.id,version:i.version,createTime:Te(i.createTime)}}(t)),A.resolve()}getNamedQuery(e,t){return A.resolve(this.kr.get(t))}saveNamedQuery(e,t){return this.kr.set(t.name,function(i){return{name:i.name,query:Kl(i.bundledQuery),readTime:Te(i.readTime)}}(t)),A.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zS{constructor(){this.overlays=new ce(x.comparator),this.qr=new Map}getOverlay(e,t){return A.resolve(this.overlays.get(t))}getOverlays(e,t){const n=Vt();return A.forEach(t,i=>this.getOverlay(e,i).next(s=>{s!==null&&n.set(i,s)})).next(()=>n)}saveOverlays(e,t,n){return n.forEach((i,s)=>{this.St(e,t,s)}),A.resolve()}removeOverlaysForBatchId(e,t,n){const i=this.qr.get(n);return i!==void 0&&(i.forEach(s=>this.overlays=this.overlays.remove(s)),this.qr.delete(n)),A.resolve()}getOverlaysForCollection(e,t,n){const i=Vt(),s=t.length+1,o=new x(t.child("")),c=this.overlays.getIteratorFrom(o);for(;c.hasNext();){const u=c.getNext().value,l=u.getKey();if(!t.isPrefixOf(l.path))break;l.path.length===s&&u.largestBatchId>n&&i.set(u.getKey(),u)}return A.resolve(i)}getOverlaysForCollectionGroup(e,t,n,i){let s=new ce((l,f)=>l-f);const o=this.overlays.getIterator();for(;o.hasNext();){const l=o.getNext().value;if(l.getKey().getCollectionGroup()===t&&l.largestBatchId>n){let f=s.get(l.largestBatchId);f===null&&(f=Vt(),s=s.insert(l.largestBatchId,f)),f.set(l.getKey(),l)}}const c=Vt(),u=s.getIterator();for(;u.hasNext()&&(u.getNext().value.forEach((l,f)=>c.set(l,f)),!(c.size()>=i)););return A.resolve(c)}St(e,t,n){const i=this.overlays.get(n.key);if(i!==null){const o=this.qr.get(i.largestBatchId).delete(n.key);this.qr.set(i.largestBatchId,o)}this.overlays=this.overlays.insert(n.key,new jl(t,n));let s=this.qr.get(t);s===void 0&&(s=W(),this.qr.set(t,s)),this.qr.set(t,s.add(n.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jS{constructor(){this.sessionToken=ye.EMPTY_BYTE_STRING}getSessionToken(e){return A.resolve(this.sessionToken)}setSessionToken(e,t){return this.sessionToken=t,A.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jl{constructor(){this.Qr=new ie(Ne.$r),this.Ur=new ie(Ne.Kr)}isEmpty(){return this.Qr.isEmpty()}addReference(e,t){const n=new Ne(e,t);this.Qr=this.Qr.add(n),this.Ur=this.Ur.add(n)}Wr(e,t){e.forEach(n=>this.addReference(n,t))}removeReference(e,t){this.Gr(new Ne(e,t))}zr(e,t){e.forEach(n=>this.removeReference(n,t))}jr(e){const t=new x(new Q([])),n=new Ne(t,e),i=new Ne(t,e+1),s=[];return this.Ur.forEachInRange([n,i],o=>{this.Gr(o),s.push(o.key)}),s}Jr(){this.Qr.forEach(e=>this.Gr(e))}Gr(e){this.Qr=this.Qr.delete(e),this.Ur=this.Ur.delete(e)}Hr(e){const t=new x(new Q([])),n=new Ne(t,e),i=new Ne(t,e+1);let s=W();return this.Ur.forEachInRange([n,i],o=>{s=s.add(o.key)}),s}containsKey(e){const t=new Ne(e,0),n=this.Qr.firstAfterOrEqual(t);return n!==null&&e.isEqual(n.key)}}class Ne{constructor(e,t){this.key=e,this.Yr=t}static $r(e,t){return x.comparator(e.key,t.key)||G(e.Yr,t.Yr)}static Kr(e,t){return G(e.Yr,t.Yr)||x.comparator(e.key,t.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class GS{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.tr=1,this.Zr=new ie(Ne.$r)}checkEmpty(e){return A.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,n,i){const s=this.tr;this.tr++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const o=new $l(s,t,n,i);this.mutationQueue.push(o);for(const c of i)this.Zr=this.Zr.add(new Ne(c.key,s)),this.indexManager.addToCollectionParentIndex(e,c.key.path.popLast());return A.resolve(o)}lookupMutationBatch(e,t){return A.resolve(this.Xr(t))}getNextMutationBatchAfterBatchId(e,t){const n=t+1,i=this.ei(n),s=i<0?0:i;return A.resolve(this.mutationQueue.length>s?this.mutationQueue[s]:null)}getHighestUnacknowledgedBatchId(){return A.resolve(this.mutationQueue.length===0?wn:this.tr-1)}getAllMutationBatches(e){return A.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){const n=new Ne(t,0),i=new Ne(t,Number.POSITIVE_INFINITY),s=[];return this.Zr.forEachInRange([n,i],o=>{const c=this.Xr(o.Yr);s.push(c)}),A.resolve(s)}getAllMutationBatchesAffectingDocumentKeys(e,t){let n=new ie(G);return t.forEach(i=>{const s=new Ne(i,0),o=new Ne(i,Number.POSITIVE_INFINITY);this.Zr.forEachInRange([s,o],c=>{n=n.add(c.Yr)})}),A.resolve(this.ti(n))}getAllMutationBatchesAffectingQuery(e,t){const n=t.path,i=n.length+1;let s=n;x.isDocumentKey(s)||(s=s.child(""));const o=new Ne(new x(s),0);let c=new ie(G);return this.Zr.forEachWhile(u=>{const l=u.key.path;return!!n.isPrefixOf(l)&&(l.length===i&&(c=c.add(u.Yr)),!0)},o),A.resolve(this.ti(c))}ti(e){const t=[];return e.forEach(n=>{const i=this.Xr(n);i!==null&&t.push(i)}),t}removeMutationBatch(e,t){U(this.ni(t.batchId,"removed")===0,55003),this.mutationQueue.shift();let n=this.Zr;return A.forEach(t.mutations,i=>{const s=new Ne(i.key,t.batchId);return n=n.delete(s),this.referenceDelegate.markPotentiallyOrphaned(e,i.key)}).next(()=>{this.Zr=n})}ir(e){}containsKey(e,t){const n=new Ne(t,0),i=this.Zr.firstAfterOrEqual(n);return A.resolve(t.isEqual(i&&i.key))}performConsistencyCheck(e){return this.mutationQueue.length,A.resolve()}ni(e,t){return this.ei(e)}ei(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Xr(e){const t=this.ei(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class WS{constructor(e){this.ri=e,this.docs=function(){return new ce(x.comparator)}(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){const n=t.key,i=this.docs.get(n),s=i?i.size:0,o=this.ri(t);return this.docs=this.docs.insert(n,{document:t.mutableCopy(),size:o}),this.size+=o-s,this.indexManager.addToCollectionParentIndex(e,n.path.popLast())}removeEntry(e){const t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){const n=this.docs.get(t);return A.resolve(n?n.document.mutableCopy():le.newInvalidDocument(t))}getEntries(e,t){let n=nt();return t.forEach(i=>{const s=this.docs.get(i);n=n.insert(i,s?s.document.mutableCopy():le.newInvalidDocument(i))}),A.resolve(n)}getDocumentsMatchingQuery(e,t,n,i){let s=nt();const o=t.path,c=new x(o.child("__id-9223372036854775808__")),u=this.docs.getIteratorFrom(c);for(;u.hasNext();){const{key:l,value:{document:f}}=u.getNext();if(!o.isPrefixOf(l.path))break;l.path.length>o.length+1||Cl(Ng(f),n)<=0||(i.has(f.key)||ho(t,f))&&(s=s.insert(f.key,f.mutableCopy()))}return A.resolve(s)}getAllFromCollectionGroup(e,t,n,i){F(9500)}ii(e,t){return A.forEach(this.docs,n=>t(n))}newChangeBuffer(e){return new KS(this)}getSize(e){return A.resolve(this.size)}}class KS extends X_{constructor(e){super(),this.Nr=e}applyChanges(e){const t=[];return this.changes.forEach((n,i)=>{i.isValidDocument()?t.push(this.Nr.addEntry(e,i)):this.Nr.removeEntry(n)}),A.waitFor(t)}getFromCache(e,t){return this.Nr.getEntry(e,t)}getAllFromCache(e,t){return this.Nr.getEntries(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class HS{constructor(e){this.persistence=e,this.si=new Yt(t=>pr(t),uo),this.lastRemoteSnapshotVersion=B.min(),this.highestTargetId=0,this.oi=0,this._i=new Jl,this.targetCount=0,this.ai=Ir.ur()}forEachTarget(e,t){return this.si.forEach((n,i)=>t(i)),A.resolve()}getLastRemoteSnapshotVersion(e){return A.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return A.resolve(this.oi)}allocateTargetId(e){return this.highestTargetId=this.ai.next(),A.resolve(this.highestTargetId)}setTargetsMetadata(e,t,n){return n&&(this.lastRemoteSnapshotVersion=n),t>this.oi&&(this.oi=t),A.resolve()}Pr(e){this.si.set(e.target,e);const t=e.targetId;t>this.highestTargetId&&(this.ai=new Ir(t),this.highestTargetId=t),e.sequenceNumber>this.oi&&(this.oi=e.sequenceNumber)}addTargetData(e,t){return this.Pr(t),this.targetCount+=1,A.resolve()}updateTargetData(e,t){return this.Pr(t),A.resolve()}removeTargetData(e,t){return this.si.delete(t.target),this._i.jr(t.targetId),this.targetCount-=1,A.resolve()}removeTargets(e,t,n){let i=0;const s=[];return this.si.forEach((o,c)=>{c.sequenceNumber<=t&&n.get(c.targetId)===null&&(this.si.delete(o),s.push(this.removeMatchingKeysForTargetId(e,c.targetId)),i++)}),A.waitFor(s).next(()=>i)}getTargetCount(e){return A.resolve(this.targetCount)}getTargetData(e,t){const n=this.si.get(t)||null;return A.resolve(n)}addMatchingKeys(e,t,n){return this._i.Wr(t,n),A.resolve()}removeMatchingKeys(e,t,n){this._i.zr(t,n);const i=this.persistence.referenceDelegate,s=[];return i&&t.forEach(o=>{s.push(i.markPotentiallyOrphaned(e,o))}),A.waitFor(s)}removeMatchingKeysForTargetId(e,t){return this._i.jr(t),A.resolve()}getMatchingKeysForTargetId(e,t){const n=this._i.Hr(t);return A.resolve(n)}containsKey(e,t){return A.resolve(this._i.containsKey(t))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yl{constructor(e,t){this.ui={},this.overlays={},this.ci=new et(0),this.li=!1,this.li=!0,this.hi=new jS,this.referenceDelegate=e(this),this.Pi=new HS(this),this.indexManager=new NS,this.remoteDocumentCache=function(i){return new WS(i)}(n=>this.referenceDelegate.Ti(n)),this.serializer=new $_(t),this.Ii=new $S(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.li=!1,Promise.resolve()}get started(){return this.li}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new zS,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let n=this.ui[e.toKey()];return n||(n=new GS(t,this.referenceDelegate),this.ui[e.toKey()]=n),n}getGlobalsCache(){return this.hi}getTargetCache(){return this.Pi}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Ii}runTransaction(e,t,n){V("MemoryPersistence","Starting transaction:",e);const i=new QS(this.ci.next());return this.referenceDelegate.Ei(),n(i).next(s=>this.referenceDelegate.di(i).next(()=>s)).toPromise().then(s=>(i.raiseOnCommittedEvent(),s))}Ai(e,t){return A.or(Object.values(this.ui).map(n=>()=>n.containsKey(e,t)))}}class QS extends Og{constructor(e){super(),this.currentSequenceNumber=e}}class rc{constructor(e){this.persistence=e,this.Ri=new Jl,this.Vi=null}static mi(e){return new rc(e)}get fi(){if(this.Vi)return this.Vi;throw F(60996)}addReference(e,t,n){return this.Ri.addReference(n,t),this.fi.delete(n.toString()),A.resolve()}removeReference(e,t,n){return this.Ri.removeReference(n,t),this.fi.add(n.toString()),A.resolve()}markPotentiallyOrphaned(e,t){return this.fi.add(t.toString()),A.resolve()}removeTarget(e,t){this.Ri.jr(t.targetId).forEach(i=>this.fi.add(i.toString()));const n=this.persistence.getTargetCache();return n.getMatchingKeysForTargetId(e,t.targetId).next(i=>{i.forEach(s=>this.fi.add(s.toString()))}).next(()=>n.removeTargetData(e,t))}Ei(){this.Vi=new Set}di(e){const t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return A.forEach(this.fi,n=>{const i=x.fromPath(n);return this.gi(e,i).next(s=>{s||t.removeEntry(i,B.min())})}).next(()=>(this.Vi=null,t.apply(e)))}updateLimboDocument(e,t){return this.gi(e,t).next(n=>{n?this.fi.delete(t.toString()):this.fi.add(t.toString())})}Ti(e){return 0}gi(e,t){return A.or([()=>A.resolve(this.Ri.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.Ai(e,t)])}}class ba{constructor(e,t){this.persistence=e,this.pi=new Yt(n=>ze(n.path),(n,i)=>n.isEqual(i)),this.garbageCollector=Y_(this,t)}static mi(e,t){return new ba(e,t)}Ei(){}di(e){return A.resolve()}forEachTarget(e,t){return this.persistence.getTargetCache().forEachTarget(e,t)}gr(e){const t=this.wr(e);return this.persistence.getTargetCache().getTargetCount(e).next(n=>t.next(i=>n+i))}wr(e){let t=0;return this.pr(e,n=>{t++}).next(()=>t)}pr(e,t){return A.forEach(this.pi,(n,i)=>this.br(e,n,i).next(s=>s?A.resolve():t(i)))}removeTargets(e,t,n){return this.persistence.getTargetCache().removeTargets(e,t,n)}removeOrphanedDocuments(e,t){let n=0;const i=this.persistence.getRemoteDocumentCache(),s=i.newChangeBuffer();return i.ii(e,o=>this.br(e,o,t).next(c=>{c||(n++,s.removeEntry(o,B.min()))})).next(()=>s.apply(e)).next(()=>n)}markPotentiallyOrphaned(e,t){return this.pi.set(t,e.currentSequenceNumber),A.resolve()}removeTarget(e,t){const n=t.withSequenceNumber(e.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(e,n)}addReference(e,t,n){return this.pi.set(n,e.currentSequenceNumber),A.resolve()}removeReference(e,t,n){return this.pi.set(n,e.currentSequenceNumber),A.resolve()}updateLimboDocument(e,t){return this.pi.set(t,e.currentSequenceNumber),A.resolve()}Ti(e){let t=e.key.toString().length;return e.isFoundDocument()&&(t+=ea(e.data.value)),t}br(e,t,n){return A.or([()=>this.persistence.Ai(e,t),()=>this.persistence.getTargetCache().containsKey(e,t),()=>{const i=this.pi.get(t);return A.resolve(i!==void 0&&i>n)}])}getCacheSize(e){return this.persistence.getRemoteDocumentCache().getSize(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class JS{constructor(e){this.serializer=e}k(e,t,n,i){const s=new Wa("createOrUpgrade",t);n<1&&i>=1&&(function(u){u.createObjectStore(co)}(e),function(u){u.createObjectStore(Fs,{keyPath:dR}),u.createObjectStore(_t,{keyPath:kf,autoIncrement:!0}).createIndex(rr,Df,{unique:!0}),u.createObjectStore(ri)}(e),wp(e),function(u){u.createObjectStore(Jn)}(e));let o=A.resolve();return n<3&&i>=3&&(n!==0&&(function(u){u.deleteObjectStore(si),u.deleteObjectStore(ii),u.deleteObjectStore(ur)}(e),wp(e)),o=o.next(()=>function(u){const l=u.store(ur),f={highestTargetId:0,highestListenSequenceNumber:0,lastRemoteSnapshotVersion:B.min().toTimestamp(),targetCount:0};return l.put(ya,f)}(s))),n<4&&i>=4&&(n!==0&&(o=o.next(()=>function(u,l){return l.store(_t).J().next(p=>{u.deleteObjectStore(_t),u.createObjectStore(_t,{keyPath:kf,autoIncrement:!0}).createIndex(rr,Df,{unique:!0});const g=l.store(_t),v=p.map(k=>g.put(k));return A.waitFor(v)})}(e,s))),o=o.next(()=>{(function(u){u.createObjectStore(oi,{keyPath:ER})})(e)})),n<5&&i>=5&&(o=o.next(()=>this.yi(s))),n<6&&i>=6&&(o=o.next(()=>(function(u){u.createObjectStore(Us)}(e),this.wi(s)))),n<7&&i>=7&&(o=o.next(()=>this.Si(s))),n<8&&i>=8&&(o=o.next(()=>this.bi(e,s))),n<9&&i>=9&&(o=o.next(()=>{(function(u){u.objectStoreNames.contains("remoteDocumentChanges")&&u.deleteObjectStore("remoteDocumentChanges")})(e)})),n<10&&i>=10&&(o=o.next(()=>this.Di(s))),n<11&&i>=11&&(o=o.next(()=>{(function(u){u.createObjectStore(Ka,{keyPath:TR})})(e),function(u){u.createObjectStore(Ha,{keyPath:vR})}(e)})),n<12&&i>=12&&(o=o.next(()=>{(function(u){const l=u.createObjectStore(Qa,{keyPath:kR});l.createIndex(vu,DR,{unique:!1}),l.createIndex($g,NR,{unique:!1})})(e)})),n<13&&i>=13&&(o=o.next(()=>function(u){const l=u.createObjectStore(_a,{keyPath:pR});l.createIndex(Xo,mR),l.createIndex(Fg,gR)}(e)).next(()=>this.Ci(e,s)).next(()=>e.deleteObjectStore(Jn))),n<14&&i>=14&&(o=o.next(()=>this.Fi(e,s))),n<15&&i>=15&&(o=o.next(()=>function(u){u.createObjectStore(Nl,{keyPath:AR,autoIncrement:!0}).createIndex(Tu,bR,{unique:!1}),u.createObjectStore(ws,{keyPath:RR}).createIndex(Bg,SR,{unique:!1}),u.createObjectStore(Es,{keyPath:PR}).createIndex(qg,CR,{unique:!1})}(e))),n<16&&i>=16&&(o=o.next(()=>{t.objectStore(ws).clear()}).next(()=>{t.objectStore(Es).clear()})),n<17&&i>=17&&(o=o.next(()=>{(function(u){u.createObjectStore(Vl,{keyPath:VR})})(e)})),n<18&&i>=18&&rm()&&(o=o.next(()=>{t.objectStore(ws).clear()}).next(()=>{t.objectStore(Es).clear()})),o}wi(e){let t=0;return e.store(Jn).ee((n,i)=>{t+=Aa(i)}).next(()=>{const n={byteSize:t};return e.store(Us).put(Eu,n)})}yi(e){const t=e.store(Fs),n=e.store(_t);return t.J().next(i=>A.forEach(i,s=>{const o=IDBKeyRange.bound([s.userId,wn],[s.userId,s.lastAcknowledgedBatchId]);return n.J(rr,o).next(c=>A.forEach(c,u=>{U(u.userId===s.userId,18650,"Cannot process batch from unexpected user",{batchId:u.batchId});const l=Xn(this.serializer,u);return K_(e,s.userId,l).next(()=>{})}))}))}Si(e){const t=e.store(si),n=e.store(Jn);return e.store(ur).get(ya).next(i=>{const s=[];return n.ee((o,c)=>{const u=new Q(o),l=function(p){return[0,ze(p)]}(u);s.push(t.get(l).next(f=>f?A.resolve():(p=>t.put({targetId:0,path:ze(p),sequenceNumber:i.highestListenSequenceNumber}))(u)))}).next(()=>A.waitFor(s))})}bi(e,t){e.createObjectStore(Bs,{keyPath:wR});const n=t.store(Bs),i=new Ql,s=o=>{if(i.add(o)){const c=o.lastSegment(),u=o.popLast();return n.put({collectionId:c,parent:ze(u)})}};return t.store(Jn).ee({X:!0},(o,c)=>{const u=new Q(o);return s(u.popLast())}).next(()=>t.store(ri).ee({X:!0},([o,c,u],l)=>{const f=Nt(c);return s(f.popLast())}))}Di(e){const t=e.store(ii);return t.ee((n,i)=>{const s=ls(i),o=z_(this.serializer,s);return t.put(o)})}Ci(e,t){const n=t.store(Jn),i=[];return n.ee((s,o)=>{const c=t.store(_a),u=function(p){return p.document?new x(Q.fromString(p.document.name).popFirst(5)):p.noDocument?x.fromSegments(p.noDocument.path):p.unknownDocument?x.fromSegments(p.unknownDocument.path):F(36783)}(o).path.toArray(),l={prefixPath:u.slice(0,u.length-2),collectionGroup:u[u.length-2],documentId:u[u.length-1],readTime:o.readTime||[0,0],unknownDocument:o.unknownDocument,noDocument:o.noDocument,document:o.document,hasCommittedMutations:!!o.hasCommittedMutations};i.push(c.put(l))}).next(()=>A.waitFor(i))}Fi(e,t){const n=t.store(_t),i=Z_(this.serializer),s=new Yl(rc.mi,this.serializer.yt);return n.J().next(o=>{const c=new Map;return o.forEach(u=>{let l=c.get(u.userId)??W();Xn(this.serializer,u).keys().forEach(f=>l=l.add(f)),c.set(u.userId,l)}),A.forEach(c,(u,l)=>{const f=new Ve(l),p=tc.wt(this.serializer,f),g=s.getIndexManager(f),v=nc.wt(f,this.serializer,g,s.referenceDelegate);return new ey(i,v,p,g).recalculateAndSaveOverlaysForDocumentKeys(new Au(t,et.ce),u).next()})})}}function wp(r){r.createObjectStore(si,{keyPath:yR}).createIndex(Dl,IR,{unique:!0}),r.createObjectStore(ii,{keyPath:"targetId"}).createIndex(Ug,_R,{unique:!0}),r.createObjectStore(ur)}const hn="IndexedDbPersistence",eu=18e5,tu=5e3,nu="Failed to obtain exclusive access to the persistence layer. To allow shared access, multi-tab synchronization has to be enabled in all tabs. If you are using `experimentalForceOwningTab:true`, make sure that only one tab has persistence enabled at any given time.",ty="main";class Xl{constructor(e,t,n,i,s,o,c,u,l,f,p=18){if(this.allowTabSynchronization=e,this.persistenceKey=t,this.clientId=n,this.Mi=s,this.window=o,this.document=c,this.xi=l,this.Oi=f,this.Ni=p,this.ci=null,this.li=!1,this.isPrimary=!1,this.networkEnabled=!0,this.Bi=null,this.inForeground=!1,this.Li=null,this.ki=null,this.qi=Number.NEGATIVE_INFINITY,this.Qi=g=>Promise.resolve(),!Xl.v())throw new C(S.UNIMPLEMENTED,"This platform is either missing IndexedDB or is known to have an incomplete implementation. Offline persistence has been disabled.");this.referenceDelegate=new FS(this,i),this.$i=t+ty,this.serializer=new $_(u),this.Ui=new Ot(this.$i,this.Ni,new JS(this.serializer)),this.hi=new RS,this.Pi=new OS(this.referenceDelegate,this.serializer),this.remoteDocumentCache=Z_(this.serializer),this.Ii=new bS,this.window&&this.window.localStorage?this.Ki=this.window.localStorage:(this.Ki=null,f===!1&&Ee(hn,"LocalStorage is unavailable. As a result, persistence may not work reliably. In particular enablePersistence() could fail immediately after refreshing the page."))}start(){return this.Wi().then(()=>{if(!this.isPrimary&&!this.allowTabSynchronization)throw new C(S.FAILED_PRECONDITION,nu);return this.Gi(),this.zi(),this.ji(),this.runTransaction("getHighestListenSequenceNumber","readonly",e=>this.Pi.getHighestSequenceNumber(e))}).then(e=>{this.ci=new et(e,this.xi)}).then(()=>{this.li=!0}).catch(e=>(this.Ui&&this.Ui.close(),Promise.reject(e)))}Ji(e){return this.Qi=async t=>{if(this.started)return e(t)},e(this.isPrimary)}setDatabaseDeletedListener(e){this.Ui.$(async t=>{t.newVersion===null&&await e()})}setNetworkEnabled(e){this.networkEnabled!==e&&(this.networkEnabled=e,this.Mi.enqueueAndForget(async()=>{this.started&&await this.Wi()}))}Wi(){return this.runTransaction("updateClientMetadataAndTryBecomePrimary","readwrite",e=>zo(e).put({clientId:this.clientId,updateTimeMs:Date.now(),networkEnabled:this.networkEnabled,inForeground:this.inForeground}).next(()=>{if(this.isPrimary)return this.Hi(e).next(t=>{t||(this.isPrimary=!1,this.Mi.enqueueRetryable(()=>this.Qi(!1)))})}).next(()=>this.Yi(e)).next(t=>this.isPrimary&&!t?this.Zi(e).next(()=>!1):!!t&&this.Xi(e).next(()=>!0))).catch(e=>{if(Ln(e))return V(hn,"Failed to extend owner lease: ",e),this.isPrimary;if(!this.allowTabSynchronization)throw e;return V(hn,"Releasing owner lease after error during lease refresh",e),!1}).then(e=>{this.isPrimary!==e&&this.Mi.enqueueRetryable(()=>this.Qi(e)),this.isPrimary=e})}Hi(e){return rs(e).get(Vr).next(t=>A.resolve(this.es(t)))}ts(e){return zo(e).delete(this.clientId)}async ns(){if(this.isPrimary&&!this.rs(this.qi,eu)){this.qi=Date.now();const e=await this.runTransaction("maybeGarbageCollectMultiClientState","readwrite-primary",t=>{const n=ke(t,oi);return n.J().next(i=>{const s=this.ss(i,eu),o=i.filter(c=>s.indexOf(c)===-1);return A.forEach(o,c=>n.delete(c.clientId)).next(()=>o)})}).catch(()=>[]);if(this.Ki)for(const t of e)this.Ki.removeItem(this._s(t.clientId))}}ji(){this.ki=this.Mi.enqueueAfterDelay("client_metadata_refresh",4e3,()=>this.Wi().then(()=>this.ns()).then(()=>this.ji()))}es(e){return!!e&&e.ownerId===this.clientId}Yi(e){return this.Oi?A.resolve(!0):rs(e).get(Vr).next(t=>{if(t!==null&&this.rs(t.leaseTimestampMs,tu)&&!this.us(t.ownerId)){if(this.es(t)&&this.networkEnabled)return!0;if(!this.es(t)){if(!t.allowTabSynchronization)throw new C(S.FAILED_PRECONDITION,nu);return!1}}return!(!this.networkEnabled||!this.inForeground)||zo(e).J().next(n=>this.ss(n,tu).find(i=>{if(this.clientId!==i.clientId){const s=!this.networkEnabled&&i.networkEnabled,o=!this.inForeground&&i.inForeground,c=this.networkEnabled===i.networkEnabled;if(s||o&&c)return!0}return!1})===void 0)}).next(t=>(this.isPrimary!==t&&V(hn,`Client ${t?"is":"is not"} eligible for a primary lease.`),t))}async shutdown(){this.li=!1,this.cs(),this.ki&&(this.ki.cancel(),this.ki=null),this.ls(),this.hs(),await this.Ui.runTransaction("shutdown","readwrite",[co,oi],e=>{const t=new Au(e,et.ce);return this.Zi(t).next(()=>this.ts(t))}),this.Ui.close(),this.Ps()}ss(e,t){return e.filter(n=>this.rs(n.updateTimeMs,t)&&!this.us(n.clientId))}Ts(){return this.runTransaction("getActiveClients","readonly",e=>zo(e).J().next(t=>this.ss(t,eu).map(n=>n.clientId)))}get started(){return this.li}getGlobalsCache(){return this.hi}getMutationQueue(e,t){return nc.wt(e,this.serializer,t,this.referenceDelegate)}getTargetCache(){return this.Pi}getRemoteDocumentCache(){return this.remoteDocumentCache}getIndexManager(e){return new VS(e,this.serializer.yt.databaseId)}getDocumentOverlayCache(e){return tc.wt(this.serializer,e)}getBundleCache(){return this.Ii}runTransaction(e,t,n){V(hn,"Starting transaction:",e);const i=t==="readonly"?"readonly":"readwrite",s=function(u){return u===18?MR:u===17?Wg:u===16?xR:u===15?Ol:u===14?Gg:u===13?jg:u===12?OR:u===11?zg:void F(60245)}(this.Ni);let o;return this.Ui.runTransaction(e,i,s,c=>(o=new Au(c,this.ci?this.ci.next():et.ce),t==="readwrite-primary"?this.Hi(o).next(u=>!!u||this.Yi(o)).next(u=>{if(!u)throw Ee(`Failed to obtain primary lease for action '${e}'.`),this.isPrimary=!1,this.Mi.enqueueRetryable(()=>this.Qi(!1)),new C(S.FAILED_PRECONDITION,Vg);return n(o)}).next(u=>this.Xi(o).next(()=>u)):this.Is(o).next(()=>n(o)))).then(c=>(o.raiseOnCommittedEvent(),c))}Is(e){return rs(e).get(Vr).next(t=>{if(t!==null&&this.rs(t.leaseTimestampMs,tu)&&!this.us(t.ownerId)&&!this.es(t)&&!(this.Oi||this.allowTabSynchronization&&t.allowTabSynchronization))throw new C(S.FAILED_PRECONDITION,nu)})}Xi(e){const t={ownerId:this.clientId,allowTabSynchronization:this.allowTabSynchronization,leaseTimestampMs:Date.now()};return rs(e).put(Vr,t)}static v(){return Ot.v()}Zi(e){const t=rs(e);return t.get(Vr).next(n=>this.es(n)?(V(hn,"Releasing primary lease."),t.delete(Vr)):A.resolve())}rs(e,t){const n=Date.now();return!(e<n-t)&&(!(e>n)||(Ee(`Detected an update time that is in the future: ${e} > ${n}`),!1))}Gi(){this.document!==null&&typeof this.document.addEventListener=="function"&&(this.Li=()=>{this.Mi.enqueueAndForget(()=>(this.inForeground=this.document.visibilityState==="visible",this.Wi()))},this.document.addEventListener("visibilitychange",this.Li),this.inForeground=this.document.visibilityState==="visible")}ls(){this.Li&&(this.document.removeEventListener("visibilitychange",this.Li),this.Li=null)}zi(){var e;typeof((e=this.window)==null?void 0:e.addEventListener)=="function"&&(this.Bi=()=>{this.cs();const t=/(?:Version|Mobile)\/1[456]/;nm()&&(navigator.appVersion.match(t)||navigator.userAgent.match(t))&&this.Mi.enterRestrictedMode(!0),this.Mi.enqueueAndForget(()=>this.shutdown())},this.window.addEventListener("pagehide",this.Bi))}hs(){this.Bi&&(this.window.removeEventListener("pagehide",this.Bi),this.Bi=null)}us(e){var t;try{const n=((t=this.Ki)==null?void 0:t.getItem(this._s(e)))!==null;return V(hn,`Client '${e}' ${n?"is":"is not"} zombied in LocalStorage`),n}catch(n){return Ee(hn,"Failed to get zombied client id.",n),!1}}cs(){if(this.Ki)try{this.Ki.setItem(this._s(this.clientId),String(Date.now()))}catch(e){Ee("Failed to set zombie client id.",e)}}Ps(){if(this.Ki)try{this.Ki.removeItem(this._s(this.clientId))}catch{}}_s(e){return`firestore_zombie_${this.persistenceKey}_${e}`}}function rs(r){return ke(r,co)}function zo(r){return ke(r,oi)}function Zl(r,e){let t=r.projectId;return r.isDefaultDatabase||(t+="."+r.database),"firestore/"+e+"/"+t+"/"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eh{constructor(e,t,n,i){this.targetId=e,this.fromCache=t,this.Es=n,this.ds=i}static As(e,t){let n=W(),i=W();for(const s of t.docChanges)switch(s.type){case 0:n=n.add(s.doc.key);break;case 1:i=i.add(s.doc.key)}return new eh(e,t.fromCache,n,i)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class YS{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ny{constructor(){this.Rs=!1,this.Vs=!1,this.fs=100,this.gs=function(){return nm()?8:xg(me())>0?6:4}()}initialize(e,t){this.ps=e,this.indexManager=t,this.Rs=!0}getDocumentsMatchingQuery(e,t,n,i){const s={result:null};return this.ys(e,t).next(o=>{s.result=o}).next(()=>{if(!s.result)return this.ws(e,t,i,n).next(o=>{s.result=o})}).next(()=>{if(s.result)return;const o=new YS;return this.Ss(e,t,o).next(c=>{if(s.result=c,this.Vs)return this.bs(e,t,o,c.size)})}).next(()=>s.result)}bs(e,t,n,i){return n.documentReadCount<this.fs?(Ur()<=H.DEBUG&&V("QueryEngine","SDK will not create cache indexes for query:",Br(t),"since it only creates cache indexes for collection contains","more than or equal to",this.fs,"documents"),A.resolve()):(Ur()<=H.DEBUG&&V("QueryEngine","Query:",Br(t),"scans",n.documentReadCount,"local documents and returns",i,"documents as results."),n.documentReadCount>this.gs*i?(Ur()<=H.DEBUG&&V("QueryEngine","The SDK decides to create cache indexes for query:",Br(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,Je(t))):A.resolve())}ys(e,t){if(jf(t))return A.resolve(null);let n=Je(t);return this.indexManager.getIndexType(e,n).next(i=>i===0?null:(t.limit!==null&&i===1&&(t=Ea(t,null,"F"),n=Je(t)),this.indexManager.getDocumentsMatchingTarget(e,n).next(s=>{const o=W(...s);return this.ps.getDocuments(e,o).next(c=>this.indexManager.getMinOffset(e,n).next(u=>{const l=this.Ds(t,c);return this.Cs(t,l,o,u.readTime)?this.ys(e,Ea(t,null,"F")):this.vs(e,l,t,u)}))})))}ws(e,t,n,i){return jf(t)||i.isEqual(B.min())?A.resolve(null):this.ps.getDocuments(e,n).next(s=>{const o=this.Ds(t,s);return this.Cs(t,o,n,i)?A.resolve(null):(Ur()<=H.DEBUG&&V("QueryEngine","Re-using previous result from %s to execute query: %s",i.toString(),Br(t)),this.vs(e,o,t,Dg(i,ni)).next(c=>c))})}Ds(e,t){let n=new ie(f_(e));return t.forEach((i,s)=>{ho(e,s)&&(n=n.add(s))}),n}Cs(e,t,n,i){if(e.limit===null)return!1;if(n.size!==t.size)return!0;const s=e.limitType==="F"?t.last():t.first();return!!s&&(s.hasPendingWrites||s.version.compareTo(i)>0)}Ss(e,t,n){return Ur()<=H.DEBUG&&V("QueryEngine","Using full collection scan to execute query:",Br(t)),this.ps.getDocumentsMatchingQuery(e,t,ut.min(),n)}vs(e,t,n,i){return this.ps.getDocumentsMatchingQuery(e,n,i).next(s=>(t.forEach(o=>{s=s.insert(o.key,o)}),s))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const th="LocalStore",XS=3e8;class ZS{constructor(e,t,n,i){this.persistence=e,this.Fs=t,this.serializer=i,this.Ms=new ce(G),this.xs=new Yt(s=>pr(s),uo),this.Os=new Map,this.Ns=e.getRemoteDocumentCache(),this.Pi=e.getTargetCache(),this.Ii=e.getBundleCache(),this.Bs(n)}Bs(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new ey(this.Ns,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.Ns.setIndexManager(this.indexManager),this.Fs.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",t=>e.collect(t,this.Ms))}}function ry(r,e,t,n){return new ZS(r,e,t,n)}async function iy(r,e){const t=L(r);return await t.persistence.runTransaction("Handle user change","readonly",n=>{let i;return t.mutationQueue.getAllMutationBatches(n).next(s=>(i=s,t.Bs(e),t.mutationQueue.getAllMutationBatches(n))).next(s=>{const o=[],c=[];let u=W();for(const l of i){o.push(l.batchId);for(const f of l.mutations)u=u.add(f.key)}for(const l of s){c.push(l.batchId);for(const f of l.mutations)u=u.add(f.key)}return t.localDocuments.getDocuments(n,u).next(l=>({Ls:l,removedBatchIds:o,addedBatchIds:c}))})})}function eP(r,e){const t=L(r);return t.persistence.runTransaction("Acknowledge batch","readwrite-primary",n=>{const i=e.batch.keys(),s=t.Ns.newChangeBuffer({trackRemovals:!0});return function(c,u,l,f){const p=l.batch,g=p.keys();let v=A.resolve();return g.forEach(k=>{v=v.next(()=>f.getEntry(u,k)).next(D=>{const N=l.docVersions.get(k);U(N!==null,48541),D.version.compareTo(N)<0&&(p.applyToRemoteDocument(D,l),D.isValidDocument()&&(D.setReadTime(l.commitVersion),f.addEntry(D)))})}),v.next(()=>c.mutationQueue.removeMutationBatch(u,p))}(t,n,e,s).next(()=>s.apply(n)).next(()=>t.mutationQueue.performConsistencyCheck(n)).next(()=>t.documentOverlayCache.removeOverlaysForBatchId(n,i,e.batch.batchId)).next(()=>t.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(n,function(c){let u=W();for(let l=0;l<c.mutationResults.length;++l)c.mutationResults[l].transformResults.length>0&&(u=u.add(c.batch.mutations[l].key));return u}(e))).next(()=>t.localDocuments.getDocuments(n,i))})}function sy(r){const e=L(r);return e.persistence.runTransaction("Get last remote snapshot version","readonly",t=>e.Pi.getLastRemoteSnapshotVersion(t))}function tP(r,e){const t=L(r),n=e.snapshotVersion;let i=t.Ms;return t.persistence.runTransaction("Apply remote event","readwrite-primary",s=>{const o=t.Ns.newChangeBuffer({trackRemovals:!0});i=t.Ms;const c=[];e.targetChanges.forEach((f,p)=>{const g=i.get(p);if(!g)return;c.push(t.Pi.removeMatchingKeys(s,f.removedDocuments,p).next(()=>t.Pi.addMatchingKeys(s,f.addedDocuments,p)));let v=g.withSequenceNumber(s.currentSequenceNumber);e.targetMismatches.get(p)!==null?v=v.withResumeToken(ye.EMPTY_BYTE_STRING,B.min()).withLastLimboFreeSnapshotVersion(B.min()):f.resumeToken.approximateByteSize()>0&&(v=v.withResumeToken(f.resumeToken,n)),i=i.insert(p,v),function(D,N,q){return D.resumeToken.approximateByteSize()===0||N.snapshotVersion.toMicroseconds()-D.snapshotVersion.toMicroseconds()>=XS?!0:q.addedDocuments.size+q.modifiedDocuments.size+q.removedDocuments.size>0}(g,v,f)&&c.push(t.Pi.updateTargetData(s,v))});let u=nt(),l=W();if(e.documentUpdates.forEach(f=>{e.resolvedLimboDocuments.has(f)&&c.push(t.persistence.referenceDelegate.updateLimboDocument(s,f))}),c.push(oy(s,o,e.documentUpdates).next(f=>{u=f.ks,l=f.qs})),!n.isEqual(B.min())){const f=t.Pi.getLastRemoteSnapshotVersion(s).next(p=>t.Pi.setTargetsMetadata(s,s.currentSequenceNumber,n));c.push(f)}return A.waitFor(c).next(()=>o.apply(s)).next(()=>t.localDocuments.getLocalViewOfDocuments(s,u,l)).next(()=>u)}).then(s=>(t.Ms=i,s))}function oy(r,e,t){let n=W(),i=W();return t.forEach(s=>n=n.add(s)),e.getEntries(r,n).next(s=>{let o=nt();return t.forEach((c,u)=>{const l=s.get(c);u.isFoundDocument()!==l.isFoundDocument()&&(i=i.add(c)),u.isNoDocument()&&u.version.isEqual(B.min())?(e.removeEntry(c,u.readTime),o=o.insert(c,u)):!l.isValidDocument()||u.version.compareTo(l.version)>0||u.version.compareTo(l.version)===0&&l.hasPendingWrites?(e.addEntry(u),o=o.insert(c,u)):V(th,"Ignoring outdated watch update for ",c,". Current version:",l.version," Watch version:",u.version)}),{ks:o,qs:i}})}function nP(r,e){const t=L(r);return t.persistence.runTransaction("Get next mutation batch","readonly",n=>(e===void 0&&(e=wn),t.mutationQueue.getNextMutationBatchAfterBatchId(n,e)))}function fi(r,e){const t=L(r);return t.persistence.runTransaction("Allocate target","readwrite",n=>{let i;return t.Pi.getTargetData(n,e).next(s=>s?(i=s,A.resolve(i)):t.Pi.allocateTargetId(n).next(o=>(i=new $t(e,o,"TargetPurposeListen",n.currentSequenceNumber),t.Pi.addTargetData(n,i).next(()=>i))))}).then(n=>{const i=t.Ms.get(n.targetId);return(i===null||n.snapshotVersion.compareTo(i.snapshotVersion)>0)&&(t.Ms=t.Ms.insert(n.targetId,n),t.xs.set(e,n.targetId)),n})}async function pi(r,e,t){const n=L(r),i=n.Ms.get(e),s=t?"readwrite":"readwrite-primary";try{t||await n.persistence.runTransaction("Release target",s,o=>n.persistence.referenceDelegate.removeTarget(o,i))}catch(o){if(!Ln(o))throw o;V(th,`Failed to update sequence numbers for target ${e}: ${o}`)}n.Ms=n.Ms.remove(e),n.xs.delete(i.target)}function Ra(r,e,t){const n=L(r);let i=B.min(),s=W();return n.persistence.runTransaction("Execute query","readwrite",o=>function(u,l,f){const p=L(u),g=p.xs.get(f);return g!==void 0?A.resolve(p.Ms.get(g)):p.Pi.getTargetData(l,f)}(n,o,Je(e)).next(c=>{if(c)return i=c.lastLimboFreeSnapshotVersion,n.Pi.getMatchingKeysForTargetId(o,c.targetId).next(u=>{s=u})}).next(()=>n.Fs.getDocumentsMatchingQuery(o,e,t?i:B.min(),t?s:W())).next(c=>(uy(n,d_(e),c),{documents:c,Qs:s})))}function ay(r,e){const t=L(r),n=L(t.Pi),i=t.Ms.get(e);return i?Promise.resolve(i.target):t.persistence.runTransaction("Get target data","readonly",s=>n.At(s,e).next(o=>o?o.target:null))}function cy(r,e){const t=L(r),n=t.Os.get(e)||B.min();return t.persistence.runTransaction("Get new document changes","readonly",i=>t.Ns.getAllFromCollectionGroup(i,e,Dg(n,ni),Number.MAX_SAFE_INTEGER)).then(i=>(uy(t,e,i),i))}function uy(r,e,t){let n=r.Os.get(e)||B.min();t.forEach((i,s)=>{s.readTime.compareTo(n)>0&&(n=s.readTime)}),r.Os.set(e,n)}async function rP(r,e,t,n){const i=L(r);let s=W(),o=nt();for(const l of t){const f=e.$s(l.metadata.name);l.document&&(s=s.add(f));const p=e.Us(l);p.setReadTime(e.Ks(l.metadata.readTime)),o=o.insert(f,p)}const c=i.Ns.newChangeBuffer({trackRemovals:!0}),u=await fi(i,function(f){return Je(Ri(Q.fromString(`__bundle__/docs/${f}`)))}(n));return i.persistence.runTransaction("Apply bundle documents","readwrite",l=>oy(l,c,o).next(f=>(c.apply(l),f)).next(f=>i.Pi.removeMatchingKeysForTargetId(l,u.targetId).next(()=>i.Pi.addMatchingKeys(l,s,u.targetId)).next(()=>i.localDocuments.getLocalViewOfDocuments(l,f.ks,f.qs)).next(()=>f.ks)))}async function iP(r,e,t=W()){const n=await fi(r,Je(Kl(e.bundledQuery))),i=L(r);return i.persistence.runTransaction("Save named query","readwrite",s=>{const o=Te(e.readTime);if(n.snapshotVersion.compareTo(o)>=0)return i.Ii.saveNamedQuery(s,e);const c=n.withResumeToken(ye.EMPTY_BYTE_STRING,o);return i.Ms=i.Ms.insert(c.targetId,c),i.Pi.updateTargetData(s,c).next(()=>i.Pi.removeMatchingKeysForTargetId(s,n.targetId)).next(()=>i.Pi.addMatchingKeys(s,t,n.targetId)).next(()=>i.Ii.saveNamedQuery(s,e))})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ly="firestore_clients";function Ep(r,e){return`${ly}_${r}_${e}`}const hy="firestore_mutations";function Tp(r,e,t){let n=`${hy}_${r}_${t}`;return e.isAuthenticated()&&(n+=`_${e.uid}`),n}const dy="firestore_targets";function ru(r,e){return`${dy}_${r}_${e}`}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rt="SharedClientState";class Sa{constructor(e,t,n,i){this.user=e,this.batchId=t,this.state=n,this.error=i}static Ws(e,t,n){const i=JSON.parse(n);let s,o=typeof i=="object"&&["pending","acknowledged","rejected"].indexOf(i.state)!==-1&&(i.error===void 0||typeof i.error=="object");return o&&i.error&&(o=typeof i.error.message=="string"&&typeof i.error.code=="string",o&&(s=new C(i.error.code,i.error.message))),o?new Sa(e,t,i.state,s):(Ee(Rt,`Failed to parse mutation state for ID '${t}': ${n}`),null)}Gs(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class bs{constructor(e,t,n){this.targetId=e,this.state=t,this.error=n}static Ws(e,t){const n=JSON.parse(t);let i,s=typeof n=="object"&&["not-current","current","rejected"].indexOf(n.state)!==-1&&(n.error===void 0||typeof n.error=="object");return s&&n.error&&(s=typeof n.error.message=="string"&&typeof n.error.code=="string",s&&(i=new C(n.error.code,n.error.message))),s?new bs(e,n.state,i):(Ee(Rt,`Failed to parse target state for ID '${e}': ${t}`),null)}Gs(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class Pa{constructor(e,t){this.clientId=e,this.activeTargetIds=t}static Ws(e,t){const n=JSON.parse(t);let i=typeof n=="object"&&n.activeTargetIds instanceof Array,s=Ul();for(let o=0;i&&o<n.activeTargetIds.length;++o)i=Mg(n.activeTargetIds[o]),s=s.add(n.activeTargetIds[o]);return i?new Pa(e,s):(Ee(Rt,`Failed to parse client data for instance '${e}': ${t}`),null)}}class nh{constructor(e,t){this.clientId=e,this.onlineState=t}static Ws(e){const t=JSON.parse(e);return typeof t=="object"&&["Unknown","Online","Offline"].indexOf(t.onlineState)!==-1&&typeof t.clientId=="string"?new nh(t.clientId,t.onlineState):(Ee(Rt,`Failed to parse online state: ${e}`),null)}}class Uu{constructor(){this.activeTargetIds=Ul()}zs(e){this.activeTargetIds=this.activeTargetIds.add(e)}js(e){this.activeTargetIds=this.activeTargetIds.delete(e)}Gs(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class iu{constructor(e,t,n,i,s){this.window=e,this.Mi=t,this.persistenceKey=n,this.Js=i,this.syncEngine=null,this.onlineStateHandler=null,this.sequenceNumberHandler=null,this.Hs=this.Ys.bind(this),this.Zs=new ce(G),this.started=!1,this.Xs=[];const o=n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");this.storage=this.window.localStorage,this.currentUser=s,this.eo=Ep(this.persistenceKey,this.Js),this.no=function(u){return`firestore_sequence_number_${u}`}(this.persistenceKey),this.Zs=this.Zs.insert(this.Js,new Uu),this.ro=new RegExp(`^${ly}_${o}_([^_]*)$`),this.io=new RegExp(`^${hy}_${o}_(\\d+)(?:_(.*))?$`),this.so=new RegExp(`^${dy}_${o}_(\\d+)$`),this.oo=function(u){return`firestore_online_state_${u}`}(this.persistenceKey),this._o=function(u){return`firestore_bundle_loaded_v2_${u}`}(this.persistenceKey),this.window.addEventListener("storage",this.Hs)}static v(e){return!(!e||!e.localStorage)}async start(){const e=await this.syncEngine.Ts();for(const n of e){if(n===this.Js)continue;const i=this.getItem(Ep(this.persistenceKey,n));if(i){const s=Pa.Ws(n,i);s&&(this.Zs=this.Zs.insert(s.clientId,s))}}this.ao();const t=this.storage.getItem(this.oo);if(t){const n=this.uo(t);n&&this.co(n)}for(const n of this.Xs)this.Ys(n);this.Xs=[],this.window.addEventListener("pagehide",()=>this.shutdown()),this.started=!0}writeSequenceNumber(e){this.setItem(this.no,JSON.stringify(e))}getAllActiveQueryTargets(){return this.lo(this.Zs)}isActiveQueryTarget(e){let t=!1;return this.Zs.forEach((n,i)=>{i.activeTargetIds.has(e)&&(t=!0)}),t}addPendingMutation(e){this.ho(e,"pending")}updateMutationState(e,t,n){this.ho(e,t,n),this.Po(e)}addLocalQueryTarget(e,t=!0){let n="not-current";if(this.isActiveQueryTarget(e)){const i=this.storage.getItem(ru(this.persistenceKey,e));if(i){const s=bs.Ws(e,i);s&&(n=s.state)}}return t&&this.To.zs(e),this.ao(),n}removeLocalQueryTarget(e){this.To.js(e),this.ao()}isLocalQueryTarget(e){return this.To.activeTargetIds.has(e)}clearQueryState(e){this.removeItem(ru(this.persistenceKey,e))}updateQueryState(e,t,n){this.Io(e,t,n)}handleUserChange(e,t,n){t.forEach(i=>{this.Po(i)}),this.currentUser=e,n.forEach(i=>{this.addPendingMutation(i)})}setOnlineState(e){this.Eo(e)}notifyBundleLoaded(e){this.Ao(e)}shutdown(){this.started&&(this.window.removeEventListener("storage",this.Hs),this.removeItem(this.eo),this.started=!1)}getItem(e){const t=this.storage.getItem(e);return V(Rt,"READ",e,t),t}setItem(e,t){V(Rt,"SET",e,t),this.storage.setItem(e,t)}removeItem(e){V(Rt,"REMOVE",e),this.storage.removeItem(e)}Ys(e){const t=e;if(t.storageArea===this.storage){if(V(Rt,"EVENT",t.key,t.newValue),t.key===this.eo)return void Ee("Received WebStorage notification for local change. Another client might have garbage-collected our state");this.Mi.enqueueRetryable(async()=>{if(this.started){if(t.key!==null){if(this.ro.test(t.key)){if(t.newValue==null){const n=this.Ro(t.key);return this.Vo(n,null)}{const n=this.mo(t.key,t.newValue);if(n)return this.Vo(n.clientId,n)}}else if(this.io.test(t.key)){if(t.newValue!==null){const n=this.fo(t.key,t.newValue);if(n)return this.po(n)}}else if(this.so.test(t.key)){if(t.newValue!==null){const n=this.yo(t.key,t.newValue);if(n)return this.wo(n)}}else if(t.key===this.oo){if(t.newValue!==null){const n=this.uo(t.newValue);if(n)return this.co(n)}}else if(t.key===this.no){const n=function(s){let o=et.ce;if(s!=null)try{const c=JSON.parse(s);U(typeof c=="number",30636,{So:s}),o=c}catch(c){Ee(Rt,"Failed to read sequence number from WebStorage",c)}return o}(t.newValue);n!==et.ce&&this.sequenceNumberHandler(n)}else if(t.key===this._o){const n=this.bo(t.newValue);await Promise.all(n.map(i=>this.syncEngine.Do(i)))}}}else this.Xs.push(t)})}}get To(){return this.Zs.get(this.Js)}ao(){this.setItem(this.eo,this.To.Gs())}ho(e,t,n){const i=new Sa(this.currentUser,e,t,n),s=Tp(this.persistenceKey,this.currentUser,e);this.setItem(s,i.Gs())}Po(e){const t=Tp(this.persistenceKey,this.currentUser,e);this.removeItem(t)}Eo(e){const t={clientId:this.Js,onlineState:e};this.storage.setItem(this.oo,JSON.stringify(t))}Io(e,t,n){const i=ru(this.persistenceKey,e),s=new bs(e,t,n);this.setItem(i,s.Gs())}Ao(e){const t=JSON.stringify(Array.from(e));this.setItem(this._o,t)}Ro(e){const t=this.ro.exec(e);return t?t[1]:null}mo(e,t){const n=this.Ro(e);return Pa.Ws(n,t)}fo(e,t){const n=this.io.exec(e),i=Number(n[1]),s=n[2]!==void 0?n[2]:null;return Sa.Ws(new Ve(s),i,t)}yo(e,t){const n=this.so.exec(e),i=Number(n[1]);return bs.Ws(i,t)}uo(e){return nh.Ws(e)}bo(e){return JSON.parse(e)}async po(e){if(e.user.uid===this.currentUser.uid)return this.syncEngine.Co(e.batchId,e.state,e.error);V(Rt,`Ignoring mutation for non-active user ${e.user.uid}`)}wo(e){return this.syncEngine.vo(e.targetId,e.state,e.error)}Vo(e,t){const n=t?this.Zs.insert(e,t):this.Zs.remove(e),i=this.lo(this.Zs),s=this.lo(n),o=[],c=[];return s.forEach(u=>{i.has(u)||o.push(u)}),i.forEach(u=>{s.has(u)||c.push(u)}),this.syncEngine.Fo(o,c).then(()=>{this.Zs=n})}co(e){this.Zs.get(e.clientId)&&this.onlineStateHandler(e.onlineState)}lo(e){let t=Ul();return e.forEach((n,i)=>{t=t.unionWith(i.activeTargetIds)}),t}}class fy{constructor(){this.Mo=new Uu,this.xo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,n){}addLocalQueryTarget(e,t=!0){return t&&this.Mo.zs(e),this.xo[e]||"not-current"}updateQueryState(e,t,n){this.xo[e]=t}removeLocalQueryTarget(e){this.Mo.js(e)}isLocalQueryTarget(e){return this.Mo.activeTargetIds.has(e)}clearQueryState(e){delete this.xo[e]}getAllActiveQueryTargets(){return this.Mo.activeTargetIds}isActiveQueryTarget(e){return this.Mo.activeTargetIds.has(e)}start(){return this.Mo=new Uu,Promise.resolve()}handleUserChange(e,t,n){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sP{Oo(e){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const vp="ConnectivityMonitor";class Ap{constructor(){this.No=()=>this.Bo(),this.Lo=()=>this.ko(),this.qo=[],this.Qo()}Oo(e){this.qo.push(e)}shutdown(){window.removeEventListener("online",this.No),window.removeEventListener("offline",this.Lo)}Qo(){window.addEventListener("online",this.No),window.addEventListener("offline",this.Lo)}Bo(){V(vp,"Network connectivity changed: AVAILABLE");for(const e of this.qo)e(0)}ko(){V(vp,"Network connectivity changed: UNAVAILABLE");for(const e of this.qo)e(1)}static v(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let jo=null;function Bu(){return jo===null?jo=function(){return 268435456+Math.round(2147483648*Math.random())}():jo++,"0x"+jo.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const su="RestConnection",oP={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"};class aP{get $o(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const t=e.ssl?"https":"http",n=encodeURIComponent(this.databaseId.projectId),i=encodeURIComponent(this.databaseId.database);this.Uo=t+"://"+e.host,this.Ko=`projects/${n}/databases/${i}`,this.Wo=this.databaseId.database===bu?`project_id=${n}`:`project_id=${n}&database_id=${i}`}Go(e,t,n,i,s){const o=Bu(),c=this.zo(e,t.toUriEncodedString());V(su,`Sending RPC '${e}' ${o}:`,c,n);const u={"google-cloud-resource-prefix":this.Ko,"x-goog-request-params":this.Wo};this.jo(u,i,s);const{host:l}=new URL(c),f=wi(l);return this.Jo(e,c,u,n,f).then(p=>(V(su,`Received RPC '${e}' ${o}: `,p),p),p=>{throw Ut(su,`RPC '${e}' ${o} failed with error: `,p,"url: ",c,"request:",n),p})}Ho(e,t,n,i,s,o){return this.Go(e,t,n,i,s)}jo(e,t,n){e["X-Goog-Api-Client"]=function(){return"gl-js/ fire/"+bi}(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach((i,s)=>e[s]=i),n&&n.headers.forEach((i,s)=>e[s]=i)}zo(e,t){const n=oP[e];return`${this.Uo}/v1/${t}:${n}`}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cP{constructor(e){this.Yo=e.Yo,this.Zo=e.Zo}Xo(e){this.e_=e}t_(e){this.n_=e}r_(e){this.i_=e}onMessage(e){this.s_=e}close(){this.Zo()}send(e){this.Yo(e)}o_(){this.e_()}__(){this.n_()}a_(e){this.i_(e)}u_(e){this.s_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Be="WebChannelConnection";class uP extends aP{constructor(e){super(e),this.c_=[],this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}Jo(e,t,n,i,s){const o=Bu();return new Promise((c,u)=>{const l=new wg;l.setWithCredentials(!0),l.listenOnce(Eg.COMPLETE,()=>{try{switch(l.getLastErrorCode()){case Qo.NO_ERROR:const p=l.getResponseJson();V(Be,`XHR for RPC '${e}' ${o} received:`,JSON.stringify(p)),c(p);break;case Qo.TIMEOUT:V(Be,`RPC '${e}' ${o} timed out`),u(new C(S.DEADLINE_EXCEEDED,"Request time out"));break;case Qo.HTTP_ERROR:const g=l.getStatus();if(V(Be,`RPC '${e}' ${o} failed with status:`,g,"response text:",l.getResponseText()),g>0){let v=l.getResponseJson();Array.isArray(v)&&(v=v[0]);const k=v==null?void 0:v.error;if(k&&k.status&&k.message){const D=function(q){const j=q.toLowerCase().replace(/_/g,"-");return Object.values(S).indexOf(j)>=0?j:S.UNKNOWN}(k.status);u(new C(D,k.message))}else u(new C(S.UNKNOWN,"Server responded with status "+l.getStatus()))}else u(new C(S.UNAVAILABLE,"Connection failed."));break;default:F(9055,{l_:e,streamId:o,h_:l.getLastErrorCode(),P_:l.getLastError()})}}finally{V(Be,`RPC '${e}' ${o} completed.`)}});const f=JSON.stringify(i);V(Be,`RPC '${e}' ${o} sending request:`,i),l.send(t,"POST",f,n,15)})}T_(e,t,n){const i=Bu(),s=[this.Uo,"/","google.firestore.v1.Firestore","/",e,"/channel"],o=Ag(),c=vg(),u={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},l=this.longPollingOptions.timeoutSeconds;l!==void 0&&(u.longPollingTimeout=Math.round(1e3*l)),this.useFetchStreams&&(u.useFetchStreams=!0),this.jo(u.initMessageHeaders,t,n),u.encodeInitMessageHeaders=!0;const f=s.join("");V(Be,`Creating RPC '${e}' stream ${i}: ${f}`,u);const p=o.createWebChannel(f,u);this.I_(p);let g=!1,v=!1;const k=new cP({Yo:N=>{v?V(Be,`Not sending because RPC '${e}' stream ${i} is closed:`,N):(g||(V(Be,`Opening RPC '${e}' stream ${i} transport.`),p.open(),g=!0),V(Be,`RPC '${e}' stream ${i} sending:`,N),p.send(N))},Zo:()=>p.close()}),D=(N,q,j)=>{N.listen(q,$=>{try{j($)}catch(ee){setTimeout(()=>{throw ee},0)}})};return D(p,as.EventType.OPEN,()=>{v||(V(Be,`RPC '${e}' stream ${i} transport opened.`),k.o_())}),D(p,as.EventType.CLOSE,()=>{v||(v=!0,V(Be,`RPC '${e}' stream ${i} transport closed`),k.a_(),this.E_(p))}),D(p,as.EventType.ERROR,N=>{v||(v=!0,Ut(Be,`RPC '${e}' stream ${i} transport errored. Name:`,N.name,"Message:",N.message),k.a_(new C(S.UNAVAILABLE,"The operation could not be completed")))}),D(p,as.EventType.MESSAGE,N=>{var q;if(!v){const j=N.data[0];U(!!j,16349);const $=j,ee=($==null?void 0:$.error)||((q=$[0])==null?void 0:q.error);if(ee){V(Be,`RPC '${e}' stream ${i} received error:`,ee);const te=ee.status;let Y=function(I){const T=Ae[I];if(T!==void 0)return R_(T)}(te),w=ee.message;Y===void 0&&(Y=S.INTERNAL,w="Unknown error status: "+te+" with message "+ee.message),v=!0,k.a_(new C(Y,w)),p.close()}else V(Be,`RPC '${e}' stream ${i} received:`,j),k.u_(j)}}),D(c,Tg.STAT_EVENT,N=>{N.stat===yu.PROXY?V(Be,`RPC '${e}' stream ${i} detected buffering proxy`):N.stat===yu.NOPROXY&&V(Be,`RPC '${e}' stream ${i} detected no buffering proxy`)}),setTimeout(()=>{k.__()},0),k}terminate(){this.c_.forEach(e=>e.close()),this.c_=[]}I_(e){this.c_.push(e)}E_(e){this.c_=this.c_.filter(t=>t===e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function py(){return typeof window<"u"?window:null}function sa(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function go(r){return new pS(r,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rh{constructor(e,t,n=1e3,i=1.5,s=6e4){this.Mi=e,this.timerId=t,this.d_=n,this.A_=i,this.R_=s,this.V_=0,this.m_=null,this.f_=Date.now(),this.reset()}reset(){this.V_=0}g_(){this.V_=this.R_}p_(e){this.cancel();const t=Math.floor(this.V_+this.y_()),n=Math.max(0,Date.now()-this.f_),i=Math.max(0,t-n);i>0&&V("ExponentialBackoff",`Backing off for ${i} ms (base delay: ${this.V_} ms, delay with jitter: ${t} ms, last attempt: ${n} ms ago)`),this.m_=this.Mi.enqueueAfterDelay(this.timerId,i,()=>(this.f_=Date.now(),e())),this.V_*=this.A_,this.V_<this.d_&&(this.V_=this.d_),this.V_>this.R_&&(this.V_=this.R_)}w_(){this.m_!==null&&(this.m_.skipDelay(),this.m_=null)}cancel(){this.m_!==null&&(this.m_.cancel(),this.m_=null)}y_(){return(Math.random()-.5)*this.V_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bp="PersistentStream";class my{constructor(e,t,n,i,s,o,c,u){this.Mi=e,this.S_=n,this.b_=i,this.connection=s,this.authCredentialsProvider=o,this.appCheckCredentialsProvider=c,this.listener=u,this.state=0,this.D_=0,this.C_=null,this.v_=null,this.stream=null,this.F_=0,this.M_=new rh(e,t)}x_(){return this.state===1||this.state===5||this.O_()}O_(){return this.state===2||this.state===3}start(){this.F_=0,this.state!==4?this.auth():this.N_()}async stop(){this.x_()&&await this.close(0)}B_(){this.state=0,this.M_.reset()}L_(){this.O_()&&this.C_===null&&(this.C_=this.Mi.enqueueAfterDelay(this.S_,6e4,()=>this.k_()))}q_(e){this.Q_(),this.stream.send(e)}async k_(){if(this.O_())return this.close(0)}Q_(){this.C_&&(this.C_.cancel(),this.C_=null)}U_(){this.v_&&(this.v_.cancel(),this.v_=null)}async close(e,t){this.Q_(),this.U_(),this.M_.cancel(),this.D_++,e!==4?this.M_.reset():t&&t.code===S.RESOURCE_EXHAUSTED?(Ee(t.toString()),Ee("Using maximum backoff delay to prevent overloading the backend."),this.M_.g_()):t&&t.code===S.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.K_(),this.stream.close(),this.stream=null),this.state=e,await this.listener.r_(t)}K_(){}auth(){this.state=1;const e=this.W_(this.D_),t=this.D_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then(([n,i])=>{this.D_===t&&this.G_(n,i)},n=>{e(()=>{const i=new C(S.UNKNOWN,"Fetching auth token failed: "+n.message);return this.z_(i)})})}G_(e,t){const n=this.W_(this.D_);this.stream=this.j_(e,t),this.stream.Xo(()=>{n(()=>this.listener.Xo())}),this.stream.t_(()=>{n(()=>(this.state=2,this.v_=this.Mi.enqueueAfterDelay(this.b_,1e4,()=>(this.O_()&&(this.state=3),Promise.resolve())),this.listener.t_()))}),this.stream.r_(i=>{n(()=>this.z_(i))}),this.stream.onMessage(i=>{n(()=>++this.F_==1?this.J_(i):this.onNext(i))})}N_(){this.state=5,this.M_.p_(async()=>{this.state=0,this.start()})}z_(e){return V(bp,`close with error: ${e}`),this.stream=null,this.close(4,e)}W_(e){return t=>{this.Mi.enqueueAndForget(()=>this.D_===e?t():(V(bp,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve()))}}}class lP extends my{constructor(e,t,n,i,s,o){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,n,i,o),this.serializer=s}j_(e,t){return this.connection.T_("Listen",e,t)}J_(e){return this.onNext(e)}onNext(e){this.M_.reset();const t=_S(this.serializer,e),n=function(s){if(!("targetChange"in s))return B.min();const o=s.targetChange;return o.targetIds&&o.targetIds.length?B.min():o.readTime?Te(o.readTime):B.min()}(e);return this.listener.H_(t,n)}Y_(e){const t={};t.database=Ou(this.serializer),t.addTarget=function(s,o){let c;const u=o.target;if(c=Ia(u)?{documents:M_(s,u)}:{query:L_(s,u).ft},c.targetId=o.targetId,o.resumeToken.approximateByteSize()>0){c.resumeToken=k_(s,o.resumeToken);const l=Nu(s,o.expectedCount);l!==null&&(c.expectedCount=l)}else if(o.snapshotVersion.compareTo(B.min())>0){c.readTime=di(s,o.snapshotVersion.toTimestamp());const l=Nu(s,o.expectedCount);l!==null&&(c.expectedCount=l)}return c}(this.serializer,e);const n=IS(this.serializer,e);n&&(t.labels=n),this.q_(t)}Z_(e){const t={};t.database=Ou(this.serializer),t.removeTarget=e,this.q_(t)}}class hP extends my{constructor(e,t,n,i,s,o){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",t,n,i,o),this.serializer=s}get X_(){return this.F_>0}start(){this.lastStreamToken=void 0,super.start()}K_(){this.X_&&this.ea([])}j_(e,t){return this.connection.T_("Write",e,t)}J_(e){return U(!!e.streamToken,31322),this.lastStreamToken=e.streamToken,U(!e.writeResults||e.writeResults.length===0,55816),this.listener.ta()}onNext(e){U(!!e.streamToken,12678),this.lastStreamToken=e.streamToken,this.M_.reset();const t=yS(e.writeResults,e.commitTime),n=Te(e.commitTime);return this.listener.na(n,t)}ra(){const e={};e.database=Ou(this.serializer),this.q_(e)}ea(e){const t={streamToken:this.lastStreamToken,writes:e.map(n=>Ws(this.serializer,n))};this.q_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dP{}class fP extends dP{constructor(e,t,n,i){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=n,this.serializer=i,this.ia=!1}sa(){if(this.ia)throw new C(S.FAILED_PRECONDITION,"The client has already been terminated.")}Go(e,t,n,i){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([s,o])=>this.connection.Go(e,Vu(t,n),i,s,o)).catch(s=>{throw s.name==="FirebaseError"?(s.code===S.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),s):new C(S.UNKNOWN,s.toString())})}Ho(e,t,n,i,s){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([o,c])=>this.connection.Ho(e,Vu(t,n),i,o,c,s)).catch(o=>{throw o.name==="FirebaseError"?(o.code===S.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new C(S.UNKNOWN,o.toString())})}terminate(){this.ia=!0,this.connection.terminate()}}class pP{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.oa=0,this._a=null,this.aa=!0}ua(){this.oa===0&&(this.ca("Unknown"),this._a=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,()=>(this._a=null,this.la("Backend didn't respond within 10 seconds."),this.ca("Offline"),Promise.resolve())))}ha(e){this.state==="Online"?this.ca("Unknown"):(this.oa++,this.oa>=1&&(this.Pa(),this.la(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.ca("Offline")))}set(e){this.Pa(),this.oa=0,e==="Online"&&(this.aa=!1),this.ca(e)}ca(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}la(e){const t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.aa?(Ee(t),this.aa=!1):V("OnlineStateTracker",t)}Pa(){this._a!==null&&(this._a.cancel(),this._a=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wr="RemoteStore";class mP{constructor(e,t,n,i,s){this.localStore=e,this.datastore=t,this.asyncQueue=n,this.remoteSyncer={},this.Ta=[],this.Ia=new Map,this.Ea=new Set,this.da=[],this.Aa=s,this.Aa.Oo(o=>{n.enqueueAndForget(async()=>{Un(this)&&(V(wr,"Restarting streams for network reachability change."),await async function(u){const l=L(u);l.Ea.add(4),await Ci(l),l.Ra.set("Unknown"),l.Ea.delete(4),await _o(l)}(this))})}),this.Ra=new pP(n,i)}}async function _o(r){if(Un(r))for(const e of r.da)await e(!0)}async function Ci(r){for(const e of r.da)await e(!1)}function ic(r,e){const t=L(r);t.Ia.has(e.targetId)||(t.Ia.set(e.targetId,e),oh(t)?sh(t):Di(t).O_()&&ih(t,e))}function mi(r,e){const t=L(r),n=Di(t);t.Ia.delete(e),n.O_()&&gy(t,e),t.Ia.size===0&&(n.O_()?n.L_():Un(t)&&t.Ra.set("Unknown"))}function ih(r,e){if(r.Va.Ue(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(B.min())>0){const t=r.remoteSyncer.getRemoteKeysForTarget(e.targetId).size;e=e.withExpectedCount(t)}Di(r).Y_(e)}function gy(r,e){r.Va.Ue(e),Di(r).Z_(e)}function sh(r){r.Va=new lS({getRemoteKeysForTarget:e=>r.remoteSyncer.getRemoteKeysForTarget(e),At:e=>r.Ia.get(e)||null,ht:()=>r.datastore.serializer.databaseId}),Di(r).start(),r.Ra.ua()}function oh(r){return Un(r)&&!Di(r).x_()&&r.Ia.size>0}function Un(r){return L(r).Ea.size===0}function _y(r){r.Va=void 0}async function gP(r){r.Ra.set("Online")}async function _P(r){r.Ia.forEach((e,t)=>{ih(r,e)})}async function yP(r,e){_y(r),oh(r)?(r.Ra.ha(e),sh(r)):r.Ra.set("Unknown")}async function IP(r,e,t){if(r.Ra.set("Online"),e instanceof C_&&e.state===2&&e.cause)try{await async function(i,s){const o=s.cause;for(const c of s.targetIds)i.Ia.has(c)&&(await i.remoteSyncer.rejectListen(c,o),i.Ia.delete(c),i.Va.removeTarget(c))}(r,e)}catch(n){V(wr,"Failed to remove targets %s: %s ",e.targetIds.join(","),n),await Ca(r,n)}else if(e instanceof ra?r.Va.Ze(e):e instanceof P_?r.Va.st(e):r.Va.tt(e),!t.isEqual(B.min()))try{const n=await sy(r.localStore);t.compareTo(n)>=0&&await function(s,o){const c=s.Va.Tt(o);return c.targetChanges.forEach((u,l)=>{if(u.resumeToken.approximateByteSize()>0){const f=s.Ia.get(l);f&&s.Ia.set(l,f.withResumeToken(u.resumeToken,o))}}),c.targetMismatches.forEach((u,l)=>{const f=s.Ia.get(u);if(!f)return;s.Ia.set(u,f.withResumeToken(ye.EMPTY_BYTE_STRING,f.snapshotVersion)),gy(s,u);const p=new $t(f.target,u,l,f.sequenceNumber);ih(s,p)}),s.remoteSyncer.applyRemoteEvent(c)}(r,t)}catch(n){V(wr,"Failed to raise snapshot:",n),await Ca(r,n)}}async function Ca(r,e,t){if(!Ln(e))throw e;r.Ea.add(1),await Ci(r),r.Ra.set("Offline"),t||(t=()=>sy(r.localStore)),r.asyncQueue.enqueueRetryable(async()=>{V(wr,"Retrying IndexedDB access"),await t(),r.Ea.delete(1),await _o(r)})}function yy(r,e){return e().catch(t=>Ca(r,t,e))}async function ki(r){const e=L(r),t=Dn(e);let n=e.Ta.length>0?e.Ta[e.Ta.length-1].batchId:wn;for(;wP(e);)try{const i=await nP(e.localStore,n);if(i===null){e.Ta.length===0&&t.L_();break}n=i.batchId,EP(e,i)}catch(i){await Ca(e,i)}Iy(e)&&wy(e)}function wP(r){return Un(r)&&r.Ta.length<10}function EP(r,e){r.Ta.push(e);const t=Dn(r);t.O_()&&t.X_&&t.ea(e.mutations)}function Iy(r){return Un(r)&&!Dn(r).x_()&&r.Ta.length>0}function wy(r){Dn(r).start()}async function TP(r){Dn(r).ra()}async function vP(r){const e=Dn(r);for(const t of r.Ta)e.ea(t.mutations)}async function AP(r,e,t){const n=r.Ta.shift(),i=zl.from(n,e,t);await yy(r,()=>r.remoteSyncer.applySuccessfulWrite(i)),await ki(r)}async function bP(r,e){e&&Dn(r).X_&&await async function(n,i){if(function(o){return b_(o)&&o!==S.ABORTED}(i.code)){const s=n.Ta.shift();Dn(n).B_(),await yy(n,()=>n.remoteSyncer.rejectFailedWrite(s.batchId,i)),await ki(n)}}(r,e),Iy(r)&&wy(r)}async function Rp(r,e){const t=L(r);t.asyncQueue.verifyOperationInProgress(),V(wr,"RemoteStore received new credentials");const n=Un(t);t.Ea.add(3),await Ci(t),n&&t.Ra.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.Ea.delete(3),await _o(t)}async function qu(r,e){const t=L(r);e?(t.Ea.delete(2),await _o(t)):e||(t.Ea.add(2),await Ci(t),t.Ra.set("Unknown"))}function Di(r){return r.ma||(r.ma=function(t,n,i){const s=L(t);return s.sa(),new lP(n,s.connection,s.authCredentials,s.appCheckCredentials,s.serializer,i)}(r.datastore,r.asyncQueue,{Xo:gP.bind(null,r),t_:_P.bind(null,r),r_:yP.bind(null,r),H_:IP.bind(null,r)}),r.da.push(async e=>{e?(r.ma.B_(),oh(r)?sh(r):r.Ra.set("Unknown")):(await r.ma.stop(),_y(r))})),r.ma}function Dn(r){return r.fa||(r.fa=function(t,n,i){const s=L(t);return s.sa(),new hP(n,s.connection,s.authCredentials,s.appCheckCredentials,s.serializer,i)}(r.datastore,r.asyncQueue,{Xo:()=>Promise.resolve(),t_:TP.bind(null,r),r_:bP.bind(null,r),ta:vP.bind(null,r),na:AP.bind(null,r)}),r.da.push(async e=>{e?(r.fa.B_(),await ki(r)):(await r.fa.stop(),r.Ta.length>0&&(V(wr,`Stopping write stream with ${r.Ta.length} pending writes`),r.Ta=[]))})),r.fa}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ah{constructor(e,t,n,i,s){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=n,this.op=i,this.removalCallback=s,this.deferred=new Le,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch(o=>{})}get promise(){return this.deferred.promise}static createAndSchedule(e,t,n,i,s){const o=Date.now()+n,c=new ah(e,t,o,i,s);return c.start(n),c}start(e){this.timerHandle=setTimeout(()=>this.handleDelayElapsed(),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new C(S.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget(()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then(e=>this.deferred.resolve(e))):Promise.resolve())}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function Ni(r,e){if(Ee("AsyncQueue",`${e}: ${r}`),Ln(r))return new C(S.UNAVAILABLE,`${e}: ${r}`);throw r}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jr{static emptySet(e){return new Jr(e.comparator)}constructor(e){this.comparator=e?(t,n)=>e(t,n)||x.comparator(t.key,n.key):(t,n)=>x.comparator(t.key,n.key),this.keyedMap=cs(),this.sortedSet=new ce(this.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal((t,n)=>(e(t),!1))}add(e){const t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){const t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof Jr)||this.size!==e.size)return!1;const t=this.sortedSet.getIterator(),n=e.sortedSet.getIterator();for(;t.hasNext();){const i=t.getNext().key,s=n.getNext().key;if(!i.isEqual(s))return!1}return!0}toString(){const e=[];return this.forEach(t=>{e.push(t.toString())}),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){const n=new Jr;return n.comparator=this.comparator,n.keyedMap=e,n.sortedSet=t,n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sp{constructor(){this.ga=new ce(x.comparator)}track(e){const t=e.doc.key,n=this.ga.get(t);n?e.type!==0&&n.type===3?this.ga=this.ga.insert(t,e):e.type===3&&n.type!==1?this.ga=this.ga.insert(t,{type:n.type,doc:e.doc}):e.type===2&&n.type===2?this.ga=this.ga.insert(t,{type:2,doc:e.doc}):e.type===2&&n.type===0?this.ga=this.ga.insert(t,{type:0,doc:e.doc}):e.type===1&&n.type===0?this.ga=this.ga.remove(t):e.type===1&&n.type===2?this.ga=this.ga.insert(t,{type:1,doc:n.doc}):e.type===0&&n.type===1?this.ga=this.ga.insert(t,{type:2,doc:e.doc}):F(63341,{Rt:e,pa:n}):this.ga=this.ga.insert(t,e)}ya(){const e=[];return this.ga.inorderTraversal((t,n)=>{e.push(n)}),e}}class gi{constructor(e,t,n,i,s,o,c,u,l){this.query=e,this.docs=t,this.oldDocs=n,this.docChanges=i,this.mutatedKeys=s,this.fromCache=o,this.syncStateChanged=c,this.excludesMetadataChanges=u,this.hasCachedResults=l}static fromInitialDocuments(e,t,n,i,s){const o=[];return t.forEach(c=>{o.push({type:0,doc:c})}),new gi(e,t,Jr.emptySet(t),o,n,i,!0,!1,s)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&lo(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const t=this.docChanges,n=e.docChanges;if(t.length!==n.length)return!1;for(let i=0;i<t.length;i++)if(t[i].type!==n[i].type||!t[i].doc.isEqual(n[i].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class RP{constructor(){this.wa=void 0,this.Sa=[]}ba(){return this.Sa.some(e=>e.Da())}}class SP{constructor(){this.queries=Pp(),this.onlineState="Unknown",this.Ca=new Set}terminate(){(function(t,n){const i=L(t),s=i.queries;i.queries=Pp(),s.forEach((o,c)=>{for(const u of c.Sa)u.onError(n)})})(this,new C(S.ABORTED,"Firestore shutting down"))}}function Pp(){return new Yt(r=>h_(r),lo)}async function ch(r,e){const t=L(r);let n=3;const i=e.query;let s=t.queries.get(i);s?!s.ba()&&e.Da()&&(n=2):(s=new RP,n=e.Da()?0:1);try{switch(n){case 0:s.wa=await t.onListen(i,!0);break;case 1:s.wa=await t.onListen(i,!1);break;case 2:await t.onFirstRemoteStoreListen(i)}}catch(o){const c=Ni(o,`Initialization of query '${Br(e.query)}' failed`);return void e.onError(c)}t.queries.set(i,s),s.Sa.push(e),e.va(t.onlineState),s.wa&&e.Fa(s.wa)&&lh(t)}async function uh(r,e){const t=L(r),n=e.query;let i=3;const s=t.queries.get(n);if(s){const o=s.Sa.indexOf(e);o>=0&&(s.Sa.splice(o,1),s.Sa.length===0?i=e.Da()?0:1:!s.ba()&&e.Da()&&(i=2))}switch(i){case 0:return t.queries.delete(n),t.onUnlisten(n,!0);case 1:return t.queries.delete(n),t.onUnlisten(n,!1);case 2:return t.onLastRemoteStoreUnlisten(n);default:return}}function PP(r,e){const t=L(r);let n=!1;for(const i of e){const s=i.query,o=t.queries.get(s);if(o){for(const c of o.Sa)c.Fa(i)&&(n=!0);o.wa=i}}n&&lh(t)}function CP(r,e,t){const n=L(r),i=n.queries.get(e);if(i)for(const s of i.Sa)s.onError(t);n.queries.delete(e)}function lh(r){r.Ca.forEach(e=>{e.next()})}var $u,Cp;(Cp=$u||($u={})).Ma="default",Cp.Cache="cache";class hh{constructor(e,t,n){this.query=e,this.xa=t,this.Oa=!1,this.Na=null,this.onlineState="Unknown",this.options=n||{}}Fa(e){if(!this.options.includeMetadataChanges){const n=[];for(const i of e.docChanges)i.type!==3&&n.push(i);e=new gi(e.query,e.docs,e.oldDocs,n,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.Oa?this.Ba(e)&&(this.xa.next(e),t=!0):this.La(e,this.onlineState)&&(this.ka(e),t=!0),this.Na=e,t}onError(e){this.xa.error(e)}va(e){this.onlineState=e;let t=!1;return this.Na&&!this.Oa&&this.La(this.Na,e)&&(this.ka(this.Na),t=!0),t}La(e,t){if(!e.fromCache||!this.Da())return!0;const n=t!=="Offline";return(!this.options.qa||!n)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}Ba(e){if(e.docChanges.length>0)return!0;const t=this.Na&&this.Na.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}ka(e){e=gi.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.Oa=!0,this.xa.next(e)}Da(){return this.options.source!==$u.Cache}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kP{constructor(e,t){this.Qa=e,this.byteLength=t}$a(){return"metadata"in this.Qa}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kp{constructor(e){this.serializer=e}$s(e){return xt(this.serializer,e)}Us(e){return e.metadata.exists?x_(this.serializer,e.document,!1):le.newNoDocument(this.$s(e.metadata.name),this.Ks(e.metadata.readTime))}Ks(e){return Te(e)}}class DP{constructor(e,t){this.Ua=e,this.serializer=t,this.Ka=[],this.Wa=[],this.collectionGroups=new Set,this.progress=Ey(e)}get queries(){return this.Ka}get documents(){return this.Wa}Ga(e){this.progress.bytesLoaded+=e.byteLength;let t=this.progress.documentsLoaded;if(e.Qa.namedQuery)this.Ka.push(e.Qa.namedQuery);else if(e.Qa.documentMetadata){this.Wa.push({metadata:e.Qa.documentMetadata}),e.Qa.documentMetadata.exists||++t;const n=Q.fromString(e.Qa.documentMetadata.name);this.collectionGroups.add(n.get(n.length-2))}else e.Qa.document&&(this.Wa[this.Wa.length-1].document=e.Qa.document,++t);return t!==this.progress.documentsLoaded?(this.progress.documentsLoaded=t,{...this.progress}):null}za(e){const t=new Map,n=new kp(this.serializer);for(const i of e)if(i.metadata.queries){const s=n.$s(i.metadata.name);for(const o of i.metadata.queries){const c=(t.get(o)||W()).add(s);t.set(o,c)}}return t}async ja(e){const t=await rP(e,new kp(this.serializer),this.Wa,this.Ua.id),n=this.za(this.documents);for(const i of this.Ka)await iP(e,i,n.get(i.name));return this.progress.taskState="Success",{progress:this.progress,Ja:this.collectionGroups,Ha:t}}}function Ey(r){return{taskState:"Running",documentsLoaded:0,bytesLoaded:0,totalDocuments:r.totalDocuments,totalBytes:r.totalBytes}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ty{constructor(e){this.key=e}}class vy{constructor(e){this.key=e}}class Ay{constructor(e,t){this.query=e,this.Ya=t,this.Za=null,this.hasCachedResults=!1,this.current=!1,this.Xa=W(),this.mutatedKeys=W(),this.eu=f_(e),this.tu=new Jr(this.eu)}get nu(){return this.Ya}ru(e,t){const n=t?t.iu:new Sp,i=t?t.tu:this.tu;let s=t?t.mutatedKeys:this.mutatedKeys,o=i,c=!1;const u=this.query.limitType==="F"&&i.size===this.query.limit?i.last():null,l=this.query.limitType==="L"&&i.size===this.query.limit?i.first():null;if(e.inorderTraversal((f,p)=>{const g=i.get(f),v=ho(this.query,p)?p:null,k=!!g&&this.mutatedKeys.has(g.key),D=!!v&&(v.hasLocalMutations||this.mutatedKeys.has(v.key)&&v.hasCommittedMutations);let N=!1;g&&v?g.data.isEqual(v.data)?k!==D&&(n.track({type:3,doc:v}),N=!0):this.su(g,v)||(n.track({type:2,doc:v}),N=!0,(u&&this.eu(v,u)>0||l&&this.eu(v,l)<0)&&(c=!0)):!g&&v?(n.track({type:0,doc:v}),N=!0):g&&!v&&(n.track({type:1,doc:g}),N=!0,(u||l)&&(c=!0)),N&&(v?(o=o.add(v),s=D?s.add(f):s.delete(f)):(o=o.delete(f),s=s.delete(f)))}),this.query.limit!==null)for(;o.size>this.query.limit;){const f=this.query.limitType==="F"?o.last():o.first();o=o.delete(f.key),s=s.delete(f.key),n.track({type:1,doc:f})}return{tu:o,iu:n,Cs:c,mutatedKeys:s}}su(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,n,i){const s=this.tu;this.tu=e.tu,this.mutatedKeys=e.mutatedKeys;const o=e.iu.ya();o.sort((f,p)=>function(v,k){const D=N=>{switch(N){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return F(20277,{Rt:N})}};return D(v)-D(k)}(f.type,p.type)||this.eu(f.doc,p.doc)),this.ou(n),i=i??!1;const c=t&&!i?this._u():[],u=this.Xa.size===0&&this.current&&!i?1:0,l=u!==this.Za;return this.Za=u,o.length!==0||l?{snapshot:new gi(this.query,e.tu,s,o,e.mutatedKeys,u===0,l,!1,!!n&&n.resumeToken.approximateByteSize()>0),au:c}:{au:c}}va(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({tu:this.tu,iu:new Sp,mutatedKeys:this.mutatedKeys,Cs:!1},!1)):{au:[]}}uu(e){return!this.Ya.has(e)&&!!this.tu.has(e)&&!this.tu.get(e).hasLocalMutations}ou(e){e&&(e.addedDocuments.forEach(t=>this.Ya=this.Ya.add(t)),e.modifiedDocuments.forEach(t=>{}),e.removedDocuments.forEach(t=>this.Ya=this.Ya.delete(t)),this.current=e.current)}_u(){if(!this.current)return[];const e=this.Xa;this.Xa=W(),this.tu.forEach(n=>{this.uu(n.key)&&(this.Xa=this.Xa.add(n.key))});const t=[];return e.forEach(n=>{this.Xa.has(n)||t.push(new vy(n))}),this.Xa.forEach(n=>{e.has(n)||t.push(new Ty(n))}),t}cu(e){this.Ya=e.Qs,this.Xa=W();const t=this.ru(e.documents);return this.applyChanges(t,!0)}lu(){return gi.fromInitialDocuments(this.query,this.tu,this.mutatedKeys,this.Za===0,this.hasCachedResults)}}const Bn="SyncEngine";class NP{constructor(e,t,n){this.query=e,this.targetId=t,this.view=n}}class VP{constructor(e){this.key=e,this.hu=!1}}class OP{constructor(e,t,n,i,s,o){this.localStore=e,this.remoteStore=t,this.eventManager=n,this.sharedClientState=i,this.currentUser=s,this.maxConcurrentLimboResolutions=o,this.Pu={},this.Tu=new Yt(c=>h_(c),lo),this.Iu=new Map,this.Eu=new Set,this.du=new ce(x.comparator),this.Au=new Map,this.Ru=new Jl,this.Vu={},this.mu=new Map,this.fu=Ir.cr(),this.onlineState="Unknown",this.gu=void 0}get isPrimaryClient(){return this.gu===!0}}async function xP(r,e,t=!0){const n=sc(r);let i;const s=n.Tu.get(e);return s?(n.sharedClientState.addLocalQueryTarget(s.targetId),i=s.view.lu()):i=await by(n,e,t,!0),i}async function MP(r,e){const t=sc(r);await by(t,e,!0,!1)}async function by(r,e,t,n){const i=await fi(r.localStore,Je(e)),s=i.targetId,o=r.sharedClientState.addLocalQueryTarget(s,t);let c;return n&&(c=await dh(r,e,s,o==="current",i.resumeToken)),r.isPrimaryClient&&t&&ic(r.remoteStore,i),c}async function dh(r,e,t,n,i){r.pu=(p,g,v)=>async function(D,N,q,j){let $=N.view.ru(q);$.Cs&&($=await Ra(D.localStore,N.query,!1).then(({documents:w})=>N.view.ru(w,$)));const ee=j&&j.targetChanges.get(N.targetId),te=j&&j.targetMismatches.get(N.targetId)!=null,Y=N.view.applyChanges($,D.isPrimaryClient,ee,te);return zu(D,N.targetId,Y.au),Y.snapshot}(r,p,g,v);const s=await Ra(r.localStore,e,!0),o=new Ay(e,s.Qs),c=o.ru(s.documents),u=mo.createSynthesizedTargetChangeForCurrentChange(t,n&&r.onlineState!=="Offline",i),l=o.applyChanges(c,r.isPrimaryClient,u);zu(r,t,l.au);const f=new NP(e,t,o);return r.Tu.set(e,f),r.Iu.has(t)?r.Iu.get(t).push(e):r.Iu.set(t,[e]),l.snapshot}async function LP(r,e,t){const n=L(r),i=n.Tu.get(e),s=n.Iu.get(i.targetId);if(s.length>1)return n.Iu.set(i.targetId,s.filter(o=>!lo(o,e))),void n.Tu.delete(e);n.isPrimaryClient?(n.sharedClientState.removeLocalQueryTarget(i.targetId),n.sharedClientState.isActiveQueryTarget(i.targetId)||await pi(n.localStore,i.targetId,!1).then(()=>{n.sharedClientState.clearQueryState(i.targetId),t&&mi(n.remoteStore,i.targetId),_i(n,i.targetId)}).catch(Mn)):(_i(n,i.targetId),await pi(n.localStore,i.targetId,!0))}async function FP(r,e){const t=L(r),n=t.Tu.get(e),i=t.Iu.get(n.targetId);t.isPrimaryClient&&i.length===1&&(t.sharedClientState.removeLocalQueryTarget(n.targetId),mi(t.remoteStore,n.targetId))}async function UP(r,e,t){const n=gh(r);try{const i=await function(o,c){const u=L(o),l=ne.now(),f=c.reduce((v,k)=>v.add(k.key),W());let p,g;return u.persistence.runTransaction("Locally write mutations","readwrite",v=>{let k=nt(),D=W();return u.Ns.getEntries(v,f).next(N=>{k=N,k.forEach((q,j)=>{j.isValidDocument()||(D=D.add(q))})}).next(()=>u.localDocuments.getOverlayedDocuments(v,k)).next(N=>{p=N;const q=[];for(const j of c){const $=aS(j,p.get(j.key).overlayedDocument);$!=null&&q.push(new Xt(j.key,$,n_($.value.mapValue),pe.exists(!0)))}return u.mutationQueue.addMutationBatch(v,l,q,c)}).next(N=>{g=N;const q=N.applyToLocalDocumentSet(p,D);return u.documentOverlayCache.saveOverlays(v,N.batchId,q)})}).then(()=>({batchId:g.batchId,changes:m_(p)}))}(n.localStore,e);n.sharedClientState.addPendingMutation(i.batchId),function(o,c,u){let l=o.Vu[o.currentUser.toKey()];l||(l=new ce(G)),l=l.insert(c,u),o.Vu[o.currentUser.toKey()]=l}(n,i.batchId,t),await Zt(n,i.changes),await ki(n.remoteStore)}catch(i){const s=Ni(i,"Failed to persist write");t.reject(s)}}async function Ry(r,e){const t=L(r);try{const n=await tP(t.localStore,e);e.targetChanges.forEach((i,s)=>{const o=t.Au.get(s);o&&(U(i.addedDocuments.size+i.modifiedDocuments.size+i.removedDocuments.size<=1,22616),i.addedDocuments.size>0?o.hu=!0:i.modifiedDocuments.size>0?U(o.hu,14607):i.removedDocuments.size>0&&(U(o.hu,42227),o.hu=!1))}),await Zt(t,n,e)}catch(n){await Mn(n)}}function Dp(r,e,t){const n=L(r);if(n.isPrimaryClient&&t===0||!n.isPrimaryClient&&t===1){const i=[];n.Tu.forEach((s,o)=>{const c=o.view.va(e);c.snapshot&&i.push(c.snapshot)}),function(o,c){const u=L(o);u.onlineState=c;let l=!1;u.queries.forEach((f,p)=>{for(const g of p.Sa)g.va(c)&&(l=!0)}),l&&lh(u)}(n.eventManager,e),i.length&&n.Pu.H_(i),n.onlineState=e,n.isPrimaryClient&&n.sharedClientState.setOnlineState(e)}}async function BP(r,e,t){const n=L(r);n.sharedClientState.updateQueryState(e,"rejected",t);const i=n.Au.get(e),s=i&&i.key;if(s){let o=new ce(x.comparator);o=o.insert(s,le.newNoDocument(s,B.min()));const c=W().add(s),u=new po(B.min(),new Map,new ce(G),o,c);await Ry(n,u),n.du=n.du.remove(s),n.Au.delete(e),mh(n)}else await pi(n.localStore,e,!1).then(()=>_i(n,e,t)).catch(Mn)}async function qP(r,e){const t=L(r),n=e.batch.batchId;try{const i=await eP(t.localStore,e);ph(t,n,null),fh(t,n),t.sharedClientState.updateMutationState(n,"acknowledged"),await Zt(t,i)}catch(i){await Mn(i)}}async function $P(r,e,t){const n=L(r);try{const i=await function(o,c){const u=L(o);return u.persistence.runTransaction("Reject batch","readwrite-primary",l=>{let f;return u.mutationQueue.lookupMutationBatch(l,c).next(p=>(U(p!==null,37113),f=p.keys(),u.mutationQueue.removeMutationBatch(l,p))).next(()=>u.mutationQueue.performConsistencyCheck(l)).next(()=>u.documentOverlayCache.removeOverlaysForBatchId(l,f,c)).next(()=>u.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(l,f)).next(()=>u.localDocuments.getDocuments(l,f))})}(n.localStore,e);ph(n,e,t),fh(n,e),n.sharedClientState.updateMutationState(e,"rejected",t),await Zt(n,i)}catch(i){await Mn(i)}}async function zP(r,e){const t=L(r);Un(t.remoteStore)||V(Bn,"The network is disabled. The task returned by 'awaitPendingWrites()' will not complete until the network is enabled.");try{const n=await function(o){const c=L(o);return c.persistence.runTransaction("Get highest unacknowledged batch id","readonly",u=>c.mutationQueue.getHighestUnacknowledgedBatchId(u))}(t.localStore);if(n===wn)return void e.resolve();const i=t.mu.get(n)||[];i.push(e),t.mu.set(n,i)}catch(n){const i=Ni(n,"Initialization of waitForPendingWrites() operation failed");e.reject(i)}}function fh(r,e){(r.mu.get(e)||[]).forEach(t=>{t.resolve()}),r.mu.delete(e)}function ph(r,e,t){const n=L(r);let i=n.Vu[n.currentUser.toKey()];if(i){const s=i.get(e);s&&(t?s.reject(t):s.resolve(),i=i.remove(e)),n.Vu[n.currentUser.toKey()]=i}}function _i(r,e,t=null){r.sharedClientState.removeLocalQueryTarget(e);for(const n of r.Iu.get(e))r.Tu.delete(n),t&&r.Pu.yu(n,t);r.Iu.delete(e),r.isPrimaryClient&&r.Ru.jr(e).forEach(n=>{r.Ru.containsKey(n)||Sy(r,n)})}function Sy(r,e){r.Eu.delete(e.path.canonicalString());const t=r.du.get(e);t!==null&&(mi(r.remoteStore,t),r.du=r.du.remove(e),r.Au.delete(t),mh(r))}function zu(r,e,t){for(const n of t)n instanceof Ty?(r.Ru.addReference(n.key,e),jP(r,n)):n instanceof vy?(V(Bn,"Document no longer in limbo: "+n.key),r.Ru.removeReference(n.key,e),r.Ru.containsKey(n.key)||Sy(r,n.key)):F(19791,{wu:n})}function jP(r,e){const t=e.key,n=t.path.canonicalString();r.du.get(t)||r.Eu.has(n)||(V(Bn,"New document in limbo: "+t),r.Eu.add(n),mh(r))}function mh(r){for(;r.Eu.size>0&&r.du.size<r.maxConcurrentLimboResolutions;){const e=r.Eu.values().next().value;r.Eu.delete(e);const t=new x(Q.fromString(e)),n=r.fu.next();r.Au.set(n,new VP(t)),r.du=r.du.insert(t,n),ic(r.remoteStore,new $t(Je(Ri(t.path)),n,"TargetPurposeLimboResolution",et.ce))}}async function Zt(r,e,t){const n=L(r),i=[],s=[],o=[];n.Tu.isEmpty()||(n.Tu.forEach((c,u)=>{o.push(n.pu(u,e,t).then(l=>{var f;if((l||t)&&n.isPrimaryClient){const p=l?!l.fromCache:(f=t==null?void 0:t.targetChanges.get(u.targetId))==null?void 0:f.current;n.sharedClientState.updateQueryState(u.targetId,p?"current":"not-current")}if(l){i.push(l);const p=eh.As(u.targetId,l);s.push(p)}}))}),await Promise.all(o),n.Pu.H_(i),await async function(u,l){const f=L(u);try{await f.persistence.runTransaction("notifyLocalViewChanges","readwrite",p=>A.forEach(l,g=>A.forEach(g.Es,v=>f.persistence.referenceDelegate.addReference(p,g.targetId,v)).next(()=>A.forEach(g.ds,v=>f.persistence.referenceDelegate.removeReference(p,g.targetId,v)))))}catch(p){if(!Ln(p))throw p;V(th,"Failed to update sequence numbers: "+p)}for(const p of l){const g=p.targetId;if(!p.fromCache){const v=f.Ms.get(g),k=v.snapshotVersion,D=v.withLastLimboFreeSnapshotVersion(k);f.Ms=f.Ms.insert(g,D)}}}(n.localStore,s))}async function GP(r,e){const t=L(r);if(!t.currentUser.isEqual(e)){V(Bn,"User change. New user:",e.toKey());const n=await iy(t.localStore,e);t.currentUser=e,function(s,o){s.mu.forEach(c=>{c.forEach(u=>{u.reject(new C(S.CANCELLED,o))})}),s.mu.clear()}(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,n.removedBatchIds,n.addedBatchIds),await Zt(t,n.Ls)}}function WP(r,e){const t=L(r),n=t.Au.get(e);if(n&&n.hu)return W().add(n.key);{let i=W();const s=t.Iu.get(e);if(!s)return i;for(const o of s){const c=t.Tu.get(o);i=i.unionWith(c.view.nu)}return i}}async function KP(r,e){const t=L(r),n=await Ra(t.localStore,e.query,!0),i=e.view.cu(n);return t.isPrimaryClient&&zu(t,e.targetId,i.au),i}async function HP(r,e){const t=L(r);return cy(t.localStore,e).then(n=>Zt(t,n))}async function QP(r,e,t,n){const i=L(r),s=await function(c,u){const l=L(c),f=L(l.mutationQueue);return l.persistence.runTransaction("Lookup mutation documents","readonly",p=>f.er(p,u).next(g=>g?l.localDocuments.getDocuments(p,g):A.resolve(null)))}(i.localStore,e);s!==null?(t==="pending"?await ki(i.remoteStore):t==="acknowledged"||t==="rejected"?(ph(i,e,n||null),fh(i,e),function(c,u){L(L(c).mutationQueue).ir(u)}(i.localStore,e)):F(6720,"Unknown batchState",{Su:t}),await Zt(i,s)):V(Bn,"Cannot apply mutation batch with id: "+e)}async function JP(r,e){const t=L(r);if(sc(t),gh(t),e===!0&&t.gu!==!0){const n=t.sharedClientState.getAllActiveQueryTargets(),i=await Np(t,n.toArray());t.gu=!0,await qu(t.remoteStore,!0);for(const s of i)ic(t.remoteStore,s)}else if(e===!1&&t.gu!==!1){const n=[];let i=Promise.resolve();t.Iu.forEach((s,o)=>{t.sharedClientState.isLocalQueryTarget(o)?n.push(o):i=i.then(()=>(_i(t,o),pi(t.localStore,o,!0))),mi(t.remoteStore,o)}),await i,await Np(t,n),function(o){const c=L(o);c.Au.forEach((u,l)=>{mi(c.remoteStore,l)}),c.Ru.Jr(),c.Au=new Map,c.du=new ce(x.comparator)}(t),t.gu=!1,await qu(t.remoteStore,!1)}}async function Np(r,e,t){const n=L(r),i=[],s=[];for(const o of e){let c;const u=n.Iu.get(o);if(u&&u.length!==0){c=await fi(n.localStore,Je(u[0]));for(const l of u){const f=n.Tu.get(l),p=await KP(n,f);p.snapshot&&s.push(p.snapshot)}}else{const l=await ay(n.localStore,o);c=await fi(n.localStore,l),await dh(n,Py(l),o,!1,c.resumeToken)}i.push(c)}return n.Pu.H_(s),i}function Py(r){return l_(r.path,r.collectionGroup,r.orderBy,r.filters,r.limit,"F",r.startAt,r.endAt)}function YP(r){return function(t){return L(L(t).persistence).Ts()}(L(r).localStore)}async function XP(r,e,t,n){const i=L(r);if(i.gu)return void V(Bn,"Ignoring unexpected query state notification.");const s=i.Iu.get(e);if(s&&s.length>0)switch(t){case"current":case"not-current":{const o=await cy(i.localStore,d_(s[0])),c=po.createSynthesizedRemoteEventForCurrentChange(e,t==="current",ye.EMPTY_BYTE_STRING);await Zt(i,o,c);break}case"rejected":await pi(i.localStore,e,!0),_i(i,e,n);break;default:F(64155,t)}}async function ZP(r,e,t){const n=sc(r);if(n.gu){for(const i of e){if(n.Iu.has(i)&&n.sharedClientState.isActiveQueryTarget(i)){V(Bn,"Adding an already active target "+i);continue}const s=await ay(n.localStore,i),o=await fi(n.localStore,s);await dh(n,Py(s),o.targetId,!1,o.resumeToken),ic(n.remoteStore,o)}for(const i of t)n.Iu.has(i)&&await pi(n.localStore,i,!1).then(()=>{mi(n.remoteStore,i),_i(n,i)}).catch(Mn)}}function sc(r){const e=L(r);return e.remoteStore.remoteSyncer.applyRemoteEvent=Ry.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=WP.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=BP.bind(null,e),e.Pu.H_=PP.bind(null,e.eventManager),e.Pu.yu=CP.bind(null,e.eventManager),e}function gh(r){const e=L(r);return e.remoteStore.remoteSyncer.applySuccessfulWrite=qP.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=$P.bind(null,e),e}function eC(r,e,t){const n=L(r);(async function(s,o,c){try{const u=await o.getMetadata();if(await function(v,k){const D=L(v),N=Te(k.createTime);return D.persistence.runTransaction("hasNewerBundle","readonly",q=>D.Ii.getBundleMetadata(q,k.id)).then(q=>!!q&&q.createTime.compareTo(N)>=0)}(s.localStore,u))return await o.close(),c._completeWith(function(v){return{taskState:"Success",documentsLoaded:v.totalDocuments,bytesLoaded:v.totalBytes,totalDocuments:v.totalDocuments,totalBytes:v.totalBytes}}(u)),Promise.resolve(new Set);c._updateProgress(Ey(u));const l=new DP(u,o.serializer);let f=await o.bu();for(;f;){const g=await l.Ga(f);g&&c._updateProgress(g),f=await o.bu()}const p=await l.ja(s.localStore);return await Zt(s,p.Ha,void 0),await function(v,k){const D=L(v);return D.persistence.runTransaction("Save bundle","readwrite",N=>D.Ii.saveBundleMetadata(N,k))}(s.localStore,u),c._completeWith(p.progress),Promise.resolve(p.Ja)}catch(u){return Ut(Bn,`Loading bundle failed with ${u}`),c._failWith(u),Promise.resolve(new Set)}})(n,e,t).then(i=>{n.sharedClientState.notifyBundleLoaded(i)})}class Ks{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=go(e.databaseInfo.databaseId),this.sharedClientState=this.Du(e),this.persistence=this.Cu(e),await this.persistence.start(),this.localStore=this.vu(e),this.gcScheduler=this.Fu(e,this.localStore),this.indexBackfillerScheduler=this.Mu(e,this.localStore)}Fu(e,t){return null}Mu(e,t){return null}vu(e){return ry(this.persistence,new ny,e.initialUser,this.serializer)}Cu(e){return new Yl(rc.mi,this.serializer)}Du(e){return new fy}async terminate(){var e,t;(e=this.gcScheduler)==null||e.stop(),(t=this.indexBackfillerScheduler)==null||t.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}Ks.provider={build:()=>new Ks};class tC extends Ks{constructor(e){super(),this.cacheSizeBytes=e}Fu(e,t){U(this.persistence.referenceDelegate instanceof ba,46915);const n=this.persistence.referenceDelegate.garbageCollector;return new J_(n,e.asyncQueue,t)}Cu(e){const t=this.cacheSizeBytes!==void 0?qe.withCacheSize(this.cacheSizeBytes):qe.DEFAULT;return new Yl(n=>ba.mi(n,t),this.serializer)}}class Cy extends Ks{constructor(e,t,n){super(),this.xu=e,this.cacheSizeBytes=t,this.forceOwnership=n,this.kind="persistent",this.synchronizeTabs=!1}async initialize(e){await super.initialize(e),await this.xu.initialize(this,e),await gh(this.xu.syncEngine),await ki(this.xu.remoteStore),await this.persistence.Ji(()=>(this.gcScheduler&&!this.gcScheduler.started&&this.gcScheduler.start(),this.indexBackfillerScheduler&&!this.indexBackfillerScheduler.started&&this.indexBackfillerScheduler.start(),Promise.resolve()))}vu(e){return ry(this.persistence,new ny,e.initialUser,this.serializer)}Fu(e,t){const n=this.persistence.referenceDelegate.garbageCollector;return new J_(n,e.asyncQueue,t)}Mu(e,t){const n=new lR(t,this.persistence);return new uR(e.asyncQueue,n)}Cu(e){const t=Zl(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey),n=this.cacheSizeBytes!==void 0?qe.withCacheSize(this.cacheSizeBytes):qe.DEFAULT;return new Xl(this.synchronizeTabs,t,e.clientId,n,e.asyncQueue,py(),sa(),this.serializer,this.sharedClientState,!!this.forceOwnership)}Du(e){return new fy}}class nC extends Cy{constructor(e,t){super(e,t,!1),this.xu=e,this.cacheSizeBytes=t,this.synchronizeTabs=!0}async initialize(e){await super.initialize(e);const t=this.xu.syncEngine;this.sharedClientState instanceof iu&&(this.sharedClientState.syncEngine={Co:QP.bind(null,t),vo:XP.bind(null,t),Fo:ZP.bind(null,t),Ts:YP.bind(null,t),Do:HP.bind(null,t)},await this.sharedClientState.start()),await this.persistence.Ji(async n=>{await JP(this.xu.syncEngine,n),this.gcScheduler&&(n&&!this.gcScheduler.started?this.gcScheduler.start():n||this.gcScheduler.stop()),this.indexBackfillerScheduler&&(n&&!this.indexBackfillerScheduler.started?this.indexBackfillerScheduler.start():n||this.indexBackfillerScheduler.stop())})}Du(e){const t=py();if(!iu.v(t))throw new C(S.UNIMPLEMENTED,"IndexedDB persistence is only available on platforms that support LocalStorage.");const n=Zl(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey);return new iu(t,e.asyncQueue,n,e.clientId,e.initialUser)}}class Hs{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=n=>Dp(this.syncEngine,n,1),this.remoteStore.remoteSyncer.handleCredentialChange=GP.bind(null,this.syncEngine),await qu(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return function(){return new SP}()}createDatastore(e){const t=go(e.databaseInfo.databaseId),n=function(s){return new uP(s)}(e.databaseInfo);return function(s,o,c,u){return new fP(s,o,c,u)}(e.authCredentials,e.appCheckCredentials,n,t)}createRemoteStore(e){return function(n,i,s,o,c){return new mP(n,i,s,o,c)}(this.localStore,this.datastore,e.asyncQueue,t=>Dp(this.syncEngine,t,0),function(){return Ap.v()?new Ap:new sP}())}createSyncEngine(e,t){return function(i,s,o,c,u,l,f){const p=new OP(i,s,o,c,u,l);return f&&(p.gu=!0),p}(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){var e,t;await async function(i){const s=L(i);V(wr,"RemoteStore shutting down."),s.Ea.add(5),await Ci(s),s.Aa.shutdown(),s.Ra.set("Unknown")}(this.remoteStore),(e=this.datastore)==null||e.terminate(),(t=this.eventManager)==null||t.terminate()}}Hs.provider={build:()=>new Hs};function Vp(r,e=10240){let t=0;return{async read(){if(t<r.byteLength){const n={value:r.slice(t,t+e),done:!1};return t+=e,n}return{done:!0}},async cancel(){},releaseLock(){},closed:Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class oc{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.Ou(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.Ou(this.observer.error,e):Ee("Uncaught Error in snapshot listener:",e.toString()))}Nu(){this.muted=!0}Ou(e,t){setTimeout(()=>{this.muted||e(t)},0)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rC{constructor(e,t){this.Bu=e,this.serializer=t,this.metadata=new Le,this.buffer=new Uint8Array,this.Lu=function(){return new TextDecoder("utf-8")}(),this.ku().then(n=>{n&&n.$a()?this.metadata.resolve(n.Qa.metadata):this.metadata.reject(new Error(`The first element of the bundle is not a metadata, it is
             ${JSON.stringify(n==null?void 0:n.Qa)}`))},n=>this.metadata.reject(n))}close(){return this.Bu.cancel()}async getMetadata(){return this.metadata.promise}async bu(){return await this.getMetadata(),this.ku()}async ku(){const e=await this.qu();if(e===null)return null;const t=this.Lu.decode(e),n=Number(t);isNaN(n)&&this.Qu(`length string (${t}) is not valid number`);const i=await this.$u(n);return new kP(JSON.parse(i),e.length+n)}Uu(){return this.buffer.findIndex(e=>e===123)}async qu(){for(;this.Uu()<0&&!await this.Ku(););if(this.buffer.length===0)return null;const e=this.Uu();e<0&&this.Qu("Reached the end of bundle when a length string is expected.");const t=this.buffer.slice(0,e);return this.buffer=this.buffer.slice(e),t}async $u(e){for(;this.buffer.length<e;)await this.Ku()&&this.Qu("Reached the end of bundle when more is expected.");const t=this.Lu.decode(this.buffer.slice(0,e));return this.buffer=this.buffer.slice(e),t}Qu(e){throw this.Bu.cancel(),new Error(`Invalid bundle format: ${e}`)}async Ku(){const e=await this.Bu.read();if(!e.done){const t=new Uint8Array(this.buffer.length+e.value.length);t.set(this.buffer),t.set(e.value,this.buffer.length),this.buffer=t}return e.done}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class iC{constructor(e){this.datastore=e,this.readVersions=new Map,this.mutations=[],this.committed=!1,this.lastTransactionError=null,this.writtenDocs=new Set}async lookup(e){if(this.ensureCommitNotCalled(),this.mutations.length>0)throw this.lastTransactionError=new C(S.INVALID_ARGUMENT,"Firestore transactions require all reads to be executed before all writes."),this.lastTransactionError;const t=await async function(i,s){const o=L(i),c={documents:s.map(p=>Gs(o.serializer,p))},u=await o.Ho("BatchGetDocuments",o.serializer.databaseId,Q.emptyPath(),c,s.length),l=new Map;u.forEach(p=>{const g=gS(o.serializer,p);l.set(g.key.toString(),g)});const f=[];return s.forEach(p=>{const g=l.get(p.toString());U(!!g,55234,{key:p}),f.push(g)}),f}(this.datastore,e);return t.forEach(n=>this.recordVersion(n)),t}set(e,t){this.write(t.toMutation(e,this.precondition(e))),this.writtenDocs.add(e.toString())}update(e,t){try{this.write(t.toMutation(e,this.preconditionForUpdate(e)))}catch(n){this.lastTransactionError=n}this.writtenDocs.add(e.toString())}delete(e){this.write(new Pi(e,this.precondition(e))),this.writtenDocs.add(e.toString())}async commit(){if(this.ensureCommitNotCalled(),this.lastTransactionError)throw this.lastTransactionError;const e=this.readVersions;this.mutations.forEach(t=>{e.delete(t.key.toString())}),e.forEach((t,n)=>{const i=x.fromPath(n);this.mutations.push(new ql(i,this.precondition(i)))}),await async function(n,i){const s=L(n),o={writes:i.map(c=>Ws(s.serializer,c))};await s.Go("Commit",s.serializer.databaseId,Q.emptyPath(),o)}(this.datastore,this.mutations),this.committed=!0}recordVersion(e){let t;if(e.isFoundDocument())t=e.version;else{if(!e.isNoDocument())throw F(50498,{Gu:e.constructor.name});t=B.min()}const n=this.readVersions.get(e.key.toString());if(n){if(!t.isEqual(n))throw new C(S.ABORTED,"Document version changed between two reads.")}else this.readVersions.set(e.key.toString(),t)}precondition(e){const t=this.readVersions.get(e.toString());return!this.writtenDocs.has(e.toString())&&t?t.isEqual(B.min())?pe.exists(!1):pe.updateTime(t):pe.none()}preconditionForUpdate(e){const t=this.readVersions.get(e.toString());if(!this.writtenDocs.has(e.toString())&&t){if(t.isEqual(B.min()))throw new C(S.INVALID_ARGUMENT,"Can't update a document that doesn't exist.");return pe.updateTime(t)}return pe.exists(!0)}write(e){this.ensureCommitNotCalled(),this.mutations.push(e)}ensureCommitNotCalled(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sC{constructor(e,t,n,i,s){this.asyncQueue=e,this.datastore=t,this.options=n,this.updateFunction=i,this.deferred=s,this.zu=n.maxAttempts,this.M_=new rh(this.asyncQueue,"transaction_retry")}ju(){this.zu-=1,this.Ju()}Ju(){this.M_.p_(async()=>{const e=new iC(this.datastore),t=this.Hu(e);t&&t.then(n=>{this.asyncQueue.enqueueAndForget(()=>e.commit().then(()=>{this.deferred.resolve(n)}).catch(i=>{this.Yu(i)}))}).catch(n=>{this.Yu(n)})})}Hu(e){try{const t=this.updateFunction(e);return!ao(t)&&t.catch&&t.then?t:(this.deferred.reject(Error("Transaction callback must return a Promise")),null)}catch(t){return this.deferred.reject(t),null}}Yu(e){this.zu>0&&this.Zu(e)?(this.zu-=1,this.asyncQueue.enqueueAndForget(()=>(this.Ju(),Promise.resolve()))):this.deferred.reject(e)}Zu(e){if((e==null?void 0:e.name)==="FirebaseError"){const t=e.code;return t==="aborted"||t==="failed-precondition"||t==="already-exists"||!b_(t)}return!1}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nn="FirestoreClient";class oC{constructor(e,t,n,i,s){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=n,this.databaseInfo=i,this.user=Ve.UNAUTHENTICATED,this.clientId=Sl.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=s,this.authCredentials.start(n,async o=>{V(Nn,"Received user=",o.uid),await this.authCredentialListener(o),this.user=o}),this.appCheckCredentials.start(n,o=>(V(Nn,"Received new app check token=",o),this.appCheckCredentialListener(o,this.user)))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this.databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();const e=new Le;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted(async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){const n=Ni(t,"Failed to shutdown persistence");e.reject(n)}}),e.promise}}async function ou(r,e){r.asyncQueue.verifyOperationInProgress(),V(Nn,"Initializing OfflineComponentProvider");const t=r.configuration;await e.initialize(t);let n=t.initialUser;r.setCredentialChangeListener(async i=>{n.isEqual(i)||(await iy(e.localStore,i),n=i)}),e.persistence.setDatabaseDeletedListener(()=>r.terminate()),r._offlineComponents=e}async function Op(r,e){r.asyncQueue.verifyOperationInProgress();const t=await _h(r);V(Nn,"Initializing OnlineComponentProvider"),await e.initialize(t,r.configuration),r.setCredentialChangeListener(n=>Rp(e.remoteStore,n)),r.setAppCheckTokenChangeListener((n,i)=>Rp(e.remoteStore,i)),r._onlineComponents=e}async function _h(r){if(!r._offlineComponents)if(r._uninitializedComponentsProvider){V(Nn,"Using user provided OfflineComponentProvider");try{await ou(r,r._uninitializedComponentsProvider._offline)}catch(e){const t=e;if(!function(i){return i.name==="FirebaseError"?i.code===S.FAILED_PRECONDITION||i.code===S.UNIMPLEMENTED:!(typeof DOMException<"u"&&i instanceof DOMException)||i.code===22||i.code===20||i.code===11}(t))throw t;Ut("Error using user provided cache. Falling back to memory cache: "+t),await ou(r,new Ks)}}else V(Nn,"Using default OfflineComponentProvider"),await ou(r,new tC(void 0));return r._offlineComponents}async function ac(r){return r._onlineComponents||(r._uninitializedComponentsProvider?(V(Nn,"Using user provided OnlineComponentProvider"),await Op(r,r._uninitializedComponentsProvider._online)):(V(Nn,"Using default OnlineComponentProvider"),await Op(r,new Hs))),r._onlineComponents}function ky(r){return _h(r).then(e=>e.persistence)}function yh(r){return _h(r).then(e=>e.localStore)}function Dy(r){return ac(r).then(e=>e.remoteStore)}function Ih(r){return ac(r).then(e=>e.syncEngine)}function aC(r){return ac(r).then(e=>e.datastore)}async function yi(r){const e=await ac(r),t=e.eventManager;return t.onListen=xP.bind(null,e.syncEngine),t.onUnlisten=LP.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=MP.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=FP.bind(null,e.syncEngine),t}function cC(r){return r.asyncQueue.enqueue(async()=>{const e=await ky(r),t=await Dy(r);return e.setNetworkEnabled(!0),function(i){const s=L(i);return s.Ea.delete(0),_o(s)}(t)})}function uC(r){return r.asyncQueue.enqueue(async()=>{const e=await ky(r),t=await Dy(r);return e.setNetworkEnabled(!1),async function(i){const s=L(i);s.Ea.add(0),await Ci(s),s.Ra.set("Offline")}(t)})}function lC(r,e){const t=new Le;return r.asyncQueue.enqueueAndForget(async()=>async function(i,s,o){try{const c=await function(l,f){const p=L(l);return p.persistence.runTransaction("read document","readonly",g=>p.localDocuments.getDocument(g,f))}(i,s);c.isFoundDocument()?o.resolve(c):c.isNoDocument()?o.resolve(null):o.reject(new C(S.UNAVAILABLE,"Failed to get document from cache. (However, this document may exist on the server. Run again without setting 'source' in the GetOptions to attempt to retrieve the document from the server.)"))}catch(c){const u=Ni(c,`Failed to get document '${s} from cache`);o.reject(u)}}(await yh(r),e,t)),t.promise}function Ny(r,e,t={}){const n=new Le;return r.asyncQueue.enqueueAndForget(async()=>function(s,o,c,u,l){const f=new oc({next:g=>{f.Nu(),o.enqueueAndForget(()=>uh(s,p));const v=g.docs.has(c);!v&&g.fromCache?l.reject(new C(S.UNAVAILABLE,"Failed to get document because the client is offline.")):v&&g.fromCache&&u&&u.source==="server"?l.reject(new C(S.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):l.resolve(g)},error:g=>l.reject(g)}),p=new hh(Ri(c.path),f,{includeMetadataChanges:!0,qa:!0});return ch(s,p)}(await yi(r),r.asyncQueue,e,t,n)),n.promise}function hC(r,e){const t=new Le;return r.asyncQueue.enqueueAndForget(async()=>async function(i,s,o){try{const c=await Ra(i,s,!0),u=new Ay(s,c.Qs),l=u.ru(c.documents),f=u.applyChanges(l,!1);o.resolve(f.snapshot)}catch(c){const u=Ni(c,`Failed to execute query '${s} against cache`);o.reject(u)}}(await yh(r),e,t)),t.promise}function Vy(r,e,t={}){const n=new Le;return r.asyncQueue.enqueueAndForget(async()=>function(s,o,c,u,l){const f=new oc({next:g=>{f.Nu(),o.enqueueAndForget(()=>uh(s,p)),g.fromCache&&u.source==="server"?l.reject(new C(S.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):l.resolve(g)},error:g=>l.reject(g)}),p=new hh(c,f,{includeMetadataChanges:!0,qa:!0});return ch(s,p)}(await yi(r),r.asyncQueue,e,t,n)),n.promise}function dC(r,e){const t=new oc(e);return r.asyncQueue.enqueueAndForget(async()=>function(i,s){L(i).Ca.add(s),s.next()}(await yi(r),t)),()=>{t.Nu(),r.asyncQueue.enqueueAndForget(async()=>function(i,s){L(i).Ca.delete(s)}(await yi(r),t))}}function fC(r,e,t,n){const i=function(o,c){let u;return u=typeof o=="string"?S_().encode(o):o,function(f,p){return new rC(f,p)}(function(f,p){if(f instanceof Uint8Array)return Vp(f,p);if(f instanceof ArrayBuffer)return Vp(new Uint8Array(f),p);if(f instanceof ReadableStream)return f.getReader();throw new Error("Source of `toByteStreamReader` has to be a ArrayBuffer or ReadableStream")}(u),c)}(t,go(e));r.asyncQueue.enqueueAndForget(async()=>{eC(await Ih(r),i,n)})}function pC(r,e){return r.asyncQueue.enqueue(async()=>function(n,i){const s=L(n);return s.persistence.runTransaction("Get named query","readonly",o=>s.Ii.getNamedQuery(o,i))}(await yh(r),e))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Oy(r){const e={};return r.timeoutSeconds!==void 0&&(e.timeoutSeconds=r.timeoutSeconds),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xp=new Map;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xy="firestore.googleapis.com",Mp=!0;class Lp{constructor(e){if(e.host===void 0){if(e.ssl!==void 0)throw new C(S.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=xy,this.ssl=Mp}else this.host=e.host,this.ssl=e.ssl??Mp;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=W_;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<xS)throw new C(S.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}Pg("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Oy(e.experimentalLongPollingOptions??{}),function(n){if(n.timeoutSeconds!==void 0){if(isNaN(n.timeoutSeconds))throw new C(S.INVALID_ARGUMENT,`invalid long polling timeout: ${n.timeoutSeconds} (must not be NaN)`);if(n.timeoutSeconds<5)throw new C(S.INVALID_ARGUMENT,`invalid long polling timeout: ${n.timeoutSeconds} (minimum allowed value is 5)`);if(n.timeoutSeconds>30)throw new C(S.INVALID_ARGUMENT,`invalid long polling timeout: ${n.timeoutSeconds} (maximum allowed value is 30)`)}}(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&function(n,i){return n.timeoutSeconds===i.timeoutSeconds}(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class yo{constructor(e,t,n,i){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=n,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Lp({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new C(S.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new C(S.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Lp(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=function(n){if(!n)return new Yb;switch(n.type){case"firstParty":return new tR(n.sessionIndex||"0",n.iamToken||null,n.authTokenFactory||null);case"provider":return n.client;default:throw new C(S.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}}(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return function(t){const n=xp.get(t);n&&(V("ComponentProvider","Removing Datastore"),xp.delete(t),n.terminate())}(this),Promise.resolve()}}function mC(r,e,t,n={}){var l;r=Z(r,yo);const i=wi(e),s=r._getSettings(),o={...s,emulatorOptions:r._getEmulatorOptions()},c=`${e}:${t}`;i&&(Yp(`https://${c}`),Xp("Firestore",!0)),s.host!==xy&&s.host!==c&&Ut("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const u={...s,host:c,ssl:i,emulatorOptions:n};if(!Tn(u,o)&&(r._setSettings(u),n.mockUserToken)){let f,p;if(typeof n.mockUserToken=="string")f=n.mockUserToken,p=Ve.MOCK_USER;else{f=tw(n.mockUserToken,(l=r._app)==null?void 0:l.options.projectId);const g=n.mockUserToken.sub||n.mockUserToken.user_id;if(!g)throw new C(S.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");p=new Ve(g)}r._authCredentials=new Xb(new Rg(f,p))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Ye=class My{constructor(e,t,n){this.converter=t,this._query=n,this.type="query",this.firestore=e}withConverter(e){return new My(this.firestore,e,this._query)}},ae=class hs{constructor(e,t,n){this.converter=t,this._key=n,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new En(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new hs(this.firestore,e,this._key)}toJSON(){return{type:hs._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,n){if(oo(t,hs._jsonSchema))return new hs(e,n||null,new x(Q.fromString(t.referencePath)))}};ae._jsonSchemaVersion="firestore/documentReference/1.0",ae._jsonSchema={type:Re("string",ae._jsonSchemaVersion),referencePath:Re("string")};let En=class Ly extends Ye{constructor(e,t,n){super(e,t,Ri(n)),this._path=n,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new ae(this.firestore,null,new x(e))}withConverter(e){return new Ly(this.firestore,e,this._path)}};function Fy(r,e,...t){if(r=z(r),Pl("collection","path",e),r instanceof yo){const n=Q.fromString(e,...t);return bf(n),new En(r,null,n)}{if(!(r instanceof ae||r instanceof En))throw new C(S.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const n=r._path.child(Q.fromString(e,...t));return bf(n),new En(r.firestore,null,n)}}function gC(r,e){if(r=Z(r,yo),Pl("collectionGroup","collection id",e),e.indexOf("/")>=0)throw new C(S.INVALID_ARGUMENT,`Invalid collection ID '${e}' passed to function collectionGroup(). Collection IDs must not contain '/'.`);return new Ye(r,null,function(n){return new Jt(Q.emptyPath(),n)}(e))}function ka(r,e,...t){if(r=z(r),arguments.length===1&&(e=Sl.newId()),Pl("doc","path",e),r instanceof yo){const n=Q.fromString(e,...t);return Af(n),new ae(r,null,new x(n))}{if(!(r instanceof ae||r instanceof En))throw new C(S.INVALID_ARGUMENT,"Expected first argument to doc() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const n=r._path.child(Q.fromString(e,...t));return Af(n),new ae(r.firestore,r instanceof En?r.converter:null,new x(n))}}function Uy(r,e){return r=z(r),e=z(e),(r instanceof ae||r instanceof En)&&(e instanceof ae||e instanceof En)&&r.firestore===e.firestore&&r.path===e.path&&r.converter===e.converter}function By(r,e){return r=z(r),e=z(e),r instanceof Ye&&e instanceof Ye&&r.firestore===e.firestore&&lo(r._query,e._query)&&r.converter===e.converter}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fp="AsyncQueue";class Up{constructor(e=Promise.resolve()){this.Xu=[],this.ec=!1,this.tc=[],this.nc=null,this.rc=!1,this.sc=!1,this.oc=[],this.M_=new rh(this,"async_queue_retry"),this._c=()=>{const n=sa();n&&V(Fp,"Visibility state changed to "+n.visibilityState),this.M_.w_()},this.ac=e;const t=sa();t&&typeof t.addEventListener=="function"&&t.addEventListener("visibilitychange",this._c)}get isShuttingDown(){return this.ec}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.uc(),this.cc(e)}enterRestrictedMode(e){if(!this.ec){this.ec=!0,this.sc=e||!1;const t=sa();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this._c)}}enqueue(e){if(this.uc(),this.ec)return new Promise(()=>{});const t=new Le;return this.cc(()=>this.ec&&this.sc?Promise.resolve():(e().then(t.resolve,t.reject),t.promise)).then(()=>t.promise)}enqueueRetryable(e){this.enqueueAndForget(()=>(this.Xu.push(e),this.lc()))}async lc(){if(this.Xu.length!==0){try{await this.Xu[0](),this.Xu.shift(),this.M_.reset()}catch(e){if(!Ln(e))throw e;V(Fp,"Operation failed with retryable error: "+e)}this.Xu.length>0&&this.M_.p_(()=>this.lc())}}cc(e){const t=this.ac.then(()=>(this.rc=!0,e().catch(n=>{throw this.nc=n,this.rc=!1,Ee("INTERNAL UNHANDLED ERROR: ",Bp(n)),n}).then(n=>(this.rc=!1,n))));return this.ac=t,t}enqueueAfterDelay(e,t,n){this.uc(),this.oc.indexOf(e)>-1&&(t=0);const i=ah.createAndSchedule(this,e,t,n,s=>this.hc(s));return this.tc.push(i),i}uc(){this.nc&&F(47125,{Pc:Bp(this.nc)})}verifyOperationInProgress(){}async Tc(){let e;do e=this.ac,await e;while(e!==this.ac)}Ic(e){for(const t of this.tc)if(t.timerId===e)return!0;return!1}Ec(e){return this.Tc().then(()=>{this.tc.sort((t,n)=>t.targetTimeMs-n.targetTimeMs);for(const t of this.tc)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.Tc()})}dc(e){this.oc.push(e)}hc(e){const t=this.tc.indexOf(e);this.tc.splice(t,1)}}function Bp(r){let e=r.message||"";return r.stack&&(e=r.stack.includes(r.message)?r.stack:r.message+`
`+r.stack),e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ju(r){return function(t,n){if(typeof t!="object"||t===null)return!1;const i=t;for(const s of n)if(s in i&&typeof i[s]=="function")return!0;return!1}(r,["next","error","complete"])}class _C{constructor(){this._progressObserver={},this._taskCompletionResolver=new Le,this._lastProgress={taskState:"Running",totalBytes:0,totalDocuments:0,bytesLoaded:0,documentsLoaded:0}}onProgress(e,t,n){this._progressObserver={next:e,error:t,complete:n}}catch(e){return this._taskCompletionResolver.promise.catch(e)}then(e,t){return this._taskCompletionResolver.promise.then(e,t)}_completeWith(e){this._updateProgress(e),this._progressObserver.complete&&this._progressObserver.complete(),this._taskCompletionResolver.resolve(e)}_failWith(e){this._lastProgress.taskState="Error",this._progressObserver.next&&this._progressObserver.next(this._lastProgress),this._progressObserver.error&&this._progressObserver.error(e),this._taskCompletionResolver.reject(e)}_updateProgress(e){this._lastProgress=e,this._progressObserver.next&&this._progressObserver.next(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yC=-1;let ve=class extends yo{constructor(e,t,n,i){super(e,t,n,i),this.type="firestore",this._queue=new Up,this._persistenceKey=(i==null?void 0:i.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const e=this._firestoreClient.terminate();this._queue=new Up(e),this._firestoreClient=void 0,await e}}};function je(r){if(r._terminated)throw new C(S.FAILED_PRECONDITION,"The client has already been terminated.");return r._firestoreClient||qy(r),r._firestoreClient}function qy(r){var n,i,s;const e=r._freezeSettings(),t=function(c,u,l,f){return new UR(c,u,l,f.host,f.ssl,f.experimentalForceLongPolling,f.experimentalAutoDetectLongPolling,Oy(f.experimentalLongPollingOptions),f.useFetchStreams,f.isUsingEmulator)}(r._databaseId,((n=r._app)==null?void 0:n.options.appId)||"",r._persistenceKey,e);r._componentsProvider||(i=e.localCache)!=null&&i._offlineComponentProvider&&((s=e.localCache)!=null&&s._onlineComponentProvider)&&(r._componentsProvider={_offline:e.localCache._offlineComponentProvider,_online:e.localCache._onlineComponentProvider}),r._firestoreClient=new oC(r._authCredentials,r._appCheckCredentials,r._queue,t,r._componentsProvider&&function(c){const u=c==null?void 0:c._online.build();return{_offline:c==null?void 0:c._offline.build(u),_online:u}}(r._componentsProvider))}function IC(r,e){Ut("enableIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const t=r._freezeSettings();return $y(r,Hs.provider,{build:n=>new Cy(n,t.cacheSizeBytes,e==null?void 0:e.forceOwnership)}),Promise.resolve()}async function wC(r){Ut("enableMultiTabIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const e=r._freezeSettings();$y(r,Hs.provider,{build:t=>new nC(t,e.cacheSizeBytes)})}function $y(r,e,t){if((r=Z(r,ve))._firestoreClient||r._terminated)throw new C(S.FAILED_PRECONDITION,"Firestore has already been started and persistence can no longer be enabled. You can only enable persistence before calling any other methods on a Firestore object.");if(r._componentsProvider||r._getSettings().localCache)throw new C(S.FAILED_PRECONDITION,"SDK cache is already specified.");r._componentsProvider={_online:e,_offline:t},qy(r)}function EC(r){if(r._initialized&&!r._terminated)throw new C(S.FAILED_PRECONDITION,"Persistence can only be cleared before a Firestore instance is initialized or after it is terminated.");const e=new Le;return r._queue.enqueueAndForgetEvenWhileRestricted(async()=>{try{await async function(n){if(!Ot.v())return Promise.resolve();const i=n+ty;await Ot.delete(i)}(Zl(r._databaseId,r._persistenceKey)),e.resolve()}catch(t){e.reject(t)}}),e.promise}function TC(r){return function(t){const n=new Le;return t.asyncQueue.enqueueAndForget(async()=>zP(await Ih(t),n)),n.promise}(je(r=Z(r,ve)))}function vC(r){return cC(je(r=Z(r,ve)))}function AC(r){return uC(je(r=Z(r,ve)))}function bC(r,e){const t=je(r=Z(r,ve)),n=new _C;return fC(t,r._databaseId,e,n),n}function RC(r,e){return pC(je(r=Z(r,ve)),e).then(t=>t?new Ye(r,null,t.query):null)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $e{constructor(e){this._byteString=e}static fromBase64String(e){try{return new $e(ye.fromBase64String(e))}catch(t){throw new C(S.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new $e(ye.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:$e._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(oo(e,$e._jsonSchema))return $e.fromBase64String(e.bytes)}}$e._jsonSchemaVersion="firestore/bytes/1.0",$e._jsonSchema={type:Re("string",$e._jsonSchemaVersion),bytes:Re("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Vn=class{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new C(S.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new fe(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Ar=class{constructor(e){this._methodName=e}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wt{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new C(S.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new C(S.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return G(this._lat,e._lat)||G(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:wt._jsonSchemaVersion}}static fromJSON(e){if(oo(e,wt._jsonSchema))return new wt(e.latitude,e.longitude)}}wt._jsonSchemaVersion="firestore/geoPoint/1.0",wt._jsonSchema={type:Re("string",wt._jsonSchemaVersion),latitude:Re("number"),longitude:Re("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mt{constructor(e){this._values=(e||[]).map(t=>t)}toArray(){return this._values.map(e=>e)}isEqual(e){return function(n,i){if(n.length!==i.length)return!1;for(let s=0;s<n.length;++s)if(n[s]!==i[s])return!1;return!0}(this._values,e._values)}toJSON(){return{type:Mt._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(oo(e,Mt._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every(t=>typeof t=="number"))return new Mt(e.vectorValues);throw new C(S.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}Mt._jsonSchemaVersion="firestore/vectorValue/1.0",Mt._jsonSchema={type:Re("string",Mt._jsonSchemaVersion),vectorValues:Re("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const SC=/^__.*__$/;class PC{constructor(e,t,n){this.data=e,this.fieldMask=t,this.fieldTransforms=n}toMutation(e,t){return this.fieldMask!==null?new Xt(e,this.data,this.fieldMask,t,this.fieldTransforms):new Si(e,this.data,t,this.fieldTransforms)}}class zy{constructor(e,t,n){this.data=e,this.fieldMask=t,this.fieldTransforms=n}toMutation(e,t){return new Xt(e,this.data,this.fieldMask,t,this.fieldTransforms)}}function jy(r){switch(r){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw F(40011,{Ac:r})}}class cc{constructor(e,t,n,i,s,o){this.settings=e,this.databaseId=t,this.serializer=n,this.ignoreUndefinedProperties=i,s===void 0&&this.Rc(),this.fieldTransforms=s||[],this.fieldMask=o||[]}get path(){return this.settings.path}get Ac(){return this.settings.Ac}Vc(e){return new cc({...this.settings,...e},this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}mc(e){var i;const t=(i=this.path)==null?void 0:i.child(e),n=this.Vc({path:t,fc:!1});return n.gc(e),n}yc(e){var i;const t=(i=this.path)==null?void 0:i.child(e),n=this.Vc({path:t,fc:!1});return n.Rc(),n}wc(e){return this.Vc({path:void 0,fc:!0})}Sc(e){return Da(e,this.settings.methodName,this.settings.bc||!1,this.path,this.settings.Dc)}contains(e){return this.fieldMask.find(t=>e.isPrefixOf(t))!==void 0||this.fieldTransforms.find(t=>e.isPrefixOf(t.field))!==void 0}Rc(){if(this.path)for(let e=0;e<this.path.length;e++)this.gc(this.path.get(e))}gc(e){if(e.length===0)throw this.Sc("Document fields must not be empty");if(jy(this.Ac)&&SC.test(e))throw this.Sc('Document fields cannot begin and end with "__"')}}class CC{constructor(e,t,n){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=n||go(e)}Cc(e,t,n,i=!1){return new cc({Ac:e,methodName:t,Dc:n,path:fe.emptyPath(),fc:!1,bc:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function br(r){const e=r._freezeSettings(),t=go(r._databaseId);return new CC(r._databaseId,!!e.ignoreUndefinedProperties,t)}function uc(r,e,t,n,i,s={}){const o=r.Cc(s.merge||s.mergeFields?2:0,e,t,i);Rh("Data must be an object, but it was:",o,n);const c=Ky(n,o);let u,l;if(s.merge)u=new tt(o.fieldMask),l=o.fieldTransforms;else if(s.mergeFields){const f=[];for(const p of s.mergeFields){const g=Gu(e,p,t);if(!o.contains(g))throw new C(S.INVALID_ARGUMENT,`Field '${g}' is specified in your field mask but missing from your input data.`);Qy(f,g)||f.push(g)}u=new tt(f),l=o.fieldTransforms.filter(p=>u.covers(p.field))}else u=null,l=o.fieldTransforms;return new PC(new Me(c),u,l)}class Io extends Ar{_toFieldTransform(e){if(e.Ac!==2)throw e.Ac===1?e.Sc(`${this._methodName}() can only appear at the top level of your update data`):e.Sc(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof Io}}function Gy(r,e,t){return new cc({Ac:3,Dc:e.settings.Dc,methodName:r._methodName,fc:t},e.databaseId,e.serializer,e.ignoreUndefinedProperties)}class wh extends Ar{_toFieldTransform(e){return new fo(e.path,new li)}isEqual(e){return e instanceof wh}}class Eh extends Ar{constructor(e,t){super(e),this.vc=t}_toFieldTransform(e){const t=Gy(this,e,!0),n=this.vc.map(s=>Rr(s,t)),i=new mr(n);return new fo(e.path,i)}isEqual(e){return e instanceof Eh&&Tn(this.vc,e.vc)}}class Th extends Ar{constructor(e,t){super(e),this.vc=t}_toFieldTransform(e){const t=Gy(this,e,!0),n=this.vc.map(s=>Rr(s,t)),i=new gr(n);return new fo(e.path,i)}isEqual(e){return e instanceof Th&&Tn(this.vc,e.vc)}}class vh extends Ar{constructor(e,t){super(e),this.Fc=t}_toFieldTransform(e){const t=new hi(e.serializer,y_(e.serializer,this.Fc));return new fo(e.path,t)}isEqual(e){return e instanceof vh&&this.Fc===e.Fc}}function Ah(r,e,t,n){const i=r.Cc(1,e,t);Rh("Data must be an object, but it was:",i,n);const s=[],o=Me.empty();Fn(n,(u,l)=>{const f=Sh(e,u,t);l=z(l);const p=i.yc(f);if(l instanceof Io)s.push(f);else{const g=Rr(l,p);g!=null&&(s.push(f),o.set(f,g))}});const c=new tt(s);return new zy(o,c,i.fieldTransforms)}function bh(r,e,t,n,i,s){const o=r.Cc(1,e,t),c=[Gu(e,n,t)],u=[i];if(s.length%2!=0)throw new C(S.INVALID_ARGUMENT,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let g=0;g<s.length;g+=2)c.push(Gu(e,s[g])),u.push(s[g+1]);const l=[],f=Me.empty();for(let g=c.length-1;g>=0;--g)if(!Qy(l,c[g])){const v=c[g];let k=u[g];k=z(k);const D=o.yc(v);if(k instanceof Io)l.push(v);else{const N=Rr(k,D);N!=null&&(l.push(v),f.set(v,N))}}const p=new tt(l);return new zy(f,p,o.fieldTransforms)}function Wy(r,e,t,n=!1){return Rr(t,r.Cc(n?4:3,e))}function Rr(r,e){if(Hy(r=z(r)))return Rh("Unsupported field value:",e,r),Ky(r,e);if(r instanceof Ar)return function(n,i){if(!jy(i.Ac))throw i.Sc(`${n._methodName}() can only be used with update() and set()`);if(!i.path)throw i.Sc(`${n._methodName}() is not currently supported inside arrays`);const s=n._toFieldTransform(i);s&&i.fieldTransforms.push(s)}(r,e),null;if(r===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),r instanceof Array){if(e.settings.fc&&e.Ac!==4)throw e.Sc("Nested arrays are not supported");return function(n,i){const s=[];let o=0;for(const c of n){let u=Rr(c,i.wc(o));u==null&&(u={nullValue:"NULL_VALUE"}),s.push(u),o++}return{arrayValue:{values:s}}}(r,e)}return function(n,i){if((n=z(n))===null)return{nullValue:"NULL_VALUE"};if(typeof n=="number")return y_(i.serializer,n);if(typeof n=="boolean")return{booleanValue:n};if(typeof n=="string")return{stringValue:n};if(n instanceof Date){const s=ne.fromDate(n);return{timestampValue:di(i.serializer,s)}}if(n instanceof ne){const s=new ne(n.seconds,1e3*Math.floor(n.nanoseconds/1e3));return{timestampValue:di(i.serializer,s)}}if(n instanceof wt)return{geoPointValue:{latitude:n.latitude,longitude:n.longitude}};if(n instanceof $e)return{bytesValue:k_(i.serializer,n._byteString)};if(n instanceof ae){const s=i.databaseId,o=n.firestore._databaseId;if(!o.isEqual(s))throw i.Sc(`Document reference is for database ${o.projectId}/${o.database} but should be for database ${s.projectId}/${s.database}`);return{referenceValue:Wl(n.firestore._databaseId||i.databaseId,n._key.path)}}if(n instanceof Mt)return function(o,c){return{mapValue:{fields:{[xl]:{stringValue:Ml},[ai]:{arrayValue:{values:o.toArray().map(l=>{if(typeof l!="number")throw c.Sc("VectorValues must only contain numeric values.");return Bl(c.serializer,l)})}}}}}}(n,i);throw i.Sc(`Unsupported field value: ${Ga(n)}`)}(r,e)}function Ky(r,e){const t={};return Kg(r)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):Fn(r,(n,i)=>{const s=Rr(i,e.mc(n));s!=null&&(t[n]=s)}),{mapValue:{fields:t}}}function Hy(r){return!(typeof r!="object"||r===null||r instanceof Array||r instanceof Date||r instanceof ne||r instanceof wt||r instanceof $e||r instanceof ae||r instanceof Ar||r instanceof Mt)}function Rh(r,e,t){if(!Hy(t)||!Cg(t)){const n=Ga(t);throw n==="an object"?e.Sc(r+" a custom object"):e.Sc(r+" "+n)}}function Gu(r,e,t){if((e=z(e))instanceof Vn)return e._internalPath;if(typeof e=="string")return Sh(r,e);throw Da("Field path arguments must be of type string or ",r,!1,void 0,t)}const kC=new RegExp("[~\\*/\\[\\]]");function Sh(r,e,t){if(e.search(kC)>=0)throw Da(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,r,!1,void 0,t);try{return new Vn(...e.split("."))._internalPath}catch{throw Da(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,r,!1,void 0,t)}}function Da(r,e,t,n,i){const s=n&&!n.isEmpty(),o=i!==void 0;let c=`Function ${e}() called with invalid data`;t&&(c+=" (via `toFirestore()`)"),c+=". ";let u="";return(s||o)&&(u+=" (found",s&&(u+=` in field ${n}`),o&&(u+=` in document ${i}`),u+=")"),new C(S.INVALID_ARGUMENT,c+r+u)}function Qy(r,e){return r.some(t=>t.isEqual(e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qs{constructor(e,t,n,i,s){this._firestore=e,this._userDataWriter=t,this._key=n,this._document=i,this._converter=s}get id(){return this._key.path.lastSegment()}get ref(){return new ae(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new DC(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}get(e){if(this._document){const t=this._document.data.field(lc("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class DC extends Qs{data(){return super.data()}}function lc(r,e){return typeof e=="string"?Sh(r,e):e instanceof Vn?e._internalPath:e._delegate._internalPath}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Jy(r){if(r.limitType==="L"&&r.explicitOrderBy.length===0)throw new C(S.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class Ph{}class wo extends Ph{}function dn(r,e,...t){let n=[];e instanceof Ph&&n.push(e),n=n.concat(t),function(s){const o=s.filter(u=>u instanceof Ch).length,c=s.filter(u=>u instanceof hc).length;if(o>1||o>0&&c>0)throw new C(S.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")}(n);for(const i of n)r=i._apply(r);return r}class hc extends wo{constructor(e,t,n){super(),this._field=e,this._op=t,this._value=n,this.type="where"}static _create(e,t,n){return new hc(e,t,n)}_apply(e){const t=this._parse(e);return Xy(e._query,t),new Ye(e.firestore,e.converter,Du(e._query,t))}_parse(e){const t=br(e.firestore);return function(s,o,c,u,l,f,p){let g;if(l.isKeyField()){if(f==="array-contains"||f==="array-contains-any")throw new C(S.INVALID_ARGUMENT,`Invalid Query. You can't perform '${f}' queries on documentId().`);if(f==="in"||f==="not-in"){$p(p,f);const k=[];for(const D of p)k.push(qp(u,s,D));g={arrayValue:{values:k}}}else g=qp(u,s,p)}else f!=="in"&&f!=="not-in"&&f!=="array-contains-any"||$p(p,f),g=Wy(c,o,p,f==="in"||f==="not-in");return J.create(l,f,g)}(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}}function NC(r,e,t){const n=e,i=lc("where",r);return hc._create(i,n,t)}class Ch extends Ph{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new Ch(e,t)}_parse(e){const t=this._queryConstraints.map(n=>n._parse(e)).filter(n=>n.getFilters().length>0);return t.length===1?t[0]:re.create(t,this._getOperator())}_apply(e){const t=this._parse(e);return t.getFilters().length===0?e:(function(i,s){let o=i;const c=s.getFlattenedFilters();for(const u of c)Xy(o,u),o=Du(o,u)}(e._query,t),new Ye(e.firestore,e.converter,Du(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class kh extends wo{constructor(e,t){super(),this._field=e,this._direction=t,this.type="orderBy"}static _create(e,t){return new kh(e,t)}_apply(e){const t=function(i,s,o){if(i.startAt!==null)throw new C(S.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(i.endAt!==null)throw new C(S.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new js(s,o)}(e._query,this._field,this._direction);return new Ye(e.firestore,e.converter,function(i,s){const o=i.explicitOrderBy.concat([s]);return new Jt(i.path,i.collectionGroup,o,i.filters.slice(),i.limit,i.limitType,i.startAt,i.endAt)}(e._query,t))}}function VC(r,e="asc"){const t=e,n=lc("orderBy",r);return kh._create(n,t)}class dc extends wo{constructor(e,t,n){super(),this.type=e,this._limit=t,this._limitType=n}static _create(e,t,n){return new dc(e,t,n)}_apply(e){return new Ye(e.firestore,e.converter,Ea(e._query,this._limit,this._limitType))}}function OC(r){return kg("limit",r),dc._create("limit",r,"F")}function xC(r){return kg("limitToLast",r),dc._create("limitToLast",r,"L")}class fc extends wo{constructor(e,t,n){super(),this.type=e,this._docOrFields=t,this._inclusive=n}static _create(e,t,n){return new fc(e,t,n)}_apply(e){const t=Yy(e,this.type,this._docOrFields,this._inclusive);return new Ye(e.firestore,e.converter,function(i,s){return new Jt(i.path,i.collectionGroup,i.explicitOrderBy.slice(),i.filters.slice(),i.limit,i.limitType,s,i.endAt)}(e._query,t))}}function MC(...r){return fc._create("startAt",r,!0)}function LC(...r){return fc._create("startAfter",r,!1)}class pc extends wo{constructor(e,t,n){super(),this.type=e,this._docOrFields=t,this._inclusive=n}static _create(e,t,n){return new pc(e,t,n)}_apply(e){const t=Yy(e,this.type,this._docOrFields,this._inclusive);return new Ye(e.firestore,e.converter,function(i,s){return new Jt(i.path,i.collectionGroup,i.explicitOrderBy.slice(),i.filters.slice(),i.limit,i.limitType,i.startAt,s)}(e._query,t))}}function FC(...r){return pc._create("endBefore",r,!1)}function UC(...r){return pc._create("endAt",r,!0)}function Yy(r,e,t,n){if(t[0]=z(t[0]),t[0]instanceof Qs)return function(s,o,c,u,l){if(!u)throw new C(S.NOT_FOUND,`Can't use a DocumentSnapshot that doesn't exist for ${c}().`);const f=[];for(const p of Qr(s))if(p.field.isKeyField())f.push(fr(o,u.key));else{const g=u.data.field(p.field);if(Ja(g))throw new C(S.INVALID_ARGUMENT,'Invalid query. You are trying to start or end a query using a document for which the field "'+p.field+'" is an uncommitted server timestamp. (Since the value of this field is unknown, you cannot start/end a query with it.)');if(g===null){const v=p.field.canonicalString();throw new C(S.INVALID_ARGUMENT,`Invalid query. You are trying to start or end a query using a document for which the field '${v}' (used as the orderBy) does not exist.`)}f.push(g)}return new kn(f,l)}(r._query,r.firestore._databaseId,e,t[0]._document,n);{const i=br(r.firestore);return function(o,c,u,l,f,p){const g=o.explicitOrderBy;if(f.length>g.length)throw new C(S.INVALID_ARGUMENT,`Too many arguments provided to ${l}(). The number of arguments must be less than or equal to the number of orderBy() clauses`);const v=[];for(let k=0;k<f.length;k++){const D=f[k];if(g[k].field.isKeyField()){if(typeof D!="string")throw new C(S.INVALID_ARGUMENT,`Invalid query. Expected a string for document ID in ${l}(), but got a ${typeof D}`);if(!Fl(o)&&D.indexOf("/")!==-1)throw new C(S.INVALID_ARGUMENT,`Invalid query. When querying a collection and ordering by documentId(), the value passed to ${l}() must be a plain document ID, but '${D}' contains a slash.`);const N=o.path.child(Q.fromString(D));if(!x.isDocumentKey(N))throw new C(S.INVALID_ARGUMENT,`Invalid query. When querying a collection group and ordering by documentId(), the value passed to ${l}() must result in a valid document path, but '${N}' is not because it contains an odd number of segments.`);const q=new x(N);v.push(fr(c,q))}else{const N=Wy(u,l,D);v.push(N)}}return new kn(v,p)}(r._query,r.firestore._databaseId,i,e,t,n)}}function qp(r,e,t){if(typeof(t=z(t))=="string"){if(t==="")throw new C(S.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!Fl(e)&&t.indexOf("/")!==-1)throw new C(S.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);const n=e.path.child(Q.fromString(t));if(!x.isDocumentKey(n))throw new C(S.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${n}' is not because it has an odd number of segments (${n.length}).`);return fr(r,new x(n))}if(t instanceof ae)return fr(r,t._key);throw new C(S.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${Ga(t)}.`)}function $p(r,e){if(!Array.isArray(r)||r.length===0)throw new C(S.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function Xy(r,e){const t=function(i,s){for(const o of i)for(const c of o.getFlattenedFilters())if(s.indexOf(c.op)>=0)return c.op;return null}(r.filters,function(i){switch(i){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}}(e.op));if(t!==null)throw t===e.op?new C(S.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new C(S.INVALID_ARGUMENT,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}class Dh{convertValue(e,t="none"){switch(Pn(e)){case 0:return null;case 1:return e.booleanValue;case 2:return he(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(Kt(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw F(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const n={};return Fn(e,(i,s)=>{n[i]=this.convertValue(s,t)}),n}convertVectorValue(e){var n,i,s;const t=(s=(i=(n=e.fields)==null?void 0:n[ai].arrayValue)==null?void 0:i.values)==null?void 0:s.map(o=>he(o.doubleValue));return new Mt(t)}convertGeoPoint(e){return new wt(he(e.latitude),he(e.longitude))}convertArray(e,t){return(e.values||[]).map(n=>this.convertValue(n,t))}convertServerTimestamp(e,t){switch(t){case"previous":const n=Ya(e);return n==null?null:this.convertValue(n,t);case"estimate":return this.convertTimestamp(qs(e));default:return null}}convertTimestamp(e){const t=Wt(e);return new ne(t.seconds,t.nanos)}convertDocumentKey(e,t){const n=Q.fromString(e);U(q_(n),9688,{name:e});const i=new Sn(n.get(1),n.get(3)),s=new x(n.popFirst(5));return i.isEqual(t)||Ee(`Document ${s} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),s}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mc(r,e,t){let n;return n=r?t&&(t.merge||t.mergeFields)?r.toFirestore(e,t):r.toFirestore(e):e,n}class BC extends Dh{constructor(e){super(),this.firestore=e}convertBytes(e){return new $e(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new ae(this.firestore,null,t)}}class ir{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}let dt=class Zy extends Qs{constructor(e,t,n,i,s,o){super(e,t,n,i,o),this._firestore=e,this._firestoreImpl=e,this.metadata=s}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const t=new Rs(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){const n=this._document.data.field(lc("DocumentSnapshot.get",e));if(n!==null)return this._userDataWriter.convertValue(n,t.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new C(S.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e=this._document,t={};return t.type=Zy._jsonSchemaVersion,t.bundle="",t.bundleSource="DocumentSnapshot",t.bundleName=this._key.toString(),!e||!e.isValidDocument()||!e.isFoundDocument()?t:(this._userDataWriter.convertObjectMap(e.data.value.mapValue.fields,"previous"),t.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),t)}};dt._jsonSchemaVersion="firestore/documentSnapshot/1.0",dt._jsonSchema={type:Re("string",dt._jsonSchemaVersion),bundleSource:Re("string","DocumentSnapshot"),bundleName:Re("string"),bundle:Re("string")};let Rs=class extends dt{data(e={}){return super.data(e)}},Et=class eI{constructor(e,t,n,i){this._firestore=e,this._userDataWriter=t,this._snapshot=i,this.metadata=new ir(i.hasPendingWrites,i.fromCache),this.query=n}get docs(){const e=[];return this.forEach(t=>e.push(t)),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach(n=>{e.call(t,new Rs(this._firestore,this._userDataWriter,n.key,n,new ir(this._snapshot.mutatedKeys.has(n.key),this._snapshot.fromCache),this.query.converter))})}docChanges(e={}){const t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new C(S.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=function(i,s){if(i._snapshot.oldDocs.isEmpty()){let o=0;return i._snapshot.docChanges.map(c=>{const u=new Rs(i._firestore,i._userDataWriter,c.doc.key,c.doc,new ir(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);return c.doc,{type:"added",doc:u,oldIndex:-1,newIndex:o++}})}{let o=i._snapshot.oldDocs;return i._snapshot.docChanges.filter(c=>s||c.type!==3).map(c=>{const u=new Rs(i._firestore,i._userDataWriter,c.doc.key,c.doc,new ir(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);let l=-1,f=-1;return c.type!==0&&(l=o.indexOf(c.doc.key),o=o.delete(c.doc.key)),c.type!==1&&(o=o.add(c.doc),f=o.indexOf(c.doc.key)),{type:qC(c.type),doc:u,oldIndex:l,newIndex:f}})}}(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new C(S.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e={};e.type=eI._jsonSchemaVersion,e.bundleSource="QuerySnapshot",e.bundleName=Sl.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const t=[],n=[],i=[];return this.docs.forEach(s=>{s._document!==null&&(t.push(s._document),n.push(this._userDataWriter.convertObjectMap(s._document.data.value.mapValue.fields,"previous")),i.push(s.ref.path))}),e.bundle=(this._firestore,this.query._query,e.bundleName,"NOT SUPPORTED"),e}};function qC(r){switch(r){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return F(61501,{type:r})}}function tI(r,e){return r instanceof dt&&e instanceof dt?r._firestore===e._firestore&&r._key.isEqual(e._key)&&(r._document===null?e._document===null:r._document.isEqual(e._document))&&r._converter===e._converter:r instanceof Et&&e instanceof Et&&r._firestore===e._firestore&&By(r.query,e.query)&&r.metadata.isEqual(e.metadata)&&r._snapshot.isEqual(e._snapshot)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $C(r){r=Z(r,ae);const e=Z(r.firestore,ve);return Ny(je(e),r._key).then(t=>Nh(e,r,t))}Et._jsonSchemaVersion="firestore/querySnapshot/1.0",Et._jsonSchema={type:Re("string",Et._jsonSchemaVersion),bundleSource:Re("string","QuerySnapshot"),bundleName:Re("string"),bundle:Re("string")};class Sr extends Dh{constructor(e){super(),this.firestore=e}convertBytes(e){return new $e(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new ae(this.firestore,null,t)}}function zC(r){r=Z(r,ae);const e=Z(r.firestore,ve),t=je(e),n=new Sr(e);return lC(t,r._key).then(i=>new dt(e,n,r._key,i,new ir(i!==null&&i.hasLocalMutations,!0),r.converter))}function jC(r){r=Z(r,ae);const e=Z(r.firestore,ve);return Ny(je(e),r._key,{source:"server"}).then(t=>Nh(e,r,t))}function GC(r){r=Z(r,Ye);const e=Z(r.firestore,ve),t=je(e),n=new Sr(e);return Jy(r._query),Vy(t,r._query).then(i=>new Et(e,n,r,i))}function WC(r){r=Z(r,Ye);const e=Z(r.firestore,ve),t=je(e),n=new Sr(e);return hC(t,r._query).then(i=>new Et(e,n,r,i))}function KC(r){r=Z(r,Ye);const e=Z(r.firestore,ve),t=je(e),n=new Sr(e);return Vy(t,r._query,{source:"server"}).then(i=>new Et(e,n,r,i))}function zp(r,e,t){r=Z(r,ae);const n=Z(r.firestore,ve),i=mc(r.converter,e,t);return Eo(n,[uc(br(n),"setDoc",r._key,i,r.converter!==null,t).toMutation(r._key,pe.none())])}function jp(r,e,t,...n){r=Z(r,ae);const i=Z(r.firestore,ve),s=br(i);let o;return o=typeof(e=z(e))=="string"||e instanceof Vn?bh(s,"updateDoc",r._key,e,t,n):Ah(s,"updateDoc",r._key,e),Eo(i,[o.toMutation(r._key,pe.exists(!0))])}function HC(r){return Eo(Z(r.firestore,ve),[new Pi(r._key,pe.none())])}function QC(r,e){const t=Z(r.firestore,ve),n=ka(r),i=mc(r.converter,e);return Eo(t,[uc(br(r.firestore),"addDoc",n._key,i,r.converter!==null,{}).toMutation(n._key,pe.exists(!1))]).then(()=>n)}function nI(r,...e){var u,l,f;r=z(r);let t={includeMetadataChanges:!1,source:"default"},n=0;typeof e[n]!="object"||ju(e[n])||(t=e[n++]);const i={includeMetadataChanges:t.includeMetadataChanges,source:t.source};if(ju(e[n])){const p=e[n];e[n]=(u=p.next)==null?void 0:u.bind(p),e[n+1]=(l=p.error)==null?void 0:l.bind(p),e[n+2]=(f=p.complete)==null?void 0:f.bind(p)}let s,o,c;if(r instanceof ae)o=Z(r.firestore,ve),c=Ri(r._key.path),s={next:p=>{e[n]&&e[n](Nh(o,r,p))},error:e[n+1],complete:e[n+2]};else{const p=Z(r,Ye);o=Z(p.firestore,ve),c=p._query;const g=new Sr(o);s={next:v=>{e[n]&&e[n](new Et(o,g,p,v))},error:e[n+1],complete:e[n+2]},Jy(r._query)}return function(g,v,k,D){const N=new oc(D),q=new hh(v,N,k);return g.asyncQueue.enqueueAndForget(async()=>ch(await yi(g),q)),()=>{N.Nu(),g.asyncQueue.enqueueAndForget(async()=>uh(await yi(g),q))}}(je(o),c,i,s)}function JC(r,e){return dC(je(r=Z(r,ve)),ju(e)?e:{next:e})}function Eo(r,e){return function(n,i){const s=new Le;return n.asyncQueue.enqueueAndForget(async()=>UP(await Ih(n),i,s)),s.promise}(je(r),e)}function Nh(r,e,t){const n=t.docs.get(e._key),i=new Sr(r);return new dt(r,i,e._key,n,new ir(t.hasPendingWrites,t.fromCache),e.converter)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const YC={maxAttempts:5};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let XC=class{constructor(e,t){this._firestore=e,this._commitHandler=t,this._mutations=[],this._committed=!1,this._dataReader=br(e)}set(e,t,n){this._verifyNotCommitted();const i=gn(e,this._firestore),s=mc(i.converter,t,n),o=uc(this._dataReader,"WriteBatch.set",i._key,s,i.converter!==null,n);return this._mutations.push(o.toMutation(i._key,pe.none())),this}update(e,t,n,...i){this._verifyNotCommitted();const s=gn(e,this._firestore);let o;return o=typeof(t=z(t))=="string"||t instanceof Vn?bh(this._dataReader,"WriteBatch.update",s._key,t,n,i):Ah(this._dataReader,"WriteBatch.update",s._key,t),this._mutations.push(o.toMutation(s._key,pe.exists(!0))),this}delete(e){this._verifyNotCommitted();const t=gn(e,this._firestore);return this._mutations=this._mutations.concat(new Pi(t._key,pe.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new C(S.FAILED_PRECONDITION,"A write batch can no longer be used after commit() has been called.")}};function gn(r,e){if((r=z(r)).firestore!==e)throw new C(S.INVALID_ARGUMENT,"Provided document reference is from a different Firestore instance.");return r}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ZC{constructor(e,t){this._firestore=e,this._transaction=t,this._dataReader=br(e)}get(e){const t=gn(e,this._firestore),n=new BC(this._firestore);return this._transaction.lookup([t._key]).then(i=>{if(!i||i.length!==1)return F(24041);const s=i[0];if(s.isFoundDocument())return new Qs(this._firestore,n,s.key,s,t.converter);if(s.isNoDocument())return new Qs(this._firestore,n,t._key,null,t.converter);throw F(18433,{doc:s})})}set(e,t,n){const i=gn(e,this._firestore),s=mc(i.converter,t,n),o=uc(this._dataReader,"Transaction.set",i._key,s,i.converter!==null,n);return this._transaction.set(i._key,o),this}update(e,t,n,...i){const s=gn(e,this._firestore);let o;return o=typeof(t=z(t))=="string"||t instanceof Vn?bh(this._dataReader,"Transaction.update",s._key,t,n,i):Ah(this._dataReader,"Transaction.update",s._key,t),this._transaction.update(s._key,o),this}delete(e){const t=gn(e,this._firestore);return this._transaction.delete(t._key),this}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let ek=class extends ZC{constructor(e,t){super(e,t),this._firestore=e}get(e){const t=gn(e,this._firestore),n=new Sr(this._firestore);return super.get(e).then(i=>new dt(this._firestore,n,t._key,i._document,new ir(!1,!1),t.converter))}};function tk(r,e,t){r=Z(r,ve);const n={...YC,...t};return function(s){if(s.maxAttempts<1)throw new C(S.INVALID_ARGUMENT,"Max attempts must be at least 1")}(n),function(s,o,c){const u=new Le;return s.asyncQueue.enqueueAndForget(async()=>{const l=await aC(s);new sC(s.asyncQueue,l,c,o,u).ju()}),u.promise}(je(r),i=>e(new ek(r,i)),n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nk(){return new Io("deleteField")}function rk(){return new wh("serverTimestamp")}function ik(...r){return new Eh("arrayUnion",r)}function sk(...r){return new Th("arrayRemove",r)}function ok(r){return new vh("increment",r)}(function(e,t=!0){(function(i){bi=i})(On),bn(new Lt("firestore",(n,{instanceIdentifier:i,options:s})=>{const o=n.getProvider("app").getImmediate(),c=new ve(new Zb(n.getProvider("auth-internal")),new nR(o,n.getProvider("app-check-internal")),function(l,f){if(!Object.prototype.hasOwnProperty.apply(l.options,["projectId"]))throw new C(S.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new Sn(l.options.projectId,f)}(o,i),o);return s={useFetchStreams:t,...s},c._setSettings(s),c},"PUBLIC").setMultipleInstances(!0)),It(wf,Ef,e),It(wf,Ef,"esm2020")})();const ak="@firebase/firestore-compat",ck="0.4.3";/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Vh(r,e){if(e===void 0)return{merge:!1};if(e.mergeFields!==void 0&&e.merge!==void 0)throw new C("invalid-argument",`Invalid options passed to function ${r}(): You cannot specify both "merge" and "mergeFields".`);return e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Gp(){if(typeof Uint8Array>"u")throw new C("unimplemented","Uint8Arrays are not available in this environment.")}function Wp(){if(!LR())throw new C("unimplemented","Blobs are unavailable in Firestore in this environment.")}class Js{constructor(e){this._delegate=e}static fromBase64String(e){return Wp(),new Js($e.fromBase64String(e))}static fromUint8Array(e){return Gp(),new Js($e.fromUint8Array(e))}toBase64(){return Wp(),this._delegate.toBase64()}toUint8Array(){return Gp(),this._delegate.toUint8Array()}isEqual(e){return this._delegate.isEqual(e._delegate)}toString(){return"Blob(base64: "+this.toBase64()+")"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Wu(r){return uk(r,["next","error","complete"])}function uk(r,e){if(typeof r!="object"||r===null)return!1;const t=r;for(const n of e)if(n in t&&typeof t[n]=="function")return!0;return!1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lk{enableIndexedDbPersistence(e,t){return IC(e._delegate,{forceOwnership:t})}enableMultiTabIndexedDbPersistence(e){return wC(e._delegate)}clearIndexedDbPersistence(e){return EC(e._delegate)}}class rI{constructor(e,t,n){this._delegate=t,this._persistenceProvider=n,this.INTERNAL={delete:()=>this.terminate()},e instanceof Sn||(this._appCompat=e)}get _databaseId(){return this._delegate._databaseId}settings(e){const t=this._delegate._getSettings();!e.merge&&t.host!==e.host&&Ut("You are overriding the original host. If you did not intend to override your settings, use {merge: true}."),e.merge&&(e={...t,...e},delete e.merge),this._delegate._setSettings(e)}useEmulator(e,t,n={}){mC(this._delegate,e,t,n)}enableNetwork(){return vC(this._delegate)}disableNetwork(){return AC(this._delegate)}enablePersistence(e){let t=!1,n=!1;return e&&(t=!!e.synchronizeTabs,n=!!e.experimentalForceOwningTab,Pg("synchronizeTabs",t,"experimentalForceOwningTab",n)),t?this._persistenceProvider.enableMultiTabIndexedDbPersistence(this):this._persistenceProvider.enableIndexedDbPersistence(this,n)}clearPersistence(){return this._persistenceProvider.clearIndexedDbPersistence(this)}terminate(){return this._appCompat&&(this._appCompat._removeServiceInstance("firestore-compat"),this._appCompat._removeServiceInstance("firestore")),this._delegate._delete()}waitForPendingWrites(){return TC(this._delegate)}onSnapshotsInSync(e){return JC(this._delegate,e)}get app(){if(!this._appCompat)throw new C("failed-precondition","Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._appCompat}collection(e){try{return new Ii(this,Fy(this._delegate,e))}catch(t){throw He(t,"collection()","Firestore.collection()")}}doc(e){try{return new ht(this,ka(this._delegate,e))}catch(t){throw He(t,"doc()","Firestore.doc()")}}collectionGroup(e){try{return new Ke(this,gC(this._delegate,e))}catch(t){throw He(t,"collectionGroup()","Firestore.collectionGroup()")}}runTransaction(e){return tk(this._delegate,t=>e(new iI(this,t)))}batch(){return je(this._delegate),new sI(new XC(this._delegate,e=>Eo(this._delegate,e)))}loadBundle(e){return bC(this._delegate,e)}namedQuery(e){return RC(this._delegate,e).then(t=>t?new Ke(this,t):null)}}class gc extends Dh{constructor(e){super(),this.firestore=e}convertBytes(e){return new Js(new $e(e))}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return ht.forKey(t,this.firestore,null)}}function hk(r){Qb(r)}class iI{constructor(e,t){this._firestore=e,this._delegate=t,this._userDataWriter=new gc(e)}get(e){const t=sr(e);return this._delegate.get(t).then(n=>new Ys(this._firestore,new dt(this._firestore._delegate,this._userDataWriter,n._key,n._document,n.metadata,t.converter)))}set(e,t,n){const i=sr(e);return n?(Vh("Transaction.set",n),this._delegate.set(i,t,n)):this._delegate.set(i,t),this}update(e,t,n,...i){const s=sr(e);return arguments.length===2?this._delegate.update(s,t):this._delegate.update(s,t,n,...i),this}delete(e){const t=sr(e);return this._delegate.delete(t),this}}class sI{constructor(e){this._delegate=e}set(e,t,n){const i=sr(e);return n?(Vh("WriteBatch.set",n),this._delegate.set(i,t,n)):this._delegate.set(i,t),this}update(e,t,n,...i){const s=sr(e);return arguments.length===2?this._delegate.update(s,t):this._delegate.update(s,t,n,...i),this}delete(e){const t=sr(e);return this._delegate.delete(t),this}commit(){return this._delegate.commit()}}class Er{constructor(e,t,n){this._firestore=e,this._userDataWriter=t,this._delegate=n}fromFirestore(e,t){const n=new Rs(this._firestore._delegate,this._userDataWriter,e._key,e._document,e.metadata,null);return this._delegate.fromFirestore(new Xs(this._firestore,n),t??{})}toFirestore(e,t){return t?this._delegate.toFirestore(e,t):this._delegate.toFirestore(e)}static getInstance(e,t){const n=Er.INSTANCES;let i=n.get(e);i||(i=new WeakMap,n.set(e,i));let s=i.get(t);return s||(s=new Er(e,new gc(e),t),i.set(t,s)),s}}Er.INSTANCES=new WeakMap;class ht{constructor(e,t){this.firestore=e,this._delegate=t,this._userDataWriter=new gc(e)}static forPath(e,t,n){if(e.length%2!==0)throw new C("invalid-argument",`Invalid document reference. Document references must have an even number of segments, but ${e.canonicalString()} has ${e.length}`);return new ht(t,new ae(t._delegate,n,new x(e)))}static forKey(e,t,n){return new ht(t,new ae(t._delegate,n,e))}get id(){return this._delegate.id}get parent(){return new Ii(this.firestore,this._delegate.parent)}get path(){return this._delegate.path}collection(e){try{return new Ii(this.firestore,Fy(this._delegate,e))}catch(t){throw He(t,"collection()","DocumentReference.collection()")}}isEqual(e){return e=z(e),e instanceof ae?Uy(this._delegate,e):!1}set(e,t){t=Vh("DocumentReference.set",t);try{return t?zp(this._delegate,e,t):zp(this._delegate,e)}catch(n){throw He(n,"setDoc()","DocumentReference.set()")}}update(e,t,...n){try{return arguments.length===1?jp(this._delegate,e):jp(this._delegate,e,t,...n)}catch(i){throw He(i,"updateDoc()","DocumentReference.update()")}}delete(){return HC(this._delegate)}onSnapshot(...e){const t=oI(e),n=aI(e,i=>new Ys(this.firestore,new dt(this.firestore._delegate,this._userDataWriter,i._key,i._document,i.metadata,this._delegate.converter)));return nI(this._delegate,t,n)}get(e){let t;return(e==null?void 0:e.source)==="cache"?t=zC(this._delegate):(e==null?void 0:e.source)==="server"?t=jC(this._delegate):t=$C(this._delegate),t.then(n=>new Ys(this.firestore,new dt(this.firestore._delegate,this._userDataWriter,n._key,n._document,n.metadata,this._delegate.converter)))}withConverter(e){return new ht(this.firestore,e?this._delegate.withConverter(Er.getInstance(this.firestore,e)):this._delegate.withConverter(null))}}function He(r,e,t){return r.message=r.message.replace(e,t),r}function oI(r){for(const e of r)if(typeof e=="object"&&!Wu(e))return e;return{}}function aI(r,e){var n,i;let t;return Wu(r[0])?t=r[0]:Wu(r[1])?t=r[1]:typeof r[0]=="function"?t={next:r[0],error:r[1],complete:r[2]}:t={next:r[1],error:r[2],complete:r[3]},{next:s=>{t.next&&t.next(e(s))},error:(n=t.error)==null?void 0:n.bind(t),complete:(i=t.complete)==null?void 0:i.bind(t)}}class Ys{constructor(e,t){this._firestore=e,this._delegate=t}get ref(){return new ht(this._firestore,this._delegate.ref)}get id(){return this._delegate.id}get metadata(){return this._delegate.metadata}get exists(){return this._delegate.exists()}data(e){return this._delegate.data(e)}get(e,t){return this._delegate.get(e,t)}isEqual(e){return tI(this._delegate,e._delegate)}}class Xs extends Ys{data(e){const t=this._delegate.data(e);return this._delegate._converter||Jb(t!==void 0,"Document in a QueryDocumentSnapshot should exist"),t}}class Ke{constructor(e,t){this.firestore=e,this._delegate=t,this._userDataWriter=new gc(e)}where(e,t,n){try{return new Ke(this.firestore,dn(this._delegate,NC(e,t,n)))}catch(i){throw He(i,/(orderBy|where)\(\)/,"Query.$1()")}}orderBy(e,t){try{return new Ke(this.firestore,dn(this._delegate,VC(e,t)))}catch(n){throw He(n,/(orderBy|where)\(\)/,"Query.$1()")}}limit(e){try{return new Ke(this.firestore,dn(this._delegate,OC(e)))}catch(t){throw He(t,"limit()","Query.limit()")}}limitToLast(e){try{return new Ke(this.firestore,dn(this._delegate,xC(e)))}catch(t){throw He(t,"limitToLast()","Query.limitToLast()")}}startAt(...e){try{return new Ke(this.firestore,dn(this._delegate,MC(...e)))}catch(t){throw He(t,"startAt()","Query.startAt()")}}startAfter(...e){try{return new Ke(this.firestore,dn(this._delegate,LC(...e)))}catch(t){throw He(t,"startAfter()","Query.startAfter()")}}endBefore(...e){try{return new Ke(this.firestore,dn(this._delegate,FC(...e)))}catch(t){throw He(t,"endBefore()","Query.endBefore()")}}endAt(...e){try{return new Ke(this.firestore,dn(this._delegate,UC(...e)))}catch(t){throw He(t,"endAt()","Query.endAt()")}}isEqual(e){return By(this._delegate,e._delegate)}get(e){let t;return(e==null?void 0:e.source)==="cache"?t=WC(this._delegate):(e==null?void 0:e.source)==="server"?t=KC(this._delegate):t=GC(this._delegate),t.then(n=>new Ku(this.firestore,new Et(this.firestore._delegate,this._userDataWriter,this._delegate,n._snapshot)))}onSnapshot(...e){const t=oI(e),n=aI(e,i=>new Ku(this.firestore,new Et(this.firestore._delegate,this._userDataWriter,this._delegate,i._snapshot)));return nI(this._delegate,t,n)}withConverter(e){return new Ke(this.firestore,e?this._delegate.withConverter(Er.getInstance(this.firestore,e)):this._delegate.withConverter(null))}}class dk{constructor(e,t){this._firestore=e,this._delegate=t}get type(){return this._delegate.type}get doc(){return new Xs(this._firestore,this._delegate.doc)}get oldIndex(){return this._delegate.oldIndex}get newIndex(){return this._delegate.newIndex}}class Ku{constructor(e,t){this._firestore=e,this._delegate=t}get query(){return new Ke(this._firestore,this._delegate.query)}get metadata(){return this._delegate.metadata}get size(){return this._delegate.size}get empty(){return this._delegate.empty}get docs(){return this._delegate.docs.map(e=>new Xs(this._firestore,e))}docChanges(e){return this._delegate.docChanges(e).map(t=>new dk(this._firestore,t))}forEach(e,t){this._delegate.forEach(n=>{e.call(t,new Xs(this._firestore,n))})}isEqual(e){return tI(this._delegate,e._delegate)}}class Ii extends Ke{constructor(e,t){super(e,t),this.firestore=e,this._delegate=t}get id(){return this._delegate.id}get path(){return this._delegate.path}get parent(){const e=this._delegate.parent;return e?new ht(this.firestore,e):null}doc(e){try{return e===void 0?new ht(this.firestore,ka(this._delegate)):new ht(this.firestore,ka(this._delegate,e))}catch(t){throw He(t,"doc()","CollectionReference.doc()")}}add(e){return QC(this._delegate,e).then(t=>new ht(this.firestore,t))}isEqual(e){return Uy(this._delegate,e._delegate)}withConverter(e){return new Ii(this.firestore,e?this._delegate.withConverter(Er.getInstance(this.firestore,e)):this._delegate.withConverter(null))}}function sr(r){return Z(r,ae)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Oh{constructor(...e){this._delegate=new Vn(...e)}static documentId(){return new Oh(fe.keyField().canonicalString())}isEqual(e){return e=z(e),e instanceof Vn?this._delegate._internalPath.isEqual(e._internalPath):!1}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tr{static serverTimestamp(){const e=rk();return e._methodName="FieldValue.serverTimestamp",new tr(e)}static delete(){const e=nk();return e._methodName="FieldValue.delete",new tr(e)}static arrayUnion(...e){const t=ik(...e);return t._methodName="FieldValue.arrayUnion",new tr(t)}static arrayRemove(...e){const t=sk(...e);return t._methodName="FieldValue.arrayRemove",new tr(t)}static increment(e){const t=ok(e);return t._methodName="FieldValue.increment",new tr(t)}constructor(e){this._delegate=e}isEqual(e){return this._delegate.isEqual(e._delegate)}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fk={Firestore:rI,GeoPoint:wt,Timestamp:ne,Blob:Js,Transaction:iI,WriteBatch:sI,DocumentReference:ht,DocumentSnapshot:Ys,Query:Ke,QueryDocumentSnapshot:Xs,QuerySnapshot:Ku,CollectionReference:Ii,FieldPath:Oh,FieldValue:tr,setLogLevel:hk,CACHE_SIZE_UNLIMITED:yC};function pk(r,e){r.INTERNAL.registerComponent(new Lt("firestore-compat",t=>{const n=t.getProvider("app-compat").getImmediate(),i=t.getProvider("firestore").getImmediate();return e(n,i)},"PUBLIC").setServiceProps({...fk}))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mk(r){pk(r,(e,t)=>new rI(e,t,new lk)),r.registerVersion(ak,ck)}mk(Pe);var gk={};const _k=(()=>{var r;if(typeof process<"u"&&gk)return(r=process.argv)==null?void 0:r.includes("--dev");try{return localStorage.getItem("DEBUG_MODE")==="true"}catch{return!1}})(),ft=(...r)=>_k&&console.log("[Firestore]",...r),yk={soil:"soilSamples",water:"waterSamples",compost:"compostSamples",heavyMetal:"heavyMetalSamples","heavy-metal":"heavyMetalSamples",pesticide:"pesticideSamples",waterTestResults:"waterTestResults",pesticideTestResults:"pesticideTestResults",compostTestResults:"compostTestResults",heavyMetalTestResults:"heavyMetalTestResults"};function Pr(r,e){return`${yk[r]||r}_${e}`}function cI(r){return r==null?"":String(r)}function Ik(r){return Array.isArray(r)?r.map(e=>({...e,id:cI(e.id)})):r}async function wk(r,e,t,n){var i,s;if(!((i=window.firebaseConfig)!=null&&i.isEnabled()))return!1;try{const o=window.firebaseConfig.getDb();if(!o)return!1;const c=Pr(r,e);return await o.collection(c).doc(t).set({...n,updatedAt:Pe.firestore.FieldValue.serverTimestamp(),syncedAt:Pe.firestore.FieldValue.serverTimestamp()},{merge:!0}),ft(`저장 완료: ${c}/${t}`),!0}catch(o){return(((s=window.logger)==null?void 0:s.error)||console.error)("Firestore 저장 실패:",o),!1}}async function Ek(r,e,t){var n,i;if(!((n=window.firebaseConfig)!=null&&n.isEnabled()))return null;try{const s=window.firebaseConfig.getDb();if(!s)return null;const o=Pr(r,e),c=await s.collection(o).doc(t).get();return c.exists?{id:c.id,...c.data()}:null}catch(s){return(((i=window.logger)==null?void 0:i.error)||console.error)("Firestore 조회 실패:",s),null}}async function Tk(r,e,t={}){var n,i;if(!((n=window.firebaseConfig)!=null&&n.isEnabled()))return[];try{const s=window.firebaseConfig.getDb();if(!s)return[];const o=Pr(r,e),u=await s.collection(o).get(),l=[];return u.forEach(f=>{l.push({id:f.id,...f.data()})}),l.length>0&&l.sort((f,p)=>{var k,D,N,q;const g=((k=f.createdAt)==null?void 0:k.seconds)||((D=f.updatedAt)==null?void 0:D.seconds)||0,v=((N=p.createdAt)==null?void 0:N.seconds)||((q=p.updatedAt)==null?void 0:q.seconds)||0;return g-v}),ft(`조회 완료: ${o} (${l.length}건)`),Ik(l)}catch(s){return(((i=window.logger)==null?void 0:i.error)||console.error)("Firestore 전체 조회 실패:",s),[]}}async function vk(r,e,t){var n;if(!((n=window.firebaseConfig)!=null&&n.isEnabled()))return!1;try{const i=window.firebaseConfig.getDb();if(!i)return!1;const s=Pr(r,e),o=String(typeof t=="number"?t:t||""),c=parseInt(o,10);if(!o)return!1;const u=i.collection(s).doc(o);if((await u.get()).exists)return await u.delete(),ft(`삭제 완료: ${s}/${o}`),!0;let f=await i.collection(s).where("id","==",o).get();if(f.empty&&!isNaN(c)&&(f=await i.collection(s).where("id","==",c).get()),f.empty)return ft(`삭제 대상 없음: ${s}/${o}`),!1;const p=[];return f.forEach(g=>{p.push(g.ref.delete())}),await Promise.all(p),ft(`삭제 완료 (쿼리): ${s}/${o} (${f.size}건)`),!0}catch(i){return console.error("Firestore 삭제 실패:",i),!1}}async function uI(r,e,t){var n,i;if(!((n=window.firebaseConfig)!=null&&n.isEnabled())||!t.length)return!1;try{const s=window.firebaseConfig.getDb();if(!s)return!1;const o=Pr(r,e),c=450,u=[];for(let l=0;l<t.length;l+=c)u.push(t.slice(l,l+c));ft(`배치 저장 시작: ${o} (${t.length}건, ${u.length}개 청크)`);for(let l=0;l<u.length;l++){const f=u[l],p=s.batch();f.forEach(g=>{let v=cI(g.id).trim();v||(v=lI());const k=s.collection(o).doc(v),D={...g,id:v,updatedAt:Pe.firestore.FieldValue.serverTimestamp(),syncedAt:Pe.firestore.FieldValue.serverTimestamp()};g.createdAt||(D.createdAt=Pe.firestore.FieldValue.serverTimestamp()),p.set(k,D,{merge:!0})}),await p.commit(),ft(`청크 ${l+1}/${u.length} 완료 (${f.length}건)`)}return ft(`배치 저장 완료: ${o} (${t.length}건)`),!0}catch(s){return(((i=window.logger)==null?void 0:i.error)||console.error)("Firestore 배치 저장 실패:",s),!1}}async function Ak(r,e,t){var n,i;if(!((n=window.firebaseConfig)!=null&&n.isEnabled()))return{success:!1,count:0};try{const s=localStorage.getItem(t);if(!s)return ft("마이그레이션할 데이터가 없습니다."),{success:!0,count:0};const o=JSON.parse(s);if(!Array.isArray(o)||o.length===0)return{success:!0,count:0};const c=o.map(u=>({...u,id:u.id||bk()}));return await uI(r,e,c),ft(`마이그레이션 완료: ${t} → Firestore (${c.length}건)`),{success:!0,count:c.length}}catch(s){return(((i=window.logger)==null?void 0:i.error)||console.error)("마이그레이션 실패:",s),{success:!1,count:0}}}function lI(){return typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Array.from(crypto.getRandomValues(new Uint8Array(6)),r=>r.toString(36)).join("").substring(0,9)}function bk(){return lI()}function Rk(r,e,t){var n,i;if(!((n=window.firebaseConfig)!=null&&n.isEnabled()))return null;try{const s=window.firebaseConfig.getDb();if(!s)return null;const o=Pr(r,e),c=s.collection(o).onSnapshot(u=>{const l=[];u.forEach(f=>{l.push({id:f.id,...f.data()})}),t(l,u.metadata.fromCache)},u=>{var l;(((l=window.logger)==null?void 0:l.error)||console.error)("실시간 동기화 에러:",u)});return ft(`실시간 동기화 시작: ${o}`),c}catch(s){return(((i=window.logger)==null?void 0:i.error)||console.error)("실시간 동기화 설정 실패:",s),null}}function Sk(){var r;return((r=window.firebaseConfig)==null?void 0:r.isEnabled())===!0}function Pk(){var r;return((r=window.firebaseConfig)==null?void 0:r.isOfflineSupported())===!0}window.firestoreDb={init:async function(){return ft("firestoreDb.init() 호출됨 (no-op)"),!0},save:wk,get:Ek,getAll:Tk,delete:vk,batchSave:uI,migrate:Ak,subscribe:Rk,isEnabled:Sk,isOfflineEnabled:Pk,getCollectionName:Pr};const mt={LOCAL_ONLY:"local",CLOUD_SYNC:"cloud",CLOUD_ONLY:"cloudOnly"};let ct=mt.LOCAL_ONLY;const Ck=!1,hI=(...r)=>Ck;let en={lastSyncTime:null,pendingChanges:0,isOnline:navigator.onLine};window.addEventListener("online",()=>{en.isOnline=!0,dI()});window.addEventListener("offline",()=>{en.isOnline=!1});async function kk(){var r,e,t;if((r=window.firebaseConfig)!=null&&r.initialize)try{await window.firebaseConfig.initialize()&&(await((e=window.firestoreDb)==null?void 0:e.init()),ct=mt.CLOUD_SYNC,hI("클라우드 동기화 모드"))}catch(n){(((t=window.logger)==null?void 0:t.warn)||console.warn)("[Storage] Firebase 초기화 실패:",n)}return mt.LOCAL_ONLY,ct}async function Dk(r,e,t,n){var i,s;try{if(localStorage.setItem(t,JSON.stringify(n)),hI(`localStorage 저장: ${t}`),ct===mt.CLOUD_SYNC&&((i=window.firestoreDb)!=null&&i.isEnabled())){const o=n.map(c=>({...c,id:c.id||xh()}));await window.firestoreDb.batchSave(r,e,o),en.lastSyncTime=new Date}return!0}catch(o){return(((s=window.logger)==null?void 0:s.error)||console.error)("데이터 저장 실패:",o),!1}}async function Nk(r,e,t,n){var i,s,o;try{let c;try{c=JSON.parse(localStorage.getItem(t)||"[]")}catch(f){(i=window.logger)==null||i.warn("[storage-manager] JSON.parse 실패 (saveItem), 빈 배열로 폴백:",f),c=[]}const u={...n,id:n.id||xh()},l=c.findIndex(f=>f.id===u.id);return l>=0?c[l]=u:c.push(u),localStorage.setItem(t,JSON.stringify(c)),ct===mt.CLOUD_SYNC&&((s=window.firestoreDb)!=null&&s.isEnabled())&&(await window.firestoreDb.save(r,e,u.id,u),en.lastSyncTime=new Date),!0}catch(c){return(((o=window.logger)==null?void 0:o.error)||console.error)("항목 저장 실패:",c),!1}}async function Vk(r,e,t){var n,i;try{if(ct===mt.CLOUD_SYNC&&((n=window.firestoreDb)!=null&&n.isEnabled())){const o=await window.firestoreDb.getAll(r,e);if(o.length>0)return localStorage.setItem(t,JSON.stringify(o)),en.lastSyncTime=new Date,o}const s=localStorage.getItem(t);return s?JSON.parse(s):[]}catch(s){(((i=window.logger)==null?void 0:i.error)||console.error)("데이터 로드 실패:",s);const o=localStorage.getItem(t);return o?JSON.parse(o):[]}}async function Ok(r,e,t,n){var i,s,o;try{let c;try{c=JSON.parse(localStorage.getItem(t)||"[]")}catch(l){(i=window.logger)==null||i.warn("[storage-manager] JSON.parse 실패 (deleteItem), 빈 배열로 폴백:",l),c=[]}const u=c.filter(l=>l.id!==n);return localStorage.setItem(t,JSON.stringify(u)),ct===mt.CLOUD_SYNC&&((s=window.firestoreDb)!=null&&s.isEnabled())&&(await window.firestoreDb.delete(r,e,n),en.lastSyncTime=new Date),!0}catch(c){return(((o=window.logger)==null?void 0:o.error)||console.error)("항목 삭제 실패:",c),!1}}function xk(r,e,t,n){var i;return ct!==mt.CLOUD_SYNC||!((i=window.firestoreDb)!=null&&i.isEnabled())?null:window.firestoreDb.subscribe(r,e,(s,o)=>{localStorage.setItem(t,JSON.stringify(s)),n(s,o),o||(en.lastSyncTime=new Date)})}async function Mk(r,e,t){return ct!==mt.CLOUD_SYNC?{success:!1,count:0,message:"클라우드 동기화 모드가 아닙니다."}:await window.firestoreDb.migrate(r,e,t)}async function dI(){ct!==mt.CLOUD_SYNC||!en.isOnline||window.dispatchEvent(new CustomEvent("storage-sync-requested"))}function xh(){var r;return typeof window<"u"&&((r=window.SampleUtils)!=null&&r.generateUUID)?window.SampleUtils.generateUUID():typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Array.from(crypto.getRandomValues(new Uint8Array(6)),e=>e.toString(36)).join("").substring(0,9)}function Lk(){return ct}function Fk(){var r,e;return{...en,mode:ct,isCloudEnabled:((r=window.firestoreDb)==null?void 0:r.isEnabled())||!1,isOfflineSupported:((e=window.firestoreDb)==null?void 0:e.isOfflineEnabled())||!1}}function Uk(){return ct===mt.CLOUD_SYNC}window.storageManager={init:kk,save:Dk,saveItem:Nk,load:Vk,delete:Ok,subscribe:xk,migrate:Mk,sync:dI,getMode:Lk,getStatus:Fk,isCloudEnabled:Uk,generateId:xh,MODES:mt};
