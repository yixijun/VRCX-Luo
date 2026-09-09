using VRCX;
using Xunit;

namespace VRCX.Tests;

public class D3D11DeviceCreationTests
{
    [Fact]
    public void RetriesWithoutDebugLayerWhenSdkComponentIsMissing()
    {
        Assert.True(
            D3D11DeviceCreation.ShouldRetryWithoutDebugLayer(
                debugLayerRequested: true,
                hResult: D3D11DeviceCreation.SdkComponentMissingHResult
            )
        );
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void DoesNotRetryForOtherConditions(bool debugLayerRequested)
    {
        Assert.False(
            D3D11DeviceCreation.ShouldRetryWithoutDebugLayer(
                debugLayerRequested,
                hResult: unchecked((int)0x80004005)
            )
        );
    }
}
