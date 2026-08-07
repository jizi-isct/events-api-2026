-- 企画ごとの追加情報。行が無い状態と、空の詳細情報({})を区別できるよう、
-- optional な列だけでも project_id を主キーとする一行を持つ。
CREATE TABLE project_details (
  project_id      TEXT PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
  additional_info TEXT,
  -- メニューは入れ子の集約で、項目単位に検索しないため JSON として保持する。
  -- 具体的な構造は読み出し時に ProjectDetailsSchema で検証する。
  menu             TEXT,

  CHECK (menu IS NULL OR json_valid(menu))
);
