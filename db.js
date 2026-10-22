const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Enable WAL mode for concurrent performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS dossiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT,
    commune TEXT,
    village TEXT,
    sheet_number TEXT,
    plot_number TEXT,
    area REAL,
    land_type TEXT DEFAULT 'ONT',
    survey_type TEXT DEFAULT 'Trích lục địa chính',
    surveyor_name TEXT,
    date_received TEXT NOT NULL,
    date_survey TEXT,
    date_return TEXT,
    date_actual_survey TEXT,
    date_actual_return TEXT,
    status TEXT DEFAULT 'CHO_DO',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dossier_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dossier_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    attachment_type TEXT DEFAULT 'photo_field',
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_dossiers_code ON dossiers(code);
  CREATE INDEX IF NOT EXISTS idx_dossiers_status ON dossiers(status);
  CREATE INDEX IF NOT EXISTS idx_dossiers_dates ON dossiers(date_received, date_survey, date_return);
`);

// Insert initial sample data if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM dossiers').get().count;
if (count === 0) {
  const insertStmt = db.prepare(`
    INSERT INTO dossiers (
      code, customer_name, phone, commune, village, sheet_number, plot_number, 
      area, land_type, survey_type, surveyor_name, 
      date_received, date_survey, date_return, status, notes
    ) VALUES (
      @code, @customer_name, @phone, @commune, @village, @sheet_number, @plot_number, 
      @area, @land_type, @survey_type, @surveyor_name, 
      @date_received, @date_survey, @date_return, @status, @notes
    )
  `);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const next3Days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const past2Days = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  const next7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const sampleDossiers = [
    {
      code: 'HS-2026-001',
      customer_name: 'Nguyễn Văn An',
      phone: '0912345678',
      commune: 'Xã Tân Triều',
      village: 'Thôn Triều Khúc',
      sheet_number: '12',
      plot_number: '45',
      area: 120.5,
      land_type: 'ONT',
      survey_type: 'Phân lô tách thửa',
      surveyor_name: 'Lê Văn Cường',
      date_received: past2Days,
      date_survey: today,
      date_return: next7Days,
      status: 'CHO_DO',
      notes: 'Khách yêu cầu đo buổi sáng, ranh mốc rõ ràng'
    },
    {
      code: 'HS-2026-002',
      customer_name: 'Trần Thị Mai',
      phone: '0988776655',
      commune: 'Phường Vạn Phúc',
      village: 'Tổ dân phố 3',
      sheet_number: '08',
      plot_number: '112',
      area: 85.0,
      land_type: 'ODT',
      survey_type: 'Trích lục địa chính',
      surveyor_name: 'Phạm Minh Đức',
      date_received: past2Days,
      date_survey: past2Days,
      date_return: next3Days,
      status: 'DANG_NOI_NGHIEP',
      notes: 'Đã đo xong hiện trường, đang biên tập bản đồ kỹ thuật'
    },
    {
      code: 'HS-2026-003',
      customer_name: 'Vũ Đình Tuấn',
      phone: '0903123456',
      commune: 'Xã Thanh Liệt',
      village: 'Thôn Văn',
      sheet_number: '21',
      plot_number: '78',
      area: 250.0,
      land_type: 'CLN',
      survey_type: 'Cấp mới GCN',
      surveyor_name: 'Lê Văn Cường',
      date_received: past2Days,
      date_survey: tomorrow,
      date_return: next7Days,
      status: 'CHO_DO',
      notes: 'Thửa giáp mương thoát nước công cộng'
    },
    {
      code: 'HS-2026-004',
      customer_name: 'Hoàng Văn Bảy',
      phone: '0977112233',
      commune: 'Xã Tả Thanh Oai',
      village: 'Đội 2',
      sheet_number: '05',
      plot_number: '33',
      area: 310.2,
      land_type: 'ONT + CLN',
      survey_type: 'Chỉnh lý biến động',
      surveyor_name: 'Hoàng Trọng Nghĩa',
      date_received: past2Days,
      date_survey: past2Days,
      date_return: today,
      status: 'CHO_TRA',
      notes: 'Bản đồ kỹ thuật đã ký duyệt lãnh đạo phòng'
    }
  ];

  for (const item of sampleDossiers) {
    insertStmt.run(item);
  }
}

module.exports = db;
