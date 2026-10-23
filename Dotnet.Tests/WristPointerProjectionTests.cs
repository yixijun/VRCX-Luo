using System;
using System.Runtime.InteropServices;
using Valve.VR;
using VRCX;
using Xunit;

namespace VRCX.Tests;

public class WristPointerProjectionTests
{
    [Theory]
    [InlineData(1.5f, 0.25f, 0.02f)]
    [InlineData(1.5f, 0.25f, 0.98f)]
    [InlineData(1.5f, 0.25f, 0.5f)]
    [InlineData(1.5f, 0.25f, 0f)]
    [InlineData(1.5f, 0.25f, 1f)]
    [InlineData(1f, 0.25f, 0.001f)]
    [InlineData(1f, 0.25f, 0.999f)]
    public void DisplayedEdgesRemainSelectableWhenNativeHitRectangleIsTruncated(float aspectHeight, float runtimeScale, float targetY)
    {
        var halfWidth = runtimeScale / 2;
        var halfHeight = halfWidth * aspectHeight;
        var intersections = 0;
        var table = new IVROverlay
        {
            GetOverlayTransformTrackedDeviceRelative = (ulong handle, ref uint device, ref HmdMatrix34_t pose) =>
            {
                device = 0;
                pose = new HmdMatrix34_t { m0 = .25f, m5 = .25f, m10 = .25f };
                return EVROverlayError.None;
            },
            GetOverlayWidthInMeters = (ulong handle, ref float width) => { width = 1; return EVROverlayError.None; },
            GetOverlayTextureSize = (ulong handle, ref uint width, ref uint height) => { width=1024; height=(uint)(1536*aspectHeight); return EVROverlayError.None; },
            GetOverlayTextureBounds = (ulong handle, ref VRTextureBounds_t bounds) => { bounds=new VRTextureBounds_t{uMax=.5f,vMax=1f/3f}; return EVROverlayError.None; },
            GetOverlayTexelAspect = (ulong handle, ref float aspect) => { aspect=1; return EVROverlayError.None; },
            ComputeOverlayIntersection = (ulong handle, ref VROverlayIntersectionParams_t parameters, ref VROverlayIntersectionResults_t result) =>
            {
                intersections++;
                var sx = parameters.vSource.v0;
                var sy = parameters.vSource.v1;
                // Captured SteamVR behavior: native hit plane is only 2/3
                // of the displayed cropped texture height.
                if (Math.Abs(sx) > halfWidth || Math.Abs(sy) > halfHeight*2/3) return false;
                result.vPoint = new HmdVector3_t { v0 = sx, v1 = sy };
                return true;
            }
        };
        var memory = Marshal.AllocHGlobal(Marshal.SizeOf<IVROverlay>());
        try
        {
            Marshal.StructureToPtr(table, memory, false);
            var poses = new[] { new TrackedDevicePose_t { bPoseIsValid = true, bDeviceIsConnected = true,
                mDeviceToAbsoluteTracking = new HmdMatrix34_t { m0 = 1, m5 = 1, m10 = 1 } } };
            var ray = new WristPointerRay(new System.Numerics.Vector3(0, (0.5f-targetY)*halfHeight*2, 1), -System.Numerics.Vector3.UnitZ);
            var projection = new WristPointerOverlayProjection();
            var overlay = new CVROverlay(memory);
            Assert.True(projection.TryIntersect(overlay,1,ray,poses,out var x,out var y));
            Assert.Equal(.5f,x,3);
            Assert.Equal(targetY,y,3);
            var measuredCalls = intersections;
            Assert.True(projection.TryIntersect(overlay,1,ray,poses,out _,out _));
            Assert.Equal(measuredCalls, intersections);
            var beforeReset = intersections;
            Assert.True(projection.TryIntersect(overlay,1,ray,poses,out _,out _));
            Assert.Equal(beforeReset, intersections);
        }
        finally { Marshal.FreeHGlobal(memory); GC.KeepAlive(table); }
    }

    [Fact]
    public void DisplayedAtlasGeometryIgnoresNativeUvCompression()
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
            GetOverlayTextureSize = (ulong handle, ref uint width, ref uint height) => { width=1024; height=1536; return EVROverlayError.None; },
            GetOverlayTextureBounds = (ulong handle, ref VRTextureBounds_t bounds) => { bounds=new VRTextureBounds_t{uMax=.5f,vMax=1f/3f}; return EVROverlayError.None; },
            GetOverlayTexelAspect = (ulong handle, ref float aspect) => { aspect=1; return EVROverlayError.None; },
            ComputeOverlayIntersection = (ulong handle, ref VROverlayIntersectionParams_t parameters, ref VROverlayIntersectionResults_t result) =>
            {
                var sx = parameters.vSource.v0;
                var sy = parameters.vSource.v1;
                if (sx < .875f || sx > 1.125f || sy < 1.875f || sy > 2.125f) return false;
                result.vUVs = new HmdVector2_t { v0 = 0.02f, v1 = 0.03f };
                result.vPoint = new HmdVector3_t { v0 = sx, v1 = sy, v2 = 3 };
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
            var ray = new WristPointerRay(new System.Numerics.Vector3(.9375f,1.9375f,4),-System.Numerics.Vector3.UnitZ);
            Assert.True(new WristPointerOverlayProjection().TryIntersect(new CVROverlay(memory), 1, ray, poses, out var x, out var y));
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
