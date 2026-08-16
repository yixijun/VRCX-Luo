const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const DEFAULT_SUMMARY_SIZE = 42;
const DEFAULT_SUMMARY_MIN_SIZE = 20;
const DEFAULT_TABLE_MIN_SIZE = 32;
const MAX_TABLE_MIN_SIZE = 60;
const MIN_SUMMARY_HEIGHT = 144;
const MIN_TABLE_HEIGHT = 260;

function calculatePlayerListLayout({
    containerHeight,
    summaryContentHeight,
    summaryOffset = 0
}) {
    if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
        return {
            summarySize: DEFAULT_SUMMARY_SIZE,
            summaryMinSize: DEFAULT_SUMMARY_MIN_SIZE,
            summaryMaxSize: 100 - DEFAULT_TABLE_MIN_SIZE,
            tableMinSize: DEFAULT_TABLE_MIN_SIZE
        };
    }

    const summaryMinSize = clamp(
        (MIN_SUMMARY_HEIGHT / containerHeight) * 100,
        DEFAULT_SUMMARY_MIN_SIZE,
        32
    );
    const tableMinSize = clamp(
        (MIN_TABLE_HEIGHT / containerHeight) * 100,
        DEFAULT_TABLE_MIN_SIZE,
        MAX_TABLE_MIN_SIZE
    );
    const summaryMaxSize = Math.max(summaryMinSize, 100 - tableMinSize);
    const desiredSummarySize =
        (Math.max(0, summaryContentHeight || 0) / containerHeight) * 100;
    const offsetPercent =
        (Number.isFinite(summaryOffset) ? summaryOffset / containerHeight : 0) *
        100;

    return {
        summarySize: clamp(
            desiredSummarySize + offsetPercent,
            summaryMinSize,
            summaryMaxSize
        ),
        summaryMinSize,
        summaryMaxSize,
        tableMinSize
    };
}

export { calculatePlayerListLayout };
