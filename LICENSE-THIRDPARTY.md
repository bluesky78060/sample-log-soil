# Third-Party Code Attributions

본 프로젝트는 아래 외부 코드를 차용·통합하였습니다. 원 저작자의 라이선스 조건을 준수합니다.

## postal-code-finder (MIT License)

- 저장소: https://github.com/bluesky78060/Postal-Code
- 경로: `mysite/postal-code-finder`
- 차용 부분:
  - `backend/src/services/providers/jusoPostalCodeService.js`
    → `src/shared/juso-service.js` (렌더러 측 헬퍼) 및
    → `src/index.js` (Electron main의 `juso:search` IPC 핸들러)
  - `backend/src/routes/address.js` 의 `sanitizeKeyword`
    → `src/shared/juso-service.js` 의 `sanitizeKeyword`

### MIT License (postal-code-finder)

```
MIT License

Copyright (c) 2025 bluesky78060

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
