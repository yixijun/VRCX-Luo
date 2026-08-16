using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace VRCX
{
    internal sealed class TrayMenuRenderer : ToolStripProfessionalRenderer
    {
        private static readonly Color TextColor = Color.FromArgb(244, 244, 245);
        private static readonly Color MutedTextColor = Color.FromArgb(161, 161, 170);
        private static readonly Color AccentColor = Color.FromArgb(59, 130, 246);

        internal TrayMenuRenderer() : base(new TrayMenuColorTable())
        {
            RoundedEdges = false;
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.TextColor = e.Item.Enabled ? TextColor : MutedTextColor;
            base.OnRenderItemText(e);
        }

        protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
        {
            e.ArrowColor = e.Item.Enabled ? TextColor : MutedTextColor;
            base.OnRenderArrow(e);
        }

        protected override void OnRenderItemCheck(ToolStripItemImageRenderEventArgs e)
        {
            var bounds = new Rectangle(e.ImageRectangle.X + 2, e.ImageRectangle.Y + 2, 15, 15);
            using var path = CreateRoundedRectangle(bounds, 4);
            using var fill = new SolidBrush(AccentColor);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.FillPath(fill, path);

            using var checkPen = new Pen(Color.White, 1.8F)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round
            };
            e.Graphics.DrawLines(checkPen, new[]
            {
                new Point(bounds.Left + 3, bounds.Top + 8),
                new Point(bounds.Left + 6, bounds.Top + 11),
                new Point(bounds.Left + 12, bounds.Top + 4)
            });
        }

        protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
        {
            using var pen = new Pen(Color.FromArgb(55, 55, 61));
            var y = e.Item.Height / 2;
            e.Graphics.DrawLine(pen, 12, y, e.Item.Width - 12, y);
        }

        private static GraphicsPath CreateRoundedRectangle(Rectangle bounds, int radius)
        {
            var diameter = radius * 2;
            var path = new GraphicsPath();
            path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
            path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
            path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    internal sealed class TrayMenuColorTable : ProfessionalColorTable
    {
        private static readonly Color Background = Color.FromArgb(24, 24, 27);
        private static readonly Color Selected = Color.FromArgb(39, 39, 42);
        private static readonly Color Border = Color.FromArgb(63, 63, 70);

        public override Color ToolStripDropDownBackground => Background;
        public override Color ImageMarginGradientBegin => Background;
        public override Color ImageMarginGradientMiddle => Background;
        public override Color ImageMarginGradientEnd => Background;
        public override Color MenuBorder => Border;
        public override Color MenuItemBorder => Selected;
        public override Color MenuItemSelected => Selected;
        public override Color MenuItemSelectedGradientBegin => Selected;
        public override Color MenuItemSelectedGradientEnd => Selected;
        public override Color MenuItemPressedGradientBegin => Selected;
        public override Color MenuItemPressedGradientMiddle => Selected;
        public override Color MenuItemPressedGradientEnd => Selected;
        public override Color CheckBackground => Background;
        public override Color CheckSelectedBackground => Selected;
        public override Color CheckPressedBackground => Selected;
        public override Color SeparatorDark => Border;
        public override Color SeparatorLight => Border;
    }
}
