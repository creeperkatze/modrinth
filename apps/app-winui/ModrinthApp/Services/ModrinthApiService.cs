using Modrinth;
using Modrinth.Models;
using Modrinth.Models.Enums.Project;
using SortIndex = Modrinth.Models.Enums.Index;

namespace ModrinthApp.Services;

public class ModrinthApiService : IDisposable
{
	private readonly ModrinthClient _client = new(new ModrinthClientConfig
	{
		UserAgent = "ModrinthWinUIAppTest/1.0 (github.com/creeperkatze/modrinth)",
	});

	public async Task<SearchResponse> SearchAsync(
		string query,
		ProjectType projectType,
		SortIndex sortIndex = SortIndex.Relevance,
		int offset = 0,
		int limit = 20,
		CancellationToken cancellationToken = default)
	{
		var facets = new FacetCollection
		{
			{ Facet.ProjectType(projectType) },
		};

		return await _client.Project.SearchAsync(query, sortIndex, offset, limit, facets, cancellationToken);
	}

	public void Dispose() => _client.Dispose();
}
