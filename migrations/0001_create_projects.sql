-- Migration number: 0001 	 2026-08-04T08:52:54.275Z

-- 企画の共通情報と、type で判別される種別ごとの情報を持つ。
-- 種別ごとの列(is_tour)は該当する type のときだけ NOT NULL になるよう CHECK で縛る。
CREATE TABLE projects (
  id                TEXT    PRIMARY KEY,
  type              TEXT    NOT NULL,
  group_name        TEXT    NOT NULL,
  project_name      TEXT    NOT NULL,
  description       TEXT    NOT NULL,
  is_child_friendly INTEGER NOT NULL,
  is_recommended    INTEGER NOT NULL,
  -- type = 'laboratory' のときのみ有効(研究室公開ツアーの有無)
  is_tour           INTEGER,

  CHECK (type IN ('food-stall', 'general', 'laboratory', 'stage')),
  CHECK (is_child_friendly IN (0, 1)),
  CHECK (is_recommended IN (0, 1)),
  CHECK (is_tour IS NULL OR is_tour IN (0, 1)),
  CHECK ((type = 'laboratory') = (is_tour IS NOT NULL))
);

CREATE INDEX idx_projects_type ON projects (type);

-- 企画のタグ。type = 'general' の GeneralTag と type = 'food-stall' の
-- FoodStallTag の両方をこの一つの表で持つ。FoodStallTag は tag / tag2 の
-- 二段構造で、'drink' だけ tag2 を持たない。
-- position は配列としての順序を保つためのもの。
CREATE TABLE project_tags (
  project_id TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  tag        TEXT    NOT NULL,
  tag2       TEXT,

  PRIMARY KEY (project_id, position),
  CHECK (position >= 0),
  -- tag2 IS NOT NULL を明示しているのは、tag2 が NULL のとき `tag2 IN (...)` が
  -- NULL となり、SQLite が CHECK 違反とみなさず素通ししてしまうため。
  CHECK (
    (tag = 'main' AND tag2 IS NOT NULL
      AND tag2 IN ('rice', 'noodle_flour', 'skewer_grill', 'snack', 'soup', 'world'))
    OR (tag = 'sweet' AND tag2 IS NOT NULL
      AND tag2 IN ('japanese', 'western', 'cold', 'snack', 'drink', 'world'))
    OR (tag = 'drink' AND tag2 IS NULL)
    OR (tag IN ('experience', 'display', 'performance', 'food', 'lecture')
      AND tag2 IS NULL)
  )
);

CREATE INDEX idx_project_tags_tag ON project_tags (tag);

-- 企画がいつどこで行われるか(Occasion)。一企画が複数持つ。
-- place_id は src/models/place.ts の PlaceId(例: "south.s3.s3-206")。
-- 場所の定義はコード側に持っているため、DB 上の外部キーにはしていない。
-- date は開催日(1 日目 / 2 日目)。
CREATE TABLE project_occasions (
  project_id   TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  place_id     TEXT    NOT NULL,
  start_date   INTEGER NOT NULL,
  start_hour   INTEGER NOT NULL,
  start_minute INTEGER NOT NULL,
  end_date     INTEGER NOT NULL,
  end_hour     INTEGER NOT NULL,
  end_minute   INTEGER NOT NULL,

  PRIMARY KEY (project_id, position),
  CHECK (position >= 0),
  CHECK (start_date IN (1, 2) AND end_date IN (1, 2)),
  CHECK (start_hour BETWEEN 0 AND 23 AND end_hour BETWEEN 0 AND 23),
  CHECK (start_minute BETWEEN 0 AND 59 AND end_minute BETWEEN 0 AND 59),
  -- 終了は開始以降
  CHECK (
    (end_date * 1440 + end_hour * 60 + end_minute)
      >= (start_date * 1440 + start_hour * 60 + start_minute)
  )
);

CREATE INDEX idx_project_occasions_place ON project_occasions (place_id);
CREATE INDEX idx_project_occasions_start
  ON project_occasions (start_date, start_hour, start_minute);
