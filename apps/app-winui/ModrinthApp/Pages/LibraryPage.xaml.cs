using System.Collections.ObjectModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using ModrinthApp.Models;

namespace ModrinthApp.Pages;

public sealed partial class LibraryPage : Page
{
	// TODO: Replace with Tauri IPC call: profile_list
	private readonly List<Instance> _allInstances =
	[
		new Instance { Name = "All the Mods 9",           GameVersion = "1.21.1", Loader = "NeoForge", ModCount = 347, LastPlayed = DateTime.Now.AddHours(-2)  },
		new Instance { Name = "Vault Hunters 3rd Edition", GameVersion = "1.18.2", Loader = "Forge",    ModCount = 208, LastPlayed = DateTime.Now.AddDays(-1)   },
		new Instance { Name = "Better MC [FABRIC]",        GameVersion = "1.20.1", Loader = "Fabric",   ModCount = 156, LastPlayed = DateTime.Now.AddDays(-4)   },
		new Instance { Name = "Create: Above and Beyond",  GameVersion = "1.16.5", Loader = "Forge",    ModCount = 82,  LastPlayed = DateTime.Now.AddDays(-10)  },
		new Instance { Name = "Prominence II RPG",         GameVersion = "1.20.1", Loader = "Forge",    ModCount = 421, LastPlayed = DateTime.Now.AddDays(-18)  },
		new Instance { Name = "Fabulously Optimized",      GameVersion = "1.21.4", Loader = "Fabric",   ModCount = 38,  LastPlayed = DateTime.Now.AddDays(-32)  },
		new Instance { Name = "Vanilla 1.21.4",            GameVersion = "1.21.4", Loader = "Vanilla",  ModCount = 0,   LastPlayed = DateTime.Now.AddDays(-60)  },
		new Instance { Name = "Quilt Test",                GameVersion = "1.20.4", Loader = "Quilt",    ModCount = 12,  LastPlayed = default                    },
	];

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
