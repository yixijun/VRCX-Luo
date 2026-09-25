import Noty from 'noty';

import { escapeTag } from '../shared/utils';

const HITOKOTO_URL = 'https://v1.hitokoto.cn/?encode=json';
const HITOKOTO_TIMEOUT_MS = 3000;

/**
 * Shows the login greeting and fills in a Hitokoto beneath it.
 * @param {object} options
 * @param {string} options.displayName
 * @param {function} options.translate
 * @param {function} [options.createNotification]
 */
export function showLoginGreeting({
    displayName,
    translate,
    createNotification = (options) => new Noty(options)
}) {
    const greeting = translate('message.auth.login_greeting', {
        name: `<strong>${escapeTag(displayName)}</strong>`
    });
    const notification = createNotification({
        type: 'success',
        text: renderGreeting(greeting, translate('message.auth.hitokoto_loading'), '')
    });

    notification.show();
    fetchHitokoto()
        .then((quote) => {
            const text = quote?.text || translate('message.auth.hitokoto_fallback');
            const source = quote?.source || translate('message.auth.hitokoto_source');
            notification.setText(renderGreeting(greeting, text, source));
        })
        .catch(() => {
            notification.setText(
                renderGreeting(
                    greeting,
                    translate('message.auth.hitokoto_fallback'),
                    translate('message.auth.hitokoto_source')
                )
            );
        });

    return notification;
}

function renderGreeting(greeting, quote, source) {
    const quoteContent = escapeTag(quote);
    const attribution = source
        ? `<div style="margin-top:2px;text-align:right;font-size:0.84em;opacity:0.8;">— ${escapeTag(source)}</div>`
        : '';
    return `${greeting}<div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.24);font-size:0.92em;line-height:1.45;">${quoteContent}${attribution}</div>`;
}

async function fetchHitokoto() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HITOKOTO_TIMEOUT_MS);

    try {
        const response = await fetch(HITOKOTO_URL, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`Hitokoto request failed: ${response.status}`);
        }

        const result = await response.json();
        if (typeof result.hitokoto !== 'string' || !result.hitokoto.trim()) {
            throw new Error('Hitokoto response did not include a sentence.');
        }

        const source = [result.from_who, result.from]
            .filter((part) => typeof part === 'string' && part.trim())
            .map((part) => part.trim())
            .join(' · ');
        return { text: result.hitokoto.trim(), source };
    } finally {
        clearTimeout(timeout);
    }
}
