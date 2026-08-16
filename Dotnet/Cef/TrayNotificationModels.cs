using System.Collections.Generic;

namespace VRCX
{
    internal sealed class TrayNotificationSnapshot
    {
        public int Total { get; set; }
        public List<TrayNotificationItem> Items { get; set; } = new();
        public TrayNotificationTheme Theme { get; set; } = new();
    }

    internal sealed class TrayNotificationTheme
    {
        public string Background { get; set; } = string.Empty;
        public string Surface { get; set; } = string.Empty;
        public string Hover { get; set; } = string.Empty;
        public string Foreground { get; set; } = string.Empty;
        public string MutedForeground { get; set; } = string.Empty;
        public string Primary { get; set; } = string.Empty;
        public string PrimaryForeground { get; set; } = string.Empty;
        public string Destructive { get; set; } = string.Empty;
    }

    internal sealed class TrayNotificationItem
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
        public string AvatarPath { get; set; } = string.Empty;
        public List<TrayNotificationAction> Actions { get; set; } = new();
    }

    internal sealed class TrayNotificationAction
    {
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
    }
}
