import { db } from "../firebase";
import { collection, getDocs, where, query } from "firebase/firestore";
import { savePricing } from "./pricing";

export const seedExamplePricing = async () => {
  const usersCollection = collection(db, "teachers");
  const q = query(usersCollection, where("role", "==", "TEACHER"));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("No teachers found to seed pricing.");
    return;
  }

  const teachers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  for (const teacher of teachers) {
    // Seed Piano pricing
    await savePricing(teacher.id, "鋼琴", [
      { minLessons: 1, rate: 1000 },
      { minLessons: 6, rate: 900 },
      { minLessons: 11, rate: 850 }
    ]);
    
    // Seed Violin if teacher teaches it
    if ((teacher as any).instruments?.includes("小提琴")) {
      await savePricing(teacher.id, "小提琴", [
        { minLessons: 1, rate: 1200 },
        { minLessons: 10, rate: 1100 }
      ]);
    }
  }
};
