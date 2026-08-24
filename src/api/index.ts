/**
 * ประตูเดียวที่ UI ใช้คุยกับข้อมูล
 *
 * เลือกใช้ Supabase ถ้าตั้งค่าไว้ครบ ไม่งั้นตกไปโหมดออฟไลน์อัตโนมัติ
 * ทั้งสองโหมดหน้าตาเหมือนกันหมด — UI ไม่ต้องรู้ว่ากำลังใช้โหมดไหน
 *
 * ⛔ Phaser ห้าม import ไฟล์นี้ (ดูกฎในสถาปัตยกรรม docs/01-tech-stack.md §2)
 *    เกมส่ง event ออกมา → React เป็นคนคุยกับ backend → ส่งผลกลับเข้าเกม
 */
import { hasBackend } from '@/lib/supabase';
import { localApi } from './local';
import { remoteApi } from './remote';
import type {
  AnswerResult,
  FinishRunResult,
  LeaderboardRow,
  PublicQuestion,
  QuestionRequest,
  Session,
  StartRunResult,
} from '@/types/game';

export const isOffline = !hasBackend;

export const api = {
  /** joinCode ใช้เฉพาะโหมดออนไลน์; โหมดออฟไลน์เอาไปแสดงเป็นชื่อห้องเฉยๆ */
  async login(nickname: string, joinCode: string): Promise<Session> {
    return isOffline
      ? localApi.login(nickname, joinCode || null)
      : remoteApi.login(nickname, joinCode);
  },

  async restoreSession(): Promise<Session | null> {
    return isOffline ? localApi.restoreSession() : remoteApi.restoreSession();
  },

  async startRun(): Promise<StartRunResult> {
    return isOffline ? localApi.startRun() : remoteApi.startRun();
  },

  async nextQuestion(runId: string, req: QuestionRequest): Promise<PublicQuestion | null> {
    return isOffline ? localApi.nextQuestion(runId, req) : remoteApi.nextQuestion(runId, req);
  },

  async answerQuestion(
    runId: string,
    questionId: string,
    choiceId: string | null,
    timeMs: number,
  ): Promise<AnswerResult> {
    return isOffline
      ? localApi.answerQuestion(runId, questionId, choiceId, timeMs)
      : remoteApi.answerQuestion(runId, questionId, choiceId, timeMs);
  },

  async finishRun(
    runId: string,
    distanceM: number,
    heartsLeft: number,
    endReason: string,
    session: Session | null,
  ): Promise<FinishRunResult> {
    return isOffline
      ? localApi.finishRun(runId, distanceM, heartsLeft, endReason, session)
      : remoteApi.finishRun(runId, distanceM, heartsLeft, endReason);
  },

  async leaderboard(limit = 20, classId?: string | null): Promise<LeaderboardRow[]> {
    return isOffline ? localApi.leaderboard(limit) : remoteApi.leaderboard(limit, classId);
  },

  async getTeacherClasses(): Promise<import('@/types/game').TeacherClass[]> {
    return isOffline ? localApi.getTeacherClasses() : remoteApi.getTeacherClasses();
  },

  async createClass(
    name: string,
    joinCode: string,
    levelSeed?: number | null,
    musicUrl?: string | null,
  ): Promise<import('@/types/game').TeacherClass> {
    return isOffline
      ? localApi.createClass(name, joinCode, levelSeed, musicUrl)
      : remoteApi.createClass(name, joinCode, levelSeed, musicUrl);
  },

  async updateClass(
    classId: string,
    isOpen: boolean,
    levelSeed?: number | null,
    musicUrl?: string | null,
  ): Promise<import('@/types/game').TeacherClass> {
    return isOffline
      ? localApi.updateClass(classId, isOpen, levelSeed, musicUrl)
      : remoteApi.updateClass(classId, isOpen, levelSeed, musicUrl);
  },

  async getStudentProgress(classId?: string | null): Promise<import('@/types/game').StudentProgress[]> {
    return isOffline
      ? localApi.getStudentProgress(classId)
      : remoteApi.getStudentProgress(classId);
  },

  async getQuestionStats(): Promise<import('@/types/game').QuestionStat[]> {
    return isOffline ? localApi.getQuestionStats() : remoteApi.getQuestionStats();
  },
};

