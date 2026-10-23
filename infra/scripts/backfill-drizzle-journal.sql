INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'f24b49c2fb85bc9f43aa6ee39c8daef33438368924b516cdbce4a392613b6cbf', 1792792599677
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'f24b49c2fb85bc9f43aa6ee39c8daef33438368924b516cdbce4a392613b6cbf'
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'ae9ae23014fab550477c4808bfe931ed31fb1bac63affe50f3ece9ebf616154e', 1792793167320
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'ae9ae23014fab550477c4808bfe931ed31fb1bac63affe50f3ece9ebf616154e'
);
