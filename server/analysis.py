from dotenv import load_dotenv
import os
from supabase import create_client, Client
import pandas as pd

# Absolute path to your .env file
dotenv_path = '/Users/guilhermelima/CompSci/letterboxd-blend/.env'
load_dotenv(dotenv_path=dotenv_path)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
print("URL:", url)
print("KEY:", key)

supabase: Client = create_client(url, key)

# Example: Query a view or joined table
data = supabase.table('user_films_with_films').select('*').execute()
df = pd.DataFrame(data.data)
print(df.head())
