namespace ModrinthApp.Models;

public class World
{
	public string Name { get; set; } = string.Empty;
	public string InstanceName { get; set; } = string.Empty;
	public DateTime LastPlayed { get; set; }
	public string GameMode { get; set; } = string.Empty;
	public bool CheatsEnabled { get; set; }

	public string LastPlayedText
	{
		get
		{
			if (LastPlayed == default) return "Never";
			var diff = DateTime.Now - LastPlayed;
			if (diff.TotalDays >= 30) return $"{(int)(diff.TotalDays / 30)}mo ago";
			if (diff.TotalDays >= 1)  return $"{(int)diff.TotalDays}d ago";
			if (diff.TotalHours >= 1) return $"{(int)diff.TotalHours}h ago";
			return "Just now";
		}
	}

	public string DetailText => CheatsEnabled ? $"{GameMode}  ·  Cheats on" : GameMode;
}
