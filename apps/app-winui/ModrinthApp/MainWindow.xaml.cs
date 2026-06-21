using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using ModrinthApp.Models;
using ModrinthApp.Pages;
using ModrinthApp.Services;

namespace ModrinthApp;

public sealed partial class MainWindow : Window
{
	public MainWindow()
	{
		this.InitializeComponent();

		// Extend client area into the title bar so Mica shows behind our custom bar.
		this.ExtendsContentIntoTitleBar = true;
		this.SetTitleBar(AppTitleBar);
	}

	private async void NavView_Loaded(object sender, RoutedEventArgs e)
	{
		await PopulateRecentInstancesAsync();
		NavView.SelectedItem = NavView.MenuItems[0];
	}

	private async Task PopulateRecentInstancesAsync()
	{
		var all = await ProfileService.GetInstancesAsync();
		var recent = all
			.Where(i => i.LastPlayed != default)
			.Take(3)
			.ToList();

		if (recent.Count == 0)
			return;

		InstanceSeparator.Visibility = Visibility.Visible;

		foreach (var instance in recent)
		{
			var item = new NavigationViewItem
			{
				Tag     = $"instance:{instance.Path}",
				Content = instance.Name,
				Icon    = new FontIcon { Glyph = "" },
			};
			ToolTipService.SetToolTip(item, instance.Name);
			NavView.MenuItems.Add(item);
		}
	}

	private void NavView_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
	{
		Type? pageType = null;

		if (args.IsSettingsSelected)
		{
			pageType = typeof(SettingsPage);
		}
		else if (args.SelectedItem is NavigationViewItem item)
		{
			var tag = item.Tag as string ?? string.Empty;
			if (tag.StartsWith("instance:"))
			{
				if (ContentFrame.CurrentSourcePageType != typeof(InstancePage))
					ContentFrame.Navigate(typeof(InstancePage));
				return;
			}

			pageType = tag switch
			{
				"home"     => typeof(HomePage),
				"discover" => typeof(BrowsePage),
				"skins"    => typeof(SkinsPage),
				"library"  => typeof(LibraryPage),
				"hosting"  => typeof(HostingPage),
				_          => null,
			};
		}

		if (pageType is not null && (ContentFrame.CurrentSourcePageType != pageType))
			ContentFrame.Navigate(pageType);
	}

	private void ContentFrame_Navigated(object sender, NavigationEventArgs e)
	{
		BackButton.IsEnabled    = ContentFrame.CanGoBack;
		ForwardButton.IsEnabled = ContentFrame.CanGoForward;

		PageTitleText.Text = e.SourcePageType?.Name switch
		{
			nameof(HomePage)     => "Home",
			nameof(LibraryPage)  => "Library",
			nameof(BrowsePage)   => "Discover",
			nameof(SkinsPage)    => "Skins",
			nameof(HostingPage)  => "Hosting",
			nameof(SettingsPage) => "Settings",
			nameof(InstancePage) => (e.Parameter as Instance)?.Name ?? "Instance",
			_                    => string.Empty,
		};
	}

	private void BackButton_Click(object sender, RoutedEventArgs e)
	{
		if (ContentFrame.CanGoBack)
			ContentFrame.GoBack();
	}

	private void ForwardButton_Click(object sender, RoutedEventArgs e)
	{
		if (ContentFrame.CanGoForward)
			ContentFrame.GoForward();
	}
}
