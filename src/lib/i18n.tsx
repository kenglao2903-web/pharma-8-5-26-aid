import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "th";

const dict = {
  appName: { en: "PharmCalc Pro", th: "PharmCalc Pro" },
  tagline: {
    en: "Hospital Pharmacy Calculation Suite",
    th: "ชุดคำนวณสำหรับเภสัชกรโรงพยาบาล",
  },
  forPharmacistUse: {
    en: "For pharmacist use • Verify before dispense",
    th: "สำหรับเภสัชกร • ตรวจสอบก่อนจ่ายยา",
  },
  // tabs
  admixture: { en: "Admixture", th: "ผสมสารน้ำ" },
  infusionTime: { en: "Infusion (Critical)", th: "ยาวิกฤต" },
  fluidDuration: { en: "IV Fluid Duration", th: "เวลาให้สารน้ำ" },
  unitConvert: { en: "Unit Convert", th: "แปลงหน่วย" },
  pediatricLiquid: { en: "Pediatric Liquid", th: "ยาน้ำเด็ก" },
  eyeDrops: { en: "Eye Drops", th: "ยาหยอดตา" },
  // header / nav
  login: { en: "Login", th: "เข้าสู่ระบบ" },
  logout: { en: "Logout", th: "ออกจากระบบ" },
  register: { en: "Register", th: "สมัครสมาชิก" },
  admin: { en: "Admin", th: "ผู้ดูแลระบบ" },
  language: { en: "Language", th: "ภาษา" },
  // login
  employeeId: { en: "Employee ID (6 digits)", th: "รหัสพนักงาน (6 หลัก)" },
  displayName: { en: "Nickname / Real Name", th: "ชื่อเล่น / ชื่อจริง" },
  signIn: { en: "Sign In", th: "เข้าสู่ระบบ" },
  noAccount: { en: "Don't have an account?", th: "ยังไม่มีบัญชี?" },
  haveAccount: { en: "Already have an account?", th: "มีบัญชีแล้ว?" },
  registerNow: { en: "Register now", th: "สมัครสมาชิก" },
  signInNow: { en: "Sign in", th: "เข้าสู่ระบบ" },
  registrationSubmitted: {
    en: "Registration submitted. Awaiting admin approval.",
    th: "ส่งใบสมัครเรียบร้อย รอผู้ดูแลระบบอนุมัติ",
  },
  invalidId: { en: "Employee ID must be 6 digits.", th: "รหัสพนักงานต้องเป็นตัวเลข 6 หลัก" },
  notFound: { en: "Employee ID not found.", th: "ไม่พบรหัสพนักงานนี้" },
  pendingApproval: {
    en: "Your account is pending admin approval.",
    th: "บัญชีของคุณรอผู้ดูแลระบบอนุมัติ",
  },
  rejected: { en: "Your account was rejected.", th: "บัญชีถูกปฏิเสธ" },
  welcome: { en: "Welcome", th: "ยินดีต้อนรับ" },
  loginRequired: {
    en: "Please sign in to use the calculators.",
    th: "กรุณาเข้าสู่ระบบเพื่อใช้งานเครื่องคำนวณ",
  },
  // admin
  adminLogin: { en: "Admin Login", th: "เข้าสู่ระบบผู้ดูแล" },
  email: { en: "Email", th: "อีเมล" },
  password: { en: "Password", th: "รหัสผ่าน" },
  accessCode: { en: "Access Code", th: "รหัสเข้าถึง" },
  adminPanel: { en: "Admin Panel", th: "แผงควบคุมผู้ดูแล" },
  pendingMembers: { en: "Pending Members", th: "สมาชิกรออนุมัติ" },
  allMembers: { en: "All Members", th: "สมาชิกทั้งหมด" },
  activityLogs: { en: "Activity Logs", th: "บันทึกการใช้งาน" },
  approve: { en: "Approve", th: "อนุมัติ" },
  reject: { en: "Reject", th: "ปฏิเสธ" },
  status: { en: "Status", th: "สถานะ" },
  action: { en: "Action", th: "การกระทำ" },
  time: { en: "Time", th: "เวลา" },
  name: { en: "Name", th: "ชื่อ" },
  details: { en: "Details", th: "รายละเอียด" },
  noPending: { en: "No pending registrations.", th: "ไม่มีคำขอที่รออนุมัติ" },
  noLogs: { en: "No activity yet.", th: "ยังไม่มีบันทึก" },
  invalidCode: { en: "Invalid access code.", th: "รหัสเข้าถึงไม่ถูกต้อง" },
  back: { en: "Back", th: "กลับ" },
  // admixture
  admixtureType: { en: "Admixture Type", th: "ประเภทการผสม" },
  dextroseAdjust: { en: "Dextrose (Concentrate)", th: "Dextrose (เพิ่มความเข้มข้น)" },
  dextroseDilute: { en: "Dextrose (Dilute)", th: "Dextrose (เจือจาง)" },
  naclAdjust: { en: "NaCl (Dilute)", th: "NaCl (เจือจาง)" },
  dextroseModeHelp: {
    en: "Concentrate: add 50% Dextrose. Dilute: add Sterile Water / NSS to lower %.",
    th: "เพิ่มความเข้มข้น: เติม 50% Dextrose. เจือจาง: เติมน้ำกลั่น / NSS เพื่อลด %",
  },
  // messages
  messages: { en: "Messages", th: "ข้อความ" },
  inbox: { en: "Inbox", th: "กล่องข้อความ" },
  noMessages: { en: "No messages.", th: "ไม่มีข้อความ" },
  sendMessage: { en: "Send Message", th: "ส่งข้อความ" },
  recipient: { en: "Recipient", th: "ผู้รับ" },
  broadcastAll: { en: "Broadcast to all approved members", th: "ส่งถึงสมาชิกที่อนุมัติทั้งหมด" },
  subject: { en: "Subject (optional)", th: "หัวข้อ (ไม่บังคับ)" },
  messageBody: { en: "Message", th: "เนื้อความ" },
  send: { en: "Send", th: "ส่ง" },
  sent: { en: "Sent", th: "ส่งแล้ว" },
  to: { en: "To", th: "ถึง" },
  everyone: { en: "Everyone", th: "ทุกคน" },
  delete: { en: "Delete", th: "ลบ" },
  confirmDelete: { en: "Delete this?", th: "ลบรายการนี้?" },
  deleteMember: { en: "Delete member", th: "ลบสมาชิก" },
  clearAllLogs: { en: "Clear all logs", th: "ล้างบันทึกทั้งหมด" },
  selectAll: { en: "Select all", th: "เลือกทั้งหมด" },
  deleteSelected: { en: "Delete selected", th: "ลบที่เลือก" },
  newMessage: { en: "New", th: "ใหม่" },
  inputs: { en: "Inputs", th: "ข้อมูลนำเข้า" },
  targetPct: { en: "Target %", th: "ความเข้มข้นเป้าหมาย %" },
  targetVolume: { en: "Target Volume (ml)", th: "ปริมาตรเป้าหมาย (มล.)" },
  baseFluid: { en: "Base Fluid", th: "สารน้ำตั้งต้น" },
  baseVolume: { en: "Base Bag Volume (ml)", th: "ปริมาตรถุงตั้งต้น (มล.)" },
  additive: { en: "Additive", th: "สารเติมแต่ง" },
  diluent: { en: "Diluent", th: "สารเจือจาง" },
  result: { en: "Result", th: "ผลลัพธ์" },
  withdrawFromBag: { en: "Withdraw from bag", th: "ดูดสารน้ำออกจากถุง" },
  discardBeforeAdding: { en: "Discard, then add additive", th: "ทิ้งก่อน แล้วจึงเติมสารเข้าไป" },
  addAdditive: { en: "Add additive", th: "เติมสาร" },
  vialsRequired: { en: "Vials required", th: "จำนวนขวดที่ต้องใช้" },
  totalVials: { en: "Total vials", th: "จำนวนขวดรวม" },
  discard: { en: "discard", th: "ทิ้ง" },
  excess: { en: "excess", th: "ส่วนเกิน" },
  stepGuide: { en: "Step-by-Step Preparation", th: "ขั้นตอนการเตรียม" },
  step: { en: "Step", th: "ขั้นตอนที่" },
  invalidRange: { en: "Invalid range", th: "ค่าที่ใส่ไม่ถูกต้อง" },
  caution: { en: "Caution", th: "ข้อควรระวัง" },
  overBagWarn: {
    en: "Target volume exceeds standard 1000 ml bag. ",
    th: "ปริมาตรเกินถุงมาตรฐาน 1000 มล. ",
  },
  heavyAdditiveWarn: {
    en: "Additive volume >100 ml — consider higher-concentration source.",
    th: "ปริมาณสารเติมเกิน 100 มล. — พิจารณาใช้ความเข้มข้นสูงกว่า",
  },
  printSticker: { en: "Print Sticker", th: "พิมพ์สติกเกอร์" },
  // step phrases (admixture)
  stepPrepBag: { en: "Prepare 1 bag of", th: "เตรียมถุง" },
  stepWithdraw: { en: "Withdraw and discard", th: "ดูดสารน้ำออกและทิ้ง" },
  stepFromBag: { en: "from the bag first", th: "จากถุงก่อน" },
  stepDraw: { en: "Draw", th: "ดูด" },
  stepFromVials: { en: "from", th: "จาก" },
  stepVialOf: { en: "vial(s) of", th: "ขวดของ" },
  stepInject: {
    en: "Inject into the bag and invert gently 5–10 times to mix.",
    th: "ฉีดเข้าถุงสารน้ำ แล้วพลิกถุงเบา ๆ 5–10 ครั้งเพื่อผสม",
  },
  stepLabel: { en: "Label final concentration", th: "ติดฉลากความเข้มข้นสุดท้าย" },
  stepTimeInitials: { en: "time, and initials.", th: "เวลา และผู้เตรียม" },
  // infusion
  criticalDrug: { en: "Critical Drug", th: "ยาวิกฤต" },
  standardIV: { en: "Standard IV", th: "สารน้ำมาตรฐาน" },
  weightBased: { en: "Weight-based", th: "ตามน้ำหนัก" },
  drugPerVial: { en: "Drug per vial", th: "ยาต่อขวด" },
  unit: { en: "Unit", th: "หน่วย" },
  rateUnit: { en: "Rate unit", th: "หน่วยอัตรา" },
  vialsAmps: { en: "Vials / Amps", th: "ขวด / แอมป์" },
  baseVol: { en: "Base Vol (ml)", th: "ปริมาตรพื้นฐาน (มล.)" },
  weight: { en: "Weight (kg)", th: "น้ำหนัก (กก.)" },
  rate: { en: "Rate", th: "อัตรา" },
  totalVolume: { en: "Total Volume (ml)", th: "ปริมาตรทั้งหมด (มล.)" },
  dripRate: { en: "Drip Rate (ml/hr)", th: "อัตราหยด (มล./ชม.)" },
  startTime: { en: "Start Time", th: "เวลาเริ่ม" },
  schedule: { en: "Schedule", th: "ตารางเวลา" },
  totalDrug: { en: "Total drug in bag", th: "ยาทั้งหมดในถุง" },
  consumption: { en: "Consumption", th: "อัตราการใช้" },
  durationPerBag: { en: "Duration per bag", th: "ระยะเวลาต่อถุง" },
  timeline: { en: "Timeline", th: "ตารางเวลา" },
  setRunsOut: { en: "Bag", th: "ถุงที่" },
  runsOut: { en: "runs out", th: "หมดเมื่อ" },
  fluidRunsOutIn: { en: "Fluid runs out in", th: "สารน้ำจะหมดในอีก" },
  estimatedRunout: { en: "Estimated run-out", th: "เวลาหมดโดยประมาณ" },
  started: { en: "Started", th: "เริ่มเมื่อ" },
  highFlowRate: { en: "High flow rate", th: "อัตราการไหลสูง" },
  highRateWarn: {
    en: "Drip rate exceeds 250 ml/hr — verify order. ",
    th: "อัตราหยดเกิน 250 มล./ชม. — ตรวจสอบคำสั่ง ",
  },
  highDrugWarn: {
    en: "Drug rate is unusually high — double-check titration.",
    th: "อัตราการให้ยาสูงผิดปกติ — ตรวจสอบการปรับขนาด",
  },
  // fluid duration
  bagsCount: { en: "Number of bags", th: "จำนวนถุง" },
  bagSize: { en: "Volume per bag (ml)", th: "ปริมาตรต่อถุง (มล.)" },
  totalDuration: { en: "Total duration", th: "ระยะเวลารวม" },
  // unit convert
  fromUnit: { en: "From", th: "จาก" },
  toUnit: { en: "To", th: "เป็น" },
  amount: { en: "Amount", th: "จำนวน" },
  conversionResult: { en: "Result", th: "ผลลัพธ์" },
} as const;

type DictKey = keyof typeof dict;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("pharmcalc.lang");
    return saved === "th" || saved === "en" ? saved : "en";
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("pharmcalc.lang", l);
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (k: DictKey) => dict[k][lang];
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
};
