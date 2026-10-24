using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.Json;
using Valve.VR;
using VRCX;
using Xunit;

namespace VRCX.Tests;

public class DashboardTests
{
    [Theory]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("invalid")]
    [InlineData("{\"id\":\"\",\"action\":\"refresh\"}")]
    [InlineData("{\"id\":\"one\",\"action\":\"execute\"}")]
    public void RejectsUnknownOrMalformedCommands(string json) => Assert.False(DashboardActionQueue.Enqueue(json));

    [Fact]
    public void QueueIsBoundedAndDrainsEachCommandOnce()
    {
        DashboardActionQueue.Drain();
        for (var i = 0; i < 32; i++) Assert.True(DashboardActionQueue.Enqueue($"{{\"id\":\"{i}\",\"action\":\"refresh\"}}"));
        Assert.False(DashboardActionQueue.Enqueue("{\"id\":\"overflow\",\"action\":\"refresh\"}"));
        Assert.Equal(32, DashboardActionQueue.Drain().Length);
        Assert.Empty(DashboardActionQueue.Drain());
    }

    [Fact]
    public void DashboardTabHasFullCanvasInputAndResetsAfterSteamVrRestart()
    {
        var events = new Queue<VREvent_t>();
        var published = new List<(string name, string json)>();
        var created = 0;
        var visible = true;
        var table = new IVROverlay
        {
            CreateDashboardOverlay = (IntPtr key, IntPtr name, ref ulong main, ref ulong thumbnail) => { created++; main = 10; thumbnail = 11; return EVROverlayError.None; },
            SetOverlayFromFile = (ulong handle, IntPtr path) => EVROverlayError.None,
            SetOverlayWidthInMeters = (ulong handle, float width) => EVROverlayError.None,
            SetOverlayInputMethod = (ulong handle, VROverlayInputMethod method) => { Assert.Equal(VROverlayInputMethod.Mouse, method); return EVROverlayError.None; },
            SetOverlayFlag = (ulong handle, VROverlayFlags flag, bool enabled) => { if (flag == VROverlayFlags.NoDashboardTab) Assert.False(enabled); return EVROverlayError.None; },
            SetOverlayMouseScale = (ulong handle, ref HmdVector2_t scale) => { Assert.Equal(1024, scale.v0); Assert.Equal(1024, scale.v1); return EVROverlayError.None; },
            IsDashboardVisible = () => visible,
            IsActiveDashboardOverlay = (ulong handle) => true,
            PollNextOverlayEvent = (ulong handle, ref VREvent_t e, uint size) => { if (!events.TryDequeue(out var next)) return false; e = next; return true; }
        };
        var memory = Marshal.AllocHGlobal(Marshal.SizeOf<IVROverlay>());
        try
        {
            Marshal.StructureToPtr(table, memory, false);
            var dashboard = new DashboardOverlay();
            var overlay = new CVROverlay(memory);
            void Update() => Assert.Equal(EVROverlayError.None, dashboard.Update(overlay, ".", _ => {}, (name, json) => published.Add((name, json))));
            // Full top and bottom edges map to the full UI instead of the atlas crop.
            foreach (var y in new[] { 0f, 1024f })
            {
                events.Enqueue(Mouse(EVREventType.VREvent_MouseButtonDown, y));
                events.Enqueue(Mouse(EVREventType.VREvent_MouseButtonUp, y));
                Update();
                using var data = JsonDocument.Parse(published[^1].json);
                Assert.True(data.RootElement.GetProperty("click").GetBoolean());
                Assert.Equal(1-y/1024f, data.RootElement.GetProperty("y").GetSingle());
            }
            events.Enqueue(Mouse(EVREventType.VREvent_MouseButtonDown, 512));
            Update();
            visible = false;
            Update();
            visible = true;
            events.Enqueue(Mouse(EVREventType.VREvent_MouseButtonUp, 512));
            Update();
            using var release = JsonDocument.Parse(published[^1].json);
            Assert.False(release.RootElement.GetProperty("click").GetBoolean());
            dashboard.Reset();
            Update();
            Assert.Equal(2, created);
        }
        finally { Marshal.FreeHGlobal(memory); GC.KeepAlive(table); }
    }

    [Fact]
    public void DashboardCanBeDisabledAndReenabledWithoutStaleInputOrRestart()
    {
        var events = new Queue<VREvent_t>();
        var published = new List<(string name, string json)>();
        var destroyed = new List<ulong>();
        var created = 0;
        var draws = 0;
        var keyboardHides = 0;
        var table = new IVROverlay
        {
            CreateDashboardOverlay = (IntPtr key, IntPtr name, ref ulong main, ref ulong thumbnail) => { created++; main = 10; thumbnail = 11; return EVROverlayError.None; },
            SetOverlayFromFile = (ulong handle, IntPtr path) => EVROverlayError.None,
            SetOverlayWidthInMeters = (ulong handle, float width) => EVROverlayError.None,
            SetOverlayInputMethod = (ulong handle, VROverlayInputMethod method) => EVROverlayError.None,
            SetOverlayFlag = (ulong handle, VROverlayFlags flag, bool enabled) => EVROverlayError.None,
            SetOverlayMouseScale = (ulong handle, ref HmdVector2_t scale) => EVROverlayError.None,
            IsDashboardVisible = () => true,
            IsActiveDashboardOverlay = (ulong handle) => true,
            HideKeyboard = () => keyboardHides++,
            HideOverlay = (ulong handle) => EVROverlayError.None,
            DestroyOverlay = (ulong handle) => { destroyed.Add(handle); return EVROverlayError.None; },
            PollNextOverlayEvent = (ulong handle, ref VREvent_t e, uint size) => { if (!events.TryDequeue(out var next)) return false; e = next; return true; }
        };
        var memory = Marshal.AllocHGlobal(Marshal.SizeOf<IVROverlay>());
        try
        {
            Marshal.StructureToPtr(table, memory, false);
            var dashboard = new DashboardOverlay();
            var overlay = new CVROverlay(memory);
            void Update() => Assert.Equal(EVROverlayError.None, dashboard.Update(overlay, ".", _ => draws++, (name, json) => published.Add((name, json))));

            dashboard.ApplyConfiguration("{\"dashboardEnabled\":false}");
            Update();
            Assert.Equal(0, created);
            Assert.Equal(0, draws);

            dashboard.ApplyConfiguration("{\"dashboardEnabled\":true}");
            events.Enqueue(Mouse(EVREventType.VREvent_MouseButtonDown, 512));
            Update();
            Assert.Equal(1, created);

            dashboard.ApplyConfiguration("{\"dashboardEnabled\":false}");
            Update();
            Assert.Equal(new ulong[] { 10, 11 }, destroyed);
            Assert.Equal(1, keyboardHides);
            Assert.Equal(("dashboardVisibility", "false"), published[^1]);
            var count = published.Count;
            dashboard.Reset(); // SteamVR restarting must preserve the user's disabled setting.
            foreach (var json in new[] { "invalid", "{}", "[]", "{\"dashboardEnabled\":\"true\"}" })
            {
                dashboard.ApplyConfiguration(json);
                Update();
            }
            Assert.Equal(1, created);
            Assert.Equal(1, draws);
            Assert.Equal(count, published.Count);

            dashboard.ApplyConfiguration("{\"dashboardEnabled\":true}");
            events.Enqueue(Mouse(EVREventType.VREvent_MouseButtonUp, 512));
            Update();
            Assert.Equal(2, created);
            using var release = JsonDocument.Parse(published[^1].json);
            Assert.False(release.RootElement.GetProperty("click").GetBoolean());
        }
        finally { Marshal.FreeHGlobal(memory); GC.KeepAlive(table); }
    }

    private static VREvent_t Mouse(EVREventType type, float y) => new()
    {
        eventType = (uint)type,
        data = new VREvent_Data_t { mouse = new VREvent_Mouse_t { x = 512, y = y, button = (uint)EVRMouseButton.Left } }
    };
}
