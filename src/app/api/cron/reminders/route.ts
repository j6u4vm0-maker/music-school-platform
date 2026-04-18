import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { runDailyLineReminders, runTeacherLineReminders } from '@/lib/services/line';

const SETTINGS_DOC_ID = 'line';
const SETTINGS_COLLECTION = 'system_settings';

/**
 * 智慧型 LINE 提醒自動化路徑
 * 該端點應由 GitHub Actions 或 Vercel Cron 每小時執行一次
 * 邏輯：檢查目前時間是否符合系統設定的發送時間，若是則觸發
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // 安全驗證：環境變數優先，若無則使用預設密鑰 (建議生產環境務必設定環境變數)
    const expectedSecret = process.env.CRON_SECRET || '7th-harmony-reminder-secret-2026';
    
    // 支援 Header 或 Query String 驗證
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (secret !== expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 讀取系統設定
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      return NextResponse.json({ error: 'LINE settings not found' }, { status: 404 });
    }

    const config = snap.data();
    if (!config.reminder_enabled) {
      return NextResponse.json({ message: 'Reminders are currently disabled in settings' });
    }

    // 2. 時間語法語檢查 (每小時執行一次 GitHub Action，API 會檢查目前小時是否與設定相符)
    const now = new Date();
    // 轉化為台北時間小時 (UTC+8)
    const taipeiHour = (now.getUTCHours() + 8) % 24;
    const configHour = parseInt(config.reminder_time?.split(':')[0] || '20');

    // 檢查有沒有強制執行參數 (force=true)
    const isForce = searchParams.get('force') === 'true';

    if (taipeiHour !== configHour && !isForce) {
      return NextResponse.json({ 
        message: 'Skip: Current hour does not match setting.',
        taipeiHour,
        configHour
      });
    }
    
    const results: any = { students: null, teachers: null };

    // --- 執行學員提醒 ---
    // 根據模式決定目標日期：DAY_BEFORE (明天) 或 SAME_DAY (今天)
    let studentTargetDate = new Date(now);
    if (config.reminder_mode === 'DAY_BEFORE') {
      studentTargetDate.setDate(studentTargetDate.getDate() + 1);
    }
    const studentDateStr = studentTargetDate.toLocaleDateString('en-CA');
    results.students = await runDailyLineReminders(studentDateStr);

    // --- 執行老師提醒 ---
    if (config.teacher_reminder_enabled) {
      // 老師通常需要當天的教學摘要 (或是跟學員同步模式)
      // 這邊預設老師端通知為「今天」的教學內容
      const teacherDateStr = now.toLocaleDateString('en-CA');
      results.teachers = await runTeacherLineReminders(teacherDateStr);
    }

    return NextResponse.json({ 
      success: true, 
      timestamp: now.toISOString(),
      mode: config.reminder_mode,
      results 
    });

  } catch (error: any) {
    console.error('[Cron API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
