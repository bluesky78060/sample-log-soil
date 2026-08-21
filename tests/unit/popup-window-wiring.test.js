import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 팝업 창 배선 레지스트리 (SLS-1-193)
 *
 * 별도 창으로 여는 페이지는 **네 곳이 동시에 맞아야** 동작한다.
 *
 *   1. `src/<dir>/index.html`            페이지 자체
 *   2. `vite.config.js` rollup input      빌드 산출물에 포함
 *   3. `src/index.js` ipcMain.handle      Electron 창 열기
 *   4. `src/preload.js` contextBridge     렌더러가 부를 통로
 *
 * ⚠️ 하나만 빠져도 **버튼이 아무 반응 없이 죽는다.** 그런데 E2E는 `http://localhost:8888`의
 *    `docs/`만 돌아 **메인 프로세스와 preload를 아예 밟지 않는다**(알려진 검증 공백).
 *    즉 3·4번이 빠져도 E2E는 전부 초록불이다.
 *
 *    CLAUDE.md가 경고하는 "레지스트리 6곳" 사고와 같은 형태라 여기서 정적으로 묶어 둔다.
 */

const ROOT = process.cwd()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

/** 주석을 걷어낸다 — 주석에 적힌 경로가 배선으로 오인되면 테스트가 공허해진다 */
const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const MAIN = read('src/index.js')
const PRELOAD = stripComments(read('src/preload.js'))
const VITE = stripComments(read('vite.config.js'))

/** src/index.js에서 makePopupWindowHandler 등록을 뽑는다 */
function registeredPopups() {
    const out = []
    const re = /ipcMain\.handle\(\s*'([^']+)'\s*,\s*makePopupWindowHandler\(\{([\s\S]*?)\}\)\s*\)/g
    let m
    while ((m = re.exec(MAIN)) !== null) {
        const dir = m[2].match(/dirName:\s*'([^']+)'/)
        const route = m[2].match(/route:\s*'([^']+)'/)
        out.push({ channel: m[1], dirName: dir?.[1], route: route?.[1] })
    }
    return out
}

describe('팝업 창 배선 (SLS-1-193)', () => {
    const popups = registeredPopups()

    it('1. 팝업 핸들러가 하나 이상 등록돼 있다 (정규식이 깨졌는지 감지)', () => {
        // 이 단언이 없으면 정규식이 아무것도 못 잡았을 때 아래 테스트들이 **공허하게 통과**한다
        expect(popups.length, 'makePopupWindowHandler 등록을 하나도 찾지 못했다').toBeGreaterThan(0)
        expect(popups.map((p) => p.channel)).toContain('open-compost-analysis')
    })

    it.each(popups)('2. $channel — 페이지·vite·preload가 모두 연결돼 있다', (popup) => {
        expect(popup.dirName, `${popup.channel}에 dirName이 없다`).toBeTruthy()
        expect(popup.route, `${popup.channel}에 route가 없다`).toBe(`/${popup.dirName}/`)

        // 1) 페이지가 실제로 있다
        const page = path.join(ROOT, 'src', popup.dirName, 'index.html')
        expect(fs.existsSync(page), `${page}가 없다`).toBe(true)

        // 2) vite entry에 있다 — 빠지면 빌드 산출물에 페이지가 없어 창이 빈 화면이 된다
        //    ⚠️ 단순 문자열 검색이면 **주석에 적힌 경로에도 걸린다.** 주석을 걷어낸 뒤,
        //       `키: resolve(...)` 형태의 실제 entry인지까지 본다.
        expect(VITE, `vite.config.js에 src/${popup.dirName}/index.html entry가 없다`)
            .toMatch(new RegExp(`\\w+:\\s*resolve\\([^)]*['"]src/${popup.dirName}/index\\.html['"]\\s*\\)`))

        // 3) preload가 이 채널을 노출한다 — 빠지면 렌더러에서 TypeError로 버튼이 죽는다
        expect(PRELOAD, `preload.js가 '${popup.channel}'을 invoke하지 않는다`)
            .toContain(`'${popup.channel}'`)
    })

    it('3. 퇴·액비 검정결과 페이지의 구성 파일이 모두 있다', () => {
        // SLS-1-193이 요구한 이식 산출물. entry/script/style이 빠지면 빈 페이지가 뜬다.
        for (const f of ['index.html', 'compost-analysis-entry.js', 'compost-analysis-script.js', 'compost-analysis-style.css']) {
            expect(fs.existsSync(path.join(ROOT, 'src/compost-analysis', f)), `src/compost-analysis/${f} 없음`).toBe(true)
        }
    })

    it('4. 퇴비 페이지가 preload의 노출 이름으로 호출한다', () => {
        const compost = read('src/compost/compost-script.js')
        expect(PRELOAD).toMatch(/openCompostAnalysis:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('open-compost-analysis'\)/)
        expect(compost).toContain('window.electronAPI.openCompostAnalysis')
    })
})
