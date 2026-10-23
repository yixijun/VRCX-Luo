#nullable enable
using System;
using System.Text.Json;

namespace VRCX;

internal sealed record DashboardWorkspaceInput(string Type, double X = 0, double Y = 0,
    string Button = "left", bool Pressed = false, double DeltaX = 0, double DeltaY = 0,
    string Key = "", string Text = "")
{
    public const int Width = 1280;
    public const int Height = 1024;

    internal static DashboardWorkspaceInput? Parse(string json)
    {
        if (string.IsNullOrEmpty(json) || json.Length > 4096) return null;
        try
        {
            var input = JsonSerializer.Deserialize<DashboardWorkspaceInput>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (input == null || !double.IsFinite(input.X) || !double.IsFinite(input.Y) || input.X is < 0 or > 1 || input.Y is < 0 or > 1) return null;
            if (input.Button is not ("left" or "right" or "middle")) return null;
            return input.Type switch
            {
                "move" or "down" or "up" => input,
                "scroll" when double.IsFinite(input.DeltaX) && double.IsFinite(input.DeltaY) && Math.Abs(input.DeltaX) <= 1200 && Math.Abs(input.DeltaY) <= 1200 => input,
                "key" when input.Key is "Escape" or "Enter" or "Backspace" or "Tab" or "ArrowUp" or "ArrowDown" or "ArrowLeft" or "ArrowRight" or "SelectAll" => input,
                "text" when input.Text?.Length is > 0 and <= 1024 => input,
                _ => null
            };
        }
        catch (JsonException) { return null; }
    }
}
