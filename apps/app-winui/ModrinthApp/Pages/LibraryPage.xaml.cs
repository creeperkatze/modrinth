using System.Collections.ObjectModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using ModrinthApp.Models;

namespace ModrinthApp.Pages;

public sealed partial class LibraryPage : Page
{
	private readonly List<Instance> _allInstances = InstanceStore.All;

	public ObservableCollection<Instance> FilteredInstances { get; } = new();

	public LibraryPage()
	{
		this.InitializeComponent();
		RefreshList();
	}

	private void RefreshList(string filter = "", int sortIndex = 0)
	{
		var query = _allInstances.AsEnumerable();

		if (!string.IsNullOrWhiteSpace(filter))
			query = query.Where(i => i.Name.Contains(filter, StringComparison.OrdinalIgnoreCase));

		query = sortIndex switch
		{
			1 => query.OrderBy(i => i.Name),
			2 => query.OrderByDescending(i => i.Name),
			3 => query.OrderByDescending(i => i.ModCount),
			_ => query.OrderByDescending(i => i.LastPlayed),
		};

		FilteredInstances.Clear();
		foreach (var instance in query)
			FilteredInstances.Add(instance);
	}

	private void SearchBox_TextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
	{
		if (args.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
			RefreshList(sender.Text, SortCombo.SelectedIndex);
	}

	private void SortCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
	{
		RefreshList(SearchBox.Text, SortCombo.SelectedIndex);
	}

	private async void NewInstance_Click(object sender, RoutedEventArgs e)
	{
		// TODO: Open a "Create new instance" dialog
		// Tauri IPC calls needed: metadata_get_game_versions, metadata_get_loader_versions, profile_create
		var dialog = new ContentDialog
		{
			Title = "New Instance",
			Content = "Instance creation dialog — not yet implemented.",
			CloseButtonText = "Close",
			XamlRoot = this.XamlRoot,
		};
		await dialog.ShowAsync();
	}
}
