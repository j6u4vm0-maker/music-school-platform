import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp, getDoc } from "firebase/firestore";

const SETTINGS_DOC_ID = 'line';
const SETTINGS_COLLECTION = 'system_settings';

export interface LineBinding {
  id?: string;
  studentId: string;
  studentName: string;
  lineUid: string;
  role: string; // 角色：媽媽, 爸爸, 學生本人, 家長, 其他
  createdAt: any;
}

const bindingsCollection = collection(db, "line_bindings");

/** 
 * Server-side Cache for LINE Config 
 */
interface LineConfig {
  channelSecret: string;
  channelAccessToken: string;
  liffId: string;
}

let lineCache: { data: LineConfig; expires: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** 取得 LINE 動態金鑰 (帶有快取機制) */
export const getLineConfig = async (): Promise<LineConfig | null> => {
  const now = Date.now();
  
  if (lineCache && now < lineCache.expires) {
    return lineCache.data;
  }

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return null;

    const data = snap.data();
    const config: LineConfig = {
      channelSecret: data.line_channel_secret || '',
      channelAccessToken: data.line_channel_access_token || '',
      liffId: data.liff_id || '',
    };

    lineCache = { data: config, expires: now + CACHE_TTL };
    return config;
  } catch (error) {
    console.error('[LineService] Error fetching config:', error);
    return null;
  }
};

/** 清除快取 */
export const clearLineCache = () => {
  lineCache = null;
};

/**
 * 核心功能：執行 LINE 帳號綁定
 */
export const bindLineAccount = async (lineUid: string, mobile: string, role: string) => {
  // 1. 格式化手機號碼
  const cleanMobile = mobile.replace(/[\s-]/g, "").replace(/^\+886/, "0");
  
  // 2. 查詢該母機號碼對應的學生
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("parentMobile", "==", cleanMobile));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error("找不到該手機號碼對應的學生資料，請聯繫行政老師核對資訊。");
  }

  const boundStudents: {id: string, name: string}[] = [];
  const now = Timestamp.now();

  // 3. 建立綁定關係
  for (const studentDoc of snapshot.docs) {
    const studentData = studentDoc.data();
    const studentId = studentDoc.id;
    
    const checkQ = query(bindingsCollection, 
      where("lineUid", "==", lineUid), 
      where("studentId", "==", studentId)
    );
    const checkSnap = await getDocs(checkQ);
    
    if (checkSnap.empty) {
      await addDoc(bindingsCollection, {
        studentId,
        studentName: studentData.name,
        lineUid,
        role,
        createdAt: now
      });
      boundStudents.push({ id: studentId, name: studentData.name });
    }
  }

  return boundStudents;
};

/**
 * 發送 LINE 訊息 (使用動態金鑰)
 */
export const sendLineMessage = async (lineUid: string, messages: any[]) => {
  const config = await getLineConfig();
  if (!config?.channelAccessToken) {
    console.error('[LineService] Access Token not configured.');
    return null;
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.channelAccessToken}`
      },
      body: JSON.stringify({
        to: lineUid,
        messages: messages
      })
    });
    return await response.json();
  } catch (error) {
    console.error("LINE API 發送失敗:", error);
    return null;
  }
};

/**
 * 執行多人精準推播 (Multicast)
 * LINE 官方限制一次最多 500 人，超過需分批發送
 */
export const sendLineMulticastMessage = async (lineUids: string[], messages: any[]) => {
  const config = await getLineConfig();
  if (!config?.channelAccessToken) {
    console.error('[LineService] Access Token not configured.');
    return null;
  }

  // 1. 去重並過濾空白
  const uniqueUids = Array.from(new Set(lineUids.filter(id => !!id)));
  if (uniqueUids.length === 0) return { success: true, count: 0 };

  // 2. 分批處理 (每 500 人一組)
  const CHUNK_SIZE = 500;
  const results = [];

  for (let i = 0; i < uniqueUids.length; i += CHUNK_SIZE) {
    const chunk = uniqueUids.slice(i, i + CHUNK_SIZE);
    
    try {
      const response = await fetch("https://api.line.me/v2/bot/message/multicast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.channelAccessToken}`
        },
        body: JSON.stringify({
          to: chunk,
          messages: messages
        })
      });
      const data = await response.json();
      results.push(data);
    } catch (error) {
      console.error(`[LineService] Multicast batch ${i} failed:`, error);
    }
  }

  return { success: true, count: uniqueUids.length, results };
};

/** 相容性別名 */
export const sendLinePushMessage = sendLineMessage;

/**
 * 建立歡迎 Flex Message
 */
export const createWelcomeFlex = (studentNames: string[]) => {
  return [
    {
      type: "flex",
      altText: "🎉 歡迎加入！綁定成功",
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "🎉 歡迎加入！綁定成功",
              weight: "bold",
              color: "#ffffff",
              size: "xl",
              align: "center"
            }
          ],
          backgroundColor: "#c4a484"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "Hepai Harmony 已成功連結您的帳號",
              weight: "bold",
              size: "md",
              color: "#4a4238"
            },
            {
              type: "text",
              text: `即日起，您可以透過此官方帳號接收 ${studentNames.join("、")} 的課程異動通知與每日排時提醒。`,
              wrap: true,
              margin: "md",
              color: "#4a4238",
              size: "sm"
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#4a4238",
              height: "sm",
              action: {
                type: "uri",
                label: "📱 查看電子布告欄",
                uri: "https://your-school-url.com/bulletin"
              }
            }
          ],
          flex: 0
        }
      }
    }
  ];
};

