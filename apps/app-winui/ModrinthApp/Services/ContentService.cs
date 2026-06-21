using ModrinthApp.Models;

namespace ModrinthApp.Services;

public static class ContentService
{
	public static async Task<List<ContentItem>> GetModsAsync(Instance instance)
	{
		var profilesDir = await ProfileService.GetProfilesDirAsync();
		var modsDir = Path.Combine(profilesDir, instance.Path, "mods");

		if (!Directory.Exists(modsDir))
			return [];

		var items = new List<ContentItem>();

		foreach (var file in Directory.EnumerateFiles(modsDir))
		{
			if (file.EndsWith(".jar", StringComparison.OrdinalIgnoreCase))
			{
				var raw = Path.GetFileNameWithoutExtension(file);
				items.Add(new ContentItem
				{
					FileName = PrettyName(raw),
					RawFileName = raw + ".jar",
					FilePath = file,
					Enabled = true,
				});
			}
			else if (file.EndsWith(".jar.disabled", StringComparison.OrdinalIgnoreCase))
			{
				var withoutDisabled = file[..^".disabled".Length];
				var raw = Path.GetFileNameWithoutExtension(withoutDisabled);
				items.Add(new ContentItem
				{
					FileName = PrettyName(raw),
					RawFileName = raw + ".jar",
					FilePath = file,
					Enabled = false,
				});
			}
		}

		return [.. items.OrderBy(i => i.FileName, StringComparer.OrdinalIgnoreCase)];
	}

	public static async Task ToggleAsync(ContentItem item)
	{
		bool enable = !item.Enabled;
		string newPath = enable
			? item.FilePath[..^".disabled".Length]
			: item.FilePath + ".disabled";

		await Task.Run(() => File.Move(item.FilePath, newPath));
		item.FilePath = newPath;
		item.Enabled = enable;
	}

	public static async Task DeleteAsync(ContentItem item)
	{
		await Task.Run(() => File.Delete(item.FilePath));
	}

	public static async Task<string> GetInstanceDirAsync(Instance instance)
	{
		var profilesDir = await ProfileService.GetProfilesDirAsync();
		return Path.Combine(profilesDir, instance.Path);
	}

	public static async Task<string?> GetLatestLogAsync(Instance instance)
	{
		var dir = await GetInstanceDirAsync(instance);
		var logPath = Path.Combine(dir, "logs", "latest.log");
		if (!File.Exists(logPath))
			return null;
		return await File.ReadAllTextAsync(logPath);
	}

	public static async Task<List<string>> GetWorldNamesAsync(Instance instance)
	{
		var dir = await GetInstanceDirAsync(instance);
		var savesDir = Path.Combine(dir, "saves");
		if (!Directory.Exists(savesDir))
			return [];
		return [..
			Directory.EnumerateDirectories(savesDir)
				.Select(Path.GetFileName)
				.OfType<string>()
				.OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
		];
	}

	private static string PrettyName(string raw) =>
		raw.Replace('-', ' ').Replace('_', ' ');
}
