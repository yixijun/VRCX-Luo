using System.Numerics;
using VRCX;
using Xunit;

namespace VRCX.Tests;

public class WristPointerMathTests
{
    [Fact]
    public void SubpixelTrackingDriftAtDisplayEdgeIsClampedButOutsidePointsAreRejected()
    {
        Assert.True(WristPointerMath.TryProjectOverlayPoint(new Vector3(0, .501f, 0), Matrix4x4.Identity, 1, 1, out _, out var y));
        Assert.Equal(0f, y);
        Assert.False(WristPointerMath.TryProjectOverlayPoint(new Vector3(0,.51f,0),Matrix4x4.Identity,1,1,out _,out _));
    }

    [Theory]
    [InlineData(0f, 0f)]
    [InlineData(0f, 1f)]
    [InlineData(1f, 0f)]
    [InlineData(1f, 1f)]
    public void AnalyticalRayReachesCornersAfterHandRotation(float expectedX, float expectedY)
    {
        var transform=Matrix4x4.CreateScale(.25f)*Matrix4x4.CreateRotationX(.8f)*Matrix4x4.CreateTranslation(1,2,3);
        var source=Vector3.Transform(new Vector3(expectedX-.5f,.5f-expectedY,1),transform);
        var direction=Vector3.Normalize(Vector3.TransformNormal(-Vector3.UnitZ,transform));
        Assert.True(WristPointerMath.TryIntersectOverlayRay(new WristPointerRay(source,direction),transform,1,1,out var x,out var y));
        Assert.Equal(expectedX,x,4);
        Assert.Equal(expectedY,y,4);
    }

