-- New audience tables are queried via PostgREST from server functions.
-- Reload the API schema immediately so a deployed frontend never sees a stale relation cache.
NOTIFY pgrst, 'reload schema';
