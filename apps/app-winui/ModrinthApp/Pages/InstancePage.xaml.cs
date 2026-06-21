using System.Collections.ObjectModel;
using System.Diagnostics;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using ModrinthApp.Models;
using ModrinthApp.Services;
using Windows.UI;

namespace ModrinthApp.Pages;

public sealed partial class InstancePage : Page
{
	private Instance? _instance;
	private List<ContentItem> _allMods = [];

	public ObservableCollection<ContentItem> FilteredMods { get; } = new();

	public InstancePage()
	{
		this.InitializeComponent();
	}

	protected override async void OnNavigatedTo(NavigationEventArgs e)
	{
		base.OnNavigatedTo(e);

		if (e.Parameter is not Instance instance)
			return;

		_instance = instance;

		NameText.Text = instance.Name;
		SubtitleText.Text = instance.SubtitleText;

		if (TryParseHexColor(instance.LoaderColor, out var color))
			IconColor.Color = color;

		var instanceDir = await ContentService.GetInstanceDirAsync(instance);
		FolderPathText.Text = instanceDir;

		await LoadModsAsync();
	}

	private async Task LoadModsAsync()
	{
		if (_instance is null) return;

		_allMods = await ContentService.GetModsAsync(_instance);
		RefreshMods(ModSearchBox.Text);
	}

	private void RefreshMods(string filter = "")
	{
		var query = _allMods.AsEnumerable();
		if (!string.IsNullOrWhiteSpace(filter))
			query = query.Where(m => m.FileName.Contains(filter, StringComparison.OrdinalIgnoreCase)
								  || m.RawFileName.Contains(filter, StringComparison.OrdinalIgnoreCase));

		FilteredMods.Clear();
		foreach (var mod in query)
			FilteredMods.Add(mod);
	}

	private void ModSearch_TextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
	{
		if (args.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
			RefreshMods(sender.Text);
	}

	private async void Mod_Toggled(object sender, RoutedEventArgs e)
	{
		if (sender is ToggleSwitch ts && ts.Tag is ContentItem item)
		{
			bool enable = ts.IsOn;
			try
			{
				await ContentService.ToggleAsync(item);
			}
			catch
			{
				item.Enabled = !enable;
			}
		}
	}

	private async void Mod_Delete_Click(object sender, RoutedEventArgs e)
	{
		if (sender is FrameworkElement fe && fe.Tag is ContentItem item)
		{
			var dialog = new ContentDialog
			{
				Title = "Delete mod?",
				Content = $"Delete \"{item.FileName}\"? This cannot be undone.",
				PrimaryButtonText = "Delete",
				CloseButtonText = "Cancel",
				DefaultButton = ContentDialogButton.Close,
				XamlRoot = XamlRoot,
			};

			if (await dialog.ShowAsync() == ContentDialogResult.Primary)
			{
				await ContentService.DeleteAsync(item);
				_allMods.Remove(item);
				RefreshMods(ModSearchBox.Text);
			}
		}
	}

	private async void Pivot_SelectionChanged(object sender, SelectionChangedEventArgs e)
	{
		if (_instance is null) return;
		if (sender is not Pivot pivot) return;

		switch (pivot.SelectedIndex)
		{
			case 2: // Worlds
				await LoadWorldsAsync();
				break;
			case 3: // Logs
				await LoadLogsAsync();
				break;
		}
	}

	private async Task LoadWorldsAsync()
	{
		if (_instance is null) return;

		var worlds = await ContentService.GetWorldNamesAsync(_instance);
		WorldList.ItemsSource = worlds;
		WorldsEmptyText.Visibility = worlds.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
		WorldList.Visibility = worlds.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
	}

	private async Task LoadLogsAsync()
	{
		if (_instance is null) return;

		var log = await ContentService.GetLatestLogAsync(_instance);
		if (log is null)
		{
			LogsEmptyText.Visibility = Visibility.Visible;
			LogTextBox.Visibility = Visibility.Collapsed;
		}
		else
		{
			LogTextBox.Text = log;
			LogTextBox.Visibility = Visibility.Visible;
			LogsEmptyText.Visibility = Visibility.Collapsed;
		}
	}

	private void Play_Click(object sender, RoutedEventArgs e)
	{
		// TODO: launch via Tauri backend integration
	}

	private async void OpenFolder_Click(object sender, RoutedEventArgs e)
	{
		if (_instance is null) return;

		var dir = await ContentService.GetInstanceDirAsync(_instance);
		if (Directory.Exists(dir))
			Process.Start(new ProcessStartInfo { FileName = "explorer.exe", Arguments = $"\"{dir}\"", UseShellExecute = true });
	}

	private async void AddMods_Click(object sender, RoutedEventArgs e)
	{
		var dialog = new ContentDialog
		{
			Title = "Add mods",
			Content = "Browse and add mods — not yet implemented.",
			CloseButtonText = "Close",
			XamlRoot = XamlRoot,
		};
		await dialog.ShowAsync();
	}

	private static bool TryParseHexColor(string hex, out Color color)
	{
		color = default;
		hex = hex.TrimStart('#');
		if (hex.Length != 6) return false;
		try
		{
			color = Color.FromArgb(255,
				Convert.ToByte(hex[0..2], 16),
				Convert.ToByte(hex[2..4], 16),
				Convert.ToByte(hex[4..6], 16));
			return true;
		}
		catch { return false; }
	}
}
