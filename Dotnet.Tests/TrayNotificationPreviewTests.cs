using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;

namespace VRCX.Tests;

internal static class TrayNotificationPreviewTests
{
    internal static void Verify()
    {
        VerifyTrayHoverIntent();
        VerifyPointerDismissalTiming();
        VerifyAvatarImageFallback();

        using var preview = new TrayNotificationPreview();
        preview.UpdateSnapshot(new TrayNotificationSnapshot
        {
            Total = 5,
            Theme = new TrayNotificationTheme
            {
                Background = "#101114",
                Surface = "#202126",
                Hover = "#30323a",
                Foreground = "#f4f4f5",
                MutedForeground = "#a1a1aa",
                Primary = "#5aa7ff",
                PrimaryForeground = "#101114",
                Destructive = "#f87171"
            },
            Items = new List<TrayNotificationItem>
            {
                CreateItem("invite", "Alice", 3),
                CreateItem("boop", "Bob", 2),
                CreateItem("friendRequest", "Carol", 1),
                CreateItem("group.queueReady", "VRChat Group", 1)
            }
        });

        if (preview.BackColor != ColorTranslator.FromHtml("#101114"))
        {
            throw new InvalidOperationException("The tray preview must use the active application theme.");
        }

        var cards = Descendants(preview)
            .Where(control => control.Name == "TrayNotificationCard")
            .ToList();
        if (cards.Count != 4)
        {
            throw new InvalidOperationException("The tray preview must render up to four notification cards.");
        }

        foreach (var card in cards)
        {
            foreach (Control child in card.Controls)
            {
                if (!card.ClientRectangle.Contains(child.Bounds))
                {
                    throw new InvalidOperationException(
                        $"Tray notification control '{child.GetType().Name}' extends outside its card."
                    );
                }
            }
        }

        string requestedAction = null;
        string requestedNotificationId = null;
        preview.ActionRequested += (action, notificationId) =>
        {
            requestedAction = action;
            requestedNotificationId = notificationId;
        };
        var cardLabel = cards[0].Controls.OfType<Label>().First();
        typeof(Control)
            .GetMethod("OnClick", BindingFlags.Instance | BindingFlags.NonPublic)
            ?.Invoke(cardLabel, new object[] { EventArgs.Empty });
        if (requestedAction != "open" || string.IsNullOrWhiteSpace(requestedNotificationId))
        {
            throw new InvalidOperationException("Clicking a tray notification card must request its matching page.");
        }

        preview.StartPosition = FormStartPosition.Manual;
        preview.Location = new Point(-10000, -10000);
        preview.Show();
        Application.DoEvents();
        preview.PerformLayout();
        preview.Refresh();

        using var bitmap = new Bitmap(preview.ClientSize.Width, preview.ClientSize.Height);
        preview.DrawToBitmap(bitmap, preview.ClientRectangle);
        var background = preview.BackColor.ToArgb();
        var renderedPixels = 0;
        for (var y = 0; y < bitmap.Height; y += 4)
        {
            for (var x = 0; x < bitmap.Width; x += 4)
            {
                if (bitmap.GetPixel(x, y).ToArgb() != background) renderedPixels++;
            }
        }
        if (renderedPixels < 100)
        {
            throw new InvalidOperationException("The tray preview rendered without visible notification content.");
        }
        preview.Hide();
    }

