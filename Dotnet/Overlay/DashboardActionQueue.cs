using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Text.Json;

namespace VRCX;

internal static class DashboardActionQueue
{
    private static readonly ConcurrentQueue<string> Queue = new();
    private static readonly HashSet<string> Actions = new(StringComparer.Ordinal) {
        "refresh", "wrist", "hud", "silent", "sleep", "join", "invite", "requestInvite", "accept", "decline"
    };

    internal static bool IsValid(string json)
    {
        if (string.IsNullOrEmpty(json) || json.Length > 2048) return false;
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            return root.ValueKind == JsonValueKind.Object &&
                root.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String && id.GetString()?.Length is > 0 and <= 80 &&
                root.TryGetProperty("action", out var action) && action.ValueKind == JsonValueKind.String && Actions.Contains(action.GetString()!);
        }
        catch (JsonException) { return false; }
    }

    public static bool Enqueue(string json)
    {
        if (!IsValid(json) || Queue.Count >= 32) return false;
        Queue.Enqueue(json);
        return true;
    }

    public static string[] Drain()
    {
        var result = new List<string>();
        while (Queue.TryDequeue(out var json)) result.Add(json);
        return result.ToArray();
    }
}
