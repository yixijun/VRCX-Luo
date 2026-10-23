using System;
using System.Numerics;
using Valve.VR;

namespace VRCX;

internal sealed class WristPointerOverlayProjection
{
    public bool TryIntersect(CVROverlay overlay, ulong handle, WristPointerRay ray,
        TrackedDevicePose_t[] poses, out float x, out float y)
    {
        x = y = 0.5f;
        uint device = OpenVR.k_unTrackedDeviceIndexInvalid;
        var relative = new HmdMatrix34_t();
        float width = 0, texelAspect = 0;
        uint textureWidth = 0, textureHeight = 0;
        var bounds = new VRTextureBounds_t();
        if (overlay.GetOverlayTransformTrackedDeviceRelative(handle, ref device, ref relative) != EVROverlayError.None ||
            device >= poses.Length || !poses[device].bPoseIsValid || !poses[device].bDeviceIsConnected ||
            overlay.GetOverlayWidthInMeters(handle, ref width) != EVROverlayError.None ||
            overlay.GetOverlayTextureSize(handle, ref textureWidth, ref textureHeight) != EVROverlayError.None ||
            overlay.GetOverlayTextureBounds(handle, ref bounds) != EVROverlayError.None ||
            overlay.GetOverlayTexelAspect(handle, ref texelAspect) != EVROverlayError.None)
            return false;

        var cropWidth = textureWidth * Math.Abs(bounds.uMax - bounds.uMin);
        var cropHeight = textureHeight * Math.Abs(bounds.vMax - bounds.vMin);
        if (!float.IsFinite(cropWidth) || !float.IsFinite(cropHeight) || !float.IsFinite(texelAspect) ||
            cropWidth <= 0 || cropHeight <= 0 || texelAspect <= 0)
            return false;

        // Project onto the displayed quad, NOT ComputeOverlayIntersection's
        // hit rectangle: SteamVR can truncate the latter for atlas crops.
        var height = width * cropHeight / (cropWidth * texelAspect);
        return WristPointerMath.TryIntersectOverlayRay(ray,
            ToMatrix(relative) * ToMatrix(poses[device].mDeviceToAbsoluteTracking),
            width, height, out x, out y);
    }

    internal static Matrix4x4 ToMatrix(HmdMatrix34_t pose) => new(
        pose.m0, pose.m4, pose.m8, 0,
        pose.m1, pose.m5, pose.m9, 0,
        pose.m2, pose.m6, pose.m10, 0,
        pose.m3, pose.m7, pose.m11, 1);
}
