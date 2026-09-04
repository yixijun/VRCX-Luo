using System;
using System.Drawing;
using System.Windows.Forms;
using Xunit;

namespace VRCX.Tests;

public class CloseToTrayDecisionTests
{
    [Fact]
    public void CancellingTheClosePromptKeepsTheMainWindowOpen()
    {
        StaTest.Run(() =>
        {
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);

            var decision = CloseToTrayDecision.Resolve(
                CloseToTrayPromptResult.Cancel,
                dontAskAgain: true
            );

            if (!decision.CancelClose || decision.ShouldPersistPreference)
            {
                throw new InvalidOperationException(
                    "Cancelling the prompt must keep the main window open without changing preferences."
                );
            }

            using var prompt = new CloseToTrayPrompt();
            if (prompt.BackColor != Color.FromArgb(10, 10, 10))
            {
                throw new InvalidOperationException(
                    "The close prompt must use the application's dark background."
                );
            }

            if (prompt.CancelButtonControl.Text != "取消")
            {
                throw new InvalidOperationException(
                    "The close prompt must provide an explicit cancel button."
                );
            }

            if (!prompt.ClientRectangle.Contains(prompt.CancelButtonControl.Bounds))
            {
                throw new InvalidOperationException(
                    "The close prompt action buttons must remain inside the visible client area after DPI scaling."
                );
            }
        });
    }

    [Fact]
    public void NonModalPromptCanBeDismissedWithoutClosingItsOwner()
    {
        StaTest.Run(() =>
        {
            using var owner = new Form();
            using var prompt = new CloseToTrayPrompt();
            CloseToTrayPromptResult? selectedResult = null;
            prompt.ChoiceSelected += (result, _) => selectedResult = result;

            owner.StartPosition = FormStartPosition.Manual;
            owner.Location = new Point(120, 90);
            owner.ClientSize = new Size(900, 640);
            owner.Show();
            prompt.Show(owner);
            Application.DoEvents();

            var expectedLocation = new Point(
                owner.Left + (owner.Width - prompt.Width) / 2,
                owner.Top + (owner.Height - prompt.Height) / 2
            );
            if (prompt.Location != expectedLocation)
            {
                throw new InvalidOperationException(
                    $"The close prompt must be centered over its owner. Expected {expectedLocation}, got {prompt.Location}."
                );
            }

            prompt.CancelButtonControl.PerformClick();
            Application.DoEvents();

            if (selectedResult.HasValue || !owner.Visible)
            {
                throw new InvalidOperationException(
                    "Dismissing the non-modal prompt must leave its owner open without selecting an action."
                );
            }

            owner.Close();
        });
    }
}
