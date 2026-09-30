import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

/**
 * asar 에 싣는 최상위 허용 목록 (SLS-1-290)
 *
 * 허용 목록에서 빠진 파일을 메인 프로세스가 읽으면 **설치본이 뜨지 않고, 자동 업데이트로도
 * 복구되지 않는다.** E2E 는 docs/ 를 http 로만 돌아 이 경로를 밟지 않으므로 여기서 지킨다.
 * 실제 패키징 결과는 mac 스모크(docs-internal/ai-pm/SLS-1-290/)로 확인했다.
 */

const ROOT = process.cwd()
const forge = createRequire(import.meta.url)(path.join(ROOT, 'forge.config.js'))
const ignore = forge.packagerConfig.ignore

describe('packagerConfig.ignore', () => {
    it.each([
        ['', false],
        ['/package.json', false],
        ['/src', false],
        ['/src/index.js', false],
        ['/src/shared/constants.js', false],
        ['/docs/index.html', false],
        ['/node_modules/firebase/package.json', false],
    ])('실을 것: %s', (p, expected) => expect(ignore(p)).toBe(expected))

    it.each([
        '/docs-internal/ai-pm/x.md',
        '/graft/INDEX.md',
        '/tests/unit/a.test.js',
        '/.env',
        '/.claude/settings.json',
        '/.omc/x',
        '/.github/workflows/build.yml',
        '/CLAUDE.md',
        '/feedback-auth.json',
        '/package-lock.json',
        '/forge.config.js',
    ])('뺄 것: %s', (p) => expect(ignore(p)).toBe(true))

    it('접두사만 같은 폴더는 싣지 않는다 — docs-internal 이 docs 에 걸리면 안 된다', () => {
        expect(ignore('/docs-internal')).toBe(true)
        expect(ignore('/srcx/a.js')).toBe(true)
    })

    it('기본 제외를 복원한다 — 락파일·.git·.bin·네이티브 빌드 잔재', () => {
        expect(ignore('/node_modules/x/pnpm-lock.yaml')).toBe(true)
        expect(ignore('/node_modules/x/build/a.obj')).toBe(true)
        expect(ignore('/node_modules/.bin/vite')).toBe(true)
        expect(ignore('/node_modules/x/.git/HEAD')).toBe(true)
        expect(ignore('/node_modules/x/package-lock.json')).toBe(true)
        expect(ignore('/node_modules/x/yarn.lock')).toBe(true)
        expect(ignore('/node_modules/x/node_gyp_bins/python3')).toBe(true)
        expect(ignore('/node_modules/x/build/a.o')).toBe(true)
        expect(ignore('/node_modules/x/lib/index.js')).toBe(false)
    })

    it('정상 파일을 삼키지 않는다 — 정규식 끝 고정', () => {
        for (const ok of ['/node_modules/x/foo.orig', '/node_modules/x/a.node', '/node_modules/x/proto.o.js', '/node_modules/x/.gitignore', '/src/shared/constants.js']) {
            expect(ignore(ok), ok).toBe(false)
        }
    })
})

describe('메인 프로세스가 읽는 경로는 asar 안에 있다', () => {
    const extraResource = (forge.packagerConfig.extraResource || []).map((p) => path.basename(p))
    const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')
    const mainEntry = JSON.parse(read('package.json')).main

    /** package.json main 과 preload 에서 시작해 상대 require 를 따라간 파일들 (src/ 기준 상대 경로) */
    function mainProcessFiles() {
        const seen = new Set()
        const queue = [mainEntry, 'src/preload.js']
        while (queue.length) {
            const f = queue.pop()
            if (seen.has(f)) continue
            seen.add(f)
            for (const m of read(f).matchAll(/require\(\s*(['"`])(\.[^'"`]*)\1\s*\)/g)) {
                let r = path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, f)), m[2]))
                if (!/\.(c|m)?js$|\.json$/.test(r)) r += '.js'
                queue.push(r)
            }
        }
        return [...seen]
    }

    /** `__dirname` 에서 상위로 올라가 여는 첫 세그먼트 — join/resolve, 따옴표 종류, '../x' 합친 형태 모두 */
    function dirnameTargets(src) {
        const out = []
        for (const m of src.matchAll(/path\.(?:join|resolve)\(\s*__dirname\s*,\s*(['"`])\.\.(?:\1\s*,\s*\1|\/)([^/'"`]+)/g)) out.push(m[2])
        return out
    }

    it('메인 프로세스 파일 추적이 비어 있지 않다', () => {
        const files = mainProcessFiles()
        expect(files).toEqual(expect.arrayContaining(['src/index.js', 'src/preload.js', 'src/dev-server-probe.js']))
        for (const f of files) expect(ignore(`/${f}`), f).toBe(false)
    })

    it('상위 폴더를 가리키는 __dirname 참조는 허용 목록이거나, resourcesPath 폴백이 있는 extraResource 다', () => {
        let found = 0
        for (const f of mainProcessFiles()) {
            const src = read(f)
            for (const t of dirnameTargets(src)) {
                found++
                const inAsar = !ignore(`/${t}`)
                // extraResource 에 있다는 것만으로는 부족하다 — __dirname/../X 는 resources/X 가 아니라 app.asar/X 를 가리킨다
                const fallback = new RegExp(`path\\.join\\(process\\.resourcesPath,\\s*(['"\`])${t.replace(/\./g, '\\.')}\\1\\)`).test(src)
                expect(inAsar || (extraResource.includes(t) && fallback), `${f}: ${t} 는 asar 에도, 폴백 있는 resources 에도 없다`).toBe(true)
            }
        }
        expect(found).toBeGreaterThan(0)
    })

    it('asar 에서 빠지는 두 설정 파일은 extraResource 로 동봉된다', () => {
        for (const name of ['.env', 'feedback-auth.json']) {
            expect(ignore(`/${name}`)).toBe(true)
            expect(extraResource).toContain(name)
        }
    })

    it('상대 require 는 모두 src/ 안이다', () => {
        for (const f of mainProcessFiles()) {
            for (const m of read(f).matchAll(/require\(\s*(['"`])(\.[^'"`]*)\1\s*\)/g)) {
                const resolved = path.resolve(path.dirname(path.join(ROOT, f)), m[2])
                expect(resolved.startsWith(path.join(ROOT, 'src') + path.sep), `${f}: ${m[2]}`).toBe(true)
            }
        }
    })

    it('package.json main 은 허용 목록 안이다', () => {
        expect(ignore(`/${mainEntry}`)).toBe(false)
    })
})
