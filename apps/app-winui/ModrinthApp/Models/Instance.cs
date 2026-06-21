namespace ModrinthApp.Models;

public class Instance
{
	public string Path { get; set; } = string.Empty;
	public string Name { get; set; } = string.Empty;
	public string GameVersion { get; set; } = string.Empty;
	public string Loader { get; set; } = string.Empty;
	public int ModCount { get; set; }
	public DateTime LastPlayed { get; set; }
	public string? IconPath { get; set; }
	public bool IsModpack { get; set; }

	public string SubtitleText => $"{Loader} {GameVersion}";

	public string LastPlayedText
	{
		get
		{
			if (LastPlayed == default) return "Never played";
			var diff = DateTime.Now - LastPlayed;
			if (diff.TotalDays >= 30) return $"{(int)(diff.TotalDays / 30)}mo ago";
			if (diff.TotalDays >= 1)  return $"{(int)diff.TotalDays}d ago";
			if (diff.TotalHours >= 1) return $"{(int)diff.TotalHours}h ago";
			return "Just now";
		}
	}

	/// Color used for the icon placeholder background, keyed by mod loader.
	public string LoaderColor => Loader switch
	{
		"Fabric"   => "#1BD96A",
		"Quilt"    => "#9B59B6",
		"NeoForge" => "#E8732A",
		"Forge"    => "#1E7FA3",
		"Vanilla"  => "#4A5568",
		_          => "#4A5568",
	};
}
