-- 企画を探すときの入り口になるカテゴリ。src/models/project.ts の
-- CategorySchema と対応する。未設定の企画があり得るので NULL を許す。
ALTER TABLE projects ADD COLUMN category TEXT
  CHECK (
    category IS NULL
    OR category IN (
      'hearty', 'street_food', 'sweets', 'performance',
      'play', 'cafe', 'laboratory', 'display'
    )
  );

CREATE INDEX idx_projects_category ON projects (category);
