using System;
using System.IO;
using System.Text.Json;
using VRCX;
using Xunit;

namespace VRCX.Tests;

public class DashboardWorkspaceDirectoryTests
{
    [Fact]
    public void ReturnsReadOnlyPagedListingsAndHandlesMissingDirectories()
    {
        var root = Path.Combine(Path.GetTempPath(), "VRCX-VR-picker-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            for (var i = 0; i < 70; i++) File.WriteAllText(Path.Combine(root, $"test-{i:D3}.txt"), "");
            using var first = JsonDocument.Parse(DashboardWorkspaceDirectory.List(root, 0));
            Assert.Equal(64, first.RootElement.GetProperty("entries").GetArrayLength());
            Assert.True(first.RootElement.GetProperty("hasMore").GetBoolean());
            using var next = JsonDocument.Parse(DashboardWorkspaceDirectory.List(root, 64));
            Assert.Equal(6, next.RootElement.GetProperty("entries").GetArrayLength());
            Assert.False(next.RootElement.GetProperty("hasMore").GetBoolean());
            using var missing = JsonDocument.Parse(DashboardWorkspaceDirectory.List(Path.Combine(root, "missing"), 0));
            Assert.True(missing.RootElement.TryGetProperty("error", out _));
            Assert.Equal(70, Directory.GetFiles(root).Length);
        }
        finally { Directory.Delete(root, true); }
    }
}
