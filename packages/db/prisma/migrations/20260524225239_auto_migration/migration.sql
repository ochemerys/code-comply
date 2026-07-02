-- Rename legacy snake_case report signing columns (environments that applied the initial migration draft)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE "reports" RENAME COLUMN "signed_at" TO "signedAt";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'signature_image'
  ) THEN
    ALTER TABLE "reports" RENAME COLUMN "signature_image" TO "signatureImage";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'signed_by_user_id'
  ) THEN
    ALTER TABLE "reports" RENAME COLUMN "signed_by_user_id" TO "signedByUserId";
  END IF;
END $$;
