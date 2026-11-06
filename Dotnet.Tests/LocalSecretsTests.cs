using System;
using System.Security.Cryptography;
using Xunit;

namespace VRCX.Tests;

public class LocalSecretsTests
{
    [Fact]
    public void ProtectsAndRestoresATestSecretForTheCurrentWindowsUser()
    {
        var api = new AppApiCef();
        const string secret = "public-test-value-only";
        var encrypted = api.ProtectLocalSecret(secret);
        Assert.DoesNotContain(secret, encrypted);
        Assert.Equal(secret, api.UnprotectLocalSecret(encrypted));
    }

    [Fact]
    public void RejectsTamperedCiphertext()
    {
        var api = new AppApiCef();
        var bytes = Convert.FromBase64String(api.ProtectLocalSecret("public-test-value-only"));
        bytes[^1] ^= 1;
        Assert.Throws<CryptographicException>(() => api.UnprotectLocalSecret(Convert.ToBase64String(bytes)));
    }

    [Fact]
    public void RejectsEmptyAndOversizedValues()
    {
        var api = new AppApiCef();
        Assert.Throws<ArgumentException>(() => api.ProtectLocalSecret(""));
        Assert.Throws<ArgumentException>(() => api.ProtectLocalSecret(new string('a', 4097)));
        Assert.Throws<ArgumentException>(() => api.UnprotectLocalSecret(new string('a', 16385)));
    }
}
