DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization'
      AND column_name = 'currency_type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization'
      AND column_name = 'credit_balance_currency_type'
  ) THEN
    ALTER TABLE "organization"
      RENAME COLUMN "currency_type" TO "credit_balance_currency_type";
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization'
      AND column_name = 'credit_balance_currency_type'
  ) THEN
    ALTER TABLE "organization"
      ADD COLUMN "credit_balance_currency_type" text DEFAULT 'INR' NOT NULL;
  END IF;
END $$;
