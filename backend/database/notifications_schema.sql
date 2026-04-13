-- Notifications table for FCM / in-app notification center
CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id BIGSERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_firebase_uid
  ON public.notifications (firebase_uid, is_read, created_at DESC);
