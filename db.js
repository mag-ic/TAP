const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// Query 'partners' table to test connection
supabase
  .from('partners')
  .select('*')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('Error connecting to database:', error.message)
    } else {
      console.log('Database connection successful! Data retrieved:', data)
    }
  })

module.exports = supabase
