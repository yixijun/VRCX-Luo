using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text;
using System.Threading;
using Valve.VR;

namespace VRCX;

internal sealed class DashboardOverlay
{
    public const string Key = "app.vrcx.luo.dashboard";
    private ulong _handle;
    private ulong _thumbnail;
    private bool _pressed;
    private bool _visible;
    private int _keyboardRequested;
    internal void RequestKeyboard(string json = "")
    {
        var flags = 1;
        try
        {
            using var data = JsonDocument.Parse(json);
            if (data.RootElement.ValueKind != JsonValueKind.Object) return;
            if (data.RootElement.TryGetProperty("password", out var password) && password.ValueKind == JsonValueKind.True) flags |= 2;
            if (data.RootElement.TryGetProperty("multiline", out var multiline) && multiline.ValueKind == JsonValueKind.True) flags |= 4;
        }
        catch (JsonException) { }
        Interlocked.Exchange(ref _keyboardRequested, flags);
    }
    private DateTime _nextSync;
    private DateTime _nextTexture;

    public void Reset()
    {
        _handle = _thumbnail = 0;
        _pressed = _visible = false;
        _nextSync = _nextTexture = DateTime.MinValue;
        _keyboardRequested = 0;
    }

    public EVROverlayError Update(CVROverlay overlay, string baseDirectory,
        Action<ulong> draw, Action<string, string> publish)
    {
        if (_handle == 0)
        {
            var error = overlay.CreateDashboardOverlay(Key, "VRCX-Luo", ref _handle, ref _thumbnail);
            if (error != EVROverlayError.None) return error;
            overlay.SetOverlayFromFile(_thumbnail, Path.Join(baseDirectory, "VRCX.png"));
            overlay.SetOverlayWidthInMeters(_handle, 1.5f);
            overlay.SetOverlayInputMethod(_handle, VROverlayInputMethod.Mouse);
            overlay.SetOverlayFlag(_handle, VROverlayFlags.NoDashboardTab, false);
            overlay.SetOverlayFlag(_handle, VROverlayFlags.SendVRDiscreteScrollEvents, true);
            var scale = new HmdVector2_t { v0 = 1024, v1 = 1024 };
            overlay.SetOverlayMouseScale(_handle, ref scale);
        }
        var active = overlay.IsDashboardVisible() && overlay.IsActiveDashboardOverlay(_handle);
        if (active != _visible || DateTime.UtcNow >= _nextSync)
        {
            publish("dashboardVisibility", JsonSerializer.Serialize(active));
            _nextSync = DateTime.UtcNow.AddSeconds(1);
        }
        _visible = active;
        if (active)
        {
            var keyboardFlags = Interlocked.Exchange(ref _keyboardRequested, 0);
            if (keyboardFlags != 0) overlay.ShowKeyboardForOverlay(_handle, (keyboardFlags & 2) != 0 ? 1 : 0, (keyboardFlags & 4) != 0 ? 1 : 0, 0, "VRCX-Luo", 1024, "", 0);
        }
        if (active || DateTime.UtcNow >= _nextTexture)
        {
            draw(_handle);
            _nextTexture = DateTime.UtcNow.AddSeconds(1);
        }
        var e = new VREvent_t();
        while (overlay.PollNextOverlayEvent(_handle, ref e, (uint)Marshal.SizeOf(e)))
        {
            if ((EVREventType)e.eventType == EVREventType.VREvent_KeyboardDone)
            {
                var text = new StringBuilder(1024);
                overlay.GetKeyboardText(text, 1024);
                if (text.Length > 0) publish("dashboardKeyboardText", JsonSerializer.Serialize(text.ToString()));
                continue;
            }
            if (!active) { _pressed = false; continue; }
            var type = (EVREventType)e.eventType;
            if (type == EVREventType.VREvent_MouseButtonDown && e.data.mouse.button == (uint)EVRMouseButton.Left)
                _pressed = true;
            if (type == EVREventType.VREvent_MouseMove || type == EVREventType.VREvent_MouseButtonUp || type == EVREventType.VREvent_MouseButtonDown)
            {
                if (!float.IsFinite(e.data.mouse.x) || !float.IsFinite(e.data.mouse.y)) continue;
                var click = type == EVREventType.VREvent_MouseButtonUp && _pressed && e.data.mouse.button == (uint)EVRMouseButton.Left;
                if (type == EVREventType.VREvent_MouseButtonUp) _pressed = false;
                publish("dashboardInput", JsonSerializer.Serialize(new {
                    x = Math.Clamp(e.data.mouse.x / 1024f, 0, 1),
                    y = Math.Clamp(1 - e.data.mouse.y / 1024f, 0, 1), click,
                    phase = type == EVREventType.VREvent_MouseButtonDown ? "down" : type == EVREventType.VREvent_MouseButtonUp ? "up" : "move",
                    button = e.data.mouse.button == (uint)EVRMouseButton.Right ? "right" : e.data.mouse.button == (uint)EVRMouseButton.Middle ? "middle" : "left",
                    pressed = _pressed
                }));
            }
            if (type == EVREventType.VREvent_ScrollDiscrete)
                publish("dashboardInput", JsonSerializer.Serialize(new { scroll = -e.data.scroll.ydelta * 120, scrollX = -e.data.scroll.xdelta * 120 }));
        }
        if (!active) _pressed = false;
        return EVROverlayError.None;
    }
}
