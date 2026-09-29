// 사용: node rawcdp-click2.mjs <port> — 설정 페이지를 먼저 열어 둔다
// raw CDP: 다운로드 동작은 건드리지 않고(Page.enable 이벤트 관찰만) 사용자 제스처로 백업 버튼을 누른다
const list = await (await fetch(`http://127.0.0.1:${process.argv[2]}/json/list`)).json();
const t = list.find(x => x.type === 'page' && x.url.includes('/docs/'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
ws.onmessage = m => { const d = JSON.parse(String(m.data)); if (d.method && /download|javascriptDialog|frameNavigated/i.test(d.method)) console.log('EVENT', d.method, JSON.stringify(d.params).slice(0, 200)); else if (d.id) console.log('RESP', d.id, JSON.stringify(d.result || d.error).slice(0, 150)); };
send('Page.enable');
send('Runtime.evaluate', { expression: "document.getElementById('exportAllBtn').click(); 'clicked'", userGesture: true });
setTimeout(() => { send('Runtime.evaluate', { expression: 'document.readyState + \" alive\"' }); }, 4000);
setTimeout(() => { ws.close(); process.exit(0); }, 5000);
