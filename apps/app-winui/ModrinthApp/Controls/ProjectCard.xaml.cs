using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Modrinth.Models;

namespace ModrinthApp.Controls;

public sealed partial class ProjectCard : UserControl
{
	public static readonly DependencyProperty HitProperty =
		DependencyProperty.Register(nameof(Hit), typeof(SearchResult), typeof(ProjectCard),
			new PropertyMetadata(null, OnHitChanged));

	public SearchResult? Hit
	{
		get => (SearchResult?)GetValue(HitProperty);
		set => SetValue(HitProperty, value);
	}

	private Brush? _accentBrush;

	public ProjectCard()
	{
		InitializeComponent();
	}

	private static void OnHitChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
	{
		if (d is not ProjectCard card || card.Hit is null) return;
		var hit = card.Hit;

		card.TitleText.Text = hit.Title;
		card.AuthorText.Text = $"by {hit.Author}";
		card.DescriptionText.Text = hit.Description;
		card.DownloadsText.Text = FormatNumber(hit.Downloads);
		card.FollowsText.Text = FormatNumber(hit.Followers);
		card.DateText.Text = FormatRelativeDate(hit.DateModified);
		card.UpdateIcon(hit.IconUrl?.ToString());
		card.UpdateTags(hit.DisplayCategories);
	}

	private void UpdateIcon(string? iconUrl)
	{
		_accentBrush ??= IconBorder.Background;

		if (!string.IsNullOrEmpty(iconUrl))
		{
			IconBorder.Background = new ImageBrush { ImageSource = new BitmapImage(new Uri(iconUrl)) };
			FallbackIcon.Visibility = Visibility.Collapsed;
		}
		else
		{
			IconBorder.Background = _accentBrush;
			FallbackIcon.Visibility = Visibility.Visible;
		}
	}

	private void UpdateTags(IEnumerable<string>? categories)
	{
		TagsPanel.Children.Clear();
		if (categories is null) return;

		var tagStyle = (Style)Resources["TagBorderStyle"];
		var list = categories.ToList();
		var shown = list.Take(3);
		var extra = list.Count - 3;

		foreach (var tag in shown)
			TagsPanel.Children.Add(MakeTag(tag, tagStyle));

		if (extra > 0)
			TagsPanel.Children.Add(MakeTag($"+{extra}", tagStyle));
	}

	private static Border MakeTag(string text, Style borderStyle) => new()
	{
		Style = borderStyle,
		Child = new TextBlock
		{
			Text = text,
			FontSize = 11,
		},
	};

	private static string FormatNumber(long n) => n switch
	{
		>= 1_000_000 => $"{n / 1_000_000.0:F1}M",
		>= 1_000     => $"{n / 1_000.0:F0}K",
		_            => $"{n}",
	};

	private static string FormatRelativeDate(DateTimeOffset date)
	{
		var diff = DateTimeOffset.UtcNow - date;
		return diff.TotalDays switch
		{
			< 1   => "Today",
			< 2   => "Yesterday",
			< 7   => $"{(int)diff.TotalDays} days ago",
			< 14  => "1 week ago",
			< 30  => $"{(int)(diff.TotalDays / 7)} weeks ago",
			< 60  => "1 month ago",
			< 365 => $"{(int)(diff.TotalDays / 30)} months ago",
			_     => $"{(int)(diff.TotalDays / 365)} years ago",
		};
	}

	private void InstallButton_Click(object sender, RoutedEventArgs e)
	{
		// TODO: Open version picker / install flow
	}
}
