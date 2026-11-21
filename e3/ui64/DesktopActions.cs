using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows;
using System.Xml.Linq;
using Microsoft.Win32;

namespace CloverStore.UI64;

internal sealed class DesktopActions : IDisposable
{
    private const long MaximumBytes = 8L * 1024 * 1024 * 1024;
    private readonly HttpClient http = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromMinutes(45) };
    private readonly Dictionary<string, Transfer> transfers = new();
    public static string DataDirectory { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Woods Studio", "Clover Store UI64");

    public int DownloadLimitKiB { get; set; }
    public bool PauseOnLowBattery { get; set; }

    public object Snapshot() => transfers.Values.Reverse().Select(item => new
    {
        id = item.Id, name = item.Name, platform = "windows", status = item.Status,
        total = item.Total, done = item.Done, installation = item.Message
    }).ToArray();

    public object Enqueue(JsonElement payload)
    {
        var url = RequireHttps(payload.GetProperty("url").GetString());
        var name = payload.GetProperty("name").GetString() ?? "Windows download";
        if (name.Length > 180 || transfers.Count >= 200) throw new InvalidOperationException("The download queue limit was reached.");
        var hash = payload.TryGetProperty("sha256", out var value) ? value.GetString() : null;
        if (!string.IsNullOrEmpty(hash) && (hash.Length != 64 || !hash.All(Uri.IsHexDigit)))
            throw new InvalidOperationException("The listing has an invalid SHA-256 checksum.");
        var item = new Transfer(Guid.NewGuid().ToString("N"), name, url, hash);
        transfers.Add(item.Id, item);
        _ = DownloadAsync(item);
        return new { id = item.Id };
    }

    public object Cancel(JsonElement payload)
    {
        var item = Get(payload);
        item.Cancellation?.Cancel();
        return new { cancelled = true };
    }

    public object Retry(JsonElement payload)
    {
        var item = Get(payload);
        if (item.Status is "Failed" or "Cancelled") _ = DownloadAsync(item);
        return new { id = item.Id };
    }

    private async Task DownloadAsync(Transfer item)
    {
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMinutes(45));
        var token = cancellation.Token;
        item.Cancellation = cancellation;
        item.Status = "Downloading";
        item.Done = item.Total = 0;
        item.Message = "";
        string? partial = null;
        try
        {
            using var response = await GetDownloadAsync(item.Url, token);
            response.EnsureSuccessStatusCode();
            item.Total = response.Content.Headers.ContentLength ?? 0;
            if (item.Total > MaximumBytes) throw new IOException("The download exceeds the 8 GiB limit.");
            var suggested = response.Content.Headers.ContentDisposition?.FileNameStar ??
                            response.Content.Headers.ContentDisposition?.FileName?.Trim('"') ??
                            response.RequestMessage?.RequestUri?.LocalPath ?? item.Url.LocalPath;
            var filename = Path.GetFileName(suggested.Replace('\\', '/'));
            if (string.IsNullOrWhiteSpace(filename) || filename.Length > 120 ||
                filename.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || filename.EndsWith('.') ||
                filename.EndsWith(' ') || filename is "." or "..")
                filename = "download.bin";
            var folder = Path.Combine(DataDirectory, "Downloads", item.Id);
            Directory.CreateDirectory(folder);
            var target = Path.Combine(folder, filename);
            partial = target + ".partial";
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using (var input = await response.Content.ReadAsStreamAsync(token))
            await using (var output = new FileStream(partial, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, true))
            {
                var buffer = new byte[65536];
                while (true)
                {
                    while (PauseOnLowBattery && GetSystemPowerStatus(out var power) &&
                           power.ACLineStatus == 0 && power.BatteryLifePercent <= 20)
                    {
                        item.Status = "Paused on low battery";
                        await Task.Delay(3000, token);
                    }
                    item.Status = "Downloading";
                    var started = Stopwatch.GetTimestamp();
                    var count = await input.ReadAsync(buffer, token);
                    if (count == 0) break;
                    if (item.Done + count > MaximumBytes) throw new IOException("The download exceeds the 8 GiB limit.");
                    hash.AppendData(buffer, 0, count);
                    await output.WriteAsync(buffer.AsMemory(0, count), token);
                    item.Done += count;
                    if (DownloadLimitKiB > 0)
                    {
                        var delay = TimeSpan.FromSeconds(count / (1024d * DownloadLimitKiB))
                            - Stopwatch.GetElapsedTime(started);
                        if (delay > TimeSpan.Zero) await Task.Delay(delay, token);
                    }
                }
            }
            var digest = Convert.ToHexString(hash.GetHashAndReset());
            if (!string.IsNullOrEmpty(item.Hash) && !digest.Equals(item.Hash, StringComparison.OrdinalIgnoreCase))
                throw new IOException("The downloaded file did not match its published SHA-256.");
            token.ThrowIfCancellationRequested();
            File.WriteAllText(partial + ":Zone.Identifier", "[ZoneTransfer]\r\nZoneId=3\r\n");
            File.Move(partial, target);
            item.File = target;
            item.Status = "Downloaded";
            item.Message = string.IsNullOrEmpty(item.Hash) ? "Publisher checksum unavailable" : "Published SHA-256 verified";
        }
        catch (OperationCanceledException) { item.Status = "Cancelled"; }
        catch (Exception error) { item.Status = "Failed"; item.Message = error.Message; }
        finally
        {
            item.Cancellation = null;
            if (partial is not null)
            {
                try { File.Delete(partial); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
    }

    private async Task<HttpResponseMessage> GetDownloadAsync(Uri uri, CancellationToken token)
    {
        for (var redirect = 0; redirect <= 5; redirect++)
        {
            var response = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, token);
            if ((int)response.StatusCode is not (301 or 302 or 303 or 307 or 308)) return response;
            using (response)
            {
                var next = response.Headers.Location ?? throw new IOException("The download redirect had no target.");
                uri = RequireHttps(new Uri(uri, next).AbsoluteUri);
            }
        }
        throw new IOException("The download exceeded the redirect limit.");
    }

    public object Reveal(JsonElement payload)
    {
        var file = RequireDownloaded(Get(payload));
        var explorer = new ProcessStartInfo("explorer.exe") { UseShellExecute = false };
        explorer.ArgumentList.Add("/select," + file);
        Process.Start(explorer);
        return new { opened = true };
    }

    public async Task<object> TestInSandboxAsync(Window owner, JsonElement payload)
    {
        var file = RequireDownloaded(Get(payload));
        var extension = Path.GetExtension(file).ToLowerInvariant();
        if (extension is not (".exe" or ".msi" or ".msix"))
            throw new InvalidOperationException("Sandbox testing supports downloaded EXE, MSI and MSIX files.");
        var executable = Path.Combine(Environment.SystemDirectory, "WindowsSandbox.exe");
        if (!File.Exists(executable))
            throw new InvalidOperationException("Windows Sandbox is unavailable. Enable the Windows Sandbox optional feature on a supported Windows edition.");
        if (MessageBox.Show(owner, "Open this installer inside Windows Sandbox? Only a copy of the installer will be shared. Sandbox networking is disabled.", "Test in Sandbox",
                MessageBoxButton.OKCancel, MessageBoxImage.Question) != MessageBoxResult.OK)
            return new { opened = false };

        var folder = Path.Combine(DataDirectory, "Sandbox", Guid.NewGuid().ToString("N"));
        var input = Path.Combine(folder, "Input");
        Directory.CreateDirectory(input);
        try
        {
            var stagedName = "Installer" + extension;
            var stagedPath = Path.Combine(input, stagedName);
            await using (var source = File.OpenRead(file))
            await using (var destination = File.Create(stagedPath))
                await source.CopyToAsync(destination);
            var config = new XElement("Configuration",
                new XElement("Networking", "Disable"),
                new XElement("VGpu", "Disable"),
                new XElement("ClipboardRedirection", "Disable"),
                new XElement("MappedFolders", new XElement("MappedFolder",
                    new XElement("HostFolder", input),
                    new XElement("SandboxFolder", @"C:\CloverTest"),
                    new XElement("ReadOnly", "true"))),
                new XElement("LogonCommand", new XElement("Command", @"explorer.exe C:\CloverTest")));
            var configFile = Path.Combine(folder, "Test.wsb");
            config.Save(configFile);
            var start = new ProcessStartInfo(executable) { UseShellExecute = false };
            start.ArgumentList.Add(configFile);
            var process = Process.Start(start) ?? throw new IOException("Windows Sandbox did not start.");
            _ = CleanupAfterExitAsync(process, folder);
            return new { opened = true };
        }
        catch
        {
            TryDelete(folder);
            throw;
        }
    }

    private static async Task CleanupAfterExitAsync(Process process, string folder)
    {
        using (process)
        {
            try { await process.WaitForExitAsync(); }
            finally { TryDelete(folder); }
        }
    }

    private static void TryDelete(string folder)
    {
        try { Directory.Delete(folder, recursive: true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    public static object OpenWebsite(JsonElement payload)
    {
        var uri = RequireHttps(payload.GetProperty("url").GetString());
        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        return new { opened = true };
    }

    public sealed record CompletedDownload(string Id, string Name);

    public CompletedDownload[] CompletedDownloads() =>
        transfers.Values.Where(item => item.Status == "Downloaded" && item.File is not null && File.Exists(item.File))
            .Select(item => new CompletedDownload(item.Id, item.Name)).ToArray();

    public async Task<int> ExportOfflineBundleAsync(string destination, IReadOnlySet<string> selection)
    {
        var files = transfers.Values.Where(item => selection.Contains(item.Id) && item.Status == "Downloaded" && item.File is not null)
            .Select(item => item.File!).Where(File.Exists).ToArray();
        if (files.Length == 0) throw new InvalidOperationException("Download at least one Windows package first.");

        var temporary = destination + "." + Guid.NewGuid().ToString("N") + ".partial";
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Create))
            {
                for (var index = 0; index < files.Length; index++)
                {
                    var file = files[index];
                    var entry = archive.CreateEntry($"Packages/{index + 1:D3}/{Path.GetFileName(file)}", CompressionLevel.NoCompression);
                    await using var input = File.OpenRead(file);
                    await using var output = entry.Open();
                    await input.CopyToAsync(output);
                }
                using var instructions = new StreamWriter(archive.CreateEntry("README.txt").Open());
                instructions.WriteLine("Clover Store E3.UI64 offline bundle");
                instructions.WriteLine("Packages are copied as published. Some installers still require Internet access or external dependencies.");
            }
            if (new DriveInfo(Path.GetPathRoot(destination)!).DriveFormat == "NTFS")
                File.WriteAllText(temporary + ":Zone.Identifier", "[ZoneTransfer]\r\nZoneId=3\r\n");
            File.Move(temporary, destination, overwrite: true);
            return files.Length;
        }
        finally
        {
            File.Delete(temporary);
        }
    }

    public static IEnumerable<string> InstalledApps()
    {
        const string uninstall = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
        var entries = new SortedSet<string>(StringComparer.CurrentCultureIgnoreCase);
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            using var root = RegistryKey.OpenBaseKey(hive, view);
            using var registry = root.OpenSubKey(uninstall);
            if (registry is null) continue;
            foreach (var id in registry.GetSubKeyNames())
            {
                using var key = registry.OpenSubKey(id);
                if (key?.GetValue("DisplayName") is not string name || key.GetValue("SystemComponent") is 1) continue;
                entries.Add(name + (key.GetValue("DisplayVersion") is string version ? " · " + version : ""));
            }
        }
        return entries;
    }

    public static object Hardware()
    {
        var memory = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        return new { memoryBytes = GlobalMemoryStatusEx(ref memory) ? memory.TotalPhysical : 0 };
    }

    public static IEnumerable<string> SystemSummary()
    {
        var memory = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        var ram = GlobalMemoryStatusEx(ref memory) ? $" · {memory.TotalPhysical / (1024d * 1024 * 1024):0.#} GiB RAM" : "";
        yield return "Windows x64" + ram;
        foreach (var drive in DriveInfo.GetDrives())
            if (drive.DriveType == DriveType.Fixed && drive.IsReady)
                yield return $"{drive.Name} {drive.AvailableFreeSpace / (1024d * 1024 * 1024):0.#} GiB free";
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatus
    {
        public uint Length, Load;
        public ulong TotalPhysical, AvailablePhysical, TotalPageFile, AvailablePageFile,
            TotalVirtual, AvailableVirtual, AvailableExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);

    [StructLayout(LayoutKind.Sequential)]
    private struct PowerStatus
    {
        public byte ACLineStatus, BatteryFlag, BatteryLifePercent, SystemStatusFlag;
        public uint BatteryLifeTime, BatteryFullLifeTime;
    }

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetSystemPowerStatus(out PowerStatus status);

    private Transfer Get(JsonElement payload) =>
        transfers.TryGetValue(payload.GetProperty("id").GetString() ?? "", out var item)
            ? item : throw new InvalidOperationException("That download is unavailable.");

    private static string RequireDownloaded(Transfer item) =>
        item.Status == "Downloaded" && item.File is { } file && File.Exists(file)
            ? file : throw new InvalidOperationException("Finish downloading the file first.");

    private static Uri RequireHttps(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
        uri.IsDefaultPort && uri.UserInfo.Length == 0 &&
        uri.HostNameType == UriHostNameType.Dns && uri.DnsSafeHost.Contains('.') &&
        !uri.DnsSafeHost.EndsWith(".local", StringComparison.OrdinalIgnoreCase)
            ? uri : throw new InvalidOperationException("A public HTTPS address is required.");

    public void Dispose()
    {
        foreach (var item in transfers.Values) item.Cancellation?.Cancel();
        http.Dispose();
    }

    private sealed record Transfer(string Id, string Name, Uri Url, string? Hash)
    {
        public string Status { get; set; } = "Queued";
        public string Message { get; set; } = "";
        public long Done { get; set; }
        public long Total { get; set; }
        public string? File { get; set; }
        public CancellationTokenSource? Cancellation { get; set; }
    }
}
