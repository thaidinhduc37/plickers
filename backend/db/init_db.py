"""
db/init_db.py — Khởi tạo database MySQL và seed dữ liệu mẫu.
Chạy:   python -m db.init_db
Hoặc được gọi tự động khi start server nếu DB trống.
"""
from app.core.database import engine, SessionLocal, Base
from app.models.models import Contest, Question, Contestant, ContestantStatus


def create_tables():
    """Tạo tất cả bảng nếu chưa tồn tại. An toàn để gọi nhiều lần."""
    Base.metadata.create_all(bind=engine)
    print("✓ Đã kiểm tra / tạo bảng database")


def seed_data(db):
    """Thêm dữ liệu mẫu nếu chưa có Contest nào."""
    if db.query(Contest).count() > 0:
        print("→ DB đã có dữ liệu, bỏ qua seed")
        return

    contest = Contest(
        title="Rung Chuông Vàng 2026",
        description="Cuộc thi kiến thức cho toàn thể cán bộ, chiến sĩ"
    )
    db.add(contest)
    db.flush()

    questions = [
        Question(contest_id=contest.id, order_index=1,
                 text="Ngày thành lập Công an nhân dân Việt Nam?",
                 option_a="19/08/1945", option_b="19/08/1946",
                 option_c="19/08/1947", option_d="19/08/1944",
                 correct_answer="A", time_limit_sec=30),
        Question(contest_id=contest.id, order_index=2,
                 text="Cấp bậc hàm cao nhất của Công an nhân dân là?",
                 option_a="Thượng tướng", option_b="Đại tướng",
                 option_c="Trung tướng",  option_d="Thiếu tướng",
                 correct_answer="B", time_limit_sec=30),
        Question(contest_id=contest.id, order_index=3,
                 text="Luật Công an nhân dân hiện hành có hiệu lực từ năm nào?",
                 option_a="2016", option_b="2018",
                 option_c="2019", option_d="2020",
                 correct_answer="B", time_limit_sec=30),
        Question(contest_id=contest.id, order_index=4,
                 text="Khẩu hiệu của Công an nhân dân Việt Nam?",
                 option_a="Vì nhân dân phục vụ", option_b="Vì Tổ quốc quyết tử",
                 option_c="Vì an ninh Tổ quốc",  option_d="Bảo vệ Tổ quốc",
                 correct_answer="A", time_limit_sec=30),
        Question(contest_id=contest.id, order_index=5,
                 text="Tấn công mạng nào sau đây thuộc dạng Social Engineering?",
                 option_a="SQL Injection", option_b="DDoS",
                 option_c="Phishing",      option_d="Buffer Overflow",
                 correct_answer="C", time_limit_sec=30),
    ]
    db.add_all(questions)

    # --- 100 thí sinh mẫu (thẻ #1 đến #100) ---
    for i in range(1, 101):
        name = f"Thí sinh số {i}"
        db.add(Contestant(name=name, card_id=i,
                          contest_id=contest.id, status=ContestantStatus.active))

    db.commit()
    print("✓ Seed: 1 cuộc thi · 5 câu hỏi · 100 thí sinh (thẻ #1–#100)")


def init_db():
    """Hàm chính — tạo bảng + seed. Gọi khi start server."""
    create_tables()
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


if __name__ == "__main__":
    print("🔔 Khởi tạo database Rung Chuông Vàng...")
    init_db()
    print("✓ Xong!")
