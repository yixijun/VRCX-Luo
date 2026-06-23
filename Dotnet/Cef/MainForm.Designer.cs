using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace VRCX
{
    partial class MainForm
    {
        /// <summary>
        ///     필수 디자이너 변수입니다.
        /// </summary>
        private IContainer components = null;

        /// <summary>
        ///     사용 중인 모든 리소스를 정리합니다.
        /// </summary>
        /// <param name="disposing">관리되는 리소스를 삭제해야 하면 true이고, 그렇지 않으면 false입니다.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }

            base.Dispose(disposing);
        }

        #region Windows Form 디자이너에서 생성한 코드

        /// <summary>
        ///     디자이너 지원에 필요한 메서드입니다.
        ///     이 메서드의 내용을 코드 편집기로 수정하지 마세요.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new Container();
            this.TrayMenu = new ContextMenuStrip(this.components);
            this.TrayMenu_Open = new ToolStripMenuItem();
            this.TrayMenu_DesktopNotifications = new ToolStripMenuItem();
            this.TrayMenu_SilentMode = new ToolStripMenuItem();
            this.TrayMenu_VSleepMode = new ToolStripMenuItem();
            this.TrayMenu_DevTools = new ToolStripMenuItem();
            this.TrayMenu_ForceCrash = new ToolStripMenuItem();
            this.TrayMenu_Separator = new ToolStripSeparator();
            this.TrayMenu_Quit = new ToolStripMenuItem();
            this.TrayIcon = new NotifyIcon(this.components);
            this.TrayMenu.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point, ((byte)(0)));

            this.TrayMenu.SuspendLayout();
            this.SuspendLayout();
            //
            // TrayMenu
            //
            this.TrayMenu.Items.Add(this.TrayMenu_Open);
            this.TrayMenu.Items.Add(this.TrayMenu_DesktopNotifications);
            this.TrayMenu.Items.Add(this.TrayMenu_SilentMode);
            this.TrayMenu.Items.Add(this.TrayMenu_VSleepMode);
            this.TrayMenu.Items.Add(this.TrayMenu_DevTools);
            if (Program.LaunchDebug)
                this.TrayMenu.Items.Add(this.TrayMenu_ForceCrash);
            this.TrayMenu.Items.Add(this.TrayMenu_Separator);
            this.TrayMenu.Items.Add(this.TrayMenu_Quit);

            this.TrayMenu.Name = "TrayMenu";
            this.TrayMenu.Size = new Size(178, 98);
            //
            // TrayMenu_Open
            //
            this.TrayMenu_Open.Name = "TrayMenu_Open";
            this.TrayMenu_Open.Size = new Size(177, 22);
            this.TrayMenu_Open.Text = "打开 VRCX-Luo";
            this.TrayMenu_Open.Click += new EventHandler(this.TrayMenu_Open_Click);
            //
            // TrayMenu_DesktopNotifications
            //
            this.TrayMenu_DesktopNotifications.Name = "TrayMenu_DesktopNotifications";
            this.TrayMenu_DesktopNotifications.Size = new Size(177, 22);
            this.TrayMenu_DesktopNotifications.Click += new EventHandler(this.TrayMenu_DesktopNotifications_Click);
            //
            // TrayMenu_SilentMode
            //
            this.TrayMenu_SilentMode.Name = "TrayMenu_SilentMode";
            this.TrayMenu_SilentMode.Size = new Size(177, 22);
            this.TrayMenu_SilentMode.Text = "静音模式";
            this.TrayMenu_SilentMode.Click += new EventHandler(this.TrayMenu_SilentMode_Click);
            //
            // TrayMenu_VSleepMode
            //
            this.TrayMenu_VSleepMode.Name = "TrayMenu_VSleepMode";
            this.TrayMenu_VSleepMode.Size = new Size(177, 22);
            this.TrayMenu_VSleepMode.Text = "V睡模式";
            this.TrayMenu_VSleepMode.Click += new EventHandler(this.TrayMenu_VSleepMode_Click);
            //
            // TrayMenu_DevTools
            //
            this.TrayMenu_DevTools.Name = "TrayMenu_DevTools";
            this.TrayMenu_DevTools.Size = new Size(177, 22);
            this.TrayMenu_DevTools.Text = "开发者工具";
            this.TrayMenu_DevTools.Click += new EventHandler(this.TrayMenu_DevTools_Click);
            //
            // TrayMenu_ForceCrash
            //
            this.TrayMenu_ForceCrash.Name = "TrayMenu_ForceCrash";
            this.TrayMenu_ForceCrash.Size = new Size(177, 22);
            this.TrayMenu_ForceCrash.Text = "强制崩溃测试";
            this.TrayMenu_ForceCrash.Click += new EventHandler(this.TrayMenu_ForceCrash_Click);
            //
            // TrayMenu_Separator
            //
            this.TrayMenu_Separator.Name = "TrayMenu_Separator";
            this.TrayMenu_Separator.Size = new Size(174, 6);
            //
            // TrayMenu_Quit
            //
            this.TrayMenu_Quit.Name = "TrayMenu_Quit";
            this.TrayMenu_Quit.Size = new Size(177, 22);
            this.TrayMenu_Quit.Text = "退出 VRCX-Luo";
            this.TrayMenu_Quit.Click += new EventHandler(this.TrayMenu_Quit_Click);
            //
            // TrayIcon
            //
            this.TrayIcon.ContextMenuStrip = this.TrayMenu;
            this.TrayIcon.Text = "VRCX";
            this.TrayIcon.Visible = true;
            this.TrayIcon.MouseClick += new MouseEventHandler(this.TrayIcon_MouseClick);
            //
            // MainForm
            //
            this.AutoScaleDimensions = new SizeF(96F, 96F);
            this.AutoScaleMode = AutoScaleMode.Dpi;
            this.ClientSize = new Size(842, 561);
            this.MinimumSize = new Size(320, 240);
            this.Name = "MainForm";
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Text = Program.Version;
            this.FormClosing += new FormClosingEventHandler(this.MainForm_FormClosing);
            this.FormClosed += new FormClosedEventHandler(this.MainForm_FormClosed);
            this.Load += new EventHandler(this.MainForm_Load);
            this.Move += new EventHandler(this.MainForm_Move);
            this.Resize += new EventHandler(this.MainForm_Resize);
            this.TrayMenu.ResumeLayout(false);
            this.ResumeLayout(false);
        }

        #endregion

        private ContextMenuStrip TrayMenu;
        private ToolStripMenuItem TrayMenu_Open;
        private ToolStripMenuItem TrayMenu_DesktopNotifications;
        private ToolStripMenuItem TrayMenu_SilentMode;
        private ToolStripMenuItem TrayMenu_VSleepMode;
        private ToolStripMenuItem TrayMenu_DevTools;
        private ToolStripMenuItem TrayMenu_ForceCrash;
        private ToolStripSeparator TrayMenu_Separator;
        private ToolStripMenuItem TrayMenu_Quit;
        private NotifyIcon TrayIcon;
    }
}
