"""
Script för att generera Argon2-hashade lösenord för seed data.
Kör detta script lokalt och använd outputen för att uppdatera databasen.
"""

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

# Initiera password hasher precis som i ditt system
password_hasher = PasswordHash([Argon2Hasher()])

# Användare och deras UUID:n
users = [
    {
        "user_id": "a1b2c3d4-1111-1111-1111-111111111111",
        "username": "anna_svensson",
        "email": "anna.svensson@email.se",
        "password": "password123",
    },
    {
        "user_id": "a1b2c3d4-2222-2222-2222-222222222222",
        "username": "erik_johansson",
        "email": "erik.johansson@email.se",
        "password": "password123",
    },
    {
        "user_id": "a1b2c3d4-3333-3333-3333-333333333333",
        "username": "maria_andersson",
        "email": "maria.andersson@email.se",
        "password": "password123",
    },
    {
        "user_id": "a1b2c3d4-4444-4444-4444-444444444444",
        "username": "lars_nilsson",
        "email": "lars.nilsson@email.se",
        "password": "password123",
    },
    {
        "user_id": "a1b2c3d4-5555-5555-5555-555555555555",
        "username": "karin_berg",
        "email": "karin.berg@email.se",
        "password": "password123",
    },
]

print("-- Genererade Argon2-hashade lösenord")
print("-- Kör dessa UPDATE-statements efter att du kört seed_data.sql\n")

for user in users:
    hashed = password_hasher.hash(user["password"])
    print(
        f"UPDATE users SET password = '{hashed}' WHERE user_id = '{user['user_id']}';"
    )
    print(f"-- Användare: {user['username']} (lösenord: {user['password']})\n")

print("\n-- ELLER använd dessa INSERT-statements istället för de i seed_data.sql:")
print(
    "\nINSERT INTO users (user_id, username, password, email, created_at, last_login) VALUES"
)

for i, user in enumerate(users):
    hashed = password_hasher.hash(user["password"])
    comma = "," if i < len(users) - 1 else ";"

    if i == 0:
        interval = "30 days"
        last_login = "1 day"
    elif i == 1:
        interval = "25 days"
        last_login = "2 hours"
    elif i == 2:
        interval = "20 days"
        last_login = "3 days"
    elif i == 3:
        interval = "15 days"
        last_login = "5 hours"
    else:
        interval = "10 days"
        last_login = "1 hour"

    print(
        f"  ('{user['user_id']}', '{user['username']}', '{hashed}', '{user['email']}', NOW() - INTERVAL '{interval}', NOW() - INTERVAL '{last_login}'){comma}"
    )
