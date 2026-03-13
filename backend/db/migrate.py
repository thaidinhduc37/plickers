"""
db/migrate.py — Migration thủ công để sửa schema:
  1. Drop UNIQUE index cũ trên contestants.card_id (global unique → per-contest unique)
  2. Thêm UNIQUE constraint (card_id, contest_id) nếu chưa có
  3. Thêm cascade delete cho FK của sessions và contestants
  4. Tạo bảng admins và seed admin user

Chạy: python -m db.migrate
"""
from app.core.database import engine
from app.core.config import settings
from app.models.models import AdminUser
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.services.auth_service import get_password_hash

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

            # Add is_backup column to questions table if not exists
            print("\n  Checking questions.is_backup column...")
            try:
                # Check if column exists
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM pragma_table_info('questions') WHERE name='is_backup'
                """)).scalar()
                if result == 0:
                    print("  Adding questions.is_backup column...")
                    conn.execute(text(
                        "ALTER TABLE questions ADD COLUMN is_backup BOOLEAN DEFAULT 0"
                    ))
                    conn.commit()
                    print("  [OK] Done")
                else:
                    print("  [OK] is_backup column already exists")
            except Exception as e:
                print(f"  Warning: {e}")

        print("\n[OK] Migration complete!")

        # Add question_overrides and used_backup_ids columns to sessions
        print("\n  Adding backup question columns to sessions...")
        with Session(engine) as db:
            from sqlalchemy import inspect
            inspector = inspect(engine)
            cols_sessions = [c["name"] for c in inspector.get_columns("sessions")]

            for col_name, col_sql in [
                ("question_overrides", "ALTER TABLE sessions ADD COLUMN question_overrides TEXT DEFAULT '{}'"),
                ("used_backup_ids", "ALTER TABLE sessions ADD COLUMN used_backup_ids TEXT DEFAULT '[]'"),
            ]:
                if col_name not in cols_sessions:
                    print(f"  Adding sessions.{col_name} column...")
                    try:
                        conn.execute(text(col_sql))
                        conn.commit()
                        print("  [OK] Done")
                    except Exception as e:
                        print(f"  Warning: {e}")
                else:
                    print(f"  [OK] sessions.{col_name} already exists")

        # Add correct_count column to contestants
        print("\n  Adding correct_count column to contestants...")
        with Session(engine) as db:
            from sqlalchemy import inspect
            inspector = inspect(engine)
            cols_conts = [c["name"] for c in inspector.get_columns("contestants")]
            if "correct_count" not in cols_conts:
                try:
                    conn.execute(text("ALTER TABLE contestants ADD COLUMN correct_count INTEGER DEFAULT 0"))
                    conn.commit()
                    print("  [OK] Done")
                except Exception as e:
                    print(f"  Warning: {e}")
            else:
                print("  [OK] correct_count already exists")

        # Add created_by columns to question_banks and contests
        print("\n  Adding created_by columns...")
        with Session(engine) as db:
            from app.models.models import QuestionBank, Contest
            from sqlalchemy import inspect
            
            inspector = inspect(engine)
            cols_banks = [c["name"] for c in inspector.get_columns("question_banks")]
            cols_contests = [c["name"] for c in inspector.get_columns("contests")]
            
            if "created_by" not in cols_banks:
                print("  Adding question_banks.created_by column...")
                try:
                    conn.execute(text(
                        "ALTER TABLE question_banks ADD COLUMN created_by VARCHAR(50) NULL"
                    ))
                    conn.commit()
                    print("  [OK] Done")
                except Exception as e:
                    print(f"  Warning: {e}")
            else:
                print("  [OK] question_banks.created_by already exists")
            
            if "created_by" not in cols_contests:
                print("  Adding contests.created_by column...")
                try:
                    conn.execute(text(
                        "ALTER TABLE contests ADD COLUMN created_by VARCHAR(50) NULL"
                    ))
                    conn.commit()
                    print("  [OK] Done")
                except Exception as e:
                    print(f"  Warning: {e}")
            else:
                print("  [OK] contests.created_by already exists")

        # Create admins table and seed admin user
        print("\n  Setting up admins table...")
        with Session(engine) as db:
            # Import models to ensure tables are created
            from app.models.models import Base
            Base.metadata.create_all(engine)
            
            # Check if admin exists
            admin = db.query(AdminUser).filter(AdminUser.username == settings.ADMIN_USERNAME).first()
            if not admin:
                print(f"  Creating admin user: {settings.ADMIN_USERNAME}")
                admin = AdminUser(
                    username=settings.ADMIN_USERNAME,
                    hashed_password=get_password_hash(settings.ADMIN_PASSWORD)
                )
                db.add(admin)
                db.commit()
                print("  [OK] Admin user created")
            else:
                print("  [OK] Admin user already exists")
        
        print("\n[OK] Auth setup complete!")


if __name__ == "__main__":
    run_migrations()
