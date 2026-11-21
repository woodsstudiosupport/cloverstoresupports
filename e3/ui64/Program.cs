using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
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
        PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.P && Keyboard.Modifiers == ModifierKeys.Control)
            {
                e.Handled = true;
                ShowTools();
            }
        };
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
                "windows.tools" => ShowTools(),
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

    private object ShowTools()
    {
        var panel = new StackPanel { Margin = new Thickness(18) };
        var dialog = new Window
        {
            Owner = this, Title = "Clover Store · Windows tools",
            Width = 680, Height = 640, Content = panel, WindowStartupLocation = WindowStartupLocation.CenterOwner
        };
        var inventory = new TextBox
        {
            IsReadOnly = true, Height = 270, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Text = string.Join(Environment.NewLine, DesktopActions.InstalledApps())
        };
        panel.Children.Add(new TextBlock
        {
            Text = string.Join(Environment.NewLine, DesktopActions.SystemSummary()),
            Margin = new Thickness(0, 0, 0, 12), TextWrapping = TextWrapping.Wrap
        });
        panel.Children.Add(new TextBlock { Text = "Installed Windows programs", Margin = new Thickness(0, 0, 0, 8) });
        panel.Children.Add(inventory);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 12, 0, 0) };
        panel.Children.Add(actions);
        AddButton("Open Windows downloads", () => Navigate("downloads"));
        AddButton("Open updates", () => Navigate("updates"));
        AddButton("Copy installed list", () => Clipboard.SetText(inventory.Text));
        var export = new Button { Content = "Choose packages for an offline ZIP", Padding = new Thickness(8), Margin = new Thickness(0, 8, 0, 0) };
        export.Click += async (_, _) =>
        {
            var available = desktop.CompletedDownloads();
            if (available.Length == 0)
            {
                MessageBox.Show(dialog, "Download at least one Windows package first.", "Offline bundle");
                return;
            }
            var choices = new ListBox
            {
                ItemsSource = available, DisplayMemberPath = "Name",
                SelectionMode = SelectionMode.Multiple, MinHeight = 180
            };
            var choose = new Button { Content = "Continue with selected packages", IsDefault = true, Margin = new Thickness(0, 10, 0, 0) };
            var layout = new StackPanel { Margin = new Thickness(16) };
            layout.Children.Add(choices);
            layout.Children.Add(choose);
            var selection = new Window
            {
                Owner = dialog, Title = "Choose offline packages", Width = 480, Height = 300,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Content = new ScrollViewer { Content = layout }
            };
            choose.Click += (_, _) =>
            {
                if (choices.SelectedItems.Count != 0) selection.DialogResult = true;
            };
            if (selection.ShowDialog() != true) return;
            var ids = choices.SelectedItems.Cast<DesktopActions.CompletedDownload>().Select(item => item.Id).ToHashSet();
            var picker = new Microsoft.Win32.SaveFileDialog
            {
                FileName = "CloverStore-Offline.zip", Filter = "ZIP archive (*.zip)|*.zip",
                AddExtension = true, OverwritePrompt = true
            };
            if (picker.ShowDialog(dialog) != true) return;
            export.IsEnabled = false;
            try
            {
                var count = await desktop.ExportOfflineBundleAsync(picker.FileName, ids);
                MessageBox.Show(dialog, $"Exported {count} packages.", "Offline bundle");
            }
            catch (Exception error)
            {
                MessageBox.Show(dialog, error.Message, "Offline bundle");
            }
            finally { export.IsEnabled = true; }
        };
        panel.Children.Add(export);
        var lowBattery = new CheckBox
        {
            Content = "Pause downloads on battery at 20% or lower",
            IsChecked = desktop.PauseOnLowBattery, Margin = new Thickness(0, 8, 0, 0)
        };
        lowBattery.Checked += (_, _) => desktop.PauseOnLowBattery = true;
        lowBattery.Unchecked += (_, _) => desktop.PauseOnLowBattery = false;
        panel.Children.Add(lowBattery);
        var speed = new ComboBox { Margin = new Thickness(0, 8, 0, 0) };
        var limits = new[] { 0, 256, 1024, 5120, 10240 };
        foreach (var limit in limits)
            speed.Items.Add(limit == 0 ? "Download speed per transfer · Unlimited" : $"Download speed per transfer · {limit} KiB/s");
        speed.SelectedIndex = Array.IndexOf(limits, desktop.DownloadLimitKiB);
        speed.SelectionChanged += (_, _) =>
        {
            if (speed.SelectedIndex >= 0) desktop.DownloadLimitKiB = limits[speed.SelectedIndex];
        };
        panel.Children.Add(speed);
        dialog.Show();
        return new { opened = true };

        void AddButton(string title, Action action)
        {
            var button = new Button { Content = title, Padding = new Thickness(8), Margin = new Thickness(0, 0, 8, 0) };
            button.Click += (_, _) => action();
            actions.Children.Add(button);
        }

        void Navigate(string page)
        {
            view.CoreWebView2?.Navigate(Entry + "#/" + page);
            dialog.Close();
        }
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
