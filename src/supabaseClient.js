import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjrbpmtpktxmleomrtwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcmJwbXRwa3R4bWxlb21ydHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyOTE0MzgsImV4cCI6MjA2Njg2NzQzOH0.K8bVHHzU0IeM_26PK91B0sbBAJlA-FZBYzqC019f5OM';
export const supabase = createClient(supabaseUrl, supabaseKey);
