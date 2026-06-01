-- Raw identity capture artifact (image path + OCR text from vision step)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_raw_ocr_data jsonb;

COMMENT ON COLUMN public.profiles.identity_raw_ocr_data IS
  'Raw capture artifact: { image_path, raw_ocr_text, mime_type, captured_at }';
