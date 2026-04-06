"use client";

// ============================================================
// pricing.ts — Firestore: pricing (teacher+instrument combos)
// ============================================================

import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

export interface PriceTier {
  minLessons: number;
  rate: number;
}

export interface TeacherInstrumentPricing {
  teacherId: string;
  instrument: string;
  payoutRate?: number;
  tiers: PriceTier[];
}

const pricingCol = collection(db, 'pricing');

const pricingId = (teacherId: string, instrument: string) =>
  `${teacherId}_${instrument.replace(/\s+/g, '_')}`;

export const getPricing = async (
  teacherId: string,
  instrument: string,
): Promise<TeacherInstrumentPricing | null> => {
  const snap = await getDoc(doc(db, 'pricing', pricingId(teacherId, instrument)));
  if (!snap.exists()) return null;
  return snap.data() as TeacherInstrumentPricing;
};

export const savePricing = async (
  teacherId: string,
  instrument: string,
  tiers: PriceTier[],
  payoutRate: number = 0.6,
) => {
  const sorted = [...tiers].sort((a, b) => a.minLessons - b.minLessons);
  await setDoc(doc(db, 'pricing', pricingId(teacherId, instrument)), {
    teacherId,
    instrument,
    payoutRate,
    tiers: sorted,
  });
};

export const calculatePackagePrice = async (
  pricing: TeacherInstrumentPricing,
  lessonCount: number,
): Promise<number> => {
  if (!pricing.tiers || pricing.tiers.length === 0) return 0;
  let applicableRate = pricing.tiers[0].rate;
  for (const tier of pricing.tiers) {
    if (lessonCount >= tier.minLessons) applicableRate = tier.rate;
    else break;
  }
  return applicableRate * lessonCount;
};

export const getTeacherPricingList = async (
  teacherId: string,
): Promise<TeacherInstrumentPricing[]> => {
  const snap = await getDocs(pricingCol);
  return snap.docs
    .filter(d => (d.data() as any).teacherId === teacherId)
    .map(d => d.data() as TeacherInstrumentPricing);
};
