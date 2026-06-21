namespace ModrinthApp.Models;

public class Project
{
	public string Id { get; set; } = string.Empty;
	public string Title { get; set; } = string.Empty;
	public string Description { get; set; } = string.Empty;
	public string ProjectType { get; set; } = string.Empty;
	public string Author { get; set; } = string.Empty;
	public int Downloads { get; set; }
	public string? IconUrl { get; set; }

	public string DownloadsFormatted => Downloads switch
	{
		>= 1_000_000 => $"{Downloads / 1_000_000.0:F1}M downloads",
		>= 1_000     => $"{Downloads / 1_000.0:F0}K downloads",
		_            => $"{Downloads} downloads",
	};
}
