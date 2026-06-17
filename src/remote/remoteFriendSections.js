const SECTION_DEFS = [
    ['favorite', '特别关注'],
    ['active', '游戏中'],
    ['online', '在线'],
    ['offline', '离线']
];

const MIN_SECTION_HEIGHT = 90;
const MAX_SECTION_HEIGHT = 520;
const DEFAULT_SECTION_HEIGHT = 180;

function clampFriendSectionHeight(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_SECTION_HEIGHT;
    }
    return Math.max(
        MIN_SECTION_HEIGHT,
        Math.min(MAX_SECTION_HEIGHT, Math.round(numeric))
    );
}

function friendMatchesQuery(friend, query = '') {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) {
        return true;
    }
    return [
        friend?.displayName,
        friend?.name,
        friend?.id,
        friend?.locationName,
        friend?.worldName,
        friend?.location,
        friend?.statusDescription
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
}

function friendStateTone(friend = {}) {
    return ['active', 'online'].includes(friend.state) ? friend.state : 'offline';
}

function friendDisplayModel(friend = {}) {
    const tone = friendStateTone(friend);
    const name = friend.displayName || friend.name || friend.id || '';
    const sidebarSubtitle =
        tone === 'online'
            ? friend.locationName ||
              friend.worldName ||
              friend.location ||
              friend.statusDescription ||
              ''
            : friend.statusDescription ||
              friend.locationName ||
              friend.worldName ||
              friend.location ||
              '';
    return {
        name,
        subtitle: sidebarSubtitle,
        tone,
        nameStyle: friend.userColour ? `color:${friend.userColour}` : ''
    };
}

function buildVisibleFriendSections({
    groups = {},
    sectionHeights = {},
    query = ''
} = {}) {
    return SECTION_DEFS.map(([key, title]) => {
        const friends = Array.isArray(groups[key])
            ? groups[key].filter((friend) => friendMatchesQuery(friend, query))
            : [];
        if (!friends.length) {
            return null;
        }
        return {
            key,
            title,
            count: friends.length,
            friends,
            height: clampFriendSectionHeight(sectionHeights[key])
        };
    }).filter(Boolean);
}

export {
    buildVisibleFriendSections,
    clampFriendSectionHeight,
    friendDisplayModel,
    friendMatchesQuery,
    friendStateTone
};
