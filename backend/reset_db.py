from app.core.database import engine, Base
from app.models.models import *
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text('SET FOREIGN_KEY_CHECKS = 0;'))
    Base.metadata.drop_all(conn)
    conn.execute(text('SET FOREIGN_KEY_CHECKS = 1;'))

Base.metadata.create_all(bind=engine)
print("Database reset successfully.")
