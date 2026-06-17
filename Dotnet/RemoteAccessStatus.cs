namespace VRCX;

public class RemoteAccessStatus
{
    public bool running { get; set; }
    public int port { get; set; }
    public string url { get; set; } = "";
    public string error { get; set; } = "";
    public bool localOnly { get; set; }
}