/**
 * 建立課前提醒訊息
 */
export const createReminderMessage = (studentName: string, date: string, lessons: any[]) => {
  const formattedDate = new Date(date).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
  
  let bodyText = `🔔 明日上課提醒\n\n${studentName} 您好，提醒您明天有課程預約：\n📅 日期：${formattedDate}\n`;
  
  lessons.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((l, idx) => {
    bodyText += `\n[課程 ${idx + 1}]\n`;
    bodyText += `⏰ 時間：${l.startTime} ~ ${l.endTime}\n`;
    bodyText += `🎨 課程：${l.courseName}\n`;
    bodyText += `👩‍🏫 老師：${l.teacherName}\n`;
    bodyText += `📍 教室：${l.classroomName}\n`;
  });

  bodyText += `\n✨ 請準時出席，若需請假或調課請提前告知。期待明天見到您！`;
  
  return [{ type: "text", text: bodyText }];
};

/**
 * 建立通用推播 Flex Message 卡片
 */
export const createBroadcastFlex = (title: string, desc: string, imageUrl?: string, actionUrl?: string) => {
  const bubble: any = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "0px",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: title,
              weight: "bold",
              size: "xl",
              color: "#ffffff",
              wrap: true
            }
          ],
          backgroundColor: "#4a4238",
          paddingAll: "20px"
        },
        {
          type: "box",
          layout: "vertical",
          paddingAll: "20px",
          contents: [
            {
              type: "text",
              text: desc,
              size: "md",
              color: "#4a4238",
              wrap: true,
              lineSpacing: "5px"
            }
          ]
        }
      ]
    }
  };

  // 如果有圖片，插入到 body 的最上方 (或作為 hero)
  if (imageUrl) {
    bubble.hero = {
      type: "image",
      url: imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    };
  }

  // 如果有連結按鈕，加入 footer
  if (actionUrl) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#c4a484",
          height: "sm",
          action: {
            type: "uri",
            label: "立即查看詳情",
            uri: actionUrl
          }
        }
      ],
      paddingAll: "20px"
    };
  }

  return [
    {
      type: "flex",
      altText: `📢 重要通知：${title}`,
      contents: bubble
    }
  ];
};

/**
 * 每日提醒自動化邏輯
 */
export const runDailyLineReminders = async () => {
  console.log('[Cron] Starting daily LINE reminders...');
  
  // 1. 計算明天日期 (台北時間)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toLocaleDateString('en-CA'); // YYYY-MM-DD
  
  console.log(`[Cron] Target Date: ${dateStr}`);

  // 2. 獲取明天所有課程
  const lessonsRef = collection(db, "lessons");
  const q = query(lessonsRef, where("date", "==", dateStr));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log('[Cron] No lessons found for tomorrow.');
    return { success: true, message: 'No lessons tomorrow' };
  }

  // 3. 過濾並分組 (排除請假 & 僅限課程)
  const studentLessons: Record<string, {name: string, list: any[]}> = {};
  let count = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // 排除：不是課程(租借)、已請假、已取消
    if (data.type !== 'LESSON') return;
    if (data.status === 'LEAVE' || data.status === 'CANCELLED') return;
    
    if (!studentLessons[data.studentId]) {
      studentLessons[data.studentId] = { name: data.studentName, list: [] };
    }
    studentLessons[data.studentId].list.push(data);
    count++;
  });

  console.log(`[Cron] Found ${count} lessons for ${Object.keys(studentLessons).length} students.`);

  // 4. 發送推播
  let sentCount = 0;
  for (const studentId in studentLessons) {
    const info = studentLessons[studentId];
    const bindings = await getStudentBindings(studentId);
    
    if (bindings.length > 0) {
      const msg = createReminderMessage(info.name, dateStr, info.list);
      // 一個學員可能綁定多個 LINE 帳號 (例如爸、媽)
      for (const b of bindings) {
        try {
          const res = await sendLineMessage(b.lineUid, msg);
          if (res) sentCount++;
        } catch (err) {
          console.error(`[Cron] Failed to send to ${b.lineUid}:`, err);
        }
      }
    }
  }

  console.log(`[Cron] Finished. Total messages sent: ${sentCount}`);
  return { success: true, sentCount };
};

/**
 * 取得特定學員的所有綁定帳號
 */
export const getStudentBindings = async (studentId: string) => {
  const q = query(bindingsCollection, where("studentId", "==", studentId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LineBinding));
};

/**
 * 解除 LINE 綁定
 */
export const unbindLineAccount = async (bindingId: string) => {
  await deleteDoc(doc(db, "line_bindings", bindingId));
};
