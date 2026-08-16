using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace VRCX
{
    internal sealed class TrayNotificationPreview : Form
    {
        private const int PreviewWidth = 388;
        private const int ContentWidth = 364;
        private const int HeaderHeight = 46;
        private const int NotificationCardHeight = 92;
        private const int NotificationCardGap = 8;
        private const int FooterHeight = 42;

        private readonly FlowLayoutPanel _content;
        private readonly Timer _dismissTimer;
        private readonly Timer _showAnimationTimer;
        private readonly ToolTip _toolTip;
        private readonly TrayPreviewPointerGuard _pointerGuard = new(TimeSpan.FromMilliseconds(450));
        private TrayNotificationPalette _palette = TrayNotificationPalette.Default;
        private DateTime _animationStartedAt = DateTime.MinValue;
        private Rectangle _anchorArea = Rectangle.Empty;
        private Point _animationTarget;

        internal event Action<string, string> ActionRequested;

        internal TrayNotificationPreview()
        {
            AutoScaleMode = AutoScaleMode.Dpi;
            BackColor = _palette.Background;
            ClientSize = new Size(PreviewWidth, 180);
            DoubleBuffered = true;
            Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Regular);
            FormBorderStyle = FormBorderStyle.None;
            ForeColor = _palette.Foreground;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;

            _content = new FlowLayoutPanel
            {
                AutoScroll = false,
                BackColor = _palette.Background,
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.TopDown,
                Padding = new Padding(12, 10, 12, 10),
                WrapContents = false
            };
            Controls.Add(_content);

            _toolTip = new ToolTip
            {
                AutoPopDelay = 2500,
                InitialDelay = 300,
                ReshowDelay = 80,
                ShowAlways = true
            };

            _dismissTimer = new Timer { Interval = 80 };
            _dismissTimer.Tick += (_, _) => CheckDismiss();

            _showAnimationTimer = new Timer { Interval = 15 };
            _showAnimationTimer.Tick += (_, _) => AdvanceShowAnimation();

            VisibleChanged += (_, _) =>
            {
                _pointerGuard.Reset();
                if (Visible)
                {
                    _dismissTimer.Start();
                }
                else
                {
                    _dismissTimer.Stop();
                    _showAnimationTimer.Stop();
                    _anchorArea = Rectangle.Empty;
                }
            };
            Resize += (_, _) => UpdateWindowRegion();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                const int DropShadow = 0x00020000;
                var createParams = base.CreateParams;
                createParams.ClassStyle |= DropShadow;
                return createParams;
            }
        }

        internal void UpdateSnapshot(TrayNotificationSnapshot snapshot)
        {
            _palette = TrayNotificationPalette.From(snapshot.Theme);
            BackColor = _palette.Background;
            ForeColor = _palette.Foreground;
            _content.BackColor = _palette.Background;

            _content.SuspendLayout();
            while (_content.Controls.Count > 0)
            {
                var control = _content.Controls[0];
                _content.Controls.RemoveAt(0);
                control.Dispose();
            }

            _content.Controls.Add(CreateHeader(snapshot.Total));
            var visibleItems = snapshot.Items.Take(4).ToList();
            foreach (var item in visibleItems)
            {
                _content.Controls.Add(CreateNotificationCard(item));
            }

            if (visibleItems.Count > 0)
            {
                _content.Controls.Add(CreateFooter());
            }

            var contentHeight =
                20
                + HeaderHeight
                + visibleItems.Count * (NotificationCardHeight + NotificationCardGap)
                + (visibleItems.Count > 0 ? FooterHeight : 0);
            ClientSize = new Size(PreviewWidth, Math.Min(536, Math.Max(78, contentHeight)));
            _content.ResumeLayout(true);
            Invalidate(true);
        }

        internal void ShowNearTray()
        {
            _pointerGuard.Reset();
            var cursor = Cursor.Position;
            var screen = Screen.FromPoint(cursor);
            var bounds = screen.Bounds;
            var area = screen.WorkingArea;
            const int gap = 12;
            _anchorArea = new Rectangle(cursor.X - 24, cursor.Y - 24, 48, 48);

            if (area.Bottom < bounds.Bottom)
            {
                _animationTarget = new Point(
                    Clamp(cursor.X - Width / 2, area.Left + gap, area.Right - Width - gap),
                    area.Bottom - Height - gap
                );
            }
            else if (area.Top > bounds.Top)
            {
                _animationTarget = new Point(
                    Clamp(cursor.X - Width / 2, area.Left + gap, area.Right - Width - gap),
                    area.Top + gap
                );
            }
            else if (area.Left > bounds.Left)
            {
                _animationTarget = new Point(
                    area.Left + gap,
                    Clamp(cursor.Y - Height / 2, area.Top + gap, area.Bottom - Height - gap)
                );
            }
            else
            {
                _animationTarget = new Point(
                    area.Right - Width - gap,
                    Clamp(cursor.Y - Height / 2, area.Top + gap, area.Bottom - Height - gap)
                );
            }

            if (!Visible)
            {
                Opacity = 0;
                Location = new Point(_animationTarget.X, _animationTarget.Y + 8);
                Show();
                _animationStartedAt = DateTime.UtcNow;
                _showAnimationTimer.Start();
            }
            else
            {
                Location = _animationTarget;
                Opacity = 1;
            }
            BringToFront();
        }

        private Control CreateHeader(int total)
        {
            var panel = new Panel
            {
                BackColor = _palette.Background,
                Margin = new Padding(0),
                Size = new Size(ContentWidth, HeaderHeight)
            };

            var title = new Label
            {
                AutoEllipsis = true,
                BackColor = Color.Transparent,
                Font = new Font(Font.FontFamily, 10.25F, FontStyle.Bold),
                ForeColor = _palette.Foreground,
                Location = new Point(2, 9),
                Size = new Size(270, 24),
                Text = "待处理通知"
            };
            panel.Controls.Add(title);

            var badgeWidth = total > 99 ? 38 : 30;
            var badge = new Label
            {
                BackColor = _palette.Destructive,
                Font = new Font(Font.FontFamily, 8F, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(ContentWidth - badgeWidth - 2, 8),
                Size = new Size(badgeWidth, 22),
                Text = total > 99 ? "99+" : total.ToString(),
                TextAlign = ContentAlignment.MiddleCenter
            };
            badge.Region = TrayDrawing.CreateRoundedRegion(badge.ClientRectangle, 7);
            panel.Controls.Add(badge);
            return panel;
        }

        private Control CreateNotificationCard(TrayNotificationItem item)
        {
            var panel = new Panel
            {
                BackColor = _palette.Surface,
                Margin = new Padding(0, 0, 0, NotificationCardGap),
                Name = "TrayNotificationCard",
                Size = new Size(ContentWidth, NotificationCardHeight)
            };
            panel.Region = TrayDrawing.CreateRoundedRegion(panel.ClientRectangle, 7);

            var avatar = new TrayAvatarControl(
                GetAvatarText(item),
                _palette.AvatarBackground,
                _palette.Primary,
                item.AvatarPath
            )
            {
                Location = new Point(10, 25),
                Size = new Size(40, 40)
            };
            panel.Controls.Add(avatar);

            var title = new Label
            {
                AutoEllipsis = true,
                BackColor = Color.Transparent,
                Font = new Font(Font.FontFamily, 9.25F, FontStyle.Bold),
                ForeColor = _palette.Foreground,
                Location = new Point(60, 9),
                Size = new Size(204, 20),
                Text = string.IsNullOrWhiteSpace(item.Title) ? "通知" : item.Title
            };
            panel.Controls.Add(title);

            var relativeTime = new Label
            {
                AutoEllipsis = true,
                BackColor = Color.Transparent,
                Font = new Font(Font.FontFamily, 8F, FontStyle.Regular),
                ForeColor = _palette.MutedForeground,
                Location = new Point(270, 10),
                Size = new Size(84, 18),
                Text = FormatRelativeTime(item.CreatedAt),
                TextAlign = ContentAlignment.TopRight
            };
            if (!string.IsNullOrWhiteSpace(item.CreatedAt))
            {
                _toolTip.SetToolTip(relativeTime, FormatAbsoluteTime(item.CreatedAt));
            }
            panel.Controls.Add(relativeTime);

            var typeLabel = new Label
            {
                AutoEllipsis = true,
                BackColor = Color.Transparent,
                Font = new Font(Font.FontFamily, 8F, FontStyle.Regular),
                ForeColor = _palette.MutedForeground,
                Location = new Point(60, 31),
                Size = new Size(200, 18),
                Text = GetTypeLabel(item.Type)
            };
            panel.Controls.Add(typeLabel);

            var actions = item.Actions.Take(3).ToList();
            var actionWidth = actions.Count * 34 + Math.Max(0, actions.Count - 1) * 4;
            var actionX = ContentWidth - actionWidth - 10;
            var body = new Label
            {
                AutoEllipsis = true,
                BackColor = Color.Transparent,
                Font = new Font(Font.FontFamily, 8.5F, FontStyle.Regular),
                ForeColor = _palette.MutedForeground,
                Location = new Point(60, 52),
                Size = new Size(Math.Max(92, actionX - 68), 30),
                Text = string.IsNullOrWhiteSpace(item.Body) ? string.Empty : item.Body
            };
            panel.Controls.Add(body);

            foreach (var action in actions)
            {
                var button = CreateActionButton(action);
                button.Location = new Point(actionX, 49);
                button.Click += (_, _) => ActionRequested?.Invoke(action.Id, item.Id);
                panel.Controls.Add(button);
                actionX += 38;
            }

            WireCardInteraction(panel, item.Id);
            return panel;
        }

        private Control CreateFooter()
        {
            var panel = new Panel
            {
                BackColor = _palette.Background,
                Margin = new Padding(0),
                Size = new Size(ContentWidth, FooterHeight)
            };
            var button = new TrayTextButton("全部忽略", _palette)
            {
                Location = new Point(ContentWidth - 100, 5),
                Size = new Size(100, 32)
            };
            button.Click += (_, _) => ActionRequested?.Invoke("ignore-all", string.Empty);
            panel.Controls.Add(button);
            return panel;
        }

        private TrayIconButton CreateActionButton(TrayNotificationAction action)
        {
            var icon = action.Id switch
            {
                "invite-accept" or "friend-accept" => TrayActionIcon.Check,
                "invite-decline" or "friend-decline" => TrayActionIcon.Close,
                "boop-reply" => TrayActionIcon.Reply,
                "ignore" => TrayActionIcon.Trash,
                _ => action.Icon switch
                {
                    "check" => TrayActionIcon.Check,
                    "cancel" or "ban" or "bell-slash" => TrayActionIcon.Close,
                    "link" => TrayActionIcon.Open,
                    _ => TrayActionIcon.Reply
                }
            };
            var style = action.Id switch
            {
                "invite-accept" or "friend-accept" or "boop-reply" => TrayActionStyle.Accent,
                "invite-decline" or "friend-decline" => TrayActionStyle.Destructive,
                _ => action.Icon switch
                {
                    "check" => TrayActionStyle.Accent,
                    "cancel" or "ban" => TrayActionStyle.Destructive,
                    _ => TrayActionStyle.Ghost
                }
            };
            var button = new TrayIconButton(icon, style, _palette)
            {
                AccessibleName = action.Label,
                Size = new Size(34, 34),
                TabStop = false
            };
            _toolTip.SetToolTip(button, action.Label);
            return button;
        }

        private void WireCardInteraction(Panel panel, string notificationId)
        {
            void Enter(object _, EventArgs __)
            {
                panel.BackColor = _palette.Hover;
                panel.Invalidate(true);
            }

            void Leave(object _, EventArgs __)
            {
                if (panel.ClientRectangle.Contains(panel.PointToClient(Cursor.Position))) return;
                panel.BackColor = _palette.Surface;
                panel.Invalidate(true);
            }

            panel.MouseEnter += Enter;
            panel.MouseLeave += Leave;
            panel.Cursor = Cursors.Hand;
            panel.Click += (_, _) => ActionRequested?.Invoke("open", notificationId);
            foreach (Control child in panel.Controls)
            {
                child.MouseEnter += Enter;
                child.MouseLeave += Leave;
                if (child is TrayIconButton) continue;
                child.Cursor = Cursors.Hand;
                child.Click += (_, _) => ActionRequested?.Invoke("open", notificationId);
            }
        }

        private void AdvanceShowAnimation()
        {
            const double durationMs = 150;
            var progress = Math.Min(1, (DateTime.UtcNow - _animationStartedAt).TotalMilliseconds / durationMs);
            var eased = 1 - Math.Pow(1 - progress, 3);
            Location = new Point(_animationTarget.X, _animationTarget.Y + (int)Math.Round(8 * (1 - eased)));
            Opacity = eased;
            if (progress < 1) return;
            Location = _animationTarget;
            Opacity = 1;
            _showAnimationTimer.Stop();
        }

        private void CheckDismiss()
        {
            var previewHoverArea = Rectangle.Inflate(Bounds, 10, 10);
            if (_pointerGuard.ShouldDismiss(previewHoverArea, _anchorArea, Cursor.Position, DateTime.UtcNow))
            {
                Hide();
            }
        }

        internal void DismissImmediately()
        {
            _pointerGuard.Reset();
            Hide();
        }

        private static string GetTypeLabel(string type)
        {
            return type switch
            {
                "invite" => "邀请",
                "boop" => "戳一戳",
                "friendRequest" => "好友请求",
                "requestInvite" => "邀请请求",
                "group.queueReady" => "群组队列",
                _ => "通知"
            };
        }

        private static string GetAvatarText(TrayNotificationItem item)
        {
            var value = string.IsNullOrWhiteSpace(item.Title) ? GetTypeLabel(item.Type) : item.Title.Trim();
            return value.Length == 0 ? "?" : value.Substring(0, 1).ToUpperInvariant();
        }

        private static string FormatRelativeTime(string createdAt)
        {
            if (!DateTimeOffset.TryParse(createdAt, out var created)) return string.Empty;

            var elapsed = DateTimeOffset.Now - created.ToLocalTime();
            if (elapsed.TotalMinutes < 1) return "刚刚";
            if (elapsed.TotalHours < 1) return $"{Math.Max(1, (int)elapsed.TotalMinutes)}分钟前";
            if (elapsed.TotalDays < 1) return $"{(int)elapsed.TotalHours}小时前";
            return $"{(int)elapsed.TotalDays}天前";
        }

        private static string FormatAbsoluteTime(string createdAt)
        {
            return DateTimeOffset.TryParse(createdAt, out var created)
                ? created.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")
                : createdAt;
        }

        private static int Clamp(int value, int minimum, int maximum)
        {
            return Math.Max(minimum, Math.Min(value, maximum));
        }

        private void UpdateWindowRegion()
        {
            if (Width <= 0 || Height <= 0) return;
            Region?.Dispose();
            Region = TrayDrawing.CreateRoundedRegion(new Rectangle(0, 0, Width, Height), 9);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _dismissTimer?.Dispose();
                _showAnimationTimer?.Dispose();
                _toolTip?.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    internal sealed class TrayPreviewPointerGuard
    {
        private readonly TimeSpan _dismissDelay;
        private DateTime _outsideSince = DateTime.MinValue;

        internal TrayPreviewPointerGuard(TimeSpan dismissDelay)
        {
            _dismissDelay = dismissDelay;
        }

        internal bool ShouldDismiss(
            Rectangle previewBounds,
            Rectangle trayAnchor,
            Point pointer,
            DateTime utcNow
        )
        {
            if (previewBounds.Contains(pointer) || trayAnchor.Contains(pointer))
            {
                Reset();
                return false;
            }

            if (_outsideSince == DateTime.MinValue)
            {
                _outsideSince = utcNow;
                return false;
            }

            return utcNow - _outsideSince >= _dismissDelay;
        }

        internal void Reset()
        {
            _outsideSince = DateTime.MinValue;
        }
    }

    internal sealed class TrayHoverIntent
    {
        private readonly TimeSpan _showDelay;
        private readonly TimeSpan _expiry;
        private readonly int _anchorSize;
        private DateTime _trackedAt = DateTime.MinValue;
        private Rectangle _anchor = Rectangle.Empty;

        internal TrayHoverIntent(TimeSpan showDelay, TimeSpan expiry, int anchorSize = 36)
        {
            _showDelay = showDelay;
            _expiry = expiry;
            _anchorSize = anchorSize;
        }

        internal void Track(Point pointer, DateTime utcNow)
        {
            var half = _anchorSize / 2;
            _anchor = new Rectangle(pointer.X - half, pointer.Y - half, _anchorSize, _anchorSize);
            _trackedAt = utcNow;
        }

        internal bool ShouldShow(Point pointer, DateTime utcNow)
        {
            if (_trackedAt == DateTime.MinValue || !_anchor.Contains(pointer))
            {
                Cancel();
                return false;
            }

            var elapsed = utcNow - _trackedAt;
            return elapsed >= _showDelay && elapsed < _expiry;
        }

        internal void Cancel()
        {
            _trackedAt = DateTime.MinValue;
            _anchor = Rectangle.Empty;
        }
    }

    internal sealed class TrayNotificationPalette
    {
        internal static TrayNotificationPalette Default { get; } = new TrayNotificationPalette(
            Color.FromArgb(36, 36, 38),
            Color.FromArgb(49, 49, 53),
            Color.FromArgb(61, 61, 67),
            Color.FromArgb(244, 244, 245),
            Color.FromArgb(161, 161, 170),
            Color.FromArgb(228, 228, 231),
            Color.FromArgb(39, 39, 42),
            Color.FromArgb(248, 113, 113)
        );

        internal Color Background { get; }
        internal Color Surface { get; }
        internal Color Hover { get; }
        internal Color Foreground { get; }
        internal Color MutedForeground { get; }
        internal Color Primary { get; }
        internal Color PrimaryForeground { get; }
        internal Color Destructive { get; }
        internal Color AvatarBackground => TrayDrawing.Blend(Surface, Primary, 0.14F);

        private TrayNotificationPalette(
            Color background,
            Color surface,
            Color hover,
            Color foreground,
            Color mutedForeground,
            Color primary,
            Color primaryForeground,
            Color destructive
        )
        {
            Background = background;
            Surface = surface;
            Hover = hover;
            Foreground = foreground;
            MutedForeground = mutedForeground;
            Primary = primary;
            PrimaryForeground = primaryForeground;
            Destructive = destructive;
        }

        internal static TrayNotificationPalette From(TrayNotificationTheme theme)
        {
            if (theme == null) return Default;
            return new TrayNotificationPalette(
                ParseColor(theme.Background, Default.Background),
                ParseColor(theme.Surface, Default.Surface),
                ParseColor(theme.Hover, Default.Hover),
                ParseColor(theme.Foreground, Default.Foreground),
                ParseColor(theme.MutedForeground, Default.MutedForeground),
                ParseColor(theme.Primary, Default.Primary),
                ParseColor(theme.PrimaryForeground, Default.PrimaryForeground),
                ParseColor(theme.Destructive, Default.Destructive)
            );
        }

        private static Color ParseColor(string value, Color fallback)
        {
            if (string.IsNullOrWhiteSpace(value)) return fallback;
            try
            {
                return ColorTranslator.FromHtml(value);
            }
            catch
            {
                return fallback;
            }
        }
    }

    internal enum TrayActionIcon
    {
        Check,
        Close,
        Reply,
        Open,
        Trash
    }

    internal enum TrayActionStyle
    {
        Accent,
        Ghost,
        Destructive
    }

    internal sealed class TrayIconButton : Control
    {
        private readonly TrayActionIcon _icon;
        private readonly TrayActionStyle _style;
        private readonly TrayNotificationPalette _palette;
        private bool _hovered;
        private bool _pressed;

        internal TrayIconButton(TrayActionIcon icon, TrayActionStyle style, TrayNotificationPalette palette)
        {
            _icon = icon;
            _style = style;
            _palette = palette;
            Cursor = Cursors.Hand;
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw |
                ControlStyles.UserPaint,
                true
            );
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            _hovered = true;
            Invalidate();
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            _hovered = false;
            _pressed = false;
            Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                _pressed = true;
                Invalidate();
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            _pressed = false;
            Invalidate();
            base.OnMouseUp(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var bounds = new Rectangle(0, 0, Width - 1, Height - 1);
            var background = ResolveBackground();
            if (background.A > 0)
            {
                using var path = TrayDrawing.CreateRoundedPath(bounds, 6);
                using var brush = new SolidBrush(background);
                e.Graphics.FillPath(brush, path);
            }

            using var pen = new Pen(ResolveForeground(), 1.8F)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round,
                LineJoin = LineJoin.Round
            };
            DrawIcon(e.Graphics, pen);
        }

        private Color ResolveBackground()
        {
            if (_style == TrayActionStyle.Accent)
            {
                return _pressed
                    ? TrayDrawing.Blend(_palette.Primary, Color.Black, 0.18F)
                    : _hovered
                        ? TrayDrawing.Blend(_palette.Primary, Color.White, 0.10F)
                        : _palette.Primary;
            }
            if (!_hovered && !_pressed) return Color.Transparent;
            return _pressed
                ? TrayDrawing.Blend(_palette.Hover, Color.Black, 0.12F)
                : _palette.Hover;
        }

        private Color ResolveForeground()
        {
            if (_style == TrayActionStyle.Accent) return _palette.PrimaryForeground;
            if (_style == TrayActionStyle.Destructive) return _palette.Destructive;
            return _hovered ? _palette.Foreground : _palette.MutedForeground;
        }

        private void DrawIcon(Graphics graphics, Pen pen)
        {
            var centerX = Width / 2F;
            var centerY = Height / 2F;
            switch (_icon)
            {
                case TrayActionIcon.Check:
                    graphics.DrawLines(pen, new[]
                    {
                        new PointF(centerX - 6, centerY),
                        new PointF(centerX - 2, centerY + 4),
                        new PointF(centerX + 6, centerY - 5)
                    });
                    break;
                case TrayActionIcon.Close:
                    graphics.DrawLine(pen, centerX - 5, centerY - 5, centerX + 5, centerY + 5);
                    graphics.DrawLine(pen, centerX + 5, centerY - 5, centerX - 5, centerY + 5);
                    break;
                case TrayActionIcon.Reply:
                    graphics.DrawLines(pen, new[]
                    {
                        new PointF(centerX - 1, centerY - 6),
                        new PointF(centerX - 7, centerY),
                        new PointF(centerX - 1, centerY + 6)
                    });
                    graphics.DrawLine(pen, centerX - 6, centerY, centerX + 3, centerY);
                    graphics.DrawArc(pen, centerX - 1, centerY, 10, 9, 270, 92);
                    break;
                case TrayActionIcon.Open:
                    graphics.DrawRectangle(pen, centerX - 6, centerY - 4, 10, 10);
                    graphics.DrawLine(pen, centerX, centerY - 7, centerX + 7, centerY - 7);
                    graphics.DrawLine(pen, centerX + 7, centerY - 7, centerX + 7, centerY);
                    graphics.DrawLine(pen, centerX + 7, centerY - 7, centerX - 1, centerY + 1);
                    break;
                case TrayActionIcon.Trash:
                    graphics.DrawRectangle(pen, centerX - 5, centerY - 4, 10, 10);
                    graphics.DrawLine(pen, centerX - 7, centerY - 7, centerX + 7, centerY - 7);
                    graphics.DrawLine(pen, centerX - 2, centerY - 10, centerX + 2, centerY - 10);
                    break;
            }
        }
    }

    internal sealed class TrayAvatarControl : Control
    {
        private readonly string _text;
        private readonly Color _background;
        private readonly Color _foreground;
        private readonly Image _image;

        internal TrayAvatarControl(string text, Color background, Color foreground, string imagePath = "")
        {
            _text = text;
            _background = background;
            _foreground = foreground;
            if (!string.IsNullOrWhiteSpace(imagePath) && File.Exists(imagePath))
            {
                try
                {
                    using var stream = new FileStream(imagePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                    using var source = Image.FromStream(stream);
                    _image = new Bitmap(source);
                }
                catch
                {
                    _image = null;
                }
            }
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw |
                ControlStyles.UserPaint,
                true
            );
        }

        internal bool HasImage => _image != null;

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var brush = new SolidBrush(_background);
            e.Graphics.FillEllipse(brush, 0, 0, Width - 1, Height - 1);
            if (_image != null)
            {
                var scale = Math.Max(Width / (float)_image.Width, Height / (float)_image.Height);
                var drawWidth = _image.Width * scale;
                var drawHeight = _image.Height * scale;
                var destination = new RectangleF(
                    (Width - drawWidth) / 2F,
                    (Height - drawHeight) / 2F,
                    drawWidth,
                    drawHeight
                );
                using var clip = new GraphicsPath();
                clip.AddEllipse(0, 0, Width - 1, Height - 1);
                var state = e.Graphics.Save();
                e.Graphics.SetClip(clip);
                e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                e.Graphics.DrawImage(_image, destination);
                e.Graphics.Restore(state);
                return;
            }
            using var font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold);
            TextRenderer.DrawText(
                e.Graphics,
                _text,
                font,
                ClientRectangle,
                _foreground,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding
            );
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) _image?.Dispose();
            base.Dispose(disposing);
        }
    }

    internal sealed class TrayTextButton : Control
    {
        private readonly string _text;
        private readonly TrayNotificationPalette _palette;
        private bool _hovered;

        internal TrayTextButton(string text, TrayNotificationPalette palette)
        {
            _text = text;
            _palette = palette;
            Cursor = Cursors.Hand;
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw |
                ControlStyles.UserPaint,
                true
            );
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            _hovered = true;
            Invalidate();
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            _hovered = false;
            Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            if (_hovered)
            {
                using var path = TrayDrawing.CreateRoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), 6);
                using var brush = new SolidBrush(_palette.Hover);
                e.Graphics.FillPath(brush, path);
            }
            using var font = new Font("Microsoft YaHei UI", 8.75F, FontStyle.Regular);
            TextRenderer.DrawText(
                e.Graphics,
                _text,
                font,
                ClientRectangle,
                _hovered ? _palette.Foreground : _palette.MutedForeground,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding
            );
        }
    }

    internal static class TrayDrawing
    {
        internal static GraphicsPath CreateRoundedPath(Rectangle bounds, int radius)
        {
            var path = new GraphicsPath();
            var diameter = Math.Max(1, radius * 2);
            path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
            path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
            path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }

        internal static Region CreateRoundedRegion(Rectangle bounds, int radius)
        {
            using var path = CreateRoundedPath(bounds, radius);
            return new Region(path);
        }

        internal static Color Blend(Color first, Color second, float amount)
        {
            amount = Math.Max(0, Math.Min(1, amount));
            return Color.FromArgb(
                (int)Math.Round(first.A + (second.A - first.A) * amount),
                (int)Math.Round(first.R + (second.R - first.R) * amount),
                (int)Math.Round(first.G + (second.G - first.G) * amount),
                (int)Math.Round(first.B + (second.B - first.B) * amount)
            );
        }
    }
}
