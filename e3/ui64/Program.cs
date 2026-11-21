using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace CloverStore.UI64;

internal static class Program
{
    [STAThread]
    public static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows() || RuntimeInformation.OSArchitecture != Architecture.X64 ||
            RuntimeInformation.ProcessArchitecture != Architecture.X64)
            return 1;

        var route = args.FirstOrDefault() switch
        {
            "--updates" => "updates",
            "--downloads" => "downloads",
            "--installed" => "installed",
            _ => "discover"
        };
        var app = new Application();
        return app.Run(new StoreWindow(route));
    }
}

internal sealed class StoreWindow : Window
{
    private const string Host = "store.e3-ui64.invalid";
    private const string Entry = "https://" + Host + "/index.html";
    private readonly WebView2 view = new();
    private readonly DesktopActions desktop = new();
    private readonly string route;

    public StoreWindow(string route)
    {
        this.route = route;
        Title = "Clover Store · E3.UI64";
        Icon = System.Windows.Media.Imaging.BitmapFrame.Create(new Uri("pack://application:,,,/Assets/Store.ico"));
        Width = 1200;
        Height = 800;
        MinWidth = 450;
        MinHeight = 480;
        Content = view;
        Loaded += async (_, _) => await StartAsync();
        Closed += (_, _) => { desktop.Dispose(); view.Dispose(); };

    }

    private async Task StartAsync()
    {
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(
                userDataFolder: Path.Combine(DesktopActions.DataDirectory, "WebView2"));
            await view.EnsureCoreWebView2Async(environment);
            var core = view.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsWebMessageEnabled = true;
            core.SetVirtualHostNameToFolderMapping(Host,
                Path.Combine(AppContext.BaseDirectory, "store"), CoreWebView2HostResourceAccessKind.Deny);
            core.NavigationStarting += (_, e) => e.Cancel = !IsEntry(e.Uri);
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.WebMessageReceived += OnMessage;
            core.Navigate(Entry + "#/" + route);
            AddJumpList();
        }
        catch (Exception error)
        {
            Content = new TextBlock
            {
                Margin = new Thickness(24), TextWrapping = TextWrapping.Wrap,
                Text = "Clover Store could not start. Check that Microsoft Edge WebView2 Runtime is installed.\n\n" + error.Message
            };
        }
    }

    private static bool IsEntry(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
        uri.Scheme == "https" && uri.Host == Host && uri.IsDefaultPort &&
        uri.UserInfo.Length == 0 && uri.AbsolutePath == "/index.html" && uri.Query.Length == 0;

    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!IsEntry(e.Source) || !IsEntry(view.Source?.AbsoluteUri ?? "")) return;
        string? id = null;
        try
        {
            var json = e.WebMessageAsJson;
            if (json.Length > 1_048_576) return;
            using var document = JsonDocument.Parse(json);
            var message = document.RootElement;
            id = message.GetProperty("id").GetString();
            if (id is null || id.Length > 30 || message.GetProperty("protocol").GetInt32() != 1) return;
            var action = message.GetProperty("action").GetString();
            var payload = message.GetProperty("payload");
            object? result = action switch
            {
                "capabilities" => new { kind = "windows", capabilities = new[] { "catalogue.read", "library.local", "downloads.request", "sandbox.test" } },
                "downloads.list" => desktop.Snapshot(),
                "downloads.enqueue" => desktop.Enqueue(payload),
                "downloads.cancel" => desktop.Cancel(payload),
                "downloads.retry" => desktop.Retry(payload),
                "website.open" => DesktopActions.OpenWebsite(payload),
                "files.open" => desktop.Reveal(payload),
                "sandbox.test" => await desktop.TestInSandboxAsync(this, payload),
                "windows.summary" => DesktopActions.SystemSummary().ToArray(),
                "windows.transfer-settings" => TransferSettings(payload),
                "windows.completed" => desktop.CompletedDownloads().Select(item => new { id = item.Id, name = item.Name }).ToArray(),
                "windows.bundle-export" => await ExportBundleAsync(payload),
                "windows.hardware" => DesktopActions.Hardware(),
                "windows.inventory" => await Task.Run(() => DesktopActions.InstalledApps().ToArray()),
                _ => throw new InvalidOperationException("This Windows action is unavailable.")
            };
            Reply(new { id, ok = true, result });
        }
        catch (Exception error)
        {
            if (id is not null) Reply(new { id, ok = false, error = error.Message });
        }
    }

    private void Reply(object message)
    {
        if (view.CoreWebView2 is not null && IsEntry(view.Source?.AbsoluteUri ?? ""))
            view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
    }

    private object TransferSettings(JsonElement payload)
    {
        if (payload.TryGetProperty("limit", out var limit))
        {
            var value = limit.GetInt32();
            if (value is not (0 or 256 or 1024 or 5120 or 10240))
                throw new ArgumentException("Unsupported transfer limit.");
            var pause = payload.GetProperty("pause").GetBoolean();
            desktop.DownloadLimitKiB = value;
            desktop.PauseOnLowBattery = pause;
        }
        return new { limit = desktop.DownloadLimitKiB, pause = desktop.PauseOnLowBattery };
    }

    private async Task<object> ExportBundleAsync(JsonElement payload)
    {
        var ids = payload.GetProperty("ids").EnumerateArray()
            .Select(item => item.GetString() ?? "").ToHashSet();
        var available = desktop.CompletedDownloads().Select(item => item.Id).ToHashSet();
        if (ids.Count == 0 || !ids.IsSubsetOf(available))
            throw new InvalidOperationException("Select completed downloads.");
        var picker = new Microsoft.Win32.SaveFileDialog
        {
            FileName = "CloverStore-Offline.zip", Filter = "ZIP archive (*.zip)|*.zip",
            AddExtension = true, OverwritePrompt = true
        };
        if (picker.ShowDialog(this) != true) return new { cancelled = true, count = 0 };
        return new { cancelled = false, count = await desktop.ExportOfflineBundleAsync(picker.FileName, ids) };
    }

    private static void AddJumpList()
    {
        var exe = Environment.ProcessPath;
        if (exe is null) return;
        var list = new System.Windows.Shell.JumpList();
        foreach (var (title, arg) in new[] { ("Updates", "--updates"), ("Downloads", "--downloads"), ("Installed", "--installed") })
            list.JumpItems.Add(new System.Windows.Shell.JumpTask { Title = title, Arguments = arg, ApplicationPath = exe });
        System.Windows.Shell.JumpList.SetJumpList(Application.Current, list);
    }
}
