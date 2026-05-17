using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Cookie = System.Net.Cookie;
using NLog;
using SixLabors.ImageSharp;
using Timer = System.Threading.Timer;

#if !LINUX
using CefSharp;
using System.Windows.Forms;
#endif

namespace VRCX
{
    public class WebApi
    {
        private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
        public static WebApi Instance;

        public static bool ProxySet;
        public static string ProxyUrl = "";
        public static IWebProxy Proxy = WebRequest.DefaultWebProxy;

        public CookieContainer CookieContainer;
        private bool _cookieDirty;
        private Timer _timer;

        private HttpClient _httpClient;
        private SocketsHttpHandler _httpHandler;

        // Secondary account clients: Map<accountId, (client, cookies)>
        private readonly Dictionary<string, (HttpClient client, CookieContainer cookies)> _secondaryClients = new();

        static WebApi()
        {
            Instance = new WebApi();
        }

        // leave this as public, private makes nodeapi angry
        public WebApi()
        {
#if LINUX
            if (Instance == null)
                Instance = this;
#endif
            CookieContainer = new CookieContainer();
            _timer = new Timer(TimerCallback, null, -1, -1);
        }

        private void TimerCallback(object state)
        {
            try
            {
                SaveCookies();
            }
            catch (Exception e)
            {
                Logger.Error($"Failed to save cookies: {e.Message}");
            }
        }

        public void Init()
        {
            SetProxy();
            InitializeHttpClient();
            LoadCookies();
            _timer.Change(1000, 1000);
        }

        private void InitializeHttpClient()
        {
            _httpHandler = new SocketsHttpHandler
            {
                CookieContainer = CookieContainer,
                UseCookies = true,
                AutomaticDecompression = DecompressionMethods.All,
                PooledConnectionLifetime = TimeSpan.FromMinutes(5),
                MaxConnectionsPerServer = 10
            };

            if (ProxySet)
            {
                _httpHandler.Proxy = Proxy;
                _httpHandler.UseProxy = true;
            }

            _httpClient = new HttpClient(_httpHandler);
            _httpClient.DefaultRequestHeaders.Add("User-Agent", Program.Version);
        }

        private void SetProxy()
        {
            if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.ProxyUrl))
                ProxyUrl = StartupArgs.LaunchArguments.ProxyUrl;

            if (string.IsNullOrEmpty(ProxyUrl))
            {
                var proxyUrl = VRCXStorage.Instance.Get("VRCX_ProxyServer");
                if (!string.IsNullOrEmpty(proxyUrl))
                    ProxyUrl = proxyUrl;
            }

            if (string.IsNullOrEmpty(ProxyUrl))
                return;

