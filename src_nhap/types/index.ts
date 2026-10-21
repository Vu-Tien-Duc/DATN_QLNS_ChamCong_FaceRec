export type LeadStatus = 'New Lead' | 'Contacted' | 'Interested' | 'Trial class' | 'Qualified Lead' | 'Converted' | 'Lost';
export type LeadSource = 'Website' | 'Facebook Ads' | 'TikTok' | 'Landing page' | 'Hotline' | 'Offline event' | 'Referral';
export type LeadTemperature = 'Hot' | 'Warm' | 'Cold';

export interface Source {
  id: string;
  name: string;
  icon?: string;
  active: boolean;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  temperature: LeadTemperature;
  courseInterest: string;
  assignedTo: string;
  referrer?: string;
  createdAt: string;
  lastFollowUp?: string;
  
  // Detailed fields
  school?: string;
  birthYear?: string;
  needs?: string;
  studyYear?: string;
  major?: string;
  attitude?: string;
  currentStatus?: string;
  goal?: string;
  competence?: string;
  priceReaction?: string;
  learningMechanism?: 'Online' | 'Offline' | 'Hybrid';
  preliminaryAssessment?: string;
  testAppointmentTime?: string;
  teacherNotes?: string;
}

export interface Student {
  id: string;
  name: string;
  birthDate?: string;
  gender?: 'Male' | 'Female' | 'Other';
  idCard?: string;
  address?: string;
  email: string;
  phone: string;
  referrer?: string;
  
  // Parent Info
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  
  // Academic Info
  school?: string;
  studyYear?: string;
  level?: string;
  entranceTestResult?: string;
  
  status: 'Active' | 'Completed' | 'Dropped';
  createdAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  classId: string;
  className: string;
  tuitionFee: number;
  discount: number;
  finalFee: number;
  enrollmentDate: string;
  status: 'Pending' | 'Confirmed' | 'Cancelled';
}

export interface Invoice {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  courseName: string;
  totalAmount: number;
  discount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  createdAt: string;
}

export interface Receipt {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Card';
  recordedBy: string;
  note?: string;
}

export interface Course {
  id: string;
  name: string;
  price: number;
  duration: string;
  teacherId: string;
}

export interface Teacher {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  activeClasses: number;
}

export type TimeSlot = 'Morning' | 'Afternoon' | 'Evening';

export interface TeachingSchedule {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  slot: TimeSlot;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
}

export interface Program {
  id: string;
  name: string;
  description?: string;
}

export interface Class {
  id: string;
  code: string;
  programId: string;
  programName: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  startDate: string;
  endDate?: string;
  totalSessions: number;
  studentIds: string[];
  weeklySchedule: {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
  }[];
  status: 'Upcoming' | 'Active' | 'Completed';
}

export interface ClassSession {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  slot: TimeSlot;
  sessionNumber: number;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  note?: string;
  updatedAt: string;
}

export interface TuitionStatus {
  studentId: string;
  studentName: string;
  courseName: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  dueDate?: string;
}

export interface Transaction {
  id: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  date: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Card';
  description: string;
  referenceId?: string; // e.g., StudentId or StaffId
  referenceName?: string;
  recordedBy: string;
}

export type ActivityType = 'Call' | 'Meeting' | 'Zalo' | 'Email' | 'Note';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: ActivityType;
  content: string;
  timestamp: string;
  recordedBy: string;
}

export interface PlacementTest {
  id: string;
  leadId: string;
  score: number;
  level: string;
  recommendedCourse: string;
  comments: string;
  date: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  joinDate: string;
  idCard?: string;
  birthDate?: string;
  address?: string;
  bankAccount?: string;
  bankName?: string;
  cvUrl?: string;
  avatarUrl?: string;
  documents?: {
    name: string;
    url: string;
    type: string;
  }[];
}
