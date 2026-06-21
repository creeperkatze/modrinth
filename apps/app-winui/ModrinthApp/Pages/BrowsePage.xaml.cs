using System.Collections.ObjectModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Modrinth.Models;
using Modrinth.Models.Enums.Project;
using ModrinthApp.Services;
using SortIndex = Modrinth.Models.Enums.Index;

namespace ModrinthApp.Pages;

public sealed partial class BrowsePage : Page
{
	private readonly ModrinthApiService _api = new();
	private string _activeCategory = "mod";
	private CancellationTokenSource? _searchCts;

	public ObservableCollection<SearchResult> SearchResults { get; } = new();

	public BrowsePage()
	{
		InitializeComponent();
		_ = DoSearchAsync();
	}

	private ProjectType ActiveProjectType => _activeCategory switch
	{
		"modpack"      => ProjectType.Modpack,
		"resourcepack" => ProjectType.Resourcepack,
		"shader"       => ProjectType.Shader,
		"datapack"     => ProjectType.Datapack,
		"plugin"       => ProjectType.Plugin,
		_              => ProjectType.Mod,
	};

	private SortIndex ActiveSortIndex => SortCombo.SelectedIndex switch
	{
		1 => SortIndex.Downloads,
		2 => SortIndex.Follows,
		3 => SortIndex.Newest,
		4 => SortIndex.Updated,
		_ => SortIndex.Relevance,
	};

	private async Task DoSearchAsync(string query = "", int debounceMs = 0)
	{
		_searchCts?.Cancel();
		var cts = _searchCts = new CancellationTokenSource();

		if (debounceMs > 0)
		{
			try { await Task.Delay(debounceMs, cts.Token); }
			catch (OperationCanceledException) { return; }
		}

		LoadingRing.IsActive = true;
		ResultsScrollViewer.Visibility = Visibility.Collapsed;
		ErrorText.Visibility = Visibility.Collapsed;

		try
		{
			var results = await _api.SearchAsync(query, ActiveProjectType, ActiveSortIndex, cancellationToken: cts.Token);

			if (cts.IsCancellationRequested) return;

			SearchResults.Clear();
			foreach (var hit in results.Hits)
				SearchResults.Add(hit);
		}
		catch (OperationCanceledException) { return; }
		catch
		{
			if (!cts.IsCancellationRequested)
				ErrorText.Visibility = Visibility.Visible;
			return;
		}
		finally
		{
			if (!cts.IsCancellationRequested)
			{
				LoadingRing.IsActive = false;
				ResultsScrollViewer.Visibility = Visibility.Visible;
			}
		}
	}

	private void Category_Click(object sender, RoutedEventArgs e)
	{
		if (sender is not ToggleButton clicked) return;

		foreach (var child in CategoryPanel.Children)
		{
			if (child is ToggleButton tb && tb != clicked)
				tb.IsChecked = false;
		}
		clicked.IsChecked = true;

		_activeCategory = clicked.Tag as string ?? "mod";
		_ = DoSearchAsync(SearchBox.Text);
	}

	private void SearchBox_QuerySubmitted(AutoSuggestBox sender, AutoSuggestBoxQuerySubmittedEventArgs args)
	{
		_ = DoSearchAsync(args.QueryText);
	}

	private void SearchBox_TextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
	{
		if (args.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
			_ = DoSearchAsync(sender.Text, debounceMs: 300);
	}

	private void SortCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
	{
		_ = DoSearchAsync(SearchBox.Text);
	}
}
