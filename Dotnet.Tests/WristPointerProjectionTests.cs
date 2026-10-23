using System;
using System.Runtime.InteropServices;
using Valve.VR;
using VRCX;
using Xunit;

namespace VRCX.Tests;

public class WristPointerProjectionTests
{
    [Fact]
    public void HostIntersectionUsesWorldPointEvenWhenRuntimeUvsOnlyCoverSmallCorner()
    {
        var table = new IVROverlay
        {
            GetOverlayTransformTrackedDeviceRelative = (ulong handle, ref uint device, ref HmdMatrix34_t pose) =>
            {
                device = 0;
                pose = new HmdMatrix34_t { m0 = 0.25f, m5 = 0.25f, m10 = 0.25f };
                return EVROverlayError.None;
            },
            GetOverlayWidthInMeters = (ulong handle, ref float width) =>
            {
                width = 1;
                return EVROverlayError.None;
            },
            ComputeOverlayIntersection = (ulong handle, ref VROverlayIntersectionParams_t parameters, ref VROverlayIntersectionResults_t result) =>
            {
                result.vUVs = new HmdVector2_t { v0 = 0.02f, v1 = 0.03f };
                result.vPoint = new HmdVector3_t { v0 = 0.9375f, v1 = 1.9375f, v2 = 3 };
                return true;
            }
        };
        var memory = Marshal.AllocHGlobal(Marshal.SizeOf<IVROverlay>());
        try
        {
            Marshal.StructureToPtr(table, memory, false);
            var poses = new[] { new TrackedDevicePose_t {
                bPoseIsValid = true, bDeviceIsConnected = true,
                mDeviceToAbsoluteTracking = new HmdMatrix34_t { m0 = 1, m5 = 1, m10 = 1, m3 = 1, m7 = 2, m11 = 3 }
            } };
            Assert.True(WristPointerOverlayProjection.TryIntersect(new CVROverlay(memory), 1, default, poses, out var x, out var y));
            Assert.Equal(0.25f, x, 4);
            Assert.Equal(0.75f, y, 4);
        }
        finally
        {
            Marshal.FreeHGlobal(memory);
            GC.KeepAlive(table);
        }
    }
}
