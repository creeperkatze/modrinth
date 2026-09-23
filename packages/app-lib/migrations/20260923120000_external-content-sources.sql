CREATE TABLE external_content_sources (
	sha1 TEXT NOT NULL PRIMARY KEY,
	platform TEXT NOT NULL CHECK (platform IN ('curseforge')),
	project_id TEXT NOT NULL,
	file_id TEXT NOT NULL,
	project_slug TEXT,
	project_title TEXT NOT NULL,
	project_icon_url TEXT,
	project_url TEXT,
	author_name TEXT,
	author_url TEXT,
	file_display_name TEXT,
	file_date TEXT,
	updated_at INTEGER NOT NULL
);
