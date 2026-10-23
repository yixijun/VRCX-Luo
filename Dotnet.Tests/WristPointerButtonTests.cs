using VRCX;
using Xunit;

namespace VRCX.Tests;

public class WristPointerButtonTests
{
    [Fact]
    public void OpeningOrSwitchingHandsRequiresReleaseBeforeClick()
    {
        var button = new WristPointerButtonState();
        Assert.False(button.Update(true, true, 1, true));
        button.Update(true, false, 0, true);
        button.Reset();
        Assert.False(button.Update(true, true, 1, true));
        button.Update(true, false, 0, true);
        Assert.True(button.Update(true, true, 1, true));
    }

    [Fact]
    public void AnalogNoiseAndEnteringPanelWhileHeldDoNotRepeatClick()
    {
        var button = new WristPointerButtonState();
        button.Update(true, false, 0, false);
        Assert.False(button.Update(true, false, 0.6f, false));
        Assert.False(button.Update(true, false, 0.6f, true));
        button.Update(true, false, 0, true);
        Assert.True(button.Update(true, false, 0.6f, true));
        Assert.False(button.Update(true, false, 0.49f, true));
        Assert.False(button.Update(true, false, 0.51f, true));
    }

    [Fact]
    public void FailedReadAndHeldTriggerDoNotProduceAnotherClick()
    {
        var button = new WristPointerButtonState();
        Assert.False(button.Update(true, false, 0, true));
        Assert.True(button.Update(true, true, 1, true));
        Assert.False(button.Update(false, false, 0, true));
        Assert.True(button.IsPressed);
        Assert.False(button.Update(true, true, 1, true));
        Assert.False(button.Update(true, false, 0, true));
        Assert.True(button.Update(true, true, 1, true));
    }
}
