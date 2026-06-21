using System.Collections.ObjectModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;
using ModrinthApp.Models;
using ModrinthApp.Services;

namespace ModrinthApp.Pages;

public sealed partial class LibraryPage : Page
{
	private List<Instance> _allInstances = [];
	private string _currentFilter = "all";

	public ObservableCollection<Instance> FilteredInstances { get; } = new();

	public LibraryPage()
	{
		this.InitializeComponent();
	}

	protected override async void OnNavigatedTo(NavigationEventArgs e)
	{
		base.OnNavigatedTo(e);
		_allInstances = await ProfileService.GetInstancesAsync();
		RefreshList(SearchBox.Text, SortCombo.SelectedIndex);
	}

	private void RefreshList(string filter = "", int sortIndex = 0)
	{
		var query = _allInstances.AsEnumerable();

		query = _currentFilter switch
		{
			"modpacks" => query.Where(i => i.IsModpack),
			"custom"   => query.Where(i => !i.IsModpack),
			"servers"  => Enumerable.Empty<Instance>(),
			_          => query,
		};

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

	private void FilterTab_Checked(object sender, RoutedEventArgs e)
	{
		if (sender is RadioButton rb && rb.Tag is string tag)
		{
			_currentFilter = tag;
			RefreshList(SearchBox.Text, SortCombo.SelectedIndex);
		}
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

	private void InstanceCard_Tapped(object sender, TappedRoutedEventArgs e)
	{
		if (sender is FrameworkElement fe && fe.Tag is Instance instance)
			Frame.Navigate(typeof(InstancePage), instance);
	}

	private async void NewInstance_Click(object sender, RoutedEventArgs e)
	{
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