    private static void VerifyAvatarImageFallback()
    {
        var path = Path.Combine(Path.GetTempPath(), $"vrcx-tray-avatar-{Guid.NewGuid():N}.png");
        try
        {
            using (var bitmap = new Bitmap(32, 32))
            {
                using var graphics = Graphics.FromImage(bitmap);
                graphics.Clear(Color.CornflowerBlue);
                bitmap.Save(path);
            }

            using var imageAvatar = new TrayAvatarControl("A", Color.Black, Color.White, path);
            if (!imageAvatar.HasImage)
            {
                throw new InvalidOperationException("The tray avatar must load a cached user image.");
            }

            using var fallbackAvatar = new TrayAvatarControl(
                "A",
                Color.Black,
                Color.White,
                path + ".missing"
            );
            if (fallbackAvatar.HasImage)
            {
                throw new InvalidOperationException("A missing avatar image must fall back to the sender initial.");
            }
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    private static void VerifyTrayHoverIntent()
    {
        var intent = new TrayHoverIntent(
            TimeSpan.FromMilliseconds(300),
            TimeSpan.FromMilliseconds(1100)
        );
        var startedAt = new DateTime(2026, 8, 15, 0, 0, 0, DateTimeKind.Utc);
        intent.Track(new Point(100, 100), startedAt);

        if (intent.ShouldShow(new Point(100, 100), startedAt.AddMilliseconds(299)))
        {
            throw new InvalidOperationException("The tray preview must wait for the hover delay.");
        }

        if (intent.ShouldShow(new Point(220, 220), startedAt.AddMilliseconds(300)))
        {
            throw new InvalidOperationException("Leaving the tray icon before the delay must cancel the preview.");
        }

        intent.Track(new Point(100, 100), startedAt);
        if (!intent.ShouldShow(new Point(102, 101), startedAt.AddMilliseconds(300)))
        {
            throw new InvalidOperationException("A stationary tray hover must show the preview after the delay.");
        }

        intent.Cancel();
        if (intent.ShouldShow(new Point(100, 100), startedAt.AddMilliseconds(400)))
        {
            throw new InvalidOperationException("A cancelled tray hover must not show the preview.");
        }
    }

    private static void VerifyPointerDismissalTiming()
    {
        var guard = new TrayPreviewPointerGuard(TimeSpan.FromMilliseconds(450));
        var previewBounds = new Rectangle(100, 100, 300, 240);
        var trayAnchor = new Rectangle(420, 320, 48, 48);
        var startedAt = new DateTime(2026, 8, 15, 0, 0, 0, DateTimeKind.Utc);

        if (guard.ShouldDismiss(previewBounds, trayAnchor, new Point(430, 330), startedAt))
        {
            throw new InvalidOperationException("The preview must stay open while the pointer is over the tray icon.");
        }

        if (guard.ShouldDismiss(previewBounds, trayAnchor, new Point(800, 600), startedAt))
        {
            throw new InvalidOperationException("The preview must allow a short transition away from the tray icon.");
        }

        if (guard.ShouldDismiss(previewBounds, trayAnchor, new Point(800, 600), startedAt.AddMilliseconds(449)))
        {
            throw new InvalidOperationException("The preview dismissed before the pointer transition delay elapsed.");
        }

        if (!guard.ShouldDismiss(previewBounds, trayAnchor, new Point(800, 600), startedAt.AddMilliseconds(450)))
        {
            throw new InvalidOperationException("The preview must dismiss promptly after the pointer leaves it.");
        }

        guard.Reset();
        guard.ShouldDismiss(previewBounds, trayAnchor, new Point(800, 600), startedAt);
        guard.ShouldDismiss(previewBounds, trayAnchor, new Point(110, 110), startedAt.AddMilliseconds(300));
        if (guard.ShouldDismiss(previewBounds, trayAnchor, new Point(800, 600), startedAt.AddMilliseconds(451)))
        {
            throw new InvalidOperationException("Returning to the preview must reset the dismissal delay.");
        }
    }

    private static TrayNotificationItem CreateItem(string type, string title, int actionCount)
    {
        var actions = new List<TrayNotificationAction>
        {
            new() { Id = "invite-accept", Label = "接受" },
            new() { Id = "invite-decline", Label = "拒绝" },
            new() { Id = "ignore", Label = "忽略" }
        };
        return new TrayNotificationItem
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = type,
            Title = title,
            Body = "这是一条用于验证文字和操作按钮排布的通知内容。",
            CreatedAt = DateTimeOffset.Now.AddMinutes(-2).ToString("O"),
            Actions = actions.Take(actionCount).ToList()
        };
    }

    private static IEnumerable<Control> Descendants(Control root)
    {
        foreach (Control child in root.Controls)
        {
            yield return child;
            foreach (var descendant in Descendants(child))
            {
                yield return descendant;
            }
        }
    }
}
