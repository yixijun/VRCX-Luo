using System;
using System.Security.Cryptography;
using System.Text;

namespace VRCX
{
    public partial class AppApiCef
    {
        private static readonly byte[] LocalSecretEntropy = Encoding.UTF8.GetBytes("VRCX-Luo local TOTP v1");

        public string ProtectLocalSecret(string plaintext)
        {
            if (string.IsNullOrEmpty(plaintext) || plaintext.Length > 4096)
                throw new ArgumentException("Invalid local secret");
            var bytes = Encoding.UTF8.GetBytes(plaintext);
            try
            {
                return Convert.ToBase64String(ProtectedData.Protect(bytes, LocalSecretEntropy, DataProtectionScope.CurrentUser));
            }
            finally { CryptographicOperations.ZeroMemory(bytes); }
        }

        public string UnprotectLocalSecret(string ciphertext)
        {
            if (string.IsNullOrEmpty(ciphertext) || ciphertext.Length > 16384)
                throw new ArgumentException("Invalid protected secret");
            var bytes = ProtectedData.Unprotect(Convert.FromBase64String(ciphertext), LocalSecretEntropy, DataProtectionScope.CurrentUser);
            try { return Encoding.UTF8.GetString(bytes); }
            finally { CryptographicOperations.ZeroMemory(bytes); }
        }
    }
}
