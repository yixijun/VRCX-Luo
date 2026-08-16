const DEFAULT_BOOP_EMOJI_GLYPHS = {
    Angry: '😠',
    Blushing: '😊',
    Crying: '😢',
    Frown: '🙁',
    'Hand Wave': '👋',
    'Hang Ten': '🤙',
    'In Love': '🥰',
    'Jack O Lantern': '🎃',
    Kiss: '😘',
    Laugh: '😂',
    Skull: '💀',
    Smile: '😄',
    'Spooky Ghost': '👻',
    Stoic: '😐',
    Sunglasses: '😎',
    Thinking: '🤔',
    'Thumbs Down': '👎',
    'Thumbs Up': '👍',
    'Tongue Out': '😛',
    Wow: '😮',
    'Arrow Point': '👉',
    "Can't see": '🙈',
    Hourglass: '⌛',
    Keyboard: '⌨️',
    'No Headphones': '🎧',
    'No Mic': '🎙️',
    Portal: '🌀',
    Shush: '🤫',
    Bats: '🦇',
    Cloud: '☁️',
    Fire: '🔥',
    'Snow Fall': '❄️',
    Snowball: '⚪',
    Splash: '💦',
    Web: '🕸️',
    Beer: '🍺',
    Candy: '🍬',
    'Candy Cane': '🍭',
    'Candy Corn': '🍬',
    Champagne: '🍾',
    Drink: '🥤',
    Gingerbread: '🍪',
    'Ice Cream': '🍦',
    Pineapple: '🍍',
    Pizza: '🍕',
    Tomato: '🍅',
    Beachball: '🏖️',
    Coal: '🪨',
    Confetti: '🎉',
    Gift: '🎁',
    Gifts: '🎁',
    'Life Ring': '🛟',
    Mistletoe: '💋',
    Money: '💰',
    'Neon Shades': '🕶️',
    'Sun Lotion': '🧴',
    Boo: '👻',
    'Broken Heart': '💔',
    Exclamation: '❗',
    Go: '🏃',
    Heart: '❤️',
    'Music Note': '🎵',
    Question: '❓',
    Stop: '🛑',
    Zzz: '💤'
};

function toDefaultBoopEmojiId(label) {
    return `default_${label.replace(/ /g, '_').toLowerCase()}`;
}

const emojiByToken = new Map(
    Object.entries(DEFAULT_BOOP_EMOJI_GLYPHS).map(([label, glyph]) => [
        toDefaultBoopEmojiId(label).slice('default_'.length),
        { label, glyph }
    ])
);

const TOKEN_ALIASES = {
    bat: 'bats',
    cant_see: "can't_see",
    wave: 'hand_wave'
};

function getDefaultBoopEmoji(value) {
    const token = String(value || '')
        .replace(/^default_/i, '')
        .trim()
        .toLowerCase();
    return emojiByToken.get(TOKEN_ALIASES[token] || token) || null;
}

export { DEFAULT_BOOP_EMOJI_GLYPHS, getDefaultBoopEmoji, toDefaultBoopEmojiId };
