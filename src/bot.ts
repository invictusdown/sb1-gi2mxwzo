import TelegramBot from 'node-telegram-bot-api';
import schedule from 'node-schedule';
import { format, addMonths, addYears } from 'date-fns';
import dotenv from 'dotenv';
import { store } from './store';
import { Reminder } from './types';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

let bot: TelegramBot;

try {
  bot = new TelegramBot(token, { polling: true });
  console.log('✅ Successfully connected to Telegram');
} catch (error) {
  console.error('❌ Error connecting to Telegram:', error);
  process.exit(1);
}

// Initialize store
try {
  await store.load();
  console.log('✅ Successfully loaded reminder store');
} catch (error) {
  console.error('❌ Error loading reminder store:', error);
  process.exit(1);
}

// Schedule all existing reminders
function scheduleReminder(reminder: Reminder) {
  schedule.scheduleJob(reminder.date, async () => {
    try {
      const message = `🔔 Reminder: ${reminder.title}\n${reminder.description || ''}`;
      await bot.sendMessage(reminder.chatId, message);

      // Schedule next occurrence based on frequency
      if (reminder.frequency === 'monthly') {
        const nextDate = addMonths(reminder.date, 1);
        reminder.date = nextDate;
        await store.save();
        scheduleReminder(reminder);
      } else if (reminder.frequency === 'yearly') {
        const nextDate = addYears(reminder.date, 1);
        reminder.date = nextDate;
        await store.save();
        scheduleReminder(reminder);
      } else {
        // Remove one-time reminders after they're done
        await store.removeReminder(reminder.id);
      }
    } catch (error) {
      console.error('❌ Error sending reminder:', error);
    }
  });
}

// Schedule all existing reminders on startup
store.getReminders().forEach(scheduleReminder);

// Command handlers
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, 
      'Welcome to the Reminder Bot! 🤖\n\n' +
      'Commands:\n' +
      '/add_reminder - Add a new reminder\n' +
      '/list_reminders - List all your reminders\n' +
      '/help - Show this help message'
    );
  } catch (error) {
    console.error('❌ Error handling /start command:', error);
  }
});

bot.onText(/\/add_reminder/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, 
      'Please send your reminder in the following format:\n\n' +
      'Title | Description | Date (YYYY-MM-DD) | Frequency (yearly/monthly/once) | Category (task/bill)\n\n' +
      'Example:\n' +
      'Pay Rent | Monthly rent payment | 2024-04-01 | monthly | bill'
    );
  } catch (error) {
    console.error('❌ Error handling /add_reminder command:', error);
  }
});

bot.onText(/\/list_reminders/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const reminders = store.getRemindersByChat(chatId);
    
    if (reminders.length === 0) {
      await bot.sendMessage(chatId, 'You have no reminders set.');
      return;
    }

    const message = reminders.map(r => 
      `📅 ${r.title}\n` +
      `   Description: ${r.description || 'N/A'}\n` +
      `   Date: ${format(r.date, 'yyyy-MM-dd')}\n` +
      `   Frequency: ${r.frequency}\n` +
      `   Category: ${r.category}\n`
    ).join('\n');

    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('❌ Error handling /list_reminders command:', error);
  }
});

// Handle reminder creation
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const parts = msg.text.split('|').map(p => p.trim());

  if (parts.length === 5) {
    try {
      const [title, description, dateStr, frequency, category] = parts;
      const date = new Date(dateStr);

      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }

      if (!['yearly', 'monthly', 'once'].includes(frequency)) {
        throw new Error('Invalid frequency');
      }

      if (!['task', 'bill'].includes(category)) {
        throw new Error('Invalid category');
      }

      const reminder: Reminder = {
        id: uuidv4(),
        title,
        description,
        date,
        frequency: frequency as 'yearly' | 'monthly' | 'once',
        chatId,
        category: category as 'task' | 'bill'
      };

      await store.addReminder(reminder);
      scheduleReminder(reminder);

      await bot.sendMessage(chatId, 
        '✅ Reminder set successfully!\n\n' +
        `Title: ${title}\n` +
        `Date: ${format(date, 'yyyy-MM-dd')}\n` +
        `Frequency: ${frequency}`
      );
    } catch (error) {
      await bot.sendMessage(chatId, 
        '❌ Error creating reminder. Please check the format and try again.\n' +
        'Use /add_reminder to see the correct format.'
      );
      console.error('❌ Error creating reminder:', error);
    }
  }
});

// Error handling for polling errors
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
  if (error.message.includes('ETELEGRAM: 404')) {
    console.error('❌ Invalid bot token. Please check your TELEGRAM_BOT_TOKEN in .env file');
    process.exit(1);
  }
});

console.log('🤖 Telegram Reminder Bot is running...');