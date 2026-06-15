export function normalizeBioForArchiveDiff(text) {
    return String(text ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[ \t]+$/gm, '')
        .normalize('NFKC')
        .replace(/\u201A/g, ',');
}

function stringHash(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = Math.imul(31, hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function decodeBasicHtmlEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}

function normalizeDiffSpanText(text) {
    return normalizeBioForArchiveDiff(decodeBasicHtmlEntities(text.replace(/<br>/g, '\n')));
}

function collectDiffSpans(html) {
    const spans = [];
    const pattern = /<span class="x-text-(added|removed)">([\s\S]*?)<\/span>/g;
    let match;
    while ((match = pattern.exec(String(html ?? ''))) !== null) {
        const text = match[2];
        const normalized = normalizeDiffSpanText(text);
        spans.push({
            index: spans.length,
            type: match[1],
            text,
            normalized,
            length: normalized.length,
            hash: stringHash(normalized)
        });
    }
    return spans;
}

function firstDiffInfo(left, right) {
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
        if (left[i] !== right[i]) {
            const leftCode = i < left.length ? left.codePointAt(i) : null;
            const rightCode = i < right.length ? right.codePointAt(i) : null;
            return {
                index: i,
                left: i < left.length ? left[i] : '<EOF>',
                leftCodePoint: leftCode === null ? null : `U+${leftCode.toString(16).toUpperCase().padStart(4, '0')}`,
                right: i < right.length ? right[i] : '<EOF>',
                rightCodePoint: rightCode === null ? null : `U+${rightCode.toString(16).toUpperCase().padStart(4, '0')}`
            };
        }
    }
    return null;
}

export function collapseEqualBioArchiveDiffSpans(html) {
    const pairPattern =
        /<span class="x-text-(added|removed)">([\s\S]*?)<\/span>\s*<span class="x-text-(added|removed)">([\s\S]*?)<\/span>/g;
    let previous = null;
    let current = String(html ?? '');

    while (current !== previous) {
        previous = current;
        current = current.replace(pairPattern, (match, firstType, firstText, secondType, secondText) => {
            if (firstType === secondType) {
                return match;
            }
            if (normalizeDiffSpanText(firstText) !== normalizeDiffSpanText(secondText)) {
                return match;
            }
            return firstType === 'added' ? firstText : secondText;
        });
    }

    return current;
}

export function formatBioArchiveDiff(previousBio, currentBio, formatDifference, meta = {}) {
    const normalizedPreviousBio = normalizeBioForArchiveDiff(previousBio);
    const normalizedCurrentBio = normalizeBioForArchiveDiff(currentBio);
    const rawHtml = formatDifference(normalizedPreviousBio, normalizedCurrentBio);
    const collapsedHtml = collapseEqualBioArchiveDiffSpans(rawHtml);

    console.groupCollapsed(`[BioArchiveDiff] ${meta.label ?? ''}`.trim());
    console.log('meta:', meta);
    console.log('previous raw length/hash:', String(previousBio ?? '').length, stringHash(String(previousBio ?? '')));
    console.log('current raw length/hash:', String(currentBio ?? '').length, stringHash(String(currentBio ?? '')));
    console.log('previous normalized length/hash:', normalizedPreviousBio.length, stringHash(normalizedPreviousBio));
    console.log('current normalized length/hash:', normalizedCurrentBio.length, stringHash(normalizedCurrentBio));
    console.log('first raw diff:', firstDiffInfo(String(previousBio ?? ''), String(currentBio ?? '')));
    console.log('first normalized diff:', firstDiffInfo(normalizedPreviousBio, normalizedCurrentBio));
    console.log('previous normalized JSON:', JSON.stringify(normalizedPreviousBio));
    console.log('current normalized JSON:', JSON.stringify(normalizedCurrentBio));
    console.log('raw diff html:', rawHtml);
    console.log('collapsed diff html:', collapsedHtml);
    console.log('raw spans:');
    console.table(collectDiffSpans(rawHtml));
    console.log('collapsed spans:');
    console.table(collectDiffSpans(collapsedHtml));
    console.groupEnd();

    return collapsedHtml;
}
