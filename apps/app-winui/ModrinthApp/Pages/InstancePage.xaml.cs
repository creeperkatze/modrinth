using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using ModrinthApp.Models;
using Windows.UI;

namespace ModrinthApp.Pages;

public sealed partial class InstancePage : Page
{
	private Instance? _instance;

	public InstancePage()
	{
		this.InitializeComponent();
	}

	protected override void OnNavigatedTo(NavigationEventArgs e)
	{
		base.OnNavigatedTo(e);

		if (e.Parameter is Instance instance)
		{
			_instance = instance;
			InstanceNameText.Text = instance.Name;
			InstanceSubtitleText.Text = instance.SubtitleText;

			// Parse the hex color and apply it to the icon background
			if (TryParseHexColor(instance.LoaderColor, out var color))
				InstanceIconColor.Color = color;
		}

		// TODO: Load real mod list from Tauri IPC: profile_get_content_items(instance.Id)
	}

	private static bool TryParseHexColor(string hex, out Color color)
	{
		color = default;
		hex = hex.TrimStart('#');
		if (hex.Length != 6) return false;
		try
		{
			color = Color.FromArgb(
				255,
				Convert.ToByte(hex[0..2], 16),
				Convert.ToByte(hex[2..4], 16),
				Convert.ToByte(hex[4..6], 16));
			return true;
		}
		catch { return false; }
	}
}
