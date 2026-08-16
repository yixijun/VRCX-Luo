export function normalizeBioForArchiveDiff(text) {
    return String(text ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[ \t]+$/gm, '')
        .normalize('NFKC')
        .replace(/[\u2044\u2215]/g, '/')
        .replace(/\u201A/g, ',');
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

export function formatLatestBioDiff(
    latestRecord,
    currentBio,
    formatDifference
) {
    if (!latestRecord || typeof formatDifference !== 'function') {
        return '';
    }

    const recordedBio = normalizeBioForArchiveDiff(latestRecord.bio);
    const liveBio = normalizeBioForArchiveDiff(currentBio ?? latestRecord.bio);
    const liveBioChangedSinceCapture = recordedBio !== liveBio;
    const previousBio = normalizeBioForArchiveDiff(
        liveBioChangedSinceCapture
            ? latestRecord.bio
            : latestRecord.previousBio
    );

    if (previousBio === liveBio) {
        return '';
    }

    return collapseEqualBioArchiveDiffSpans(formatDifference(previousBio, liveBio));
}

export function formatBioArchiveDiff(previousBio, currentBio, formatDifference) {
    const normalizedPreviousBio = normalizeBioForArchiveDiff(previousBio);
    const normalizedCurrentBio = normalizeBioForArchiveDiff(currentBio);
    const rawHtml = formatDifference(normalizedPreviousBio, normalizedCurrentBio);

    return collapseEqualBioArchiveDiffSpans(rawHtml);
}
