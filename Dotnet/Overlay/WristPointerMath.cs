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

    /// <summary>
    /// Converts the coordinates returned by OpenVR's overlay intersection API
    /// into normalized DOM coordinates. The documented contract is the
    /// configured mouse-scale pixel space, but some SteamVR runtimes return
    /// normalized UVs for the same call. Unit-range pairs are therefore kept
    /// as UVs, while larger values are normalized as pixels. The Y axis is
    /// flipped because OpenVR reports overlay coordinates from the lower edge
    /// while the wrist document is laid out from the upper edge.
    /// </summary>
    public static bool TryConvertOverlayPixels(
        float pixelX,
        float pixelY,
        float width,
        float height,
        out float x,
        out float y
    )
    {
        x = 0f;
        y = 0f;
        if (!float.IsFinite(pixelX) ||
            !float.IsFinite(pixelY) ||
            !float.IsFinite(width) ||
            !float.IsFinite(height) ||
            width <= 0f ||
            height <= 0f ||
            pixelX < 0f ||
            pixelX > width ||
            pixelY < 0f ||
            pixelY > height)
        {
            return false;
        }

        // SteamVR 1.x/2.x runtime combinations used by the production overlay
        // can return normalized UVs even after SetOverlayMouseScale. Dividing
        // those values by the scale collapses the pointer into the corner.
        if (width > 1f && height > 1f && pixelX <= 1f && pixelY <= 1f)
        {
            return TryConvertOverlayUv(pixelX, pixelY, out x, out y);
        }

        x = pixelX / width;
        y = 1f - pixelY / height;
        return true;
    }

    /// <summary>
    /// Selects the first usable overlay point from a preferred ray and its
    /// compatibility fallback. A miss keeps the pointer at the neutral center
    /// and lets the caller publish it as hidden.
    /// </summary>
    public static bool TrySelectOverlayPoint(
        bool preferredHit,
        float preferredX,
        float preferredY,
        bool fallbackHit,
        float fallbackX,
        float fallbackY,
        out float x,
        out float y
    )
    {
        if (preferredHit && IsNormalizedPoint(preferredX, preferredY))
        {
            x = preferredX;
            y = preferredY;
            return true;
        }

        if (fallbackHit && IsNormalizedPoint(fallbackX, fallbackY))
        {
            x = fallbackX;
            y = fallbackY;
            return true;
        }

        x = 0.5f;
        y = 0.5f;
        return false;
    }

    /// <summary>
    /// Keeps the last valid overlay point through a short transient miss.
    /// SteamVR can briefly report no intersection while a tracked ray moves
    /// across the overlay edge; retaining the last point avoids a visible
    /// reset to the center between two valid samples.
    /// </summary>
    public static bool TryRetainOverlayPoint(
        bool currentHit,
        float currentX,
        float currentY,
        bool hasLastPoint,
        float lastX,
        float lastY,
        double elapsedMilliseconds,
        double graceMilliseconds,
        out float x,
        out float y
    )
    {
        if (currentHit && IsNormalizedPoint(currentX, currentY))
        {
            x = currentX;
            y = currentY;
            return true;
        }

        if (hasLastPoint &&
            double.IsFinite(elapsedMilliseconds) &&
            elapsedMilliseconds >= 0d &&
            double.IsFinite(graceMilliseconds) &&
            graceMilliseconds >= 0d &&
            elapsedMilliseconds <= graceMilliseconds &&
            IsNormalizedPoint(lastX, lastY))
        {
            x = lastX;
            y = lastY;
            return true;
        }

        x = 0.5f;
        y = 0.5f;
        return false;
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

    private static bool IsNormalizedPoint(float x, float y)
    {
        return float.IsFinite(x) && float.IsFinite(y) &&
            x >= 0f && x <= 1f && y >= 0f && y <= 1f;
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
