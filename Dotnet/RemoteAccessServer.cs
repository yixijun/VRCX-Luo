using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using NLog;

namespace VRCX;

public class RemoteAccessServer
{
    public static RemoteAccessServer Instance { get; } = new();

    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private readonly ConcurrentDictionary<string, DateTime> _tokens = new();
    private readonly ConcurrentDictionary<WebSocket, byte> _sockets = new();
    private readonly ConcurrentDictionary<string, LoginFailure> _loginFailures = new();
    private HttpListener? _listener;
    private CancellationTokenSource? _cts;
    private Task? _broadcastLoopTask;
    private Func<string, Task<string>>? _evaluateScript;
    private int _port = 23580;
    private bool _privacyMode;
    private bool _localOnly;
    private string _error = "";

    public RemoteAccessStatus Status => new()
    {
        running = IsListenerRunning(_listener),
        port = _port,
        url = IsListenerRunning(_listener)
            ? $"http://{(_localOnly ? "127.0.0.1" : GetLanAddress())}:{_port}/"
            : "",
        error = _error,
        localOnly = _localOnly
    };

    public RemoteAccessStatus Start(int port, bool privacyMode, Func<string, Task<string>> evaluateScript)
    {
        Stop();
        _port = port;
        _privacyMode = privacyMode;
        _evaluateScript = evaluateScript;
        _error = "";
        _localOnly = false;
        _cts = new CancellationTokenSource();
        try
        {
            _listener = CreateStartedListener(_port);
            var listener = _listener;
            var token = _cts.Token;
            _ = Task.Run(() => ListenLoop(listener, token));
            _broadcastLoopTask = Task.Run(() => BroadcastLoop(_cts.Token));
        }
        catch (Exception e)
        {
            _error = e.Message;
            Logger.Error(e, "Failed to start remote access server");
            Stop();
        }
        return Status;
    }

    public void Stop()
    {
        var cts = _cts;
        var listener = _listener;
        _cts = null;
        _listener = null;
        try
        {
            cts?.Cancel();
            try { listener?.Stop(); } catch { }
            try { listener?.Close(); } catch { }
            _broadcastLoopTask = null;
            foreach (var socket in _sockets.Keys)
            {
                try { socket.Abort(); } catch { }
            }
            _sockets.Clear();
        }
        catch (Exception e)
        {
            Logger.Error(e);
        }
        finally
        {
            cts?.Dispose();
        }
    }

    public void BroadcastSnapshot()
    {
        if (_sockets.IsEmpty)
            return;

        _ = Task.Run(async () =>
        {
            try
            {
                var snapshot = await GetSnapshot();
                await BroadcastRawSnapshot(snapshot);
            }
            catch (Exception e)
            {
                Logger.Error(e);
            }
        });
    }

    private async Task ListenLoop(HttpListener listener, CancellationToken token)
    {
        while (!token.IsCancellationRequested && IsListenerRunning(listener))
        {
            try
            {
                var context = await listener.GetContextAsync();
                _ = Task.Run(() => HandleContext(context));
            }
            catch (ObjectDisposedException)
            {
                break;
            }
            catch (HttpListenerException)
            {
                if (!token.IsCancellationRequested)
                    throw;
                break;
            }
            catch (Exception e)
            {
                if (!token.IsCancellationRequested)
                    Logger.Error(e);
            }
        }
    }

    private async Task HandleContext(HttpListenerContext context)
    {
        try
        {
            if (context.Request.IsWebSocketRequest && context.Request.Url?.AbsolutePath == "/ws")
            {
                await HandleWebSocket(context);
                return;
            }

            var path = context.Request.Url?.AbsolutePath ?? "/";
            if (context.Request.HttpMethod == "GET" && (path == "/" || path == "/remote.html"))
            {
                await SendFile(context, "remote.html", "text/html; charset=utf-8");
                return;
            }
            if (context.Request.HttpMethod == "GET" && (path.StartsWith("/assets/") || path.StartsWith("/images/")))
            {
                await SendFile(context, path.TrimStart('/'), GetContentType(path));
                return;
            }
            if (path.StartsWith("/api/"))
            {
                await HandleApi(context, path);
                return;
            }
            await SendJson(context, new { error = "Not found" }, 404);
        }
        catch (Exception e)
        {
            Logger.Error(e);
            await SendJson(context, new { error = e.Message }, 500);
        }
    }

