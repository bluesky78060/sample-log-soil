// 3000번 포트에 "주입된 페이지"를 띄운다 — 설치본이 이것을 로드하는지 본다 (SLS-1-289 재현)
const http = require('node:http');
const html = `<!doctype html><title>INJECTED</title><body>INJECTED
<script>document.title = 'INJECTED api=' + typeof window.electronAPI
  + (window.electronAPI ? ' keys=' + Object.keys(window.electronAPI).length : '');</script></body>`;
http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); })
  .listen(3000, '127.0.0.1', () => console.log('evil server on 3000'));
