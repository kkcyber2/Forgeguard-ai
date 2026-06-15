-- Hacker face liveness (replaces phone SMS clearance step)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS face_liveness_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS face_liveness_at timestamptz,
  ADD COLUMN IF NOT EXISTS face_liveness_pose_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.face_liveness_verified IS 'Multi-pose webcam liveness completed (hacker clearance)';
COMMENT ON COLUMN public.profiles.face_liveness_at IS 'Timestamp of last successful liveness submission';
COMMENT ON COLUMN public.profiles.face_liveness_pose_count IS 'Number of distinct pose frames sealed in last liveness run';