    private async Task HandleApi(HttpListenerContext context, string path)
    {
        if (path == "/api/auth/login" && context.Request.HttpMethod == "POST")
        {
            var clientKey = GetClientKey(context.Request);
            if (IsLoginRateLimited(clientKey))
            {
                await SendJson(context, new { error = "Too many login attempts, please wait." }, 429);
                return;
            }
            var body = await ReadBody(context.Request);
            var password = JsonDocument.Parse(body).RootElement.GetProperty("password").GetString() ?? "";
            var storedHash = VRCXStorage.Instance.Get("VRCX_remoteAccessPasswordHash");
            if (!VerifyPassword(password, storedHash))
            {
                RegisterLoginFailure(clientKey);
                await SendJson(context, new { error = "Invalid password" }, 401);
                return;
            }
            _loginFailures.TryRemove(clientKey, out _);
            var token = CreateToken();
            _tokens[token] = DateTime.UtcNow.AddDays(7);
            await SendJson(context, new { token });
            return;
        }

        if (!IsAuthorized(context.Request))
        {
            await SendJson(context, new { error = "Unauthorized" }, 401);
            return;
        }

        if (path == "/api/auth/logout" && context.Request.HttpMethod == "POST")
        {
            var token = GetBearerToken(context.Request);
            if (!string.IsNullOrEmpty(token)) _tokens.TryRemove(token, out _);
            await SendJson(context, new { ok = true });
            return;
        }
        if (path == "/api/session")
        {
            await SendJson(context, new { ok = true, status = Status });
            return;
        }
        if (path == "/api/snapshot")
        {
            await SendRawJson(context, await GetSnapshot());
            return;
        }
        if (path == "/api/action" && context.Request.HttpMethod == "POST")
        {
            var body = await ReadBody(context.Request);
            var requestId = GetStringProperty(body, "requestId");
            var result = await ExecuteAction(body);
            await SendRawJson(context, result);
            if (!string.IsNullOrEmpty(requestId))
                BroadcastActionResult(requestId, result);
            BroadcastSnapshot();
            return;
        }
        await SendJson(context, new { error = "Not found" }, 404);
    }

    private async Task HandleWebSocket(HttpListenerContext context)
    {
        var token = context.Request.QueryString["token"];
        if (string.IsNullOrEmpty(token) || !ValidateToken(token))
        {
            context.Response.StatusCode = 401;
            context.Response.Close();
            return;
        }

        var wsContext = await context.AcceptWebSocketAsync(null);
        var socket = wsContext.WebSocket;
        _sockets.TryAdd(socket, 0);
        try
        {
            await SendSocketRaw(socket, WrapSnapshot(await GetSnapshot()));
            var buffer = new byte[1024];
            while (socket.State == WebSocketState.Open)
            {
                var result = await socket.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;
            }
        }
        finally
        {
            _sockets.TryRemove(socket, out _);
            socket.Dispose();
        }
    }

