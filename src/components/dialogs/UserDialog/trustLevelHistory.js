function getTimestamp(value) {
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? timestamp : 0;
}

const TRUST_LEVEL_META = {
    'Trusted User': {
        shortLabel: 'Trusted',
        className: 'x-tag-veteran'
    },
    'Known User': {
        shortLabel: 'Known',
        className: 'x-tag-trusted'
    },
    User: {
        shortLabel: 'User',
        className: 'x-tag-known'
    },
    'New User': {
        shortLabel: 'New',
        className: 'x-tag-basic'
    },
    Visitor: {
        shortLabel: 'Visitor',
        className: 'x-tag-untrusted'
    }
};

export function getTrustLevelMeta(level) {
    return (
        TRUST_LEVEL_META[level] || {
            shortLabel: level || '-',
            className: 'text-muted-foreground border-muted-foreground/40'
        }
    );
}

export function buildTrustLevelTimeline(rows = []) {
    return rows
        .filter((row) => row?.type === 'TrustLevel')
        .slice()
        .sort((a, b) => {
            const byDate = getTimestamp(b.created_at) - getTimestamp(a.created_at);
            if (byDate !== 0) {
                return byDate;
            }
            return (b.rowId || 0) - (a.rowId || 0);
        })
        .map((row) => ({
            id: row.rowId || `${row.userId || ''}-${row.created_at || ''}-${row.trustLevel || ''}`,
            createdAt: row.created_at,
            from: row.previousTrustLevel || '',
            to: row.trustLevel || '',
            fromMeta: getTrustLevelMeta(row.previousTrustLevel),
            toMeta: getTrustLevelMeta(row.trustLevel)
        }));
}
