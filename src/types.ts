export interface Reminder {
  id: string;
  title: string;
  description?: string;
  date: Date;
  frequency: 'yearly' | 'monthly' | 'once';
  chatId: number;
  category: 'task' | 'bill';
}

export interface ReminderStore {
  reminders: Reminder[];
}