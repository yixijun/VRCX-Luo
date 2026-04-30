// requires binding of WebApi

class WebApiService {
    clearCookies() {
        return WebApi.ClearCookies();
    }

    getCookies() {
        return WebApi.GetCookies();
    }

    setCookies(cookie) {
        return WebApi.SetCookies(cookie);
    }

    createSecondaryClient(accountId) {
        return WebApi.CreateSecondaryClient(accountId);
    }

    destroySecondaryClient(accountId) {
        return WebApi.DestroySecondaryClient(accountId);
    }

    getSecondaryCookies(accountId) {
        return WebApi.GetSecondaryCookies(accountId);
    }

    setSecondaryCookies(accountId, cookies) {
        return WebApi.SetSecondaryCookies(accountId, cookies);
    }

    /**
     * @param {any} options
     * @returns {Promise<{status: number, data?: string}>}
     */
    async execute(options) {
        if (!options) {
            throw new Error('options is required');
        }
        if (LINUX) {
            const requestJson = JSON.stringify(options);
            var json = await WebApi.ExecuteJson(requestJson);
            var data = JSON.parse(json);
            if (data.status === -1) {
                throw new Error(data.message);
            }
            return {
                status: data.status,
                data: data.message
            };
        }

        var item = await WebApi.Execute(options);
        if (item.Item1 === -1) {
            throw item.Item2;
        }
        return {
            status: item.Item1,
            data: item.Item2
        };
    }

    /**
     * Execute a request as a specific secondary account.
     * @param {string} accountId
     * @param {any} options
     * @returns {Promise<{status: number, data?: string}>}
     */
    async executeAs(accountId, options) {
        if (!options) {
            throw new Error('options is required');
        }
        if (LINUX) {
            const requestJson = JSON.stringify(options);
            const json = await WebApi.ExecuteAsJson(accountId, requestJson);
            const data = JSON.parse(json);
            if (data.status === -1) {
                throw new Error(data.message);
            }
            return {
                status: data.status,
                data: data.message
            };
        }

        const item = await WebApi.ExecuteAs(accountId, options);
        if (item.Item1 === -1) {
            throw item.Item2;
        }
        return {
            status: item.Item1,
            data: item.Item2
        };
    }
}

var self = new WebApiService();
window.webApiService = self;

export { self as default, WebApiService };