            try
            {
                ProxySet = true;
                Proxy = new WebProxy(ProxyUrl);
            }
            catch (UriFormatException)
            {
                VRCXStorage.Instance.Set("VRCX_ProxyServer", string.Empty);
                VRCXStorage.Instance.Save();
                const string message =
                    "The proxy server URI you used is invalid.\nVRCX will close, please correct the proxy URI.";
#if !LINUX
                System.Windows.Forms.MessageBox.Show(message, "Invalid Proxy URI", MessageBoxButtons.OK, MessageBoxIcon.Error);
#endif
                Logger.Error(message);
                Environment.Exit(0);
            }
        }

        public void Exit()
        {
            _timer.Change(-1, -1);
            SaveCookies();
        }

        public void ClearCookies()
        {
#if !LINUX
            Cef.GetGlobalCookieManager().DeleteCookies();
#endif
            CookieContainer = new CookieContainer();
            InitializeHttpClient();
            _cookieDirty = true;
            SaveCookies();
        }

        private void LoadCookies()
        {
            SQLite.Instance.ExecuteNonQuery(
                "CREATE TABLE IF NOT EXISTS `cookies` (`key` TEXT PRIMARY KEY, `value` TEXT)");
            var values = SQLite.Instance.Execute("SELECT `value` FROM `cookies` WHERE `key` = @key",
                new Dictionary<string, object>
                {
                    { "@key", "default" }
                }
            );
            try
            {
                var item = values[0];
                using var stream = new MemoryStream(Convert.FromBase64String((string)item[0]));
                CookieContainer = new CookieContainer();
                CookieContainer.Add(System.Text.Json.JsonSerializer.Deserialize<CookieCollection>(stream));
                InitializeHttpClient();
            }
            catch (Exception e)
            {
                Logger.Error($"Failed to load cookies: {e.Message}");
            }
        }

        private List<Cookie> GetAllCookies()
        {
            var cookieTable = (Hashtable)CookieContainer.GetType().InvokeMember("m_domainTable",
                BindingFlags.NonPublic |
                BindingFlags.GetField |
                BindingFlags.Instance,
                null,
                CookieContainer,
                new object[] { });

            var uniqueCookies = new Dictionary<string, Cookie>();
            foreach (var item in cookieTable.Keys)
            {
                var domain = (string)item;
                if (string.IsNullOrEmpty(domain))
                    continue;

                if (domain.StartsWith('.'))
                    domain = domain[1..];

                var address = $"http://{domain}/";
                if (!Uri.TryCreate(address, UriKind.Absolute, out var uri))
                    continue;

                foreach (Cookie cookie in CookieContainer.GetCookies(uri))
                {
                    var key = $"{domain}.{cookie.Name}";
                    if (!uniqueCookies.TryGetValue(key, out var value) ||
                        cookie.TimeStamp > value.TimeStamp)
                    {
                        cookie.Expires = DateTime.MaxValue;
                        uniqueCookies[key] = cookie;
                    }
                }
            }

            return uniqueCookies.Values.ToList();
        }

        public void SaveCookies()
        {
            if (!_cookieDirty)
                return;

            try
            {
                var cookies = GetAllCookies();
                using var memoryStream = new MemoryStream();
                System.Text.Json.JsonSerializer.Serialize(memoryStream, cookies);
                SQLite.Instance.ExecuteNonQuery(
                    "INSERT OR REPLACE INTO `cookies` (`key`, `value`) VALUES (@key, @value)",
                    new Dictionary<string, object>()
                    {
                        { "@key", "default" },
                        { "@value", Convert.ToBase64String(memoryStream.ToArray()) }
                    }
                );

                _cookieDirty = false;
            }
            catch (Exception e)
            {
                Logger.Error($"Failed to save cookies: {e.Message}");
            }
        }

        public string GetCookies()
        {
            _cookieDirty = true; // force cookies to be saved for lastUserLoggedIn

            using var memoryStream = new MemoryStream();
            System.Text.Json.JsonSerializer.Serialize(memoryStream, GetAllCookies());
            return Convert.ToBase64String(memoryStream.ToArray());
        }

        public void SetCookies(string cookies)
        {
            try
            {
                using var stream = new MemoryStream(Convert.FromBase64String(cookies));
                var data = System.Text.Json.JsonSerializer.Deserialize<CookieCollection>(stream);
                CookieContainer.Add(data);
            }
            catch (Exception e)
            {
                Logger.Error($"Failed to set cookies: {e.Message}");
            }

            _cookieDirty = true; // force cookies to be saved for lastUserLoggedIn
        }

        private async Task<HttpRequestMessage> BuildLegacyImageUploadRequest(string url, IDictionary<string, object> options)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            var boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x");
            var content = new MultipartFormDataContent(boundary);

            if (options.TryGetValue("postData", out var postDataObject))
            {
                content.Add(new StringContent((string)postDataObject), "data");
            }

            var imageData = options["imageData"] as string;
            var fileToUpload = Program.AppApiInstance.ResizeImageToFitLimits(Convert.FromBase64String(imageData), false);
            var imageContent = new ByteArrayContent(fileToUpload);
            imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            content.Add(imageContent, "image", "image.png");

            request.Content = content;
            return request;
        }

        private async Task<HttpRequestMessage> BuildUploadFilePutRequest(string url, IDictionary<string, object> options)
        {
            var request = new HttpRequestMessage(HttpMethod.Put, url);
            var fileData = options["fileData"] as string;
            var sentData = Convert.FromBase64CharArray(fileData.ToCharArray(), 0, fileData.Length);
            var content = new ByteArrayContent(sentData);
            content.Headers.ContentType = new MediaTypeHeaderValue(options["fileMIME"] as string);
            if (options.TryGetValue("fileMD5", out var fileMd5))
                content.Headers.ContentMD5 = Convert.FromBase64String(fileMd5 as string);
            request.Content = content;
            return request;
        }

        private async Task<HttpRequestMessage> BuildImageUploadRequest(string url, IDictionary<string, object> options)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            var boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x");
            var content = new MultipartFormDataContent(boundary);

            if (options.TryGetValue("postData", out var postDataObject))
            {
                var jsonPostData = (JObject)JsonConvert.DeserializeObject((string)postDataObject);
                if (jsonPostData != null)
                {
                    foreach (var data in jsonPostData)
                    {
                        content.Add(new StringContent(data.Value?.ToString() ?? string.Empty), data.Key);
                    }
                }
            }

            var imageData = options["imageData"] as string;
            var matchingDimensions = options["matchingDimensions"] as bool? ?? false;
            var fileToUpload = Program.AppApiInstance.ResizeImageToFitLimits(Convert.FromBase64String(imageData), matchingDimensions);

            var imageContent = new ByteArrayContent(fileToUpload);
            imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            content.Add(imageContent, "file", "blob");

            request.Content = content;
            return request;
        }

        private async Task<HttpRequestMessage> BuildPrintImageUploadRequest(string url, IDictionary<string, object> options)
        {
            if (options.TryGetValue("cropWhiteBorder", out var cropWhiteBorder) && (bool)cropWhiteBorder)
            {
                var oldImageData = options["imageData"] as string;
                var ms = new MemoryStream(Convert.FromBase64String(oldImageData));
                var print = await Image.LoadAsync(ms);
                if (Program.AppApiInstance.CropPrint(ref print))
                {
                    var ms2 = new MemoryStream();
                    await print.SaveAsPngAsync(ms2);
                    options["imageData"] = Convert.ToBase64String(ms2.ToArray());
                }
            }

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            var boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x");
            var content = new MultipartFormDataContent(boundary);

            var imageData = options["imageData"] as string;
            var fileToUpload = Program.AppApiInstance.ResizePrintImage(Convert.FromBase64String(imageData));

            var imageContent = new ByteArrayContent(fileToUpload);
            imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            imageContent.Headers.ContentLength = fileToUpload.Length;
            content.Add(imageContent, "image", "image");

            if (options.TryGetValue("postData", out var postDataObject))
            {
                var jsonPostData = JsonConvert.DeserializeObject<Dictionary<string, string>>(postDataObject.ToString());
                if (jsonPostData != null)
                {
                    foreach (var (key, value) in jsonPostData)
                    {
                        var stringContent = new StringContent(value, Encoding.UTF8, "text/plain");
                        content.Add(stringContent, key);
                    }
                }
            }

            request.Content = content;
            return request;
        }

        public async Task<string> ExecuteJson(string options)
        {
            var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(options);
            var result = await Execute(data);
            return System.Text.Json.JsonSerializer.Serialize(new
            {
                status = result.Item1,
                message = result.Item2
            });
        }

        public async Task<Tuple<int, string>> Execute(IDictionary<string, object> options)
        {
            var result = await ExecuteWithClient(_httpClient, options);
            // Track cookie dirty flag for default client
            if (result.Item1 >= 200)
                _cookieDirty = true;
            return result;
        }

        // ── Secondary account client management ──────────────────────────────

        public void CreateSecondaryClient(string accountId)
        {
            if (_secondaryClients.ContainsKey(accountId))
                return;

            var cookies = new CookieContainer();
            var handler = new SocketsHttpHandler
            {
                CookieContainer = cookies,
                UseCookies = true,
                AutomaticDecompression = DecompressionMethods.All,
                PooledConnectionLifetime = TimeSpan.FromMinutes(5),
                MaxConnectionsPerServer = 10
            };
            if (ProxySet)
            {
                handler.Proxy = Proxy;
                handler.UseProxy = true;
            }
            var client = new HttpClient(handler);
            client.DefaultRequestHeaders.Add("User-Agent", Program.Version);
            _secondaryClients[accountId] = (client, cookies);
        }

        public void DestroySecondaryClient(string accountId)
        {
            if (_secondaryClients.TryGetValue(accountId, out var entry))
            {
                entry.client.Dispose();
                _secondaryClients.Remove(accountId);
            }
        }

        public string GetSecondaryCookies(string accountId)
        {
            if (!_secondaryClients.TryGetValue(accountId, out var entry))
                return string.Empty;

            var cookies = GetAllCookiesFrom(entry.cookies);
            using var memoryStream = new MemoryStream();
            System.Text.Json.JsonSerializer.Serialize(memoryStream, cookies);
            return Convert.ToBase64String(memoryStream.ToArray());
        }

        public void SetSecondaryCookies(string accountId, string cookies)
        {
            if (!_secondaryClients.TryGetValue(accountId, out var entry))
                return;

            try
            {
                using var stream = new MemoryStream(Convert.FromBase64String(cookies));
                var data = System.Text.Json.JsonSerializer.Deserialize<CookieCollection>(stream);
                entry.cookies.Add(data);
            }
            catch (Exception e)
            {
                Logger.Error($"Failed to set secondary cookies for {accountId}: {e.Message}");
            }
        }

        public async Task<string> ExecuteAsJson(string accountId, string options)
        {
            var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(options);
            var result = await ExecuteAs(accountId, data);
            return System.Text.Json.JsonSerializer.Serialize(new
            {
                status = result.Item1,
                message = result.Item2
            });
        }

        public async Task<Tuple<int, string>> ExecuteAs(string accountId, IDictionary<string, object> options)
        {
            if (!_secondaryClients.TryGetValue(accountId, out var entry))
                return new Tuple<int, string>(-1, $"No secondary client for {accountId}");

            return await ExecuteWithClient(entry.client, options);
        }

        private List<Cookie> GetAllCookiesFrom(CookieContainer container)
        {
            var cookieTable = (Hashtable)container.GetType().InvokeMember("m_domainTable",
                BindingFlags.NonPublic |
                BindingFlags.GetField |
                BindingFlags.Instance,
                null,
                container,
                new object[] { });

            var uniqueCookies = new Dictionary<string, Cookie>();
            foreach (var item in cookieTable.Keys)
            {
                var domain = (string)item;
                if (string.IsNullOrEmpty(domain))
                    continue;

                if (domain.StartsWith('.'))
                    domain = domain[1..];

                var address = $"http://{domain}/";
                if (!Uri.TryCreate(address, UriKind.Absolute, out var uri))
                    continue;

                foreach (Cookie cookie in container.GetCookies(uri))
                {
                    var key = $"{domain}.{cookie.Name}";
                    if (!uniqueCookies.TryGetValue(key, out var value) ||
                        cookie.TimeStamp > value.TimeStamp)
                    {
                        cookie.Expires = DateTime.MaxValue;
                        uniqueCookies[key] = cookie;
                    }
                }
            }

            return uniqueCookies.Values.ToList();
        }

        private async Task<Tuple<int, string>> ExecuteWithClient(HttpClient httpClient, IDictionary<string, object> options)
        {
            try
            {
                var url = (string)options["url"];
                HttpRequestMessage request;

                // Handle special upload types
                if (options.TryGetValue("uploadImageLegacy", out _))
                {
                    request = await BuildLegacyImageUploadRequest(url, options);
                }
                else if (options.TryGetValue("uploadFilePUT", out _))
                {
                    request = await BuildUploadFilePutRequest(url, options);
                }
                else if (options.TryGetValue("uploadImage", out _))
                {
                    request = await BuildImageUploadRequest(url, options);
                }
                else if (options.TryGetValue("uploadImagePrint", out _))
                {
                    request = await BuildPrintImageUploadRequest(url, options);
                }
                else
                {
                    var httpMethod = HttpMethod.Get;
                    if (options.TryGetValue("method", out var methodObj))
                    {
                        httpMethod = HttpMethod.Parse(methodObj.ToString());
                    }

                    request = new HttpRequestMessage(httpMethod, url);

                    if (httpMethod != HttpMethod.Get && options.TryGetValue("body", out var body))
                    {
                        var bodyContent = new StringContent((string)body, Encoding.UTF8);
                        if (options.TryGetValue("headers", out var hdrs))
                        {
                            var hd = ParseHeaders(hdrs);
                            if (hd.TryGetValue("Content-Type", out var ct))
                                bodyContent.Headers.ContentType = MediaTypeHeaderValue.Parse(ct);
                        }
                        request.Content = bodyContent;
                    }
                }

                if (options.TryGetValue("headers", out var headers))
                {
                    var headersDict = ParseHeaders(headers);
                    foreach (var (key, value) in headersDict)
                    {
                        if (string.Equals(key, "Content-Type", StringComparison.OrdinalIgnoreCase))
                            continue;

                        if (string.Equals(key, "Referer", StringComparison.OrdinalIgnoreCase))
                            request.Headers.Referrer = new Uri(value);
                        else
                            request.Headers.TryAddWithoutValidation(key, value);
                    }
                }

                using var response = await httpClient.SendAsync(request);

                var contentTypeResponse = response.Content.Headers.ContentType?.MediaType ?? string.Empty;

                if (contentTypeResponse.Contains("image/") || contentTypeResponse.Contains("application/octet-stream"))
                {
                    var imageBytes = await response.Content.ReadAsByteArrayAsync();
                    return new Tuple<int, string>(
                        (int)response.StatusCode,
                        $"data:image/png;base64,{Convert.ToBase64String(imageBytes)}"
                    );
                }

                var responseBody = await response.Content.ReadAsStringAsync();
                return new Tuple<int, string>((int)response.StatusCode, responseBody);
            }
            catch (HttpRequestException httpException)
            {
                if (httpException.InnerException != null)
                    Logger.Error($"{httpException.Message} | {httpException.InnerException}");

                var statusCode = httpException.StatusCode.HasValue ? (int)httpException.StatusCode.Value : -1;
                return new Tuple<int, string>(statusCode, httpException.Message);
            }
            catch (Exception e)
            {
                if (e.InnerException != null)
                    Logger.Error($"{e.Message} | {e.InnerException}");

                return new Tuple<int, string>(-1, e.Message);
            }
        }

        // ── End secondary account client management ───────────────────────────

        private static Dictionary<string, string> ParseHeaders(object headers)
        {
            Dictionary<string, string> headersDict;
            if (headers.GetType() == typeof(JObject))
            {
                headersDict = ((JObject)headers).ToObject<Dictionary<string, string>>();
            }
            else
            {
                var headersKvp = (IEnumerable<KeyValuePair<string, object>>)headers;
                headersDict = new Dictionary<string, string>();
                foreach (var (key, value) in headersKvp)
                    headersDict.Add(key, value.ToString());
            }
            return headersDict;
        }
    }
}
