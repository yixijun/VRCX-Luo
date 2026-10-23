using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace VRCX;

internal static class VrWorkspaceFileFilters
{
    internal static string[] Extensions(IEnumerable<string> filters, IEnumerable<string> expanded)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var filter in (expanded ?? Array.Empty<string>()).Concat(filters ?? Array.Empty<string>()))
        {
            // CEF supplies MIME expansions such as ".png;.jpg" and optional
            // descriptive filters such as "Image Types|.png;.gif".
            var pattern = (filter ?? "").Split('|').Last();
            foreach (var item in pattern.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (item is "*" or "*.*") return new[] { "*" };
                var extension = item.TrimStart('*', '.');
                if (Regex.IsMatch(extension, @"^[a-zA-Z0-9][a-zA-Z0-9._+-]*$"))
                    result.Add(extension.ToLowerInvariant());
            }
        }
        return result.ToArray();
    }
}
