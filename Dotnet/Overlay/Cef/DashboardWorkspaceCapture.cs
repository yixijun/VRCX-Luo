using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.DevTools;
using CefSharp.DevTools.Input;
using CefSharp.DevTools.Page;
using NLog;

namespace VRCX;

// Render the dedicated VR layout in the owning session. Never creates a second
// application, login, database connection, or view of the Windows desktop.
internal sealed class DashboardWorkspaceCapture
{
    internal static readonly DashboardWorkspaceCapture Instance = new();
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private CancellationTokenSource? _cancellation;
    private Task? _captureTask;
    private DevToolsClient? _client;
    private long _leaseExpires;
    private double _viewportWidth = DashboardWorkspaceInput.Width;
    private double _viewportHeight = DashboardWorkspaceInput.Height;
    private long _lastClick;
    private double _lastX, _lastY;
    private string _lastButton = "left";
    private int _clickCount = 1;
    private int _pressedButtons;

    internal bool Active => _cancellation != null && !_cancellation.IsCancellationRequested && _captureTask is { IsCompleted: false };

    internal async Task<bool> SetEnabled(bool enabled)
    {
        await _gate.WaitAsync();
        try
        {
            if (!enabled)
            {
                _cancellation?.Cancel();
                if (_captureTask != null) await _captureTask;
                _cancellation?.Dispose();
                _cancellation = null;
                _captureTask = null;
                return true;
            }
            RenewLease();
            if (Active && _captureTask is { IsCompleted: false }) return true;
            var browser = MainForm.Instance?.Browser;
            if (browser == null || browser.IsDisposed || !browser.IsBrowserInitialized) return false;
            _client = browser.GetDevToolsClient();
            await _client.Emulation.SetDeviceMetricsOverrideAsync(DashboardWorkspaceInput.Width, DashboardWorkspaceInput.Height, 1, false);
            _cancellation?.Dispose();
            _cancellation = new CancellationTokenSource();
            var token = _cancellation.Token;
            var client = _client;
            _captureTask = Task.Run(() => Capture(client, token));
            return true;
        }
        catch (Exception error) { Logger.Warn(error, "VR workspace could not start"); return false; }
        finally { _gate.Release(); }
    }

    internal void RenewLease() => Interlocked.Exchange(ref _leaseExpires, Stopwatch.GetTimestamp() + Stopwatch.Frequency * 15);


