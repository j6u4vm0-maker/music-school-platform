import { NextRequest, NextResponse } from 'next/server';
import { runDailyLineReminders } from '@/lib/services/line';

/**
 * 每日晚間 8 點自動推播提醒 (排程入口)
 * 建議由 Vercel Cron 或外部排程工具調用
 * 安全驗證：檢查 Authorization Header 或特定 Secret
 */
export async function GET(request: NextRequest) {
  // 1. 安全驗證 (可選：由環境變數控制)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // 如果設定了 CRON_SECRET，則進行比對
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyLineReminders();
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error: any) {
    console.error('[API/Cron] Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}

// 支援 POST 方式 (某些排程工具預設使用 POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