    [Fact]
    public void RayMissesBehindOutsideAndParallelToDisplayAreRejected()
    {
        Assert.False(WristPointerMath.TryIntersectOverlayRay(new WristPointerRay(new Vector3(0,0,1),Vector3.UnitZ),Matrix4x4.Identity,1,1,out _,out _));
        Assert.False(WristPointerMath.TryIntersectOverlayRay(new WristPointerRay(new Vector3(0,0,1),Vector3.UnitX),Matrix4x4.Identity,1,1,out _,out _));
        Assert.False(WristPointerMath.TryIntersectOverlayRay(new WristPointerRay(new Vector3(0,2,1),-Vector3.UnitZ),Matrix4x4.Identity,1,1,out _,out _));
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 0)]
    [InlineData(0, 1)]
    [InlineData(1, 1)]
    [InlineData(0.25f, 0.75f)]
    public void WorldIntersectionCoversEntireTranslatedRotatedWrist(float expectedX, float expectedY)
    {
        var transform = Matrix4x4.CreateScale(0.25f) *
            Matrix4x4.CreateRotationX(1.1f) * Matrix4x4.CreateRotationY(0.4f) *
            Matrix4x4.CreateTranslation(1, 2, 3);
        var point = Vector3.Transform(new Vector3(expectedX - 0.5f, 0.5f - expectedY, 0), transform);
        Assert.True(WristPointerMath.TryProjectOverlayPoint(point, transform, 1, 1, out var x, out var y));
        Assert.Equal(expectedX, x, 4);
        Assert.Equal(expectedY, y, 4);
    }

    [Fact]
    public void OpenVrPoseCompositionPreservesWristCornersInTrackingSpace()
    {
        var relative = new Valve.VR.HmdMatrix34_t { m0 = 0.25f, m5 = 0.25f, m10 = 0.25f, m3 = 0.07f };
        var device = new Valve.VR.HmdMatrix34_t { m2 = 1, m5 = 1, m8 = -1, m3 = 1, m7 = 2, m11 = 3 };
        var transform = WristPointerOverlayProjection.ToMatrix(relative) * WristPointerOverlayProjection.ToMatrix(device);
        // Top right in device space=(.195,.125,0), then rotate/translate.
        Assert.True(WristPointerMath.TryProjectOverlayPoint(new Vector3(1,2.125f,2.805f), transform,1,1,out var x,out var y));
        Assert.Equal(1f,x,4);
        Assert.Equal(0f,y,4);
    }

    [Fact]
    public void InvalidOrOutsideOverlayIntersectionIsRejected()
    {
        Assert.False(WristPointerMath.TryProjectOverlayPoint(new Vector3(0.7f,0,0),Matrix4x4.Identity,1,1,out _,out _));
        Assert.False(WristPointerMath.TryProjectOverlayPoint(new Vector3(float.NaN,0,0),Matrix4x4.Identity,1,1,out _,out _));
        Assert.False(WristPointerMath.TryProjectOverlayPoint(Vector3.Zero,default,1,1,out _,out _));
    }

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
    public void OverlayIntersectionUnitRangeValuesRemainNormalizedCoordinates()
    {
        var success = WristPointerMath.TryConvertOverlayPixels(
            pixelX: 0.75f,
            pixelY: 0.25f,
            width: 512f,
            height: 512f,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(0.75f, x, 5);
        Assert.Equal(0.75f, y, 5);
    }

    [Fact]
    public void WristTextureUvIsExpandedFromTheSharedTextureCrop()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        var success = WristPointerMath.TryConvertOverlayCoordinates(
            coordinateX: 0.25f,
            coordinateY: 1f / 6f,
            width: 512f,
            height: 512f,
            textureUMin: 0f,
            textureUMax: 0.5f,
            textureVMin: 0f,
            textureVMax: 1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(WristPointerCoordinateSpace.TextureUv, coordinateSpace);
        Assert.Equal(0.5f, x, 5);
        Assert.Equal(0.5f, y, 5);
    }

    [Fact]
    public void WristCropScaledPixelsAreExpandedToTheFullPanel()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        var success = WristPointerMath.TryConvertOverlayCoordinates(
            coordinateX: 128f,
            coordinateY: 256f / 3f,
            width: 512f,
            height: 512f,
            textureUMin: 0f,
            textureUMax: 0.5f,
            textureVMin: 0f,
            textureVMax: 1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(0.5f, x, 5);
        Assert.Equal(0.5f, y, 5);

        success = WristPointerMath.TryConvertOverlayCoordinates(
            coordinateX: 256f,
            coordinateY: 512f / 3f,
            width: 512f,
            height: 512f,
            textureUMin: 0f,
            textureUMax: 0.5f,
            textureVMin: 0f,
            textureVMax: 1f / 3f,
            ref coordinateSpace,
            out x,
            out y
        );

        Assert.True(success);
        Assert.Equal(1f, x, 5);
        Assert.Equal(0f, y, 5);
    }

    [Fact]
    public void WristCropPixelModeRecoversWhenRuntimeReturnsLocalPixels()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        Assert.True(
            WristPointerMath.TryConvertOverlayCoordinates(
                coordinateX: 128f,
                coordinateY: 256f / 3f,
                width: 512f,
                height: 512f,
                textureUMin: 0f,
                textureUMax: 0.5f,
                textureVMin: 0f,
                textureVMax: 1f / 3f,
                ref coordinateSpace,
                out var firstX,
                out var firstY
            )
        );
        Assert.Equal(0.5f, firstX, 5);
        Assert.Equal(0.5f, firstY, 5);

        var success = WristPointerMath.TryConvertOverlayCoordinates(
            coordinateX: 384f,
            coordinateY: 256f,
            width: 512f,
            height: 512f,
            textureUMin: 0f,
            textureUMax: 0.5f,
            textureVMin: 0f,
            textureVMax: 1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(WristPointerCoordinateSpace.Pixels, coordinateSpace);
        Assert.Equal(0.75f, x, 5);
        Assert.Equal(0.5f, y, 5);
    }

    [Fact]
    public void WristCropPixelModeRecoversWhenUnitRangeSampleArrivesFirst()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        Assert.True(
            WristPointerMath.TryConvertOverlayCoordinates(
                coordinateX: 0.25f,
                coordinateY: 0.25f,
                width: 512f,
                height: 512f,
                textureUMin: 0f,
                textureUMax: 0.5f,
                textureVMin: 0f,
                textureVMax: 1f / 3f,
                ref coordinateSpace,
                out var firstX,
                out var firstY
            )
        );
        Assert.Equal(0.5f, firstX, 5);
        Assert.Equal(0.25f, firstY, 5);

        var success = WristPointerMath.TryConvertOverlayCoordinates(
            coordinateX: 128f,
            coordinateY: 256f / 3f,
            width: 512f,
            height: 512f,
            textureUMin: 0f,
            textureUMax: 0.5f,
            textureVMin: 0f,
            textureVMax: 1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(WristPointerCoordinateSpace.TexturePixels, coordinateSpace);
        Assert.Equal(0.5f, x, 5);
        Assert.Equal(0.5f, y, 5);
    }

    [Fact]
    public void WristCoordinateSpaceDoesNotSwitchAfterTheFirstValidSample()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        Assert.True(
            WristPointerMath.TryConvertOverlayCoordinates(
                0.25f,
                1f / 6f,
                512f,
                512f,
                0f,
                0.5f,
                0f,
                1f / 3f,
                ref coordinateSpace,
                out _,
                out _
            )
        );

        var success = WristPointerMath.TryConvertOverlayCoordinates(
            0.4f,
            0.25f,
            512f,
            512f,
            0f,
            0.5f,
            0f,
            1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(WristPointerCoordinateSpace.TextureUv, coordinateSpace);
        Assert.Equal(0.8f, x, 5);
        Assert.Equal(0.25f, y, 5);
    }

    [Fact]
    public void LocalOverlayUvRemainsLocalAfterTheFirstValidSample()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        Assert.True(
            WristPointerMath.TryConvertOverlayCoordinates(
                0.75f,
                0.75f,
                512f,
                512f,
                0f,
                0.5f,
                0f,
                1f / 3f,
                ref coordinateSpace,
                out var firstX,
                out var firstY
            )
        );
        Assert.Equal(WristPointerCoordinateSpace.OverlayUv, coordinateSpace);
        Assert.Equal(0.75f, firstX, 5);
        Assert.Equal(0.25f, firstY, 5);

        var success = WristPointerMath.TryConvertOverlayCoordinates(
            0.25f,
            0.25f,
            512f,
            512f,
            0f,
            0.5f,
            0f,
            1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(WristPointerCoordinateSpace.OverlayUv, coordinateSpace);
        Assert.Equal(0.25f, x, 5);
        Assert.Equal(0.75f, y, 5);
    }

    [Fact]
    public void AmbiguousWristSampleCanRecoverToSharedTexturePixels()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        Assert.True(
            WristPointerMath.TryConvertOverlayCoordinates(
                0.25f,
                0.25f,
                512f,
                512f,
                0f,
                0.5f,
                0f,
                1f / 3f,
                ref coordinateSpace,
                out _,
                out _
            )
        );

        var success = WristPointerMath.TryConvertOverlayCoordinates(
            400f,
            300f,
            512f,
            512f,
            0f,
            0.5f,
            0f,
            1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(WristPointerCoordinateSpace.Pixels, coordinateSpace);
        Assert.Equal(400f / 512f, x, 5);
        Assert.Equal(1f - 300f / 512f, y, 5);
    }

    [Fact]
    public void AmbiguousWristSampleCanRecoverToLocalOverlayUv()
    {
        var coordinateSpace = WristPointerCoordinateSpace.Unknown;
        Assert.True(
            WristPointerMath.TryConvertOverlayCoordinates(
                0.25f,
                0.25f,
                512f,
                512f,
                0f,
                0.5f,
                0f,
                1f / 3f,
                ref coordinateSpace,
                out _,
                out _
            )
        );

        var success = WristPointerMath.TryConvertOverlayCoordinates(
            0.75f,
            0.75f,
            512f,
            512f,
            0f,
            0.5f,
            0f,
            1f / 3f,
            ref coordinateSpace,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(WristPointerCoordinateSpace.OverlayUv, coordinateSpace);
        Assert.Equal(0.75f, x, 5);
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

    [Fact]
    public void RecentOverlayMissKeepsTheLastPoint()
    {
        var success = WristPointerMath.TryRetainOverlayPoint(
            currentHit: false,
            currentX: 0.5f,
            currentY: 0.5f,
            hasLastPoint: true,
            lastX: 0.2f,
            lastY: 0.8f,
            elapsedMilliseconds: 32d,
            graceMilliseconds: 100d,
            out var x,
            out var y
        );

        Assert.True(success);
        Assert.Equal(0.2f, x);
        Assert.Equal(0.8f, y);
    }

    [Fact]
    public void ExpiredOverlayMissHidesTheLastPoint()
    {
        var success = WristPointerMath.TryRetainOverlayPoint(
            currentHit: false,
            currentX: 0.5f,
            currentY: 0.5f,
            hasLastPoint: true,
            lastX: 0.2f,
            lastY: 0.8f,
            elapsedMilliseconds: 101d,
            graceMilliseconds: 100d,
            out var x,
            out var y
        );

        Assert.False(success);
        Assert.Equal(0.5f, x);
        Assert.Equal(0.5f, y);
    }
}
