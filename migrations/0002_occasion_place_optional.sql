-- place は src/models/occasion.ts で任意(v.optional)なのに place_id が NOT NULL
-- だったため、場所未定の occasion を登録できなかった。NULL を許すようにする。
-- SQLite は列の NOT NULL を外せないので、表を作り直して移し替える。

DROP INDEX idx_project_occasions_place;
DROP INDEX idx_project_occasions_start;

ALTER TABLE project_occasions RENAME TO project_occasions_old;

CREATE TABLE project_occasions (
  project_id   TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  place_id     TEXT,
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

INSERT INTO project_occasions (
  project_id, position, place_id,
  start_date, start_hour, start_minute,
  end_date, end_hour, end_minute
)
SELECT
  project_id, position, place_id,
  start_date, start_hour, start_minute,
  end_date, end_hour, end_minute
FROM project_occasions_old;

DROP TABLE project_occasions_old;

CREATE INDEX idx_project_occasions_place ON project_occasions (place_id);
CREATE INDEX idx_project_occasions_start
  ON project_occasions (start_date, start_hour, start_minute);
