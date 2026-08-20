-- 屋台が何を出すか。src/models/project.ts の FoodStallProjectSchema と対応する。
-- 種別ごとの列なので、is_tour と同じく type = 'food-stall' のときだけ NOT NULL に
-- なるよう CHECK で縛る。
ALTER TABLE projects ADD COLUMN offering TEXT
  CHECK ((type = 'food-stall') = (offering IS NOT NULL));
