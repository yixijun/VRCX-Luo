using System;
using System.Numerics;
using System.Text.Json;

namespace VRCX;

/// <summary>
/// Small, host-independent pieces of the wrist pointer contract.
/// OpenVR overlay UVs use a lower-left origin while DOM coordinates use an
/// upper-left origin, so the conversion belongs at this boundary.
/// </summary>
public static class WristPointerMath
{
    public static Vector3 GetControllerForward(float matrixM2, float matrixM6, float matrixM10)
    {
        return new Vector3(-matrixM2, -matrixM6, -matrixM10);
    }

    /// <summary>
    /// Builds a world-space pointer ray from the controller pose and its
    /// render-model tip (the pose SteamVR exposes for aim/pointer input).
    /// Both transforms are expressed in the same tracking space.
    /// </summary>
    public static bool TryCreateTipRay(
        Vector3 deviceOrigin,
        Vector3 deviceAxisX,
        Vector3 deviceAxisY,
        Vector3 deviceAxisZ,
        Vector3 componentOrigin,
        Vector3 componentAxisX,
        Vector3 componentAxisY,
        Vector3 componentAxisZ,
        out WristPointerRay ray
    )
    {
        var source = deviceOrigin +
            deviceAxisX * componentOrigin.X +
            deviceAxisY * componentOrigin.Y +
            deviceAxisZ * componentOrigin.Z;
        var componentForward = -componentAxisZ;
        var direction = deviceAxisX * componentForward.X +
            deviceAxisY * componentForward.Y +
            deviceAxisZ * componentForward.Z;

        return TryNormalizeRay(source, direction, out ray);
    }

    public static bool TryNormalizeRay(Vector3 source, Vector3 direction, out WristPointerRay ray)
    {
        ray = default;
        if (!IsFinite(source) || !IsFinite(direction))
        {
            return false;
        }

        var lengthSquared = direction.LengthSquared();
        if (!float.IsFinite(lengthSquared) || lengthSquared < 0.000001f)
        {
            return false;
        }

        ray = new WristPointerRay(source, Vector3.Normalize(direction));
        return true;
    }

    public static bool TryConvertOverlayUv(float u, float v, out float x, out float y)
    {
        x = 0f;
        y = 0f;
        if (!float.IsFinite(u) || !float.IsFinite(v) || u < 0f || u > 1f || v < 0f || v > 1f)
        {
            return false;
        }

        x = u;
        y = 1f - v;
        return true;
    }

    public static string CreatePayload(float x, float y, bool visible, bool pressed, string hand)
    {
        return JsonSerializer.Serialize(new
        {
            x,
            y,
            visible,
            pressed,
            hand
        });
    }

    private static bool IsFinite(Vector3 value)
    {
        return float.IsFinite(value.X) && float.IsFinite(value.Y) && float.IsFinite(value.Z);
    }
}

public readonly struct WristPointerRay
{
    public WristPointerRay(Vector3 source, Vector3 direction)
    {
        Source = source;
        Direction = direction;
    }

    public Vector3 Source { get; }
    public Vector3 Direction { get; }
}
