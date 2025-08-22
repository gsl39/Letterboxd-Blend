require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!supabaseKey) {
  throw new Error('SUPABASE_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
