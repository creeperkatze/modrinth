using System.Collections.ObjectModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using ModrinthApp.Models;

namespace ModrinthApp.Pages;

public sealed partial class HomePage : Page
{
	// TODO: Replace with Tauri IPC call: profile_list (sorted by last_played desc, limited to ~8)
	public ObservableCollection<Instance> RecentInstances { get; } = new()
	{
		new Instance { Name = "All the Mods 9",           GameVersion = "1.21.1", Loader = "NeoForge", ModCount = 347, LastPlayed = DateTime.Now.AddHours(-2)   },
		new Instance { Name = "Vault Hunters 3rd Edition", GameVersion = "1.18.2", Loader = "Forge",    ModCount = 208, LastPlayed = DateTime.Now.AddDays(-1)    },
		new Instance { Name = "Better MC [FABRIC]",        GameVersion = "1.20.1", Loader = "Fabric",   ModCount = 156, LastPlayed = DateTime.Now.AddDays(-4)    },
		new Instance { Name = "Create: Above and Beyond",  GameVersion = "1.16.5", Loader = "Forge",    ModCount = 82,  LastPlayed = DateTime.Now.AddDays(-10)   },
		new Instance { Name = "Prominence II RPG",         GameVersion = "1.20.1", Loader = "Forge",    ModCount = 421, LastPlayed = DateTime.Now.AddDays(-18)   },
		new Instance { Name = "Fabulously Optimized",      GameVersion = "1.21.4", Loader = "Fabric",   ModCount = 38,  LastPlayed = DateTime.Now.AddDays(-32)   },
	};

	// TODO: Replace with Tauri IPC call: get_search_results with featured=true and projectType=modpack
	public ObservableCollection<Project> FeaturedModpacks { get; } = new()
	{
		new Project { Title = "All the Mods 9",           Description = "All The Mods started out as a private pack for just a few friends of the mod authors.",   Author = "ATM Team",      Downloads = 5_200_000, ProjectType = "modpack" },
		new Project { Title = "FTB Academy",               Description = "The perfect starting point for players new to modded Minecraft.",                          Author = "FTB Team",      Downloads = 3_100_000, ProjectType = "modpack" },
		new Project { Title = "RLCraft",                   Description = "The biggest RLCraft update yet. It adds quests, tweaks, and a whole lot more.",            Author = "Shivaxi",       Downloads = 12_800_000, ProjectType = "modpack" },
		new Project { Title = "Vault Hunters",             Description = "A progression-based modpack centered around the Vault dimension.",                         Author = "iskall85",      Downloads = 4_500_000, ProjectType = "modpack" },
		new Project { Title = "Create: Above and Beyond",  Description = "Use the Create mod to reach space! Embark on a journey powered by contraptions.",         Author = "Simibubi",      Downloads = 2_800_000, ProjectType = "modpack" },
		new Project { Title = "Prominence II RPG",         Description = "An expansive RPG modpack for Minecraft 1.20.1 with quests, gear, and dungeons.",          Author = "Bstylia14",     Downloads = 1_900_000, ProjectType = "modpack" },
	};

	public HomePage()
	{
		this.InitializeComponent();
	}

	private void BrowseAll_Click(object sender, RoutedEventArgs e)
	{
		// Navigate to the browse page
		if (App.MainWindow?.Content is NavigationView nav && nav.Content is Frame frame)
		{
			foreach (var item in nav.MenuItems)
			{
				if (item is NavigationViewItem nvi && nvi.Tag as string == "browse")
				{
					nav.SelectedItem = nvi;
					break;
				}
			}
		}
	}
}
