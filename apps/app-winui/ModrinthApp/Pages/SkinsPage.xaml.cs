using System.Collections.ObjectModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace ModrinthApp.Pages;

public sealed partial class SkinsPage : Page
{
	// TODO: Replace with Tauri IPC call: get_available_skins()
	public ObservableCollection<string> Skins { get; } = new()
	{
		"Default Steve",
		"Default Alex",
		"Classic Herobrine",
		"Enderman",
		"Creeper Suit",
		"Diamond Armor",
		"Skeleton",
		"Zombie",
	};

	public SkinsPage()
	{
		this.InitializeComponent();
	}

	private async void UploadSkin_Click(object sender, RoutedEventArgs e)
	{
		// TODO: Open file picker for .png skin texture, then call:
		// Tauri IPC: add_and_equip_custom_skin(skinPath, skinVariant)
		var picker = new Windows.Storage.Pickers.FileOpenPicker();
		picker.FileTypeFilter.Add(".png");

		var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
		WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);

		var file = await picker.PickSingleFileAsync();
		if (file is not null)
		{
			ActiveSkinName.Text = file.DisplayName;
			// TODO: pass file.Path to Tauri IPC
		}
	}

	private async void RemoveSkin_Click(object sender, RoutedEventArgs e)
	{
		// TODO: Tauri IPC: unequip_skin()
		var dialog = new ContentDialog
		{
			Title = "Remove Skin",
			Content = "Are you sure you want to remove your active skin?",
			PrimaryButtonText = "Remove",
			CloseButtonText = "Cancel",
			XamlRoot = this.XamlRoot,
		};
		var result = await dialog.ShowAsync();
		if (result == ContentDialogResult.Primary)
			ActiveSkinName.Text = "No skin equipped";
	}
}
