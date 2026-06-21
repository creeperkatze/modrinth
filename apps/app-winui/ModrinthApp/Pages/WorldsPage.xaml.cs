using System.Collections.ObjectModel;
using Microsoft.UI.Xaml.Controls;
using ModrinthApp.Models;

namespace ModrinthApp.Pages;

public sealed partial class WorldsPage : Page
{
	// TODO: Replace with Tauri IPC call: get_recent_worlds()
	private readonly List<World> _allWorlds =
	[
		new World { Name = "New World",        InstanceName = "All the Mods 9",     GameMode = "Survival",  CheatsEnabled = false, LastPlayed = DateTime.Now.AddHours(-2)  },
		new World { Name = "Creative Test",    InstanceName = "All the Mods 9",     GameMode = "Creative",  CheatsEnabled = true,  LastPlayed = DateTime.Now.AddDays(-1)   },
		new World { Name = "My Vault",         InstanceName = "Vault Hunters 3rd",  GameMode = "Survival",  CheatsEnabled = false, LastPlayed = DateTime.Now.AddDays(-3)   },
		new World { Name = "Village Seed",     InstanceName = "Better MC [FABRIC]", GameMode = "Survival",  CheatsEnabled = false, LastPlayed = DateTime.Now.AddDays(-5)   },
		new World { Name = "Contraption Lab",  InstanceName = "Create: A&B",        GameMode = "Survival",  CheatsEnabled = true,  LastPlayed = DateTime.Now.AddDays(-11)  },
		new World { Name = "Old World",        InstanceName = "Vanilla 1.21.4",     GameMode = "Survival",  CheatsEnabled = false, LastPlayed = DateTime.Now.AddDays(-65)  },
	];

	public ObservableCollection<World> FilteredWorlds { get; } = new();

	public WorldsPage()
	{
		this.InitializeComponent();
		RefreshList();
	}

	private void RefreshList(string filter = "")
	{
		var query = _allWorlds.AsEnumerable();

		if (!string.IsNullOrWhiteSpace(filter))
			query = query.Where(w => w.Name.Contains(filter, StringComparison.OrdinalIgnoreCase)
			                    || w.InstanceName.Contains(filter, StringComparison.OrdinalIgnoreCase));

		FilteredWorlds.Clear();
		foreach (var world in query.OrderByDescending(w => w.LastPlayed))
			FilteredWorlds.Add(world);
	}

	private void SearchBox_TextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
	{
		if (args.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
			RefreshList(sender.Text);
	}
}
