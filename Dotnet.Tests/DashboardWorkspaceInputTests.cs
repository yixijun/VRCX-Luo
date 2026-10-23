using VRCX;
using Xunit;

namespace VRCX.Tests;

public class DashboardWorkspaceInputTests
{
    [Theory]
    [InlineData("{\"type\":\"down\",\"x\":0,\"y\":0}")]
    [InlineData("{\"type\":\"up\",\"x\":1,\"y\":1,\"button\":\"right\"}")]
    [InlineData("{\"type\":\"move\",\"x\":0.4,\"y\":0.8,\"pressed\":true}")]
    [InlineData("{\"type\":\"scroll\",\"x\":0.5,\"y\":0.5,\"deltaY\":-120}")]
    [InlineData("{\"type\":\"key\",\"key\":\"Escape\"}")]
    [InlineData("{\"type\":\"text\",\"text\":\"中文测试\"}")]
    public void AcceptsSupportedInputsIncludingFullEdges(string json) => Assert.NotNull(DashboardWorkspaceInput.Parse(json));

    [Theory]
    [InlineData("{\"type\":\"execute\"}")]
    [InlineData("{\"type\":\"down\",\"x\":-0.01}")]
    [InlineData("{\"type\":\"down\",\"y\":1.01}")]
    [InlineData("{\"type\":\"key\",\"key\":\"F12\"}")]
    [InlineData("{\"type\":\"scroll\",\"deltaY\":99999}")]
    [InlineData("{\"type\":\"text\",\"text\":null}")]
    [InlineData("null")]
    [InlineData("not json")]
    public void RejectsInvalidOrOutOfBoundsInputs(string json) => Assert.Null(DashboardWorkspaceInput.Parse(json));
}
