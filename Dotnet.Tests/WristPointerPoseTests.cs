using Valve.VR;
using VRCX;
using Xunit;

namespace VRCX.Tests;

public class WristPointerPoseTests
{
    [Fact]
    public void InvalidTriggerPoseFallsBackToTipInsteadOfFreezingAnInvalidRay()
    {
        var resolver = new WristPointerPoseResolver();
        Assert.True(resolver.TryGetStablePose(component => component == "trigger"
            ? default(HmdMatrix34_t)
            : new HmdMatrix34_t { m0 = 1, m5 = 1, m10 = 1 }, out var pose));
        Assert.Equal(1, pose.m10);
    }

    [Fact]
    public void SqueezingTriggerCannotChangeCachedDeviceRelativeAim()
    {
        var resolver = new WristPointerPoseResolver();
        var calls = 0;
        var pressed = false;
        HmdMatrix34_t? Read(string component)
        {
            calls++;
            return new HmdMatrix34_t { m0 = 1, m5 = 1, m10 = 1, m3 = pressed ? 0.2f : 0.1f };
        }
        Assert.True(resolver.TryGetStablePose(Read, out var resting));
        pressed = true;
        Assert.True(resolver.TryGetStablePose(Read, out var squeezed));
        Assert.Equal(resting.m3, squeezed.m3);
        Assert.Equal(1, calls);
        resolver.Reset();
        Assert.True(resolver.TryGetStablePose(Read, out _));
        Assert.Equal(2, calls);
    }
}
