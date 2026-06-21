using Microsoft.Data.Sqlite;
using ModrinthApp.Models;

namespace ModrinthApp.Services;

public static class ProfileService
{
	private static string DbPath =>
		System.IO.Path.Combine(
			Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
			"ModrinthApp",
			"app.db");

	private static string? _profilesDir;

	public static async Task<string> GetProfilesDirAsync()
	{
		if (_profilesDir is not null)
			return _profilesDir;

		if (!File.Exists(DbPath))
		{
			_profilesDir = System.IO.Path.Combine(System.IO.Path.GetDirectoryName(DbPath)!, "profiles");
			return _profilesDir;
		}

		using var connection = new SqliteConnection($"Data Source={DbPath};Mode=ReadOnly;Cache=Shared");
		await connection.OpenAsync();
		var configDir = await GetConfigDirAsync(connection);
		_profilesDir = System.IO.Path.Combine(configDir, "profiles");
		return _profilesDir;
	}

	public static async Task<List<Instance>> GetInstancesAsync()
	{
		if (!File.Exists(DbPath))
			return [];

		using var connection = new SqliteConnection($"Data Source={DbPath};Mode=ReadOnly;Cache=Shared");
		await connection.OpenAsync();

		var configDir = await GetConfigDirAsync(connection);
		var profilesDir = System.IO.Path.Combine(configDir, "profiles");
		_profilesDir = profilesDir;

		using var cmd = connection.CreateCommand();
		cmd.CommandText = """
			SELECT path, name, game_version, mod_loader, icon_path, last_played, linked_project_id
			FROM profiles
			WHERE install_stage = 'installed'
			ORDER BY last_played DESC
			""";

		var instances = new List<Instance>();
		using var reader = await cmd.ExecuteReaderAsync();
		while (await reader.ReadAsync())
		{
			var path = reader.GetString(0);
			var name = reader.GetString(1);
			var gameVersion = reader.GetString(2);
			var modLoader = reader.GetString(3);
			var iconPath = reader.IsDBNull(4) ? null : reader.GetString(4);
			var lastPlayedSeconds = reader.IsDBNull(5) ? (long?)null : reader.GetInt64(5);
			var linkedProjectId = reader.IsDBNull(6) ? null : reader.GetString(6);

			var modsDir = System.IO.Path.Combine(profilesDir, path, "mods");
			var modCount = Directory.Exists(modsDir)
				? Directory.EnumerateFiles(modsDir, "*.jar", SearchOption.TopDirectoryOnly).Count()
				: 0;

			instances.Add(new Instance
			{
				Path = path,
				Name = name,
				GameVersion = gameVersion,
				Loader = NormalizeLoader(modLoader),
				ModCount = modCount,
				LastPlayed = lastPlayedSeconds.HasValue
					? DateTimeOffset.FromUnixTimeSeconds(lastPlayedSeconds.Value).LocalDateTime
					: default,
				IconPath = iconPath,
				IsModpack = linkedProjectId != null,
			});
		}

		return instances;
	}

	private static async Task<string> GetConfigDirAsync(SqliteConnection connection)
	{
		using var cmd = connection.CreateCommand();
		cmd.CommandText = "SELECT custom_dir FROM settings WHERE id = 0";
		var result = await cmd.ExecuteScalarAsync();
		if (result is string customDir && !string.IsNullOrEmpty(customDir))
			return customDir;

		return System.IO.Path.GetDirectoryName(DbPath)!;
	}

	private static string NormalizeLoader(string loader) => loader switch
	{
		"fabric"   => "Fabric",
		"forge"    => "Forge",
		"quilt"    => "Quilt",
		"neoforge" => "NeoForge",
		"vanilla"  => "Vanilla",
		_          => loader,
	};
}
