-- Map legacy webcam selfie rows to face liveness (idempotent)

UPDATE public.profiles
   SET face_liveness_verified = true,
       face_liveness_at = COALESCE(face_liveness_at, updated_at, now()),
       face_liveness_pose_count = GREATEST(face_liveness_pose_count, 1)
 WHERE identity_proofed = true
   AND face_liveness_verified = false;
