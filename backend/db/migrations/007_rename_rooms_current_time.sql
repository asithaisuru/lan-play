DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'rooms'
      AND column_name = 'current_time'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'rooms'
      AND column_name = 'current_position'
  ) THEN
    ALTER TABLE rooms RENAME COLUMN current_time TO current_position;
  END IF;
END $$;
