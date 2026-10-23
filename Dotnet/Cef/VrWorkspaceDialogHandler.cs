using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.Handler;

namespace VRCX;

internal sealed class VrWorkspaceDialogHandler : DialogHandler
{
    protected override bool OnFileDialog(IWebBrowser chromiumWebBrowser, IBrowser browser, CefFileDialogMode mode,
        string title, string defaultFilePath, IReadOnlyCollection<string> acceptFilters,
        IReadOnlyCollection<string> acceptExtensions, IReadOnlyCollection<string> acceptDescriptions, IFileDialogCallback callback)
    {
        if (!DashboardWorkspaceCapture.Instance.Active) return false;
        _ = Select(mode, title, defaultFilePath, acceptExtensions, callback);
        return true;
    }

    private static async Task Select(CefFileDialogMode mode, string title, string defaultFilePath,
        IReadOnlyCollection<string> extensions, IFileDialogCallback callback)
    {
        using (callback)
        {
            try
            {
                var pickerMode = mode switch { CefFileDialogMode.Save => "save", CefFileDialogMode.OpenFolder => "directory", CefFileDialogMode.OpenMultiple => "selectMultiple", _ => "selectSingle" };
                var options = new {
                    title,
                    defaultPath = mode == CefFileDialogMode.Save ? Path.GetDirectoryName(defaultFilePath) ?? "" : defaultFilePath,
                    filename = mode == CefFileDialogMode.Save ? Path.GetFileName(defaultFilePath) : "",
                    filters = new[] { new { extensions = extensions?.Select(e => e.TrimStart('*', '.')).Where(e => e.Length > 0).ToArray() ?? Array.Empty<string>() } }
                };
                var response = await MainForm.Instance.Browser.EvaluateScriptAsPromiseAsync($"return window.chooseVrUploadFiles({JsonSerializer.Serialize(pickerMode)}, {JsonSerializer.Serialize(options)});", timeout: TimeSpan.FromMinutes(10));
                if (callback.IsDisposed) return;
                var files = response.Success ? JsonSerializer.Deserialize<List<string>>(JsonSerializer.Serialize(response.Result)) : null;
                if (files is not { Count: > 0 }) { callback.Cancel(); return; }
                if (mode == CefFileDialogMode.Save)
                {
                    var target = files[0];
                    var folder = Path.GetDirectoryName(target);
                    if (!Directory.Exists(folder)) { callback.Cancel(); return; }
                    var name = Path.GetFileName(target);
                    var suffix = 1;
                    while (File.Exists(target) || Directory.Exists(target)) target = Path.Combine(folder, $"{Path.GetFileNameWithoutExtension(name)} ({suffix++}){Path.GetExtension(name)}");
                    files[0] = target;
                }
                callback.Continue(files);
            }
            catch (Exception error)
            {
                if (!callback.IsDisposed) callback.Cancel();
                NLog.LogManager.GetCurrentClassLogger().Warn(error, "VR file dialog cancelled or unavailable");
            }
        }
    }
}
