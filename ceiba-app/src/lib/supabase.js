import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qatfoxmarddsocnwycgy.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTUyNDIsImV4cCI6MjA5ODczMTI0Mn0.7kRWYrRHT0zFgFD24SDF3nHwOS0kz_v-DYvME3lP6Uk';

export const supabase = createClient(supabaseUrl, supabaseKey);
