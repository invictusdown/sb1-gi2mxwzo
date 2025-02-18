import { ReminderStore, Reminder } from './types';
import fs from 'fs/promises';
import path from 'path';

const STORE_FILE = 'reminders.json';

class Store {
  private data: ReminderStore = { reminders: [] };

  async load() {
    try {
      const content = await fs.readFile(STORE_FILE, 'utf-8');
      this.data = JSON.parse(content);
      // Convert stored date strings back to Date objects
      this.data.reminders = this.data.reminders.map(reminder => ({
        ...reminder,
        date: new Date(reminder.date)
      }));
    } catch (error) {
      // If file doesn't exist, use empty store
      this.data = { reminders: [] };
    }
  }

  async save() {
    await fs.writeFile(STORE_FILE, JSON.stringify(this.data, null, 2));
  }

  async addReminder(reminder: Reminder) {
    this.data.reminders.push(reminder);
    await this.save();
  }

  async removeReminder(id: string) {
    this.data.reminders = this.data.reminders.filter(r => r.id !== id);
    await this.save();
  }

  getReminders(): Reminder[] {
    return this.data.reminders;
  }

  getRemindersByChat(chatId: number): Reminder[] {
    return this.data.reminders.filter(r => r.chatId === chatId);
  }
}

export const store = new Store();