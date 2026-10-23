/* global module */
const WIDTH = 1280;
const HEIGHT = 1024;

function validateInput(input) {
    if (!input || typeof input !== 'object') return false;
    if (input.type === 'text')
        return (
            typeof input.text === 'string' &&
            input.text.length > 0 &&
            input.text.length <= 1024
        );
    if (input.type === 'key')
        return [
            'Escape',
            'Enter',
            'Backspace',
            'Tab',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'SelectAll'
        ].includes(input.key);
    if (!['move', 'down', 'up', 'scroll'].includes(input.type)) return false;
    if (
        ![input.x, input.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
    )
        return false;
    if (input.button && !['left', 'right', 'middle'].includes(input.button))
        return false;
    return (
        input.type !== 'scroll' ||
        [input.deltaX || 0, input.deltaY || 0].every(
            (n) => Number.isFinite(n) && Math.abs(n) <= 1200
        )
    );
}

function createVrWorkspaceCapture({ getWindow, publish }) {
    let active = false,
        session = 0,
        lease = 0,
        ownsDebugger = false,
        timer;
    let viewportWidth = WIDTH,
        viewportHeight = HEIGHT;
    const debuggerClient = () => getWindow()?.webContents?.debugger;
    async function onProtocolMessage(_event, method, data) {
        if (!active || method !== 'Page.fileChooserOpened') return;
        try {
            const files = await getWindow().webContents.executeJavaScript(
                `window.chooseVrUploadFiles(${JSON.stringify(data.mode)})`
            );
            if (active && Array.isArray(files) && files.length)
                await debuggerClient().sendCommand('DOM.setFileInputFiles', {
                    files,
                    backendNodeId: data.backendNodeId
                });
        } catch {
            /* Closing the workspace cancels pending file inputs. */
        }
    }
    async function stop() {
        active = false;
        session++;
        clearTimeout(timer);
        const client = debuggerClient();
        if (client?.isAttached()) {
            client.removeListener('message', onProtocolMessage);
            try {
                await client.sendCommand('Page.setInterceptFileChooserDialog', {
                    enabled: false
                });
            } catch {
                /* Window may be closing. */
            }
            try {
                await client.sendCommand(
                    'Emulation.clearDeviceMetricsOverride'
                );
            } catch {
                /* Window may be closing. */
            }
            if (ownsDebugger) client.detach();
        }
        ownsDebugger = false;
        const contents = getWindow()?.webContents;
        if (contents && !contents.isDestroyed())
            await contents.executeJavaScript('window.closeVrWorkspace?.()');
        return true;
    }
    async function frame(generation) {
        if (!active || generation !== session) return;
        if (Date.now() > lease || !getWindow() || getWindow().isDestroyed()) {
            await stop();
            return;
        }
        try {
            const metrics = await debuggerClient().sendCommand(
                'Page.getLayoutMetrics'
            );
            viewportWidth = metrics.cssVisualViewport.clientWidth;
            viewportHeight = metrics.cssVisualViewport.clientHeight;
            const result = await debuggerClient().sendCommand(
                'Page.captureScreenshot',
                {
                    format: 'jpeg',
                    quality: 82,
                    fromSurface: true,
                    captureBeyondViewport: false,
                    clip: {
                        x: 0,
                        y: 0,
                        width: viewportWidth,
                        height: viewportHeight,
                        scale: 1
                    }
                }
            );
            if (!active || generation !== session) return;
            publish(
                JSON.stringify({
                    image: `data:image/jpeg;base64,${result.data}`,
                    width: viewportWidth,
                    height: viewportHeight
                })
            );
            timer = setTimeout(() => frame(generation), 100);
        } catch {
            await stop();
        }
    }
    async function setEnabled(enabled) {
        if (typeof enabled !== 'boolean')
            throw new TypeError('enabled must be boolean');
        if (!enabled) return stop();
        lease = Date.now() + 15000;
        if (active) return true;
        const client = debuggerClient();
        if (!client) return false;
        try {
            ownsDebugger = !client.isAttached();
            if (ownsDebugger) client.attach('1.3');
            client.on('message', onProtocolMessage);
            await client.sendCommand('Page.enable');
            await client.sendCommand('Page.setInterceptFileChooserDialog', {
                enabled: true
            });
            await client.sendCommand('Emulation.setDeviceMetricsOverride', {
                width: WIDTH,
                height: HEIGHT,
                deviceScaleFactor: 1,
                mobile: false
            });
            active = true;
            frame(++session);
            return true;
        } catch {
            await stop();
            return false;
        }
    }
    async function input(event) {
        if (!active || !validateInput(event)) return false;
        lease = Date.now() + 15000;
        const client = debuggerClient();
        if (event.type === 'text')
            await client.sendCommand('Input.insertText', { text: event.text });
        else if (event.type === 'key') {
            const code = {
                Escape: 27,
                Enter: 13,
                Backspace: 8,
                Tab: 9,
                ArrowLeft: 37,
                ArrowUp: 38,
                ArrowRight: 39,
                ArrowDown: 40,
                SelectAll: 65
            }[event.key];
            const key = event.key === 'SelectAll' ? 'a' : event.key;
            await client.sendCommand('Input.dispatchKeyEvent', {
                type: 'keyDown',
                key,
                modifiers: event.key === 'SelectAll' ? 2 : 0,
                windowsVirtualKeyCode: code,
                ...(event.key === 'Enter' ? { text: '\r' } : {})
            });
            await client.sendCommand('Input.dispatchKeyEvent', {
                type: 'keyUp',
                key,
                windowsVirtualKeyCode: code
            });
        } else {
            const params = {
                type: {
                    move: 'mouseMoved',
                    down: 'mousePressed',
                    up: 'mouseReleased',
                    scroll: 'mouseWheel'
                }[event.type],
                x: Math.min(event.x * viewportWidth, viewportWidth - 0.5),
                y: Math.min(event.y * viewportHeight, viewportHeight - 0.5),
                button:
                    event.type === 'scroll' ||
                    (event.type === 'move' && !event.pressed)
                        ? 'none'
                        : event.button || 'left',
                buttons: event.pressed
                    ? { left: 1, right: 2, middle: 4 }[event.button || 'left']
                    : 0,
                clickCount: ['down', 'up'].includes(event.type) ? 1 : 0
            };
            if (event.type === 'scroll') {
                params.deltaX = event.deltaX || 0;
                params.deltaY = event.deltaY || 0;
            }
            await client.sendCommand('Input.dispatchMouseEvent', params);
        }
        return true;
    }
    return { setEnabled, input };
}
module.exports = { createVrWorkspaceCapture, validateInput };
