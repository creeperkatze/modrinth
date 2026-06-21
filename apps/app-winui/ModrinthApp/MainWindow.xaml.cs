using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using ModrinthApp.Pages;

namespace ModrinthApp;

public sealed partial class MainWindow : Window
{
	public MainWindow()
	{
		this.InitializeComponent();
	}

	private void NavView_Loaded(object sender, RoutedEventArgs e)
	{
		NavView.SelectedItem = NavView.MenuItems[0];
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
			pageType = (item.Tag as string) switch
			{
				"home"    => typeof(HomePage),
				"library" => typeof(LibraryPage),
				"browse"  => typeof(BrowsePage),
				"worlds"  => typeof(WorldsPage),
				"skins"   => typeof(SkinsPage),
				_         => null,
			};
		}

		if (pageType is not null && (ContentFrame.CurrentSourcePageType != pageType))
			ContentFrame.Navigate(pageType);
	}
}
