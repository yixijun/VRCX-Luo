import { router } from './router';
import { startRendererMemoryThresholdReport } from './rendererMemoryReport';

import configRepository from '../services/config';

export async function isSentryOptedIn() {
    return NIGHTLY && configRepository.getBool('VRCX_SentryEnabled', false);
}

/**
 * Guarded import, prevents leaking Sentry into non-nightly bundles.
 */
export function getSentry() {
    return NIGHTLY ? import('@sentry/vue') : null;
}

export async function initSentry(app) {
    if (!NIGHTLY) return;

    try {
        if (!(await isSentryOptedIn())) return;

        const vrcxId = await configRepository.getString('VRCX_id', '');
        const response = await webApiService.execute({
            url: 'https://api0.vrcx.app/errorreporting/getdsn',
            method: 'GET',
            headers: {
                Referer: 'https://vrcx.app',
                'VRCX-ID': vrcxId
            }
        });
        if (response.status !== 200) {
            console.error(
                'Failed to get Sentry DSN:',
                response.status,
                response.data
            );
            return;
        }
        const dsn = atob(response.data);
        const Sentry = await getSentry();
        Sentry.init({
            app,
            dsn,
            environment: 'nightly',
            release: VERSION,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 1.0,
            tracesSampleRate: 0.0001,
            beforeSend(event, hint) {
                const error = hint.originalException;
                const errorMessage =
                    error &&
                    /** @type {{ message?: unknown }} */ (error).message;
                if (typeof errorMessage === 'string') {
                    if (
                        errorMessage.includes('401') ||
                        errorMessage.includes('403') ||
                        errorMessage.includes('404') ||
                        errorMessage.includes('500') ||
                        errorMessage.includes('503') ||
                        errorMessage.includes('No such host is known') ||
                        errorMessage.includes(
                            'The SSL connection could not be established'
                        ) ||
                        errorMessage.includes('A connection attempt failed') ||
                        errorMessage.includes(
                            'no data of the requested type was found'
                        ) ||
                        errorMessage.includes(
                            'An error occurred while sending the request'
                        ) ||
                        errorMessage.includes('database or disk is full') ||
                        errorMessage.includes('disk I/O error') ||
                        errorMessage.includes(
                            'There is not enough space on the disk.'
                        ) ||
                        errorMessage.includes(
                            'The requested address is not valid in its context.'
                        )
                    ) {
                        return null;
                    }
                    return event;
                }
                return event;
            },

            integrations: [
                Sentry.replayIntegration({
                    maskAllText: true,
                    blockAllMedia: true
                }),
                Sentry.browserTracingIntegration({ router }),
                Sentry.vueIntegration({
                    tracingOptions: {
                        trackComponents: true
                    }
                })
            ]
        });
        console.log('Sentry initialized');

        startRendererMemoryThresholdReport(Sentry, {
            thresholdRatio: 0.8,
            intervalMs: 10_000,
            cooldownMs: 5 * 60_000
        });
    } catch (e) {
        console.error('Failed to initialize Sentry:', e);
        return;
    }
}
