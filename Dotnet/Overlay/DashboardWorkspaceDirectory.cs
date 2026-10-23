using System;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace VRCX;

internal static class DashboardWorkspaceDirectory
{
    internal static string List(string path, int offset)
    {
        try
        {
            if (offset < 0 || offset > 1000000 || path?.Length > 4096) throw new ArgumentException("目录参数无效");
            if (string.IsNullOrWhiteSpace(path))
            {
                var roots = new[] { Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) }
                    .Concat(DriveInfo.GetDrives().Where(d => d.IsReady).Select(d => d.RootDirectory.FullName))
                    .Where(Directory.Exists).Distinct().Select(p => new { name = p, path = p, directory = true });
                return JsonSerializer.Serialize(new { path = "", parent = "", entries = roots, hasMore = false });
            }
            if (File.Exists(path)) path = Path.GetDirectoryName(path);
            path = Path.GetFullPath(path);
            // Skip/take is applied before projection. Large galleries are paged instead of serialized at once.
            var rows = Directory.EnumerateDirectories(path).Concat(Directory.EnumerateFiles(path)).Skip(offset).Take(65).ToArray();
            var entries = rows.Take(64).Select(p => new { name = Path.GetFileName(p), path = p, directory = Directory.Exists(p) });
            return JsonSerializer.Serialize(new { path, parent = Directory.GetParent(path)?.FullName ?? "", entries, hasMore = rows.Length > 64 });
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or ArgumentException)
        {
            return JsonSerializer.Serialize(new { error = error.Message });
        }
    }
}
