namespace ModrinthApp.Models;

public static class InstanceStore
{
	// TODO: Replace with Tauri IPC call: profile_list
	public static readonly List<Instance> All =
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
}
