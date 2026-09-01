-- 工大祭実行委員会の公式企画。種別固有の追加情報は持たない。
-- SQLite は既存の CHECK 制約を直接変更できないため、projects を作り直す。
-- 親テーブルの DROP による CASCADE から子のデータを退避し、作り直した後に戻す。
PRAGMA defer_foreign_keys = ON;

CREATE TABLE projects_new (
  id                TEXT    PRIMARY KEY,
  type              TEXT    NOT NULL,
  group_name        TEXT    NOT NULL,
  project_name      TEXT    NOT NULL,
  description       TEXT    NOT NULL,
  is_child_friendly INTEGER NOT NULL,
  is_recommended    INTEGER NOT NULL,
  is_tour           INTEGER,
  category          TEXT,
  offering          TEXT,

  CHECK (type IN ('food-stall', 'general', 'laboratory', 'stage', 'official')),
  CHECK (is_child_friendly IN (0, 1)),
  CHECK (is_recommended IN (0, 1)),
  CHECK (is_tour IS NULL OR is_tour IN (0, 1)),
  CHECK ((type = 'laboratory') = (is_tour IS NOT NULL)),
  CHECK (
    category IS NULL
    OR category IN (
      'hearty', 'street_food', 'sweets', 'performance',
      'play', 'cafe', 'laboratory', 'display'
    )
  ),
  CHECK (offering IS NULL OR type = 'food-stall')
);

INSERT INTO projects_new (
  id, type, group_name, project_name, description,
  is_child_friendly, is_recommended, is_tour, category, offering
)
SELECT
  id, type, group_name, project_name, description,
  is_child_friendly, is_recommended, is_tour, category, offering
FROM projects;

CREATE TABLE project_tags_backup AS SELECT * FROM project_tags;
CREATE TABLE project_occasions_backup AS SELECT * FROM project_occasions;
CREATE TABLE project_details_backup AS SELECT * FROM project_details;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

INSERT INTO project_tags SELECT * FROM project_tags_backup;
INSERT INTO project_occasions SELECT * FROM project_occasions_backup;
INSERT INTO project_details SELECT * FROM project_details_backup;

DROP TABLE project_tags_backup;
DROP TABLE project_occasions_backup;
DROP TABLE project_details_backup;

CREATE INDEX idx_projects_type ON projects (type);
CREATE INDEX idx_projects_category ON projects (category);

PRAGMA defer_foreign_keys = OFF;
