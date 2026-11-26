/**
 * SheetJS 출력 xlsx 의 ZIP 포장 보정 (SLS-1-300)
 *
 * 흙토람이 SheetJS 출력을 「변조된 확장자」로 거부했다(sample-log-electron SAMPL-1-186).
 * 시험 이력과 미확인 사항은 docs-internal/ai-pm/SLS-1-300/SLS-1-300-direction.md 한 곳에 둔다.
 * 흙토람 토양·공익직불제·퇴비 흙토람 세 내보내기가 이 함수 하나를 쓴다 — 사본을 두면 한쪽만 고친다.
 * 어긋나면 던진다: 조용히 내보내면 사용자는 업로드 시점에야 거부를 안다.
 */

const CT_NAME = '[Content_Types].xml';
const XLSB_MARK = 'binary.macroEnabled.main';
const BIN_DEFAULT = /<Default Extension="bin" ContentType="[^"]*binary\.macroEnabled\.main"\/>/g;

/**
 * [Content_Types].xml 을 ZIP 첫 엔트리로 옮기고 xlsb bin Default 선언을 지운다.
 * JSZip 인자는 테스트가 재검증 단계를 위조하려고 받는다.
 */
export async function finalizeXlsxPackage(arrayBuffer, JSZip = window.JSZip) {
    if (!JSZip) throw new Error('JSZip 미사용: xlsx 포장을 고칠 수 없다');

    const zip = await JSZip.loadAsync(arrayBuffer);
    const ctFile = zip.file(CT_NAME);
    if (!ctFile) throw new Error(`${CT_NAME} 없음`);
    const out = new JSZip();
    out.file(CT_NAME, (await ctFile.async('string')).replace(BIN_DEFAULT, ''), { createFolders: false });
    for (const name of Object.keys(zip.files)) {
        if (name === CT_NAME) continue;
        const f = zip.files[name];
        if (f.dir) out.folder(name);
        else out.file(name, await f.async('uint8array'), { createFolders: false });
    }
    const result = await out.generateAsync({ type: 'arraybuffer' });

    const check = await JSZip.loadAsync(result);
    const ctOk = Object.keys(check.files)[0] === CT_NAME;
    const ct = await check.file(CT_NAME)?.async('string');
    if (!ctOk || ct === undefined || ct.includes(XLSB_MARK)) {
        throw new Error('xlsx 포장 보정 실패: 흙토람이 거부할 수 있는 파일');
    }
    return result;
}

window.finalizeXlsxPackage = finalizeXlsxPackage;
