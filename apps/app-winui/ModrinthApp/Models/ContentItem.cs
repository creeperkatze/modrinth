using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace ModrinthApp.Models;

public class ContentItem : INotifyPropertyChanged
{
	public string FileName { get; set; } = string.Empty;
	public string RawFileName { get; set; } = string.Empty;
	public string FilePath { get; set; } = string.Empty;

	private bool _enabled;
	public bool Enabled
	{
		get => _enabled;
		set { if (_enabled != value) { _enabled = value; OnPropertyChanged(); } }
	}

	public event PropertyChangedEventHandler? PropertyChanged;
	private void OnPropertyChanged([CallerMemberName] string? name = null) =>
		PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
