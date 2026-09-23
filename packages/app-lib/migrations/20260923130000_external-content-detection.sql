ALTER TABLE settings
ADD COLUMN default_content_platform TEXT NOT NULL DEFAULT 'modrinth' CHECK (default_content_platform IN ('modrinth', 'curseforge'));

ALTER TABLE external_content_sources
ADD COLUMN author_id TEXT;

ALTER TABLE external_content_sources
ADD COLUMN detected INTEGER NOT NULL DEFAULT FALSE CHECK (detected IN (0, 1));

CREATE TABLE external_content_checks (
	sha1 TEXT NOT NULL,
	platform TEXT NOT NULL CHECK (platform IN ('curseforge')),
	checked_at INTEGER NOT NULL,
	PRIMARY KEY (sha1, platform)
);

CREATE TABLE curseforge_fingerprints (
	sha1 TEXT NOT NULL PRIMARY KEY,
	fingerprint INTEGER NOT NULL
);
