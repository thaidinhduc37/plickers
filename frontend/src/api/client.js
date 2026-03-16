/**
 * src/api/client.js
 * API client hoàn chỉnh cho hệ thống Rung Chuông Vàng.
 * Bao gồm: HTTP requests, file upload, WebSocket manager.
 */

export const API_BASE = ""; // Dùng Vite proxy, không gọi thẳng backend
const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

class ApiClient {
  constructor() {
    this.token = localStorage.getItem("rcv_token") || null;
  }

  // ── Token ────────────────────────────────────────────────────────────────

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("rcv_token", token);
    } else {
      localStorage.removeItem("rcv_token");
    }
  }

  logout() {
    this.setToken(null);
  }

  isAuthenticated() {
    return !!this.token;
  }

  // ── Core request ─────────────────────────────────────────────────────────

  async request(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const url = `${API_BASE}${endpoint}`;
    const config = { ...options, headers };

    let response = await fetch(url, config);

    // On 401/403, clear token and redirect to login.
    // Exception: /api/auth/me — let checkAuth() / ProtectedRoute handle it via React Router
    // (avoids hard-redirect that wipes React state while scanner is running).
    if (
      (response.status === 401 || response.status === 403) &&
      endpoint !== "/api/auth/login" &&
      endpoint !== "/api/auth/me"
    ) {
      this.setToken(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return response;
    }

    return response;
  }

  /**
   * Public request — KHÔNG redirect khi 401/403.
   * Dùng cho /api/public/* để scan loop không bị gián đoạn khi token expire.
   * Vẫn gửi token nếu có (backend public endpoint bỏ qua token).
   */
  async publicRequest(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    // Gửi token nếu có — backend public endpoint sẽ bỏ qua hoặc dùng để auth
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    const url = `${API_BASE}${endpoint}`;
    return fetch(url, { ...options, headers });
  }

  async get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  // Upload file (không set Content-Type — browser tự set multipart boundary)
  async upload(endpoint, formData) {
    const headers = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    return fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });
  }

  // Parse JSON hoặc trả về null nếu lỗi
  async json(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  // Throw nếu response không ok, kèm message từ backend
  async assertOk(response) {
    if (!response.ok) {
      const body = await this.json(response);
      const msg = body?.detail || `HTTP ${response.status}`;
      throw new Error(msg);
    }
    return response;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  async login(username, password) {
    try {
      const res = await this.post("/api/auth/login", { username, password });
      if (res.ok) {
        const data = await res.json();
        this.setToken(data.access_token);
        return { ok: true };
      }
      const err = await this.json(res);
      return { ok: false, error: err?.detail || "Sai tài khoản hoặc mật khẩu" };
    } catch {
      return { ok: false, error: "Không thể kết nối máy chủ" };
    }
  }

  async changePassword(oldPassword, newPassword) {
    const res = await this.post("/api/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
    await this.assertOk(res);
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION BANKS (NGÂN HÀNG CÂU HỎI)
  // ═══════════════════════════════════════════════════════════════════════════

  async getBanks() {
    const res = await this.get("/api/banks");
    await this.assertOk(res);
    return res.json();
  }

  async getBank(bankId) {
    const res = await this.get(`/api/banks/${bankId}`);
    await this.assertOk(res);
    return res.json();
  }

  async createBank(title, description = "") {
    const res = await this.post("/api/banks", { title, description });
    await this.assertOk(res);
    return res.json();
  }

  async deleteBank(bankId) {
    const res = await this.delete(`/api/banks/${bankId}`);
    await this.assertOk(res);
    return res.json();
  }

  async updateBank(bankId, title, description = "") {
    const res = await this.patch(`/api/banks/${bankId}`, {
      title,
      description,
    });
    await this.assertOk(res);
    return res.json();
  }

  async addQuestionToBank(bankId, questionData) {
    const res = await this.post(`/api/banks/${bankId}/questions`, questionData);
    await this.assertOk(res);
    return res.json();
  }

  async bulkAddQuestionsToBank(bankId, questions) {
    const res = await this.post(
      `/api/banks/${bankId}/questions/bulk`,
      questions,
    );
    await this.assertOk(res);
    return res.json();
  }

  async updateQuestionInBank(bankId, questionId, qData) {
    const res = await this.patch(
      `/api/banks/${bankId}/questions/${questionId}`,
      qData,
    );
    await this.assertOk(res);
    return res.json();
  }

  async deleteQuestionFromBank(bankId, questionId) {
    const res = await this.delete(
      `/api/banks/${bankId}/questions/${questionId}`,
    );
    await this.assertOk(res);
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTESTS (CUỘC THI)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Lấy danh sách cuộc thi (summary, không có questions) */
  async getContests() {
    const res = await this.get("/api/contests");
    await this.assertOk(res);
    return res.json();
  }

  /** Lấy chi tiết 1 cuộc thi kèm questions */
  async getContest(contestId) {
    const res = await this.get(`/api/contests/${contestId}`);
    await this.assertOk(res);
    return res.json();
  }

  /** Tạo cuộc thi mới */
  async createContest(title, description = "", bank_id = null) {
    const res = await this.post("/api/contests", {
      title,
      description,
      bank_id,
    });
    await this.assertOk(res);
    return res.json();
  }

  /** Xoá cuộc thi */
  async deleteContest(contestId) {
    const res = await this.delete(`/api/contests/${contestId}`);
    await this.assertOk(res);
  }

  /** Cập nhật thông tin cuộc thi */
  async updateContest(
    contestId,
    title,
    description = "",
    bank_id = null,
    max_contestants = null,
  ) {
    const res = await this.patch(`/api/contests/${contestId}`, {
      title,
      description,
      bank_id,
      max_contestants,
    });
    await this.assertOk(res);
    return res.json();
  }

  /** Xoá thí sinh khỏi DB */
  async deleteContestant(contestantId) {
    const res = await this.delete(`/api/contestants/${contestantId}`);
    await this.assertOk(res);
  }

  /** Thêm 1 câu hỏi vào cuộc thi */
  async addQuestion(contestId, question) {
    const res = await this.post(
      `/api/contests/${contestId}/questions`,
      question,
    );
    await this.assertOk(res);
    return res.json();
  }

  /**
   * Thêm nhiều câu hỏi cùng lúc
   * BUG3 FIX: Endpoint đã chuyển từ /api/contests/{id}/questions/bulk
   *           sang /api/banks/{bank_id}/questions/bulk
   * questions: [{order_index, text, option_a, option_b, option_c, option_d, correct_answer, time_limit_sec}]
   */
  async bulkAddQuestions(bankId, questions) {
    const res = await this.post(
      `/api/banks/${bankId}/questions/bulk`,
      questions,
    );
    await this.assertOk(res);
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTESTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Import danh sách thí sinh từ text/CSV.
   * Định dạng text: mỗi dòng 1 tên
   * Định dạng CSV: name,card_id
   */
  async importContestants(contestId, text) {
    const formData = new FormData();
    const blob = new Blob([text], { type: "text/plain" });
    formData.append("file", blob, "contestants.txt");
    const res = await this.upload(
      `/api/contestants/import/${contestId}`,
      formData,
    );
    await this.assertOk(res);
    return res.json();
  }

  /**
   * Lấy danh sách thí sinh.
   * @param {number|null} contestId - lọc theo contest
   * @param {string|null} status    - 'active' | 'eliminated' | 'winner'
   */
  async getContestants(contestId = null, status = null) {
    const params = new URLSearchParams();
    if (contestId) params.set("contest_id", contestId);
    if (status) params.set("status", status);
    const query = params.toString() ? `?${params}` : "";
    const res = await this.get(`/api/contestants${query}`);
    await this.assertOk(res);
    return res.json();
  }

  /**
   * BTC override trạng thái thí sinh thủ công.
   * @param {number} contestantId
   * @param {'active'|'eliminated'|'winner'} status
   * @param {string} note - lý do (tuỳ chọn)
   */
  async updateContestantStatus(contestantId, status, note = "") {
    const res = await this.patch(`/api/contestants/${contestantId}/status`, {
      status,
      note,
    });
    await this.assertOk(res);
    return res.json();
  }

  async resetContestants(contestId) {
    const res = await this.post(`/api/contestants/reset/${contestId}`);
    await this.assertOk(res);
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Bắt đầu phiên thi mới cho contestId */
  async startSession(contestId) {
    const res = await this.post("/api/session/start", {
      contest_id: contestId,
    });
    await this.assertOk(res);
    return res.json();
  }

  /** Lấy thông tin phiên đang chạy */
  async getActiveSession() {
    const res = await this.get("/api/session/active");
    if (res.status === 404) return null;
    await this.assertOk(res);
    return res.json();
  }

  /** Hiện đáp án đúng + tự động loại người sai */
  async revealAnswer() {
    const res = await this.post("/api/session/reveal");
    await this.assertOk(res);
    return res.json();
  }

  /** Chuyển sang câu hỏi tiếp theo */
  async nextQuestion() {
    const res = await this.post("/api/session/next-question");
    await this.assertOk(res);
    return res.json();
  }

  /** Thi lại câu hỏi hiện tại */
  async retryQuestion() {
    const res = await this.post("/api/session/retry-question");
    await this.assertOk(res);
    return res.json();
  }

  /** Bỏ qua câu hỏi hiện tại */
  async skipQuestion() {
    const res = await this.post("/api/session/skip-question");
    await this.assertOk(res);
    return res.json();
  }

  /** Loại bỏ câu hiện tại, thay bằng câu dự phòng */
  async useBackupQuestion(questionId) {
    const res = await this.post("/api/session/use-backup", {
      question_id: questionId,
    });
    await this.assertOk(res);
    return res.json();
  }

  /** Kết thúc phiên thi */
  async endSession() {
    const res = await this.post("/api/session/end");
    await this.assertOk(res);
    return res.json();
  }

  /** Kết quả câu hỏi hiện tại (votes, scanned count...) */
  async getSessionResults(sessionId) {
    const res = await this.get(`/api/session/${sessionId}/results`);
    await this.assertOk(res);
    return res.json();
  }

  /** Tổng kết toàn bộ phiên thi */
  async getSessionSummary(sessionId) {
    const res = await this.get(`/api/session/${sessionId}/summary`);
    await this.assertOk(res);
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCAN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gửi kết quả quét thẻ lên server (CV Service hoặc mobile fallback).
   * @param {number} sessionId
   * @param {Array<{card_id: number, answer: string}>} results
   */
  async submitScan(sessionId, results) {
    // DIAGNOSTIC LOG: Log the submit scan request
    console.log(
      `[DIAGNOSTIC] submitScan called: sessionId=${sessionId}, resultsCount=${results.length}`
    );
    const res = await this.post("/api/scan/submit", {
      session_id: sessionId,
      results,
    });
    // Log response or error
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      console.error(
        `[DIAGNOSTIC] submitScan failed: status=${res.status}, ` +
        `body=${JSON.stringify(errorBody)}`
      );
    } else {
      console.log(`[DIAGNOSTIC] submitScan succeeded: ${res.status}`);
    }
    await this.assertOk(res);
    return res.json();
  }

  /** Tiến độ quét: bao nhiêu người đã có đáp án */
  async getScanStatus(sessionId) {
    const res = await this.get(`/api/scan/status/${sessionId}`);
    await this.assertOk(res);
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API (cho Mobile Scanner - Không auth)
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API (cho Scanner Page sau khi đăng nhập - Không cần token trong scan loop)
  // ═══════════════════════════════════════════════════════════════════════════

  async getPublicActiveSession() {
    try {
      const res = await this.publicRequest("/api/public/session/active", {
        method: "GET",
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async getPublicSession(sessionId) {
    try {
      const res = await this.publicRequest(`/api/public/session/${sessionId}`, {
        method: "GET",
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async getPublicContestants(sessionId) {
    try {
      const res = await this.publicRequest(
        `/api/public/session/${sessionId}/contestants`,
        { method: "GET" },
      );
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  }

  async submitPublicScan(sessionId, results) {
    try {
      const res = await this.publicRequest(
        `/api/public/session/${sessionId}/scan`,
        {
          method: "POST",
          body: JSON.stringify({ session_id: sessionId, results }),
        },
      );
      if (!res.ok) return {};
      return await res.json().catch(() => ({}));
    } catch {
      return {};
    }
  }

  async startScanning() {
    const res = await this.post("/api/session/start-scanning");
    await this.assertOk(res);
    return res.json();
  }

  async publicRevealAnswer(sessionId) {
    const res = await this.publicRequest(
      `/api/public/session/${sessionId}/reveal`,
      { method: "POST", body: JSON.stringify({}) },
    );
    if (!res.ok) {
      throw new Error(`Failed to reveal answer: ${res.status}`);
    }
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDS (PDF)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Tải PDF thẻ cho toàn bộ thí sinh trong contest */
  async downloadContestCards(contestId) {
    const url = `${API_BASE}/api/cards/generate/contest/${contestId}`;
    await this._downloadWithToken(url, `rcv-contest-${contestId}-cards.pdf`);
  }

  /** Tải PDF thẻ trắng (count thẻ, bắt đầu từ start_id) */
  async downloadBlankCards(count, startId = 1) {
    const url = `${API_BASE}/api/cards/generate/blank?count=${count}&start_id=${startId}`;
    await this._downloadWithToken(
      url,
      `rcv-blank-cards-${startId}-${startId + count - 1}.pdf`,
    );
  }

  async _downloadWithToken(url, filename) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Tải thất bại (${res.status}): ${text.slice(0, 200)}`);
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quản lý kết nối WebSocket tới server.
 * Tự động reconnect khi mất kết nối.
 *
 * Sử dụng:
 *   wsManager.connect(sessionId)
 *   wsManager.on('answer_received', (data) => { ... })
 *   wsManager.disconnect()
 *
 * Events từ server:
 *   session_started       — phiên thi bắt đầu
 *   question_changed      — câu hỏi mới
 *   answer_received       — có thẻ mới quét
 *   answer_revealed       — đáp án đúng được công bố
 *   contestants_eliminated— danh sách bị loại
 *   btc_override          — BTC đổi trạng thái thủ công
 *   session_ended         — kết thúc phiên
 *   connected             — xác nhận kết nối thành công
 *   pong                  — keepalive response
 */
class WebSocketManager {
  constructor() {
    this._ws = null;
    this._handlers = {}; // event -> [callback]
    this._sessionId = null;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._reconnectDelay = 2000;
    this._maxReconnectDelay = 30000;
    this._shouldConnect = false;
    this.connected = false;
  }

  /** Kết nối tới session WebSocket */
  connect(sessionId) {
    this._shouldConnect = true;
    this._sessionId = sessionId;
    this._reconnectDelay = 2000;
    this._doConnect();
  }

  _doConnect() {
    if (!this._shouldConnect) return;

    const url = `${WS_BASE}/ws/contest/${this._sessionId}`;
    // Keep a local reference so stale handlers from a replaced/closed WS are ignored.
    const ws = new WebSocket(url);
    this._ws = ws;

    ws.onopen = () => {
      if (this._ws !== ws) return; // stale — a newer connection already took over
      this.connected = true;
      this._reconnectDelay = 2000;
      this._emit("__connected", {});
      // Keepalive ping mỗi 25 giây
      this._pingTimer = setInterval(() => {
        if (this._ws?.readyState === WebSocket.OPEN) {
          this._ws.send("ping");
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      if (this._ws !== ws) return; // stale
      try {
        const { event: eventType, data } = JSON.parse(event.data);
        this._emit(eventType, data);
      } catch (e) {
        console.warn("WS parse error:", e);
      }
    };

    ws.onclose = () => {
      if (this._ws !== ws) return; // stale — don't emit __disconnected or schedule reconnect for old WS
      this.connected = false;
      this._emit("__disconnected", {});
      clearInterval(this._pingTimer);
      if (this._shouldConnect) {
        this._scheduleReconnect();
      }
    };

    ws.onerror = () => {
      if (this._ws !== ws) return; // stale
      ws.close();
    };
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      this._doConnect();
      // Exponential backoff
      this._reconnectDelay = Math.min(
        this._reconnectDelay * 1.5,
        this._maxReconnectDelay,
      );
    }, this._reconnectDelay);
  }

  /** Ngắt kết nối hoàn toàn (không reconnect) */
  disconnect() {
    this._shouldConnect = false;
    clearTimeout(this._reconnectTimer);
    clearInterval(this._pingTimer);
    this._ws?.close();
    this._ws = null;
    this.connected = false;
    this._sessionId = null;
  }

  /**
   * Đăng ký handler cho 1 event type.
   * Dùng '__connected' và '__disconnected' để theo dõi trạng thái kết nối.
   * @returns {Function} unsubscribe function
   */
  on(eventType, callback) {
    if (!this._handlers[eventType]) {
      this._handlers[eventType] = [];
    }
    this._handlers[eventType].push(callback);
    // Trả về hàm để huỷ đăng ký
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    if (!this._handlers[eventType]) return;
    this._handlers[eventType] = this._handlers[eventType].filter(
      (h) => h !== callback,
    );
  }

  /** Xoá tất cả handlers */
  offAll() {
    this._handlers = {};
  }

  _emit(eventType, data) {
    (this._handlers[eventType] || []).forEach((h) => {
      try {
        h(data);
      } catch (e) {
        console.error(`WS handler error [${eventType}]:`, e);
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS — Singleton instances dùng chung toàn app
// ═══════════════════════════════════════════════════════════════════════════════

export const api = new ApiClient();
export const wsManager = new WebSocketManager();
