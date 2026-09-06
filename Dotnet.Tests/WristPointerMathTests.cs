using System.Numerics;
using VRCX;
using Xunit;

namespace VRCX.Tests;

public class WristPointerMathTests
{
    [Fact]
    public void ControllerForwardUsesOpenVrNegativeZAxis()
    {
        var forward = WristPointerMath.GetControllerForward(0f, 0f, 1f);

        Assert.Equal(new Vector3(0f, 0f, -1f), forward);
    }

    [Fact]
    public void RayDirectionIsNormalizedWithoutChangingItsSource()
    {
        var source = new Vector3(1f, 2f, 3f);

        var success = WristPointerMath.TryNormalizeRay(
            source,
            new Vector3(0f, 3f, 4f),
            out var ray
        );

        Assert.True(success);
        Assert.Equal(source, ray.Source);
        Assert.Equal(new Vector3(0f, 0.6f, 0.8f), ray.Direction);
    }

    [Fact]
    public void TipRayAppliesComponentOffsetAndOrientationInTrackingSpace()
    {
        var success = WristPointerMath.TryCreateTipRay(
            deviceOrigin: new Vector3(1f, 2f, 3f),
            deviceAxisX: new Vector3(0f, 0f, -1f),
            deviceAxisY: new Vector3(0f, 1f, 0f),
            deviceAxisZ: new Vector3(1f, 0f, 0f),
            componentOrigin: new Vector3(0.1f, 0.2f, 0.3f),
            componentAxisX: new Vector3(1f, 0f, 0f),
            componentAxisY: new Vector3(0f, 1f, 0f),
            componentAxisZ: new Vector3(0f, 0f, 1f),
            out var ray
        );

        Assert.True(success);
        Assert.Equal(new Vector3(1.3f, 2.2f, 2.9f), ray.Source);
        Assert.Equal(new Vector3(-1f, 0f, 0f), ray.Direction);
    }

    [Fact]
    public void OverlayUvIsConvertedFromLowerLeftToUpperLeftCoordinates()
    {
        var success = WristPointerMath.TryConvertOverlayUv(0.25f, 0.8f, out var x, out var y);

        Assert.True(success);
        Assert.Equal(0.25f, x);
        Assert.Equal(0.2f, y, 5);
    }

    [Fact]
    public void OverlayPixelsAreNormalizedAcrossTheConfiguredMouseScale()
    {
        var success = WristPointerMath.TryConvertOverlayPixels(
            pixelX: 128f,
            pixelY: 384f,
            width: 512f,
            height: 512f,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(0.25f, x, 5);
        Assert.Equal(0.25f, y, 5);
    }

    [Fact]
    public void OverlayPixelsOutsideTheConfiguredMouseScaleAreRejected()
    {
        Assert.False(
            WristPointerMath.TryConvertOverlayPixels(
                pixelX: 513f,
                pixelY: 256f,
                width: 512f,
                height: 512f,
                out _,
                out _
            )
        );
    }

    [Fact]
    public void InvalidRayAndUvValuesAreRejected()
    {
        Assert.False(
            WristPointerMath.TryNormalizeRay(
                Vector3.Zero,
                Vector3.Zero,
                out _
            )
        );
        Assert.False(WristPointerMath.TryConvertOverlayUv(-0.1f, 0.5f, out _, out _));
        Assert.False(WristPointerMath.TryConvertOverlayUv(float.NaN, 0.5f, out _, out _));
    }

    [Fact]
    public void PreferredOverlayPointWinsWhenBothRaysHit()
    {
        var success = WristPointerMath.TrySelectOverlayPoint(
            preferredHit: true,
            preferredX: 0.2f,
            preferredY: 0.3f,
            fallbackHit: true,
            fallbackX: 0.8f,
            fallbackY: 0.9f,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(0.2f, x);
        Assert.Equal(0.3f, y);
    }

    [Fact]
    public void FallbackOverlayPointIsUsedWhenPreferredRayMisses()
    {
        var success = WristPointerMath.TrySelectOverlayPoint(
            preferredHit: false,
            preferredX: 0.2f,
            preferredY: 0.3f,
            fallbackHit: true,
            fallbackX: 0.8f,
            fallbackY: 0.9f,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(0.8f, x);
        Assert.Equal(0.9f, y);
    }

    [Fact]
    public void OverlayPointSelectionReportsMissWhenBothRaysMiss()
    {
        var success = WristPointerMath.TrySelectOverlayPoint(
            preferredHit: false,
            preferredX: 0.2f,
            preferredY: 0.3f,
            fallbackHit: false,
            fallbackX: 0.8f,
            fallbackY: 0.9f,
            out var x,
            out var y
        );

        Assert.False(success);
        Assert.Equal(0.5f, x);
        Assert.Equal(0.5f, y);
    }
}
