using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows;

namespace CloverStore.UI64;

internal static class PackageManagers
{
    private static string ScoopRoot => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "scoop");
    private static string WinGet => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "WindowsApps", "winget.exe");
    private static string Chocolatey => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "chocolatey", "bin", "choco.exe");
    private static string Scoop => Path.Combine(ScoopRoot, "apps", "scoop", "current", "bin", "scoop.ps1");

    public static async Task<object> RunAsync(Window owner, JsonElement payload)
    {
        var manager = payload.GetProperty("manager").GetString();
        var operation = payload.GetProperty("operation").GetString();
        if (operation is not ("list" or "install" or "upgrade")) throw new ArgumentException("Unsupported package operation.");
        var id = operation == "list" ? "" : payload.GetProperty("id").GetString() ?? "";
        if (operation != "list" && !Regex.IsMatch(id, @"\A[A-Za-z0-9][A-Za-z0-9._-]{0,149}\z"))
            throw new ArgumentException("Enter an exact package ID.");
        var path = manager switch
        {
            "winget" => WinGet, "scoop" => Scoop, "chocolatey" => Chocolatey,
            _ => throw new ArgumentException("Choose a package manager.")
        };
        if (!File.Exists(path)) throw new InvalidOperationException($"{manager} was not found at its standard install path.");

        var start = new ProcessStartInfo(path) { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true };
        if (manager == "scoop")
        {
            start.FileName = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
            foreach (var value in new[] { "-NoProfile", "-File", path })
                start.ArgumentList.Add(value);
        }
        start.ArgumentList.Add(operation == "upgrade" && manager == "scoop" ? "update" : operation);
        if (operation != "list")
        {
            if (manager == "winget")
            {
                foreach (var value in new[] { "--id", id, "--exact", "--source", "winget", "--disable-interactivity" })
                    start.ArgumentList.Add(value);
                if (operation == "install" && payload.TryGetProperty("location", out var field) && field.GetString() is { Length: > 0 } location)
                {
                    if (!Path.IsPathFullyQualified(location) || !Directory.Exists(location) ||
                        !char.IsAsciiLetter(location[0]) || location[1] != ':')
                        throw new ArgumentException("Choose an existing local install directory.");
                    start.ArgumentList.Add("--location");
                    start.ArgumentList.Add(location);
                }
            }
            else
            {
                start.ArgumentList.Add(id);
                if (manager == "chocolatey") start.ArgumentList.Add("--yes");
            }
            if (MessageBox.Show(owner, $"Run {manager} {operation} for {id}? This can change installed software.",
                "Clover Store package manager", MessageBoxButton.OKCancel, MessageBoxImage.Question) != MessageBoxResult.OK)
                return new { exitCode = 0, output = "Cancelled." };
        }

        using var process = Process.Start(start) ?? throw new IOException("Could not launch the package manager.");
        var outputTask = ReadBoundedAsync(process.StandardOutput);
        var errorTask = ReadBoundedAsync(process.StandardError);
        await process.WaitForExitAsync();
        var output = (await outputTask + "\n" + await errorTask).Trim();
        return new { exitCode = process.ExitCode, output };
    }

    private static async Task<string> ReadBoundedAsync(StreamReader stream)
    {
        const int limit = 32000;
        var output = new System.Text.StringBuilder();
        var buffer = new char[2048];
        int count;
        while ((count = await stream.ReadAsync(buffer)) != 0)
            if (output.Length < limit) output.Append(buffer, 0, Math.Min(count, limit - output.Length));
        return output.ToString();
    }
}
