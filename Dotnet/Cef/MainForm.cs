using System;
using System.Diagnostics.CodeAnalysis;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using CefSharp;
using CefSharp.WinForms;
using Newtonsoft.Json;
using NLog;

namespace VRCX
{
    [SuppressMessage("Interoperability", "CA1416:Validate platform compatibility")]
    public partial class MainForm : WinformBase
    {
        public static MainForm Instance;
        public static NativeWindow nativeWindow;
        private static readonly Logger logger = LogManager.GetCurrentClassLogger();
        private const uint WmSetIcon = 0x0080;
        private const int IconSmall = 0;
        private const int IconBig = 1;

        [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

        public ChromiumWebBrowser Browser;
        private readonly Icon _appIcon;
        private readonly Icon _appIconNoty;
        private readonly Timer _saveTimer;
        private int LastLocationX;
        private int LastLocationY;
        private int LastSizeWidth;
        private int LastSizeHeight;
        private bool _allowClose;
        private CloseToTrayPrompt _closeToTrayPrompt;
        private TrayNotificationPreview _trayNotificationPreview;
        private TrayNotificationSnapshot _trayNotificationSnapshot = new();
        private readonly Timer _trayHoverTimer;
        private readonly TrayHoverIntent _trayHoverIntent = new(
            TimeSpan.FromMilliseconds(300),
            TimeSpan.FromMilliseconds(1100)
        );
        private bool _trayMenuActive;
        private FormWindowState LastWindowStateToRestore = FormWindowState.Normal;

        public MainForm()
        {
            Instance = this;
            InitializeComponent();
            Shown += (_, _) => RefreshTaskbarIcon();

            // Set the form icon before any explicit handle access.  Creating the
            // handle first can leave the taskbar using the default WinForms icon
            // until the shell refreshes the window entry.
            try
            {
                var path = Path.GetDirectoryName(Environment.ProcessPath) ?? string.Empty;
                _appIcon = new Icon(Path.Combine(path, "VRCX.ico"));
                _appIconNoty = new Icon(Path.Combine(path, "VRCX_notify.ico"));
                Icon = _appIcon;
                TrayIcon.Icon = _appIcon;
            }
            catch (Exception ex)
            {
                logger.Error(ex);
            }

            nativeWindow = NativeWindow.FromHandle(this.Handle);
            RefreshTaskbarIcon();
            ConfigureTrayMenuAppearance();
            UpdateTraySettingsMenu();
            TrayMenu.Opening += (_, _) =>
            {
                _trayMenuActive = true;
                DismissTrayNotificationPreview();
                UpdateTraySettingsMenu();
            };
            TrayMenu.Closed += (_, _) =>
            {
                _trayMenuActive = false;
                _trayHoverIntent.Cancel();
            };

            _trayHoverTimer = new Timer { Interval = 100 };
            _trayHoverTimer.Tick += (_, _) =>
            {
                if (
                    !_trayMenuActive
                    && !TrayMenu.Visible
                    && _trayNotificationSnapshot.Items.Count > 0
                    && _trayHoverIntent.ShouldShow(Cursor.Position, DateTime.UtcNow)
                )
                {
                    ShowTrayNotificationPreview();
                }
            };

            // adding a 5s delay here to avoid excessive writes to disk
            _saveTimer = new Timer();
            _saveTimer.Interval = 5000;
            _saveTimer.Tick += SaveTimer_Tick;
            Browser = new ChromiumWebBrowser(Program.LaunchDebug ? "http://localhost:9000/index.html" : "file://vrcx/index.html")
            {
                DragHandler = new CustomDragHandler(),
                MenuHandler = new CustomMenuHandler(),
                DownloadHandler = new CustomDownloadHandler(),
                RequestHandler = new CustomRequestHandler(),
                BrowserSettings =
                {
                    DefaultEncoding = "UTF-8",
                },
                Dock = DockStyle.Fill
            };
            Browser.IsBrowserInitializedChanged += (_, _) =>
            {
                if (Program.LaunchDebug)
                    Browser.ShowDevTools();
            };
            Browser.AddressChanged += (_, addressChangedEventArgs) =>
            {
                logger.Debug("Address changed: " + addressChangedEventArgs.Address);
            };
            Browser.LoadingStateChanged += (_, loadingFailedEventArgs) =>
            {
                if (loadingFailedEventArgs.IsLoading)
                    logger.Debug("Loading page");
                else
                    logger.Debug("Loaded page: " + loadingFailedEventArgs.Browser.MainFrame.Url);
            };
            Browser.ConsoleMessage += (_, consoleMessageEventArgs) =>
            {
                logger.Debug(consoleMessageEventArgs.Message + " (" + consoleMessageEventArgs.Source + ":" + consoleMessageEventArgs.Line + ")");
            };
            Browser.GotFocus += (_, _) =>
            {
                if (Browser != null && !Browser.IsLoading && Browser.CanExecuteJavascriptInMainFrame)
                    Browser.ExecuteScriptAsync("window?.$pinia?.vrcStatus?.onBrowserFocus();");
            };

            JavascriptBindings.ApplyAppJavascriptBindings(Browser.JavascriptObjectRepository);
            Controls.Add(Browser);
        }

        private void MainForm_Load(object sender, System.EventArgs e)
        {
            try
            {
                int.TryParse(VRCXStorage.Instance.Get("VRCX_LocationX"), out LastLocationX);
                int.TryParse(VRCXStorage.Instance.Get("VRCX_LocationY"), out LastLocationY);
                int.TryParse(VRCXStorage.Instance.Get("VRCX_SizeWidth"), out LastSizeWidth);
                int.TryParse(VRCXStorage.Instance.Get("VRCX_SizeHeight"), out LastSizeHeight);
                var location = new Point(LastLocationX, LastLocationY);
                var size = new Size(LastSizeWidth, LastSizeHeight);
                var screen = Screen.FromPoint(location);
                if (screen.Bounds.Contains(location.X, location.Y))
                {
                    Location = location;
                }
                Size = new Size(1920, 1080);
                if (size.Width > 0 && size.Height > 0)
                {
                    Size = size;
                }
            }
            catch (Exception ex)
            {
                logger.Error(ex);
            }

            try
            {
                var state = WindowState;
                var startAsMinimized = VRCXStorage.Instance.Get("VRCX_StartAsMinimizedState") == "true";
                var closeToTray = VRCXStorage.Instance.Get("VRCX_CloseToTray") == "true";
                if (int.TryParse(VRCXStorage.Instance.Get("VRCX_WindowState"), out var value))
                {
                    state = (FormWindowState)value;
                }
                if (state == FormWindowState.Minimized)
                {
                    state = FormWindowState.Normal;
                }
                // Apply WindowState twice to maximize before minimize
                WindowState = state;
                LastWindowStateToRestore = state;

                if (StartupArgs.LaunchArguments.IsStartup && startAsMinimized)
                {
                    if (closeToTray)
                    {
                        BeginInvoke(Hide);
                        return;
                    }
                    state = FormWindowState.Minimized;
                    WindowState = state;
                }
            }
            catch (Exception ex)
            {
                logger.Error(ex);
            }

            Browser.Invalidate();
        }

        private void MainForm_Resize(object sender, System.EventArgs e)
        {
            if (WindowState != FormWindowState.Minimized)
                LastWindowStateToRestore = WindowState;

            if (WindowState != FormWindowState.Normal)
                return;

            LastSizeWidth = Size.Width;
            LastSizeHeight = Size.Height;

            _saveTimer?.Start();
        }

        private void SaveTimer_Tick(object sender, EventArgs e)
        {
            SaveWindowState();
            _saveTimer?.Stop();
        }

        private void MainForm_Move(object sender, System.EventArgs e)
        {
            if (WindowState != FormWindowState.Normal)
            {
                return;
            }
            LastLocationX = Location.X;
            LastLocationY = Location.Y;

            _saveTimer?.Start();
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (e.CloseReason != CloseReason.UserClosing || _allowClose)
            {
                return;
            }

            if (IsCloseToTrayEnabled())
            {
                HideToTray(e);
                return;
            }

            if (!ShouldPromptCloseToTray())
            {
                return;
            }

            e.Cancel = true;
            ShowCloseToTrayPrompt();
        }

        private void ShowCloseToTrayPrompt()
        {
            if (
                Browser != null &&
                Browser.CanExecuteJavascriptInMainFrame
            )
            {
                Browser.ExecuteScriptAsync(
                    "window.dispatchEvent(new CustomEvent('vrcx-close-requested'));"
                );
                return;
            }

            if (_closeToTrayPrompt != null && !_closeToTrayPrompt.IsDisposed)
            {
                _closeToTrayPrompt.Activate();
                return;
            }

            var prompt = new CloseToTrayPrompt();
            _closeToTrayPrompt = prompt;
            prompt.FormClosed += (_, _) =>
            {
                if (ReferenceEquals(_closeToTrayPrompt, prompt))
                {
                    _closeToTrayPrompt = null;
                }
            };
            prompt.ChoiceSelected += ApplyCloseToTrayChoice;
            prompt.Show(this);
            prompt.Activate();
        }

        public void HandleClosePromptChoice(string action, bool dontAskAgain)
        {
            var result = action switch
            {
                "tray" => CloseToTrayPromptResult.MinimizeToTray,
                "exit" => CloseToTrayPromptResult.Exit,
                _ => CloseToTrayPromptResult.Cancel
            };

            if (result == CloseToTrayPromptResult.Cancel)
            {
                return;
            }

            ApplyCloseToTrayChoice(result, dontAskAgain);
        }

        private void ApplyCloseToTrayChoice(
            CloseToTrayPromptResult promptResult,
            bool dontAskAgain
        )
        {
            var decision = CloseToTrayDecision.Resolve(
                promptResult,
                dontAskAgain
            );

            if (decision.ShouldPersistPreference)
            {
                VRCXStorage.Instance.Set("VRCX_CloseToTrayPrompt", "false");
                VRCXStorage.Instance.Set(
                    "VRCX_CloseToTray",
                    decision.CloseToTrayEnabled.ToString().ToLowerInvariant()
                );
            }

            if (decision.MinimizeToTray)
            {
                Hide();
                return;
            }

            _allowClose = true;
            Close();
        }

        private static bool IsCloseToTrayEnabled()
        {
            return VRCXStorage.Instance.Get("VRCX_CloseToTray") == "true";
        }

        private static bool ShouldPromptCloseToTray()
        {
            return VRCXStorage.Instance.Get("VRCX_CloseToTrayPrompt") != "false";
        }

        private void HideToTray(FormClosingEventArgs e)
        {
            e.Cancel = true;
            Hide();
        }

        private void SaveWindowState()
        {
            VRCXStorage.Instance.Set("VRCX_LocationX", LastLocationX.ToString());
            VRCXStorage.Instance.Set("VRCX_LocationY", LastLocationY.ToString());
            VRCXStorage.Instance.Set("VRCX_SizeWidth", LastSizeWidth.ToString());
            VRCXStorage.Instance.Set("VRCX_SizeHeight", LastSizeHeight.ToString());
            VRCXStorage.Instance.Set("VRCX_WindowState", ((int)LastWindowStateToRestore).ToString());
        }

        private void MainForm_FormClosed(object sender, FormClosedEventArgs e)
        {
            SaveWindowState();
        }

        private void RefreshTaskbarIcon()
        {
            if (_appIcon == null || IsDisposed || !IsHandleCreated)
                return;

            var handle = Handle;
            if (handle == IntPtr.Zero)
                return;

            SendMessage(handle, WmSetIcon, (IntPtr)IconSmall, _appIcon.Handle);
            SendMessage(handle, WmSetIcon, (IntPtr)IconBig, _appIcon.Handle);
        }

        private void TrayIcon_MouseClick(object sender, MouseEventArgs e)
        {
            DismissTrayNotificationPreview();
            if (e.Button == MouseButtons.Left)
            {
                Focus_Window();
            }
        }

        private void TrayIcon_MouseMove(object sender, MouseEventArgs e)
        {
            if (_trayMenuActive || TrayMenu.Visible)
            {
                _trayHoverTimer.Stop();
                return;
            }
            _trayHoverIntent.Track(Cursor.Position, DateTime.UtcNow);
            _trayHoverTimer.Stop();
            _trayHoverTimer.Start();
        }

        private void ShowTrayNotificationPreview()
        {
            _trayHoverTimer.Stop();
            if (_trayMenuActive || TrayMenu.Visible) return;
            if (_trayNotificationPreview == null || _trayNotificationPreview.IsDisposed)
            {
                _trayNotificationPreview = new TrayNotificationPreview();
                _trayNotificationPreview.ActionRequested += DispatchTrayNotificationAction;
            }
            _trayNotificationPreview.UpdateSnapshot(_trayNotificationSnapshot);
            _trayNotificationPreview.ShowNearTray();
        }

        private void DismissTrayNotificationPreview()
        {
            _trayHoverTimer.Stop();
            _trayHoverIntent.Cancel();
            _trayNotificationPreview?.DismissImmediately();
        }

        private void DispatchTrayNotificationAction(string action, string notificationId)
        {
            if (action == "open" || action == "open-center" || action == "invite-accept" || action == "boop-reply")
            {
                Focus_Window();
            }
            Browser?.ExecuteScriptAsync(
                "window.dispatchEvent(new CustomEvent('vrcx-tray-notification-action', { detail: { action: " +
                JsonConvert.SerializeObject(action) +
                ", notificationId: " +
                JsonConvert.SerializeObject(notificationId) +
                " } }));"
            );
            DismissTrayNotificationPreview();
        }

        private void TrayMenu_Open_Click(object sender, System.EventArgs e)
        {
            Focus_Window();
        }

        private bool AreDesktopNotificationsEnabled()
        {
            return VRCXStorage.Instance.Get("VRCX_desktopNotificationsEnabled") != "false";
        }

        private bool IsTraySilentModeEnabled()
        {
            return VRCXStorage.Instance.Get("VRCX_traySilentMode") == "true";
        }

        private bool IsVSleepModeEnabled()
        {
            return VRCXStorage.Instance.Get("VRCX_vSleepMode") == "true";
        }

        private void UpdateTraySettingsMenu()
        {
            var desktopNotificationsEnabled = AreDesktopNotificationsEnabled();
            TrayMenu_DesktopNotifications.Checked = desktopNotificationsEnabled;
            TrayMenu_DesktopNotifications.Text = desktopNotificationsEnabled ? "桌面通知：已开启" : "桌面通知：已关闭";


            TrayMenu_SilentMode.Checked = IsTraySilentModeEnabled();
            TrayMenu_VSleepMode.Checked = IsVSleepModeEnabled();
        }

        private void ConfigureTrayMenuAppearance()
        {
            TrayMenu.AutoSize = true;
            TrayMenu.BackColor = Color.FromArgb(24, 24, 27);
            TrayMenu.ForeColor = Color.FromArgb(244, 244, 245);
            TrayMenu.Font = new Font("Microsoft YaHei UI", 9.5F, FontStyle.Regular);
            TrayMenu.Padding = new Padding(6);
            TrayMenu.Renderer = new TrayMenuRenderer();
            TrayMenu.ShowImageMargin = true;

            foreach (ToolStripItem item in TrayMenu.Items)
            {
                if (item is ToolStripMenuItem menuItem)
                {
                    menuItem.AutoSize = true;
                    menuItem.Padding = new Padding(5, 4, 5, 4);
                }
            }
        }

        private void TrayMenu_DesktopNotifications_Click(object sender, System.EventArgs e)
        {
            var enabled = !AreDesktopNotificationsEnabled();
            VRCXStorage.Instance.Set("VRCX_desktopNotificationsEnabled", enabled.ToString().ToLowerInvariant());
            VRCXStorage.Instance.Save();
            UpdateTraySettingsMenu();
            Browser?.ExecuteScriptAsync(
                "window.dispatchEvent(new CustomEvent('vrcx-desktop-notifications-updated', { detail: { enabled: " +
                enabled.ToString().ToLowerInvariant() +
                " } }));"
            );
        }

        private void TrayMenu_SilentMode_Click(object sender, System.EventArgs e)
        {
            var enabled = !IsTraySilentModeEnabled();
            VRCXStorage.Instance.Set("VRCX_traySilentMode", enabled.ToString().ToLowerInvariant());
            VRCXStorage.Instance.Save();
            UpdateTraySettingsMenu();
            Browser?.ExecuteScriptAsync(
                "window.dispatchEvent(new CustomEvent('vrcx-tray-silent-mode-updated', { detail: { enabled: " +
                enabled.ToString().ToLowerInvariant() +
                " } }));"
            );
        }

        private void TrayMenu_VSleepMode_Click(object sender, System.EventArgs e)
        {
            var enabled = !IsVSleepModeEnabled();
            VRCXStorage.Instance.Set("VRCX_vSleepMode", enabled.ToString().ToLowerInvariant());
            VRCXStorage.Instance.Save();
            UpdateTraySettingsMenu();
            Browser?.ExecuteScriptAsync(
                "window.dispatchEvent(new CustomEvent('vrcx-v-sleep-mode-updated', { detail: { enabled: " +
                enabled.ToString().ToLowerInvariant() +
                " } }));"
            );
        }

        public void Focus_Window()
        {
            Show();
            if (WindowState == FormWindowState.Minimized)
            {
                WindowState = LastWindowStateToRestore;
            }
            // Focus();
            Activate();
        }

        private void TrayMenu_DevTools_Click(object sender, System.EventArgs e)
        {
            Instance.Browser.ShowDevTools();
        }

        private void TrayMenu_ForceCrash_Click(object sender, System.EventArgs e)
        {
            Instance.Browser.LoadUrl("chrome://crash");
        }

        private void TrayMenu_Quit_Click(object sender, System.EventArgs e)
        {
            SaveWindowState();
            Application.Exit();
        }

        public void SetTrayIconNotification(bool notify)
        {
            TrayIcon.Icon = notify ? _appIconNoty : _appIcon;
        }

        public void UpdateTrayNotifications(string json)
        {
            try
            {
                _trayNotificationSnapshot =
                    JsonConvert.DeserializeObject<TrayNotificationSnapshot>(json) ?? new TrayNotificationSnapshot();
                if (_trayNotificationSnapshot.Items.Count == 0)
                {
                    DismissTrayNotificationPreview();
                    return;
                }

                if (_trayNotificationPreview != null &&
                    !_trayNotificationPreview.IsDisposed &&
                    _trayNotificationPreview.Visible)
                {
                    _trayNotificationPreview.UpdateSnapshot(_trayNotificationSnapshot);
                }
            }
            catch (Exception ex)
            {
                logger.Warn(ex, "Failed to update tray notifications");
            }
        }

    }
}
