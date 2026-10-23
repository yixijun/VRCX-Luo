using VRCX;
using Xunit;

namespace VRCX.Tests;

public class VrWorkspaceFileFiltersTests
{
    [Fact]
    public void ExpandsMimeExtensionListsAndDescriptiveFilters()
    {
        Assert.Equal(new[] { "png", "jpg", "gif", "json" }, VrWorkspaceFileFilters.Extensions(
            new[] { "image/*", "Image Types|.png;.gif", ".JSON" }, new[] { ".png;.jpg" }));
    }

    [Fact]
    public void KeepsAllFilesAndUnknownMimeTypesSelectable()
    {
        Assert.Equal(new[] { "*" }, VrWorkspaceFileFilters.Extensions(new[] { "All|*.*" }, new[] { ".png" }));
        Assert.Empty(VrWorkspaceFileFilters.Extensions(new[] { "application/unknown" }, new[] { "" }));
        Assert.Empty(VrWorkspaceFileFilters.Extensions(null, null));
    }
}
