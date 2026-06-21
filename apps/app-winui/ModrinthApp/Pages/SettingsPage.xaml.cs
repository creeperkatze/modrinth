using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace ModrinthApp.Pages;

public sealed partial class SettingsPage : Page
{
	public SettingsPage()
	{
		this.InitializeComponent();
	}

	private void ThemeCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
	{
		// TODO: Tauri IPC: settings_set({ theme: selectedTheme })
		// Also update the app-level RequestedTheme:
		var theme = ThemeCombo.SelectedIndex switch
		{
			1 => ElementTheme.Light,
			2 => ElementTheme.Dark,
			_ => ElementTheme.Default,
		};

		if (App.MainWindow?.Content is FrameworkElement root)
			root.RequestedTheme = theme;
	}

	private async void AddAccount_Click(object sender, RoutedEventArgs e)
	{
		// TODO: Tauri IPC: login() — opens Minecraft OAuth in a browser window
		var dialog = new ContentDialog
		{
			Title = "Add Account",
			Content = "Account login via Tauri IPC (login()) is not yet wired up in this prototype.",
			CloseButtonText = "Close",
			XamlRoot = this.XamlRoot,
		};
		await dialog.ShowAsync();
	}

	private async void ChangeDir_Click(object sender, RoutedEventArgs e)
	{
		// TODO: Tauri IPC: settings_set with new base_dir; if user cancels, call cancel_directory_change()
		var picker = new Windows.Storage.Pickers.FolderPicker();
		picker.FileTypeFilter.Add("*");

		var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
		WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);

		var folder = await picker.PickSingleFolderAsync();
		if (folder is not null)
			DataDirText.Text = folder.Path;
	}

	private void OpenDir_Click(object sender, RoutedEventArgs e)
	{
		// TODO: Tauri IPC: highlight_in_folder(dataDir)
	}

	private void Telemetry_Toggled(object sender, RoutedEventArgs e)
	{
		// TODO: Tauri IPC: settings_set({ telemetry: (sender as ToggleSwitch)?.IsOn })
	}
}
