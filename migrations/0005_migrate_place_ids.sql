-- 場所定義の変更に合わせて、既存の企画実施場所を新しい ID へ移行する。
-- ウッドデッキステージは通常のウッドデッキと区別し、専用 ID に改名する。
UPDATE project_occasions
SET place_id = 'east.wood-deck-stage'
WHERE place_id = 'east.wood-deck';

-- いちょう並木の模擬店枠 11〜16 は、Taki Plaza 裏の枠 1〜6 に対応する。
UPDATE project_occasions
SET place_id = 'east.fs-behind-taki-plaza.' ||
  (CAST(SUBSTR(place_id, LENGTH('east.fs-east-icho.') + 1) AS INTEGER) - 10)
WHERE place_id IN (
  'east.fs-east-icho.11',
  'east.fs-east-icho.12',
  'east.fs-east-icho.13',
  'east.fs-east-icho.14',
  'east.fs-east-icho.15',
  'east.fs-east-icho.16'
);
