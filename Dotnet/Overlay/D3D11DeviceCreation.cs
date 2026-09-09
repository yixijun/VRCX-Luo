namespace VRCX;

internal static class D3D11DeviceCreation
{
    internal const int SdkComponentMissingHResult = unchecked((int)0x887A002D);

    internal static bool ShouldRetryWithoutDebugLayer(bool debugLayerRequested, int hResult)
    {
        return debugLayerRequested && hResult == SdkComponentMissingHResult;
    }
}
