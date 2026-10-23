using System.Numerics;
using Valve.VR;

namespace VRCX;

internal sealed class WristPointerOverlayProjection
{
    private ulong _measuredHandle;
    private float _measuredWidth;
    private float _halfWidth;
    private float _halfHeight;

    public void Reset() => _measuredHandle = 0;

    public bool TryIntersect(CVROverlay overlay, ulong handle, WristPointerRay ray,
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

        var transform = ToMatrix(relative) * ToMatrix(poses[device].mDeviceToAbsoluteTracking);
        if (_measuredHandle != handle || _measuredWidth != width)
        {
            // A square texture crop does not guarantee a square runtime hit
            // plane. Measure the actual intersection boundaries once per
            // overlay lifecycle, including runtime treatment of pose scale.
            var normal = Vector3.TransformNormal(Vector3.UnitZ, transform);
            if (!WristPointerMath.TryNormalizeRay(Vector3.Zero, normal, out var normalRay))
                return false;
            normal = normalRay.Direction;
            if (Vector3.Dot(normal, ray.Direction) > 0) normal = -normal;
            if (!TryMeasureHalfExtent(overlay, handle, transform, normal, Vector3.UnitX, width, out var halfWidth) ||
                !TryMeasureHalfExtent(overlay, handle, transform, normal, Vector3.UnitY, width, out var halfHeight))
                return false;
            _halfWidth = halfWidth;
            _halfHeight = halfHeight;
            _measuredWidth = width;
            _measuredHandle = handle;
        }

        return WristPointerMath.TryProjectOverlayPoint(
            new Vector3(result.vPoint.v0, result.vPoint.v1, result.vPoint.v2),
            transform, _halfWidth * 2, _halfHeight * 2, out x, out y);
    }

    private static bool TryMeasureHalfExtent(CVROverlay overlay, ulong handle, Matrix4x4 transform,
        Vector3 normal, Vector3 axis, float initialExtent, out float extent)
    {
        extent = 0;
        if (!float.IsFinite(initialExtent) || initialExtent <= 0) return false;
        bool Hit(float offset)
        {
            var source = Vector3.Transform(axis * offset, transform) + normal;
            var parameters = new VROverlayIntersectionParams_t {
                vSource = new HmdVector3_t { v0 = source.X, v1 = source.Y, v2 = source.Z },
                vDirection = new HmdVector3_t { v0 = -normal.X, v1 = -normal.Y, v2 = -normal.Z },
                eOrigin = ETrackingUniverseOrigin.TrackingUniverseStanding
            };
            var result = new VROverlayIntersectionResults_t();
            return overlay.ComputeOverlayIntersection(handle, ref parameters, ref result);
        }
        if (!Hit(0)) return false;
        float low = 0, high = initialExtent;
        var bracketed = false;
        for (var i = 0; i < 8; i++)
        {
            if (!Hit(high)) { bracketed = true; break; }
            low = high;
            high *= 2;
        }
        if (!bracketed) return false;
        for (var i = 0; i < 16; i++)
        {
            var middle = (low + high) / 2;
            if (Hit(middle)) low = middle; else high = middle;
        }
        extent = (low + high) / 2;
        return extent > 0;
    }

    internal static Matrix4x4 ToMatrix(HmdMatrix34_t pose) => new(
        pose.m0, pose.m4, pose.m8, 0,
        pose.m1, pose.m5, pose.m9, 0,
        pose.m2, pose.m6, pose.m10, 0,
        pose.m3, pose.m7, pose.m11, 1);
}
