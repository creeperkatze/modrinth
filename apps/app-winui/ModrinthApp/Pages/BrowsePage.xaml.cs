using System.Collections.ObjectModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using ModrinthApp.Models;

namespace ModrinthApp.Pages;

public sealed partial class BrowsePage : Page
{
	private string _activeCategory = "mod";

	// TODO: Replace with Tauri IPC call: get_search_results(query, projectType, sortField, ...)
	private static readonly List<Project> _mockMods =
	[
		new Project { Title = "Sodium",                    Description = "Modern rendering engine and client-side optimization mod for Minecraft.",    Author = "CaffeineMC",    Downloads = 45_000_000, ProjectType = "mod" },
		new Project { Title = "Iris Shaders",              Description = "A modern shaders mod for Minecraft intended to be compatible with OptiFine shader packs.", Author = "IrisShaders", Downloads = 22_000_000, ProjectType = "mod" },
		new Project { Title = "Lithium",                   Description = "A free and open-source optimization mod which works to improve general performance.", Author = "CaffeineMC", Downloads = 18_000_000, ProjectType = "mod" },
		new Project { Title = "Create",                    Description = "Building tools and aesthetic technology using rotating machinery and contraptions.", Author = "simibubi",  Downloads = 31_000_000, ProjectType = "mod" },
		new Project { Title = "Applied Energistics 2",     Description = "A Mod about Matter, Energy, and using them to conquer the world.",           Author = "AlgorithmX2",   Downloads = 28_000_000, ProjectType = "mod" },
		new Project { Title = "Thermal Expansion",         Description = "A central mod in many tech modpacks, add machines and energy storage.",      Author = "TeamCoFH",      Downloads = 19_000_000, ProjectType = "mod" },
		new Project { Title = "Botania",                   Description = "A tech mod in the theme of natural magic.",                                  Author = "Vazkii",        Downloads = 24_000_000, ProjectType = "mod" },
		new Project { Title = "Farmer's Delight",          Description = "A mod that gently expands on farming and cooking in Minecraft.",             Author = "vectorwing",    Downloads = 16_000_000, ProjectType = "mod" },
		new Project { Title = "Twilight Forest",           Description = "A mod that adds a whole new dimension along with a storyline.",              Author = "Benimatic",     Downloads = 35_000_000, ProjectType = "mod" },
		new Project { Title = "Waystones",                 Description = "Teleport back to activated waystones, from anywhere in the world.",         Author = "BlayTheNinth",  Downloads = 38_000_000, ProjectType = "mod" },
		new Project { Title = "JourneyMap",                Description = "Real-time mapping in game or in a web browser as you explore.",             Author = "techbrew",      Downloads = 42_000_000, ProjectType = "mod" },
		new Project { Title = "Xaero's Minimap",           Description = "A minimap mod that features several components, including entity radar.",   Author = "xaero96",       Downloads = 39_000_000, ProjectType = "mod" },
	];

	private static readonly List<Project> _mockModpacks =
	[
		new Project { Title = "All the Mods 9",           Description = "All The Mods started out as a private pack for just a few friends.",         Author = "ATM Team",   Downloads = 5_200_000, ProjectType = "modpack" },
		new Project { Title = "Vault Hunters",             Description = "A progression-based modpack centered around the Vault dimension.",           Author = "iskall85",   Downloads = 4_500_000, ProjectType = "modpack" },
		new Project { Title = "RLCraft",                   Description = "The biggest RLCraft update yet. Hard mode Minecraft like you've never seen.", Author = "Shivaxi",    Downloads = 12_800_000, ProjectType = "modpack" },
		new Project { Title = "Prominence II RPG",         Description = "An expansive RPG modpack with quests, gear, and dungeons.",                 Author = "Bstylia14",  Downloads = 1_900_000, ProjectType = "modpack" },
		new Project { Title = "Create: Above and Beyond",  Description = "Use Create to reach space! Contraption-powered adventure awaits.",          Author = "Simibubi",   Downloads = 2_800_000, ProjectType = "modpack" },
		new Project { Title = "Better MC [FABRIC]",        Description = "Bringing quality-of-life mods to enhance your Minecraft experience.",       Author = "Giraffemaster", Downloads = 3_700_000, ProjectType = "modpack" },
	];

	public ObservableCollection<Project> SearchResults { get; } = new();

	public BrowsePage()
	{
		this.InitializeComponent();
		LoadResults();
	}

	private void LoadResults(string query = "")
	{
		var source = _activeCategory == "modpack" ? _mockModpacks : _mockMods;

		var results = string.IsNullOrWhiteSpace(query)
			? source
			: source.Where(p => p.Title.Contains(query, StringComparison.OrdinalIgnoreCase)
			               || p.Description.Contains(query, StringComparison.OrdinalIgnoreCase));

		SearchResults.Clear();
		foreach (var p in results)
			SearchResults.Add(p);
	}

	private void Category_Click(object sender, RoutedEventArgs e)
	{
		if (sender is not ToggleButton clicked) return;

		// Enforce single-select among the category toggles
		foreach (var child in CategoryPanel.Children)
		{
			if (child is ToggleButton tb && tb != clicked)
				tb.IsChecked = false;
		}
		clicked.IsChecked = true;

		_activeCategory = clicked.Tag as string ?? "mod";
		// TODO: Tauri IPC call: get_search_results(query: SearchBox.Text, projectType: _activeCategory, ...)
		LoadResults(SearchBox.Text);
	}

	private void SearchBox_QuerySubmitted(AutoSuggestBox sender, AutoSuggestBoxQuerySubmittedEventArgs args)
	{
		// TODO: Tauri IPC call: get_search_results(query: args.QueryText, projectType: _activeCategory, ...)
		LoadResults(args.QueryText);
	}

	private void SortCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
	{
		// TODO: Re-fetch from Tauri IPC with updated sort field
		LoadResults(SearchBox.Text);
	}
}
