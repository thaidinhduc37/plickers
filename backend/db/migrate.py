"""
db/migrate.py — Migration thủ công để sửa schema:
  1. Drop UNIQUE index cũ trên contestants.card_id (global unique → per-contest unique)
  2. Thêm UNIQUE constraint (card_id, contest_id) nếu chưa có
  3. Thêm cascade delete cho FK của sessions và contestants

Chạy: python -m db.migrate
"""
from app.core.database import engine
from sqlalchemy import text

def run_migrations():
    with engine.connect() as conn:
        db_url = str(engine.url)
        is_mysql = 'mysql' in db_url or 'pymysql' in db_url
        is_sqlite = 'sqlite' in db_url

        print(f"DB type: {'MySQL' if is_mysql else 'SQLite'}")

        if is_mysql:
            # Lấy tên DB hiện tại
            db_name = conn.execute(text("SELECT DATABASE()")).scalar()
            print(f"Database: {db_name}")

            # 1. Kiểm tra và xóa UNIQUE constraint cũ trên card_id (nếu có)
            idx_rows = conn.execute(text("""
                SELECT INDEX_NAME FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'contestants'
                AND COLUMN_NAME = 'card_id' AND NON_UNIQUE = 0
                AND INDEX_NAME != 'PRIMARY'
            """), {"db": db_name}).fetchall()

            for (idx_name,) in idx_rows:
                if idx_name != 'uq_card_contest':
                    print(f"  Dropping old UNIQUE index: {idx_name}")
                    try:
                        conn.execute(text(f"ALTER TABLE contestants DROP INDEX `{idx_name}`"))
                        conn.commit()
                    except Exception as e:
                        print(f"  Warning: {e}")

            # 2. Thêm composite UNIQUE nếu chưa có
            existing = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'contestants'
                AND CONSTRAINT_NAME = 'uq_card_contest'
            """), {"db": db_name}).scalar()

            if existing == 0:
                print("  Adding UNIQUE(card_id, contest_id)...")
                try:
                    conn.execute(text(
                        "ALTER TABLE contestants ADD CONSTRAINT uq_card_contest UNIQUE (card_id, contest_id)"
                    ))
                    conn.commit()
                    print("  ✓ Done")
                except Exception as e:
                    print(f"  Warning: {e}")
            else:
                print("  ✓ uq_card_contest already exists")

            # 3. Fix FK cascade cho sessions.contest_id
            # MySQL cần drop và recreate FK để đổi ON DELETE behavior
            fk_rows = conn.execute(text("""
                SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'sessions'
                AND REFERENCED_TABLE_NAME = 'contests'
            """), {"db": db_name}).fetchall()

            for (fk_name,) in fk_rows:
                print(f"  Updating FK {fk_name} on sessions → CASCADE...")
                try:
                    conn.execute(text(f"ALTER TABLE sessions DROP FOREIGN KEY `{fk_name}`"))
                    conn.execute(text(
                        "ALTER TABLE sessions ADD CONSTRAINT fk_sessions_contest "
                        "FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE"
                    ))
                    conn.commit()
                    print("  ✓ Done")
                except Exception as e:
                    print(f"  Warning: {e}")

            # 4. Fix FK cascade cho contestants.contest_id
            fk_rows2 = conn.execute(text("""
                SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'contestants'
                AND REFERENCED_TABLE_NAME = 'contests'
            """), {"db": db_name}).fetchall()

            for (fk_name,) in fk_rows2:
                print(f"  Updating FK {fk_name} on contestants → CASCADE...")
                try:
                    conn.execute(text(f"ALTER TABLE contestants DROP FOREIGN KEY `{fk_name}`"))
                    conn.execute(text(
                        "ALTER TABLE contestants ADD CONSTRAINT fk_contestants_contest "
                        "FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE"
                    ))
                    conn.commit()
                    print("  ✓ Done")
                except Exception as e:
                    print(f"  Warning: {e}")

        elif is_sqlite:
            print("SQLite: CASCADE is handled at application level via SQLAlchemy relationships.")
            print("SQLite does NOT support DROP INDEX syntax via ALTER TABLE.")
            print("Schema changes will apply on next DB recreation.")

        print("\n✅ Migration complete!")


if __name__ == "__main__":
    run_migrations()
