# Supabase database CA

`supabase-ca.crt` is the public production CA, downloaded over HTTPS from the same URL used by Supabase Studio:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Source: https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

This is a public trust certificate, not a private key. PostgreSQL connections verify both certificate trust and hostname. `DATABASE_CA_FILE` can override it for a different deployment. Certificate verification is never disabled for hosted connections.
