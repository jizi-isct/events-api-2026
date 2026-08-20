-- 屋台が何を出すか。src/models/project.ts の FoodStallProjectSchema と対応する。
-- 種別ごとの列なので、type = 'food-stall' 以外では持てないよう CHECK で縛る。
-- 未設定の企画があり得るので、food-stall でも NULL を許す。
ALTER TABLE projects ADD COLUMN offering TEXT
  CHECK (offering IS NULL OR type = 'food-stall');
