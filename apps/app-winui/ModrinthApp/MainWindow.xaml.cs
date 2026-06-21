using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using ModrinthApp.Pages;

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

	private void ContentFrame_Navigated(object sender, NavigationEventArgs e)
	{
		BackButton.IsEnabled    = ContentFrame.CanGoBack;
		ForwardButton.IsEnabled = ContentFrame.CanGoForward;

		PageTitleText.Text = e.SourcePageType?.Name switch
		{
			nameof(HomePage)     => "Home",
			nameof(LibraryPage)  => "Library",
			nameof(BrowsePage)   => "Browse",
			nameof(WorldsPage)   => "Worlds",
			nameof(SkinsPage)    => "Skins",
			nameof(SettingsPage) => "Settings",
			nameof(InstancePage) => "Instance",
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
