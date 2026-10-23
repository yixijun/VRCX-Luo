using System.Numerics;
using Valve.VR;

namespace VRCX;

internal static class WristPointerOverlayProjection
{
    public static bool TryIntersect(CVROverlay overlay, ulong handle, WristPointerRay ray,
        TrackedDevicePose_t[] poses, out float x, out float y)
    {
        x = y = 0.5f;
        uint device = OpenVR.k_unTrackedDeviceIndexInvalid;
        var relative = new HmdMatrix34_t();
        float width = 0;
        if (overlay.GetOverlayTransformTrackedDeviceRelative(handle, ref device, ref relative) != EVROverlayError.None ||
            device >= poses.Length || !poses[device].bPoseIsValid || !poses[device].bDeviceIsConnected ||
            overlay.GetOverlayWidthInMeters(handle, ref width) != EVROverlayError.None)
            return false;

        var parameters = new VROverlayIntersectionParams_t
        {
            vSource = new HmdVector3_t { v0 = ray.Source.X, v1 = ray.Source.Y, v2 = ray.Source.Z },
            vDirection = new HmdVector3_t { v0 = ray.Direction.X, v1 = ray.Direction.Y, v2 = ray.Direction.Z },
            eOrigin = ETrackingUniverseOrigin.TrackingUniverseStanding
        };
        var result = new VROverlayIntersectionResults_t();
        if (!overlay.ComputeOverlayIntersection(handle, ref parameters, ref result))
            return false;

        // Both hosts display the same square 512x512 wrist crop. vPoint is
        // in the requested tracking space; do not infer a UV format from it.
        return WristPointerMath.TryProjectOverlayPoint(
            new Vector3(result.vPoint.v0, result.vPoint.v1, result.vPoint.v2),
            ToMatrix(relative) * ToMatrix(poses[device].mDeviceToAbsoluteTracking),
            width, width, out x, out y);
    }

    internal static Matrix4x4 ToMatrix(HmdMatrix34_t pose) => new(
        pose.m0, pose.m4, pose.m8, 0,
        pose.m1, pose.m5, pose.m9, 0,
        pose.m2, pose.m6, pose.m10, 0,
        pose.m3, pose.m7, pose.m11, 1);
}
