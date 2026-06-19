using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text.Json;

namespace VRCX
{
    public abstract partial class AppApi
    {
        [DllImport("psapi.dll")]
        private static extern bool EmptyWorkingSet(IntPtr hProcess);

        [DllImport("ntdll.dll")]
        private static extern int NtSetSystemInformation(int systemInformationClass, ref int systemInformation, int systemInformationLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetSystemFileCacheSize(IntPtr minimumFileCacheSize, IntPtr maximumFileCacheSize, int flags);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool OpenProcessToken(IntPtr processHandle, int desiredAccess, out IntPtr tokenHandle);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool LookupPrivilegeValue(string systemName, string name, out Luid luid);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool AdjustTokenPrivileges(IntPtr tokenHandle, bool disableAllPrivileges, ref TokenPrivileges newState, int bufferLength, IntPtr previousState, IntPtr returnLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr handle);

        private const int SystemMemoryListInformation = 80;
        private const int MemoryFlushModifiedList = 3;
        private const int MemoryPurgeStandbyList = 4;
        private const int MemoryPurgeLowPriorityStandbyList = 5;
        private const int TokenAdjustPrivileges = 0x20;
        private const int TokenQuery = 0x08;
        private const int SePrivilegeEnabled = 0x02;

        private static readonly string[] MemoryCleanupProcessNames =
        {
            "VRCX-Luo",
            "VRCX",
            "VRChat",
            "CefSharp.BrowserSubprocess"
        };

        private static string GetMemoryCleanupSnapshotInternal()
        {
            var snapshot = BuildMemorySnapshot();
            return JsonSerializer.Serialize(snapshot);
        }

        private static string CleanupMemoryInternal(bool deep)
        {
            var before = BuildMemorySnapshot();
            var processResults = CleanupProcessWorkingSets();
            var deepResult = new MemoryCleanupDeepResult
            {
                Requested = deep,
                Supported = OperatingSystem.IsWindows(),
                RequiresAdmin = true,
                Ran = false,
                Status = deep ? "pending" : "notRequested"
            };

            if (deep)
            {
                if (!OperatingSystem.IsWindows())
                {
                    deepResult.Status = "unsupported";
                }
                else if (!IsAdministrator())
                {
                    deepResult.Status = "requiresAdmin";
                }
                else
                {
                    deepResult = CleanupSystemMemoryLists();
                }
            }

            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();

            var after = BuildMemorySnapshot();
            return JsonSerializer.Serialize(new MemoryCleanupResult
            {
                Before = before,
                After = after,
                Processes = processResults,
                Deep = deepResult,
                FreedBytes = Math.Max(0, before.TargetProcessWorkingSetBytes - after.TargetProcessWorkingSetBytes)
            });
        }

        private static MemoryCleanupSnapshot BuildMemorySnapshot()
        {
            var info = GC.GetGCMemoryInfo();
            var processes = GetTargetProcesses()
                .Select(process =>
                {
                    try
                    {
                        return new MemoryCleanupProcessInfo
                        {
                            Id = process.Id,
                            Name = process.ProcessName,
                            WorkingSetBytes = process.WorkingSet64,
                            PrivateMemoryBytes = process.PrivateMemorySize64
                        };
                    }
                    catch
                    {
                        return null;
                    }
                    finally
                    {
                        process.Dispose();
                    }
                })
                .Where(process => process != null)
                .OrderBy(process => process.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(process => process.Id)
                .ToList();

            return new MemoryCleanupSnapshot
            {
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                IsWindows = OperatingSystem.IsWindows(),
                IsAdministrator = OperatingSystem.IsWindows() && IsAdministrator(),
                TotalAvailableMemoryBytes = info.TotalAvailableMemoryBytes,
                MemoryLoadBytes = info.MemoryLoadBytes,
                Processes = processes
            };
        }

        private static List<MemoryCleanupProcessResult> CleanupProcessWorkingSets()
        {
            return GetTargetProcesses()
                .Select(process =>
                {
                    var result = new MemoryCleanupProcessResult
                    {
                        Id = 0,
                        Name = string.Empty,
                        Ok = false,
                        BeforeBytes = 0,
                        AfterBytes = 0,
                        Error = string.Empty
                    };

                    try
                    {
                        result.Id = process.Id;
                        result.Name = process.ProcessName;
                        result.BeforeBytes = process.WorkingSet64;
                        result.Ok = EmptyWorkingSet(process.Handle);
                        process.Refresh();
                        result.AfterBytes = process.WorkingSet64;
                    }
                    catch (Exception ex)
                    {
                        result.Error = ex.Message;
                    }
                    finally
                    {
                        process.Dispose();
                    }

                    return result;
                })
                .ToList();
        }

        private static MemoryCleanupDeepResult CleanupSystemMemoryLists()
        {
            var result = new MemoryCleanupDeepResult
            {
                Requested = true,
                Supported = true,
                RequiresAdmin = true,
                Ran = true,
                Status = "completed"
            };

            result.Operations.Add(EnablePrivilege("SeProfileSingleProcessPrivilege"));
            result.Operations.Add(EnablePrivilege("SeIncreaseQuotaPrivilege"));
            result.Operations.Add(PurgeMemoryList("modifiedPageList", MemoryFlushModifiedList));
            result.Operations.Add(PurgeMemoryList("standbyList", MemoryPurgeStandbyList));
            result.Operations.Add(PurgeMemoryList("lowPriorityStandbyList", MemoryPurgeLowPriorityStandbyList));
            result.Operations.Add(TrimSystemFileCache());

            if (!result.Operations.Any(operation => operation.Ok && operation.Kind == "cleanup"))
            {
                result.Ran = false;
                result.Status = "failed";
            }

            return result;
        }

        private static MemoryCleanupOperationResult PurgeMemoryList(string name, int command)
        {
            var nativeStatus = NtSetSystemInformation(SystemMemoryListInformation, ref command, sizeof(int));
            return new MemoryCleanupOperationResult
            {
                Kind = "cleanup",
                Name = name,
                Ok = nativeStatus == 0,
                NativeStatus = $"0x{nativeStatus:X8}",
                Error = nativeStatus == 0 ? string.Empty : $"NtSetSystemInformation failed with status 0x{nativeStatus:X8}"
            };
        }

        private static MemoryCleanupOperationResult TrimSystemFileCache()
        {
            var ok = SetSystemFileCacheSize(new IntPtr(-1), new IntPtr(-1), 0);
            var error = ok ? 0 : Marshal.GetLastWin32Error();
            return new MemoryCleanupOperationResult
            {
                Kind = "cleanup",
                Name = "systemFileCache",
                Ok = ok,
                NativeStatus = error == 0 ? "0" : error.ToString(),
                Error = ok ? string.Empty : $"SetSystemFileCacheSize failed with Win32 error {error}"
            };
        }

        private static MemoryCleanupOperationResult EnablePrivilege(string privilegeName)
        {
            var result = new MemoryCleanupOperationResult
            {
                Kind = "privilege",
                Name = privilegeName
            };

            if (!OpenProcessToken(Process.GetCurrentProcess().Handle, TokenAdjustPrivileges | TokenQuery, out var tokenHandle))
            {
                var error = Marshal.GetLastWin32Error();
                result.NativeStatus = error.ToString();
                result.Error = $"OpenProcessToken failed with Win32 error {error}";
                return result;
            }

            try
            {
                if (!LookupPrivilegeValue(null, privilegeName, out var luid))
                {
                    var error = Marshal.GetLastWin32Error();
                    result.NativeStatus = error.ToString();
                    result.Error = $"LookupPrivilegeValue failed with Win32 error {error}";
                    return result;
                }

                var tokenPrivileges = new TokenPrivileges
                {
                    PrivilegeCount = 1,
                    Luid = luid,
                    Attributes = SePrivilegeEnabled
                };

                var ok = AdjustTokenPrivileges(tokenHandle, false, ref tokenPrivileges, 0, IntPtr.Zero, IntPtr.Zero);
                var adjustError = Marshal.GetLastWin32Error();
                result.Ok = ok && adjustError == 0;
                result.NativeStatus = adjustError.ToString();
                result.Error = result.Ok ? string.Empty : $"AdjustTokenPrivileges failed with Win32 error {adjustError}";
                return result;
            }
            finally
            {
                CloseHandle(tokenHandle);
            }
        }

        private static IEnumerable<Process> GetTargetProcesses()
        {
            if (!OperatingSystem.IsWindows())
                return Enumerable.Empty<Process>();

            return MemoryCleanupProcessNames
                .SelectMany(processName =>
                {
                    try
                    {
                        return Process.GetProcessesByName(processName);
                    }
                    catch
                    {
                        return Array.Empty<Process>();
                    }
                });
        }

        private static bool IsAdministrator()
        {
            try
            {
                using var identity = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }

        private sealed class MemoryCleanupSnapshot
        {
            public long Timestamp { get; set; }
            public bool IsWindows { get; set; }
            public bool IsAdministrator { get; set; }
            public long TotalAvailableMemoryBytes { get; set; }
            public long MemoryLoadBytes { get; set; }
            public List<MemoryCleanupProcessInfo> Processes { get; set; } = new();
            public long TargetProcessWorkingSetBytes => Processes.Sum(process => process.WorkingSetBytes);
        }

        private sealed class MemoryCleanupProcessInfo
        {
            public int Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public long WorkingSetBytes { get; set; }
            public long PrivateMemoryBytes { get; set; }
        }

        private sealed class MemoryCleanupResult
        {
            public MemoryCleanupSnapshot Before { get; set; } = new();
            public MemoryCleanupSnapshot After { get; set; } = new();
            public List<MemoryCleanupProcessResult> Processes { get; set; } = new();
            public MemoryCleanupDeepResult Deep { get; set; } = new();
            public long FreedBytes { get; set; }
        }

        private sealed class MemoryCleanupProcessResult
        {
            public int Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public bool Ok { get; set; }
            public long BeforeBytes { get; set; }
            public long AfterBytes { get; set; }
            public string Error { get; set; } = string.Empty;
            public long FreedBytes => Math.Max(0, BeforeBytes - AfterBytes);
        }

        private sealed class MemoryCleanupDeepResult
        {
            public bool Requested { get; set; }
            public bool Supported { get; set; }
            public bool RequiresAdmin { get; set; }
            public bool Ran { get; set; }
            public string Status { get; set; } = string.Empty;
            public List<MemoryCleanupOperationResult> Operations { get; set; } = new();
        }

        private sealed class MemoryCleanupOperationResult
        {
            public string Kind { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public bool Ok { get; set; }
            public string NativeStatus { get; set; } = string.Empty;
            public string Error { get; set; } = string.Empty;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct Luid
        {
            public uint LowPart;
            public int HighPart;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct TokenPrivileges
        {
            public int PrivilegeCount;
            public Luid Luid;
            public int Attributes;
        }
    }
}
