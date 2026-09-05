function normalizeTrayNotificationSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return { total: 0, items: [] };
    }
    const items = Array.isArray(snapshot.items)
        ? snapshot.items.slice(0, 4).map((item) => ({
              id: String(item?.id || ''),
              title: String(item?.title || '通知').slice(0, 80),
              body: String(item?.body || '').slice(0, 180),
              actions: Array.isArray(item?.actions)
                  ? item.actions.slice(0, 3).map((action) => ({
                        id: String(action?.id || ''),
                        label: String(action?.label || '')
                    }))
                  : []
          }))
        : [];
    return {
        total: Number.isFinite(Number(snapshot.total))
            ? Math.max(0, Number(snapshot.total))
            : items.length,
        items
    };
}

function buildTrayToolTip(snapshot) {
    const { total, items } = snapshot;
    if (!items.length) return 'VRCX-Luo';
    const lines = [`VRCX-Luo · ${total} 条待处理通知`];
    for (const item of items.slice(0, 3)) {
        lines.push(
            `${item.title}${item.body ? `：${item.body}` : ''}`.slice(0, 100)
        );
    }
    return lines.join('\n');
}

module.exports = {
    buildTrayToolTip,
    normalizeTrayNotificationSnapshot
};