    private async Task BroadcastLoop(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(2), token);
                if (!_sockets.IsEmpty)
                    BroadcastSnapshot();
            }
            catch (TaskCanceledException)
            {
                break;
            }
            catch (Exception e)
            {
                Logger.Error(e);
            }
        }
    }

    private async Task<string> GetSnapshot()
    {
        var options = JsonSerializer.Serialize(new { privacyMode = _privacyMode });
        return await EvalJson($"window.$remoteBridge.getRemoteSnapshot({options})");
    }

    private async Task<string> ExecuteAction(string body)
    {
        var encoded = JsonSerializer.Serialize(body);
        return await EvalJson($"(async()=>{{const x=JSON.parse({encoded});return await window.$remoteBridge.executeRemoteAction(x.type,x.payload||{{}});}})()");
    }

    private async Task<string> EvalJson(string expression)
    {
        if (_evaluateScript == null)
            throw new InvalidOperationException("Remote bridge unavailable");

        var script = $"Promise.resolve({expression}).then(JSON.stringify).catch(e=>JSON.stringify({{error:e.message,code:e.code}}))";
        return await _evaluateScript(script);
    }

    private async Task BroadcastRawSnapshot(string snapshotJson)
    {
        await BroadcastRawMessage(WrapSnapshot(snapshotJson));
    }

    private void BroadcastActionResult(string requestId, string resultJson)
    {
        _ = Task.Run(async () =>
        {
            var error = GetStringProperty(resultJson, "error");
            await BroadcastRawMessage(JsonSerializer.Serialize(new
            {
                type = "action-result",
                requestId,
                ok = string.IsNullOrEmpty(error),
                error
            }));
        });
    }

    private async Task BroadcastRawMessage(string message)
    {
        foreach (var socket in _sockets.Keys)
        {
            if (socket.State == WebSocketState.Open)
                await SendSocketRaw(socket, message);
        }
    }

    private static string WrapSnapshot(string snapshotJson)
    {
        return $"{{\"type\":\"snapshot\",\"data\":{snapshotJson}}}";
    }

    private static string GetStringProperty(string json, string propertyName)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            if (
                document.RootElement.ValueKind == JsonValueKind.Object &&
                document.RootElement.TryGetProperty(propertyName, out var value) &&
                value.ValueKind == JsonValueKind.String)
            {
                return value.GetString() ?? "";
            }
        }
        catch
        {
            return "";
        }
        return "";
    }

    private static async Task<string> ReadBody(HttpListenerRequest request)
    {
        using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
        return await reader.ReadToEndAsync();
    }

    private static bool IsAuthorized(HttpListenerRequest request)
    {
        var token = GetBearerToken(request);
        return !string.IsNullOrEmpty(token) && Instance.ValidateToken(token);
    }

    private bool ValidateToken(string token)
    {
        if (!_tokens.TryGetValue(token, out var expiresAt))
            return false;
        if (expiresAt < DateTime.UtcNow)
        {
            _tokens.TryRemove(token, out _);
            return false;
        }
        return true;
    }

    private static string? GetBearerToken(HttpListenerRequest request)
    {
        var header = request.Headers["Authorization"];
        return header?.StartsWith("Bearer ") == true ? header[7..] : null;
    }

    private static string CreateToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static bool VerifyPassword(string password, string encoded)
    {
        try
        {
            var parts = (encoded ?? "").Split(':');
            if (parts.Length != 4 || parts[0] != "pbkdf2-sha256")
                return false;
            if (!int.TryParse(parts[1], out var iterations) || iterations <= 0)
                return false;
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
            var actual = pbkdf2.GetBytes(expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch
        {
            return false;
        }
    }

    private static async Task SendFile(HttpListenerContext context, string relativePath, string contentType)
    {
        var root = Path.GetFullPath(Path.Join(Program.BaseDirectory, "html"));
        var fullPath = Path.GetFullPath(Path.Join(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var relativeToRoot = Path.GetRelativePath(root, fullPath);
        if (
            !Path.IsPathRooted(relativeToRoot) &&
            !relativeToRoot.StartsWith("..") &&
            File.Exists(fullPath))
        {
            var bytes = await File.ReadAllBytesAsync(fullPath);
            context.Response.ContentType = contentType;
            context.Response.ContentLength64 = bytes.Length;
            await context.Response.OutputStream.WriteAsync(bytes);
            context.Response.Close();
        }
        else
        {
            await SendJson(context, new { error = "Not found" }, 404);
        }
    }

    private static string GetContentType(string path)
    {
        if (path.EndsWith(".js")) return "text/javascript; charset=utf-8";
        if (path.EndsWith(".css")) return "text/css; charset=utf-8";
        if (path.EndsWith(".png")) return "image/png";
        if (path.EndsWith(".ico")) return "image/x-icon";
        if (path.EndsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static async Task SendJson(HttpListenerContext context, object value, int statusCode = 200)
    {
        await SendRawJson(context, JsonSerializer.Serialize(value), statusCode);
    }

    private static async Task SendRawJson(HttpListenerContext context, string json, int statusCode = 200)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.ContentLength64 = bytes.Length;
        await context.Response.OutputStream.WriteAsync(bytes);
        context.Response.Close();
    }

    private static async Task SendSocketRaw(WebSocket socket, string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
    }

    private HttpListener CreateStartedListener(int port)
    {
        var prefixes = new[]
        {
            $"http://+:{port}/",
            $"http://{GetLanAddress()}:{port}/",
            $"http://127.0.0.1:{port}/"
        };

        Exception? lastError = null;
        for (var i = 0; i < prefixes.Length; i++)
        {
            var listener = new HttpListener();
            try
            {
                listener.Prefixes.Add(prefixes[i]);
                listener.Start();
                if (i == prefixes.Length - 1)
                {
                    _localOnly = true;
                    _error = "LAN listener requires Windows URL ACL permission; started on 127.0.0.1 only.";
                }
                return listener;
            }
            catch (Exception e)
            {
                lastError = e;
                if (i == 0 && TryEnsureUrlAcl(port))
                {
                    try { listener.Close(); } catch { }
                    listener = new HttpListener();
                    try
                    {
                        listener.Prefixes.Add(prefixes[i]);
                        listener.Start();
                        return listener;
                    }
                    catch (Exception retryError)
                    {
                        lastError = retryError;
                    }
                }
                try { listener.Close(); } catch { }
            }
        }

        throw lastError ?? new InvalidOperationException("Failed to start remote access server");
    }

    private static bool IsListenerRunning(HttpListener? listener)
    {
        try
        {
            return listener?.IsListening == true;
        }
        catch (ObjectDisposedException)
        {
            return false;
        }
    }

    private static string GetClientKey(HttpListenerRequest request)
    {
        return request.RemoteEndPoint?.Address.ToString() ?? "unknown";
    }

    private bool IsLoginRateLimited(string clientKey)
    {
        if (!_loginFailures.TryGetValue(clientKey, out var failure))
            return false;
        if (DateTime.UtcNow - failure.WindowStartedAt > TimeSpan.FromMinutes(1))
        {
            _loginFailures.TryRemove(clientKey, out _);
            return false;
        }
        return failure.Count >= 6;
    }

    private void RegisterLoginFailure(string clientKey)
    {
        _loginFailures.AddOrUpdate(
            clientKey,
            _ => new LoginFailure { Count = 1, WindowStartedAt = DateTime.UtcNow },
            (_, failure) =>
            {
                if (DateTime.UtcNow - failure.WindowStartedAt > TimeSpan.FromMinutes(1))
                {
                    failure.Count = 1;
                    failure.WindowStartedAt = DateTime.UtcNow;
                }
                else
                {
                    failure.Count++;
                }
                return failure;
            });
    }

    private static string GetLanAddress()
    {
        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (ni.OperationalStatus != OperationalStatus.Up)
                continue;
            foreach (var ua in ni.GetIPProperties().UnicastAddresses)
            {
                if (ua.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ua.Address))
                    return ua.Address.ToString();
            }
        }
        return "127.0.0.1";
    }

    private static bool TryEnsureUrlAcl(int port)
    {
        if (!OperatingSystem.IsWindows())
            return false;

        if (HasUrlAcl(port))
            return true;

        if (TryAddUrlAcl(port, false))
            return true;

        return TryAddUrlAcl(port, true);
    }

    private static bool HasUrlAcl(int port)
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = $"http show urlacl url=http://+:{port}/",
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            });
            process?.WaitForExit(3000);
            return process?.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static bool TryAddUrlAcl(int port, bool elevated)
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = $"http add urlacl url=http://+:{port}/ sddl=D:(A;;GX;;;WD)",
                CreateNoWindow = !elevated,
                UseShellExecute = elevated,
                Verb = elevated ? "runas" : "",
                WindowStyle = elevated ? ProcessWindowStyle.Normal : ProcessWindowStyle.Hidden,
                RedirectStandardOutput = !elevated,
                RedirectStandardError = !elevated
            });
            process?.WaitForExit(elevated ? 15000 : 3000);
            return process?.ExitCode == 0;
        }
        catch (Exception e)
        {
            Logger.Debug(e, "Failed to add remote access URL ACL");
            return false;
        }
    }

    private sealed class LoginFailure
    {
        public int Count { get; set; }
        public DateTime WindowStartedAt { get; set; }
    }
}
