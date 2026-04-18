"use client";

// ============================================================
// db.ts — Legacy Service Layer (Now using Repositories)
// ============================================================

import { Student, Teacher, Classroom } from '../types/user';
import * as userRepo from '../repositories/userRepository';
import * as classroomRepo from '../repositories/classroomRepository';

// ── Users (Students & Teachers) ────────────────────────────────

export const addUser = async (user: Partial<Student | Teacher>) => {
  return await userRepo.addUserRecord(user);
};

export const getStudents = async (): Promise<Student[]> => {
  return await userRepo.fetchStudents();
};

export const getTeachers = async (): Promise<Teacher[]> => {
  return await userRepo.fetchTeachers();
};

export const updateUser = async (id: string, user: Partial<Student | Teacher>) => {
  await userRepo.updateUserRecord(id, user);
};

export const deleteUser = async (id: string) => {
  await userRepo.deleteUserRecord(id);
};

// ── Classrooms ────────────────────────────────────────────────

export const addClassroom = async (classroom: Classroom) => {
  return await classroomRepo.addClassroomRecord(classroom);
};

export const getClassrooms = async (): Promise<Classroom[]> => {
  return await classroomRepo.fetchClassrooms();
};

export const updateClassroom = async (id: string, classroom: Partial<Classroom>) => {
  await classroomRepo.updateClassroomRecord(id, classroom);
};

export const deleteClassroom = async (id: string) => {
  await classroomRepo.deleteClassroomRecord(id);
};
