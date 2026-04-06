import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp, getDoc } from "firebase/firestore";

// LINE 頻道資訊 (由規劃書提供)
const LINE_CHANNEL_ACCESS_TOKEN = "0542c3a8ead7a9c57b44d245a55089c2";

export interface LineBinding {
  id?: string;
  studentId: string;
  studentName: string;
  lineUid: string;
  role: string; // 如：爸爸, 媽媽, 本人
  createdAt: any;
}

const bindingsCollection = collection(db, "line_bindings");

/**
 * 核心功能：驗證手機並執行綁定
 * 包含「兄弟姊妹聯動綁定」邏輯
 */
export const bindLineAccount = async (lineUid: string, mobile: string, role: string) => {
  // 1. 正規化手機號碼 (濾除空白、橫線、國碼)
  const cleanMobile = mobile.replace(/[\s-]/g, "").replace(/^\+886/, "0");
  
  // 2. 搜尋所有 parent_mobile 符合的學生
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("parentMobile", "==", cleanMobile));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error("手機號碼與系統紀錄不符，請聯絡櫃檯。");
  }

  const boundStudents: {id: string, name: string}[] = [];
  const now = Timestamp.now();

  // 3. 執行綁定 (對所有符合的學生進行一對多關聯)
  for (const studentDoc of snapshot.docs) {
    const studentData = studentDoc.data();
    const studentId = studentDoc.id;
    
    // 檢查是否已綁定過 (防止重複寫入)
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
 * 發送 LINE 訊息 (Flex Message 或 Text)
 */
export const sendLineMessage = async (lineUid: string, messages: any[]) => {
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
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
 * 產出【歡迎訊息】Flex Message
 */
export const createWelcomeFlex = (studentNames: string[]) => {
  return [
    {
      type: "flex",
      altText: "🎉 綁定成功！歡迎加入 Hepai Harmony",
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "Hepai Harmony",
              weight: "bold",
              color: "#4a4238",
              size: "xl",
              align: "center"
            }
          ],
          backgroundColor: "#ece4d9"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "🎉 綁定成功！",
              weight: "bold",
              size: "xl",
              color: "#c4a484"
            },
            {
              type: "text",
              text: `已啟用 ${studentNames.join("、")} 的專屬通知。未來的上課提醒與繳費資訊將發送至此。`,
              wrap: true,
              margin: "md",
              color: "#4a4238"
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
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: "📖 點閱新生須知",
                uri: "https://your-school-url.com/guide"
              }
            },
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: "☎️ 聯絡櫃檯專員",
                uri: "tel:0212345678"
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
 * 產出【上課提醒】訊息模板
 */
export const createReminderMessage = (studentName: string, date: string, lessons: any[]) => {
  let bodyText = `🔔 明日上課提醒\n明天是 ${studentName} 的上課日喔！\n📅 日期：${date}\n`;
  
  lessons.forEach((l, idx) => {
    bodyText += `\n[時段 ${idx + 1}]\n`;
    bodyText += `⏰ 時間：${l.startTime} ~ ${l.endTime}\n`;
    bodyText += `🎹 課程：${l.courseName}\n`;
    bodyText += `👩🏫 老師：${l.teacherName}\n`;
    bodyText += `🏫 教室：${l.classroomName}\n`;
  });

  bodyText += `\n💡 小叮嚀：若因故需請假，請盡早通知我們喔！`;
  
  return [{ type: "text", text: bodyText }];
};

/**
 * 每日提醒執行程序：撈取明天課表並發送推播
 */
export const runDailyLineReminders = async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];

  // 1. 撈取明日所有課程
  const lessonsRef = collection(db, "lessons");
  const q = query(lessonsRef, where("date", "==", dateStr));
  const snapshot = await getDocs(q);
  
  // 按照學生分組：一個學生發一則訊息
  const studentLessons: Record<string, {name: string, list: any[]}> = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!studentLessons[data.studentId]) {
      studentLessons[data.studentId] = { name: data.studentName, list: [] };
    }
    studentLessons[data.studentId].list.push(data);
  });

  // 2. 針對每個有課的學生，查找綁定的家長並發送
  for (const studentId in studentLessons) {
    const info = studentLessons[studentId];
    const bindings = await getStudentBindings(studentId);
    
    if (bindings.length > 0) {
      const msg = createReminderMessage(info.name, dateStr, info.list);
      for (const b of bindings) {
        await sendLineMessage(b.lineUid, msg);
      }
    }
  }
};

/**
 * 取得特定學生的所有綁定家長
 */
export const getStudentBindings = async (studentId: string) => {
  const q = query(bindingsCollection, where("studentId", "==", studentId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LineBinding));
};

/**
 * 解除綁定
 */
export const unbindLineAccount = async (bindingId: string) => {
  await deleteDoc(doc(db, "line_bindings", bindingId));
};