    private async Task Capture(DevToolsClient client, CancellationToken token)
    {
        try
        {
            while (!token.IsCancellationRequested && Stopwatch.GetTimestamp() < Interlocked.Read(ref _leaseExpires))
            {
                var metrics = await client.Page.GetLayoutMetricsAsync();
                var width = metrics.CssVisualViewport.ClientWidth;
                var height = metrics.CssVisualViewport.ClientHeight;
                if (width <= 0 || height <= 0) break;
                Volatile.Write(ref _viewportWidth, width);
                Volatile.Write(ref _viewportHeight, height);
                var response = await client.Page.CaptureScreenshotAsync(CaptureScreenshotFormat.Jpeg, quality: 82,
                    clip: new Viewport { X = 0, Y = 0, Width = width, Height = height, Scale = 1 }, fromSurface: true, captureBeyondViewport: false);
                var payload = JsonSerializer.Serialize(new { image = "data:image/jpeg;base64," + Convert.ToBase64String(response.Data), width, height });
                await OverlayServer.Instance.SendMessageAsync(new OverlayMessage { Type = OverlayMessageType.JsFunctionCall, FunctionName = "dashboardWorkspaceFrame", Data = payload });
                await Task.Delay(100, token);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception error) { Logger.Warn(error, "VR workspace rendering stopped"); }
        finally
        {
            try
            {
                foreach (var button in new[] { MouseButton.Left, MouseButton.Right, MouseButton.Middle })
                    if ((_pressedButtons & (button == MouseButton.Left ? 1 : button == MouseButton.Right ? 2 : 4)) != 0)
                        await client.Input.DispatchMouseEventAsync(DispatchMouseEventType.MouseReleased, _lastX * _viewportWidth, _lastY * _viewportHeight, button: button, buttons: 0, clickCount: _clickCount);
                _pressedButtons = 0;
            }
            catch { }
            try { await client.Emulation.ClearDeviceMetricsOverrideAsync(); } catch { }
            client.Dispose();
            _client = null;
            var browser = MainForm.Instance?.Browser;
            if (browser?.CanExecuteJavascriptInMainFrame == true) await browser.EvaluateScriptAsync("window.closeVrWorkspace?.()");
            if (!token.IsCancellationRequested)
                OverlayServer.Instance.SendMessage(new OverlayMessage { Type = OverlayMessageType.JsFunctionCall, FunctionName = "dashboardWorkspaceStatus", Data = JsonSerializer.Serialize(new { error = "工作区连接已中断，请重试", closed = true }) });
        }
    }

    internal async Task<bool> Input(string json)
    {
        var input = DashboardWorkspaceInput.Parse(json);
        if (input == null) return false;
        await _gate.WaitAsync();
        try
        {
            var client = _client;
            if (!Active || client == null) return false;
            RenewLease();
            if (input.Type == "text") await client.Input.InsertTextAsync(input.Text);
            else if (input.Type == "key")
            {
                var code = input.Key switch { "Escape" => 27, "Enter" => 13, "Backspace" => 8, "Tab" => 9, "ArrowLeft" => 37, "ArrowUp" => 38, "ArrowRight" => 39, "ArrowDown" => 40, "SelectAll" => 65, _ => 0 };
                var key = input.Key == "SelectAll" ? "a" : input.Key;
                await client.Input.DispatchKeyEventAsync(DispatchKeyEventType.KeyDown, modifiers: input.Key == "SelectAll" ? 2 : 0, key: key, text: input.Key == "Enter" ? "\r" : null, windowsVirtualKeyCode: code);
                await client.Input.DispatchKeyEventAsync(DispatchKeyEventType.KeyUp, key: key, windowsVirtualKeyCode: code);
            }
            else
            {
                var type = input.Type switch { "down" => DispatchMouseEventType.MousePressed, "up" => DispatchMouseEventType.MouseReleased, "scroll" => DispatchMouseEventType.MouseWheel, _ => DispatchMouseEventType.MouseMoved };
                var button = input.Button switch { "right" => MouseButton.Right, "middle" => MouseButton.Middle, _ => MouseButton.Left };
                var buttonMask = button == MouseButton.Left ? 1 : button == MouseButton.Right ? 2 : 4;
                if (input.Type == "down")
                {
                    var now = Stopwatch.GetTimestamp();
                    _clickCount = _clickCount == 1 && input.Button == _lastButton && (now - _lastClick) < Stopwatch.Frequency / 2 && Math.Abs(input.X - _lastX) < .01 && Math.Abs(input.Y - _lastY) < .01 ? 2 : 1;
                    _lastClick = now;
                    _lastButton = input.Button;
                    _pressedButtons |= buttonMask;
                }
                if (input.Type == "up") _pressedButtons &= ~buttonMask;
                _lastX = input.X; _lastY = input.Y;
                await client.Input.DispatchMouseEventAsync(type,
                    Math.Min(input.X * Volatile.Read(ref _viewportWidth), Volatile.Read(ref _viewportWidth) - .5),
                    Math.Min(input.Y * Volatile.Read(ref _viewportHeight), Volatile.Read(ref _viewportHeight) - .5),
                    button: input.Type == "scroll" || (input.Type == "move" && !input.Pressed) ? MouseButton.None : button,
                    buttons: input.Pressed ? (button == MouseButton.Right ? 2 : button == MouseButton.Middle ? 4 : 1) : 0,
                    clickCount: input.Type is "down" or "up" ? _clickCount : 0, deltaX: input.Type == "scroll" ? input.DeltaX : null, deltaY: input.Type == "scroll" ? input.DeltaY : null);
            }
            return true;
        }
        catch (Exception error) { Logger.Warn(error, "VR workspace input failed"); return false; }
        finally { _gate.Release(); }
    }
}
