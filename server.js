const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Get local network IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Helper: Generate auto code if not provided (HS-YYYY-001)
function generateNextCode() {
  const year = new Date().getFullYear();
  const prefix = `HS-${year}-`;
  const row = db.prepare(`
    SELECT code FROM dossiers 
    WHERE code LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextNum = 1;
  if (row && row.code) {
    const parts = row.code.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// ================= API ENDPOINTS =================

// 1. Get statistics for dashboard
app.get('/api/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const total = db.prepare('SELECT COUNT(*) as count FROM dossiers').get().count;
    const choDo = db.prepare("SELECT COUNT(*) as count FROM dossiers WHERE status = 'CHO_DO'").get().count;
    const dangNoiNghiep = db.prepare("SELECT COUNT(*) as count FROM dossiers WHERE status = 'DANG_NOI_NGHIEP'").get().count;
    const choTra = db.prepare("SELECT COUNT(*) as count FROM dossiers WHERE status = 'CHO_TRA'").get().count;
    const daTra = db.prepare("SELECT COUNT(*) as count FROM dossiers WHERE status = 'DA_TRA'").get().count;
    const vuongMac = db.prepare("SELECT COUNT(*) as count FROM dossiers WHERE status = 'VUONG_MAC'").get().count;

    // Overdue: status not DA_TRA, and date_return < today
    const overdue = db.prepare(`
      SELECT COUNT(*) as count FROM dossiers 
      WHERE status != 'DA_TRA' AND date_return IS NOT NULL AND date_return < ?
    `).get(today).count;

    // Need survey today
    const todaySurvey = db.prepare(`
      SELECT COUNT(*) as count FROM dossiers 
      WHERE status = 'CHO_DO' AND date_survey = ?
    `).get(today).count;

    // Distinct surveyors and communes for filters
    const surveyors = db.prepare(`
      SELECT DISTINCT surveyor_name FROM dossiers 
      WHERE surveyor_name IS NOT NULL AND surveyor_name != '' 
      ORDER BY surveyor_name ASC
    `).all().map(r => r.surveyor_name);

    const communes = db.prepare(`
      SELECT DISTINCT commune FROM dossiers 
      WHERE commune IS NOT NULL AND commune != '' 
      ORDER BY commune ASC
    `).all().map(r => r.commune);

    res.json({
      total,
      choDo,
      dangNoiNghiep,
      choTra,
      daTra,
      vuongMac,
      overdue,
      todaySurvey,
      surveyors,
      communes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get list of dossiers with search & filters
app.get('/api/dossiers', (req, res) => {
  try {
    const { q, status, surveyor, commune, quick_filter, sort_by = 'id', order = 'DESC' } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let conditions = ['1=1'];
    let params = [];

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(`(
        code LIKE ? OR 
        customer_name LIKE ? OR 
        phone LIKE ? OR 
        commune LIKE ? OR 
        village LIKE ? OR 
        sheet_number LIKE ? OR 
        plot_number LIKE ? OR 
        surveyor_name LIKE ?
      )`);
      params.push(term, term, term, term, term, term, term, term);
    }

    if (status && status !== 'ALL') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (surveyor && surveyor.trim()) {
      conditions.push('surveyor_name = ?');
      params.push(surveyor.trim());
    }

    if (commune && commune.trim()) {
      conditions.push('commune = ?');
      params.push(commune.trim());
    }

    if (quick_filter === 'today_survey') {
      conditions.push("date_survey = ? AND status = 'CHO_DO'");
      params.push(today);
    } else if (quick_filter === 'overdue') {
      conditions.push("status != 'DA_TRA' AND date_return IS NOT NULL AND date_return < ?");
      params.push(today);
    } else if (quick_filter === 'due_soon') {
      const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
      conditions.push("status != 'DA_TRA' AND date_return >= ? AND date_return <= ?");
      params.push(today, in3Days);
    } else if (quick_filter === 'pending_noi_nghiep') {
      conditions.push("status = 'DANG_NOI_NGHIEP'");
    }

    const allowedSortCols = ['id', 'date_received', 'date_survey', 'date_return', 'code', 'customer_name'];
    const safeSortBy = allowedSortCols.includes(sort_by) ? sort_by : 'id';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT d.*, 
        (SELECT COUNT(*) FROM dossier_attachments a WHERE a.dossier_id = d.id) as attachment_count
      FROM dossiers d
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${safeSortBy} ${safeOrder}
    `;

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get single dossier with attachments
app.get('/api/dossiers/:id', (req, res) => {
  try {
    const dossier = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(req.params.id);
    if (!dossier) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });

    const attachments = db.prepare(`
      SELECT * FROM dossier_attachments 
      WHERE dossier_id = ? 
      ORDER BY id DESC
    `).all(req.params.id);

    res.json({ ...dossier, attachments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create new dossier
app.post('/api/dossiers', (req, res) => {
  try {
    let {
      code,
      customer_name,
      phone,
      commune,
      village,
      sheet_number,
      plot_number,
      area,
      land_type,
      survey_type,
      surveyor_name,
      date_received,
      date_survey,
      date_return,
      status = 'CHO_DO',
      notes
    } = req.body;

    if (!customer_name) {
      return res.status(400).json({ error: 'Tên chủ đất không được để trống' });
    }

    if (!code || !code.trim()) {
      code = generateNextCode();
    } else {
      code = code.trim();
    }

    if (!date_received) {
      date_received = new Date().toISOString().split('T')[0];
    }

    const stmt = db.prepare(`
      INSERT INTO dossiers (
        code, customer_name, phone, commune, village, sheet_number, plot_number,
        area, land_type, survey_type, surveyor_name,
        date_received, date_survey, date_return, status, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      code,
      customer_name.trim(),
      phone ? phone.trim() : null,
      commune ? commune.trim() : null,
      village ? village.trim() : null,
      sheet_number ? sheet_number.trim() : null,
      plot_number ? plot_number.trim() : null,
      area ? parseFloat(area) || 0 : null,
      land_type || 'ONT',
      survey_type || 'Trích lục địa chính',
      surveyor_name ? surveyor_name.trim() : null,
      date_received,
      date_survey || null,
      date_return || null,
      status,
      notes ? notes.trim() : null
    );

    const newDossier = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newDossier);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: dossiers.code')) {
      return res.status(400).json({ error: 'Mã hồ sơ này đã tồn tại trong hệ thống' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 5. Update dossier
app.put('/api/dossiers/:id', (req, res) => {
  try {
    const {
      code,
      customer_name,
      phone,
      commune,
      village,
      sheet_number,
      plot_number,
      area,
      land_type,
      survey_type,
      surveyor_name,
      date_received,
      date_survey,
      date_return,
      date_actual_survey,
      date_actual_return,
      status,
      notes
    } = req.body;

    const stmt = db.prepare(`
      UPDATE dossiers SET
        code = ?, customer_name = ?, phone = ?, commune = ?, village = ?,
        sheet_number = ?, plot_number = ?, area = ?, land_type = ?,
        survey_type = ?, surveyor_name = ?,
        date_received = ?, date_survey = ?, date_return = ?,
        date_actual_survey = ?, date_actual_return = ?,
        status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      code,
      customer_name,
      phone,
      commune,
      village,
      sheet_number,
      plot_number,
      area ? parseFloat(area) || 0 : null,
      land_type,
      survey_type,
      surveyor_name,
      date_received,
      date_survey,
      date_return,
      date_actual_survey,
      date_actual_return,
      status,
      notes,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Fast status update (1-touch on mobile)
app.patch('/api/dossiers/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const today = new Date().toISOString().split('T')[0];

    let updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    let params = [status];

    // If transitioned to DANG_NOI_NGHIEP, record actual survey date if not set
    if (status === 'DANG_NOI_NGHIEP') {
      updateFields.push('date_actual_survey = COALESCE(date_actual_survey, ?)');
      params.push(today);
    }
    // If transitioned to DA_TRA, record actual return date
    if (status === 'DA_TRA') {
      updateFields.push('date_actual_return = COALESCE(date_actual_return, ?)');
      params.push(today);
    }

    params.push(req.params.id);

    db.prepare(`UPDATE dossiers SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete dossier
app.delete('/api/dossiers/:id', (req, res) => {
  try {
    // Delete attached physical files first
    const files = db.prepare('SELECT filename FROM dossier_attachments WHERE dossier_id = ?').all(req.params.id);
    for (const f of files) {
      const filePath = path.join(uploadsDir, f.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.prepare('DELETE FROM dossier_attachments WHERE dossier_id = ?').run(req.params.id);
    db.prepare('DELETE FROM dossiers WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Đã xóa hồ sơ thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Upload attachments (Field photos / survey minutes / documents)
app.post('/api/dossiers/:id/attachments', upload.array('files', 10), (req, res) => {
  try {
    const dossierId = req.params.id;
    const attachmentType = req.body.attachment_type || 'photo_field';
    const caption = req.body.caption || '';

    const insertStmt = db.prepare(`
      INSERT INTO dossier_attachments (
        dossier_id, filename, original_name, mimetype, size, attachment_type, caption
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const inserted = [];
    for (const file of req.files) {
      const result = insertStmt.run(
        dossierId,
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        attachmentType,
        caption
      );
      inserted.push({
        id: result.lastInsertRowid,
        filename: file.filename,
        original_name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        attachment_type: attachmentType,
        caption
      });
    }

    res.json({ success: true, files: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete single attachment
app.delete('/api/attachments/:id', (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM dossier_attachments WHERE id = ?').get(req.params.id);
    if (file) {
      const filePath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.prepare('DELETE FROM dossier_attachments WHERE id = ?').run(req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Export Excel (.xlsx) formatted for Land Registration Office reports
app.get('/api/export-excel', async (req, res) => {
  try {
    const dossiers = db.prepare(`
      SELECT * FROM dossiers 
      ORDER BY date_received DESC, id DESC
    `).all();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Văn phòng Đăng ký Đất đai - Phòng Kỹ thuật Địa chính';
    workbook.lastModifiedBy = 'Cán bộ kỹ thuật';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Danh sách Hồ sơ Đo đạc', {
      views: [{ showGridLines: true }]
    });

    // Title & Office Header
    sheet.mergeCells('A1:L1');
    const headerRow1 = sheet.getCell('A1');
    headerRow1.value = 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI - PHÒNG KỸ THUẬT ĐỊA CHÍNH';
    headerRow1.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };
    headerRow1.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('A2:L2');
    const headerRow2 = sheet.getCell('A2');
    headerRow2.value = 'SỔ THEO DÕI VÀ QUẢN LÝ TIẾN ĐỘ HỒ SƠ ĐO ĐẠC ĐỊA CHÍNH';
    headerRow2.font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: 'FF0F172A' } };
    headerRow2.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('A3:L3');
    const headerRow3 = sheet.getCell('A3');
    headerRow3.value = `Thời điểm xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} | Tổng số: ${dossiers.length} hồ sơ`;
    headerRow3.font = { name: 'Times New Roman', size: 11, italic: true };
    headerRow3.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.addRow([]); // Blank line

    // Column Headers
    const headers = [
      'STT',
      'Mã hồ sơ',
      'Chủ sử dụng đất',
      'Số điện thoại',
      'Địa chỉ thửa đất',
      'Tờ BĐ',
      'Thửa đất',
      'Diện tích (m²)',
      'Loại hình đo',
      'Cán bộ phụ trách',
      'Ngày nhận',
      'Ngày đi đo',
      'Ngày hẹn trả',
      'Trạng thái',
      'Ghi chú'
    ];

    const rowHeader = sheet.addRow(headers);
    rowHeader.height = 28;
    rowHeader.eachCell((cell) => {
      cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' } // Deep Blue
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });

    const statusMap = {
      'CHO_DO': 'Chờ đi đo',
      'DANG_NOI_NGHIEP': 'Đang nội nghiệp',
      'CHO_TRA': 'Chờ trả kết quả',
      'DA_TRA': 'Đã trả hồ sơ',
      'VUONG_MAC': 'Vướng mắc'
    };

    // Data rows
    dossiers.forEach((item, index) => {
      const address = [item.village, item.commune].filter(Boolean).join(', ');
      const row = sheet.addRow([
        index + 1,
        item.code,
        item.customer_name,
        item.phone || '',
        address,
        item.sheet_number || '',
        item.plot_number || '',
        item.area || '',
        item.survey_type || '',
        item.surveyor_name || '',
        item.date_received || '',
        item.date_survey || '',
        item.date_return || '',
        statusMap[item.status] || item.status,
        item.notes || ''
      ]);

      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Times New Roman', size: 11 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
        // Alignments
        if ([1, 6, 7, 11, 12, 13].includes(colNum)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum === 8) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.0';
        } else if (colNum === 14) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          // Color badges for status
          if (item.status === 'DA_TRA') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light green
          } else if (item.status === 'VUONG_MAC') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light red
          } else if (item.status === 'CHO_DO') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light yellow
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Auto fit column widths
    sheet.columns = [
      { width: 6 },  // STT
      { width: 15 }, // Mã hồ sơ
      { width: 22 }, // Chủ sử dụng đất
      { width: 14 }, // Số điện thoại
      { width: 28 }, // Địa chỉ
      { width: 10 }, // Tờ
      { width: 10 }, // Thửa
      { width: 14 }, // Diện tích
      { width: 20 }, // Loại hình đo
      { width: 18 }, // Cán bộ
      { width: 14 }, // Ngày nhận
      { width: 14 }, // Ngày đi đo
      { width: 14 }, // Ngày hẹn trả
      { width: 18 }, // Trạng thái
      { width: 28 }  // Ghi chú
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=So_Theo_Doi_Ho_So_Do_Dac_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Network info & QR Code generation for mobile direct connection
app.get('/api/network-info', async (req, res) => {
  try {
    const ips = getLocalIpAddresses();
    const primaryIp = ips[0] || 'localhost';
    const mobileUrl = `http://${primaryIp}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      margin: 1,
      width: 250,
      color: { dark: '#0F172A', light: '#FFFFFF' }
    });

    res.json({
      port: PORT,
      primaryIp,
      ips,
      mobileUrl,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`=======================================================`);
  console.log(`HỆ THỐNG QUẢN LÝ HỒ SƠ ĐO ĐẠC ĐỊA CHÍNH ĐÃ KHỞI CHẠY`);
  console.log(`- Máy tính truy cập: http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`- Điện thoại quét/mở: http://${ips[0]}:${PORT}`);
  }
  console.log(`=======================================================`);
});
