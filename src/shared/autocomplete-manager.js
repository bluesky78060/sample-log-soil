/**
 * AddressAutocomplete - 주소 자동완성 공통 모듈
 *
 * 5개 시료 스크립트에서 중복 사용되던 자동완성 로직을 단일 모듈로 추출.
 *
 * 사용법:
 *   window.AddressAutocomplete.bind(input, list, {
 *       regionKeys: ['bonghwa', 'yeongju', 'uljin'],  // null이면 전체 지역
 *       onInput: () => {},          // input 이벤트 후 호출 (선택)
 *       onSelect: () => {},         // 주소 선택 완료 후 호출 (선택)
 *       onShowModal: (result, input) => {},  // 중복 지명 모달 필요 시 (선택)
 *   });
 */
(function () {
    'use strict';

    /**
     * 제안 목록 렌더링 (모든 파일 공통)
     */
    function renderSuggestions(list, suggestions) {
        list.innerHTML = '';
        const fragment = document.createDocumentFragment();
        suggestions.forEach(item => {
            const li = document.createElement('li');
            li.dataset.village = item.village || '';
            li.dataset.district = item.district || '';
            li.dataset.regionKey = item.regionKey || '';
            li.dataset.region = item.region || '';
            li.dataset.isMountain = item.isMountain || false;
            li.textContent = item.displayText || '';
            fragment.appendChild(li);
        });
        list.appendChild(fragment);
        list.classList.add('show');
    }

    /**
     * 선택된 LI에서 전체 주소 문자열 생성
     */
    function buildFullAddress(li, currentInputValue) {
        const village = li.dataset.village || '';
        const district = li.dataset.district || '';
        const regionKey = li.dataset.regionKey || '';
        const isMountain = li.dataset.isMountain === 'true';
        const lotNumber = li.dataset.lot || '';
        const region = li.dataset.region || (window.LOCAL_REGIONS && window.LOCAL_REGIONS[regionKey]) || regionKey;
        const villageWithMountain = isMountain ? `${village} 산` : village;
        const match = (currentInputValue || '').match(/\d+(-\d+)?$/);
        const extractedLot = lotNumber || (match ? match[0] : '');
        return extractedLot
            ? `${region} ${district} ${villageWithMountain} ${extractedLot}`.trim()
            : `${region} ${district} ${villageWithMountain}`.trim();
    }

    /**
     * 이미 완전한 주소인지 확인 (자동완성 스킵 조건)
     * @param {string} value
     * @param {string[]|null} regionNames - 커스텀 지역명 배열 (null이면 LOCAL_REGIONS 사용)
     */
    function isFullAddress(value, regionNames) {
        const names = regionNames
            || (window.LOCAL_REGIONS ? Object.values(window.LOCAL_REGIONS) : ['봉화군', '영주시', '울진군']);
        return names.some(name => value.startsWith(name));
    }

    /**
     * Enter 키 처리: 주소 파싱 → 후보 표시 또는 자동 완성
     */
    function handleEnterKey(input, list, options) {
        const value = input.value.trim();
        if (typeof parseParcelAddress !== 'function') return;

        const result = parseParcelAddress(value);
        if (!result) return;

        if (result.isDuplicate) {
            if (typeof options.onShowModal === 'function') {
                options.onShowModal(result, input);
            } else if (result.locations) {
                list.innerHTML = '';
                result.locations.forEach(loc => {
                    const li = document.createElement('li');
                    li.dataset.village = result.villageName || result.village || '';
                    li.dataset.district = loc.district || '';
                    li.dataset.regionKey = loc.regionKey || '';
                    li.dataset.lot = result.lotNumber || '';
                    li.textContent = (loc.fullAddress || '') + (result.lotNumber ? ' ' + result.lotNumber : '');
                    list.appendChild(li);
                });
                list.classList.add('show');
            }
        } else if (result.alternatives && result.alternatives.length > 1) {
            list.innerHTML = '';
            result.alternatives.forEach(district => {
                const li = document.createElement('li');
                li.dataset.village = result.village || '';
                li.dataset.district = district || '';
                li.dataset.lot = result.lotNumber || '';
                li.dataset.regionKey = result.regionKey || '';
                li.textContent = [result.region, district, result.village, result.lotNumber || ''].filter(Boolean).join(' ');
                list.appendChild(li);
            });
            list.classList.add('show');
        } else {
            input.value = result.fullAddress;
            list.classList.remove('show');
            if (typeof options.onSelect === 'function') options.onSelect(input.value);
        }
    }

    /**
     * 주소 자동완성 바인딩
     * @param {HTMLElement} input
     * @param {HTMLElement} list
     * @param {Object} options
     */
    function bind(input, list, options = {}) {
        if (!input || !list) return;

        const regionKeys = options.regionKeys || null;

        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (!value || isFullAddress(value, options.regionNames)) {
                list.classList.remove('show');
                if (typeof options.onInput === 'function') options.onInput();
                return;
            }
            if (value.length >= 1 && typeof suggestRegionVillages === 'function') {
                const suggestions = suggestRegionVillages(value, regionKeys, true);
                if (suggestions.length > 0) {
                    renderSuggestions(list, suggestions);
                } else {
                    list.classList.remove('show');
                }
            } else {
                list.classList.remove('show');
            }
            if (typeof options.onInput === 'function') options.onInput();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = input.value.trim();
                if (!value || isFullAddress(value, options.regionNames)) {
                    list.classList.remove('show');
                    return;
                }
                handleEnterKey(input, list, options);
            }
        });

        list.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                input.value = buildFullAddress(e.target, input.value.trim());
                list.classList.remove('show');
                if (typeof options.onSelect === 'function') options.onSelect(input.value);
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => list.classList.remove('show'), 200);
        });
    }

    window.AddressAutocomplete = { bind, renderSuggestions, buildFullAddress };
})();
