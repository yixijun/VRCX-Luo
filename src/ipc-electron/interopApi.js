import manifest from '../../src-electron/dotnetCapabilityManifest.cjs';

const { isAllowedDotNetClass, isAllowedDotNetMethod } = manifest;

class InteropApi {
    constructor() {
        return new Proxy(this, {
            get(target, prop) {
                if (WINDOWS) {
                    return undefined;
                }
                // If the property is not a method of InteropApi,
                // treat it as a .NET class name
                if (typeof prop === 'string' && !target[prop]) {
                    if (!isAllowedDotNetClass(prop)) {
                        return undefined;
                    }
                    return new Proxy(
                        {},
                        {
                            get(_, methodName) {
                                if (!isAllowedDotNetMethod(prop, methodName)) {
                                    return undefined;
                                }
                                // Return a method that calls the .NET method dynamically
                                return async (...args) => {
                                    return await target.callMethod(
                                        prop,
                                        methodName,
                                        ...args
                                    );
                                };
                            }
                        }
                    );
                }
                return target[prop];
            }
        });
    }

    async callMethod(className, methodName, ...args) {
        if (typeof className !== 'string' || typeof methodName !== 'string') {
            throw new TypeError(
                'InteropApi className and methodName must be strings'
            );
        }
        return window.interopApi
            .callDotNetMethod(className, methodName, args)
            .then((result) => {
                return result;
            });
    }
}

export default new InteropApi();
