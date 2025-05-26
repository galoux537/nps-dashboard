export interface User {
  id: string;
  name: string;
  role: 'agent' | 'manager' | 'supervisor';
}

export interface NPSData {
  id: string;
  score: number;
  feedback: string;
  userId: string;
  createdAt: string;
} 