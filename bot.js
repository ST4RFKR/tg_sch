// Импорт необходимых библиотек
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
// Токен вашего бота
const token = process.env.TOKEN; // Замените на ваш токен
const bot = new TelegramBot(token, { polling: true });

// Данные и состояния
let scheduleData = [];
let filter = 'all'; // 'all', 'extra', 'js', 'main'
let visibleSchedule = 1;
let lastMessageId; // Хранит ID последнего сообщения с расписанием

// Функция для получения данных с API Google Calendar
async function getData() {
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/classroom102613341857294235333%40group.calendar.google.com/events?key=AIzaSyB-JSBKuhkxr0ZaMf-ZXbho0YM13O-GwbY&timeMin=2024-10-07T00%3A00%3A00%2B03%3A00&timeMax=2024-10-31T00%3A00%3A00%2B03%3A00&singleEvents=true&maxResults=9999',
    );
    const data = await res.json();
    scheduleData = data.items;
  } catch (error) {
    console.error('Ошибка получения данных: ' + error);
  }
}

// Инициализация данных при старте бота
getData();

// Функция фильтрации по спринтам
function filterBySprint(data) {
  return data.reduce(
    (acc, el) => {
      for (let i = 1; i <= 5; i++) {
        if (el.summary.includes(`Спринт 0${i}`)) {
          acc[`s${i}`].push(el);
        }
      }
      return acc;
    },
    { s1: [], s2: [], s3: [], s4: [], s5: [] },
  );
}

// Функция для отображения событий с учетом фильтрации
// Функция для улучшенного отображения событий (со статусом)
function renderSchedule(schedule) {
  if (filter === 'extra') {
    schedule = schedule.filter((el) => el.summary.includes('доп.занятие'));
  }
  if (filter === 'js') {
    schedule = schedule.filter((el) => el.summary.includes('JS Native'));
  }
  if (filter === 'main') {
    // Фильтрация основных занятий в формате "Спринт 0X - " или "Спринт 0X/online"
    schedule = schedule.filter((el) =>
      /Спринт 0\d+\s*-\s*|\s*Спринт 0\d+\/online/.test(el.summary),
    );
  }

  if (schedule.length === 0) {
    return '😢 Занятий не найдено...';
  }

  // Сортировка по дате в порядке убывания
  schedule.sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

  return schedule
    .map((event) => {
      const teacherInfo =
        event.description?.replace(/[^a-zA-Zа-яА-ЯёЁ\s]+/g, '') || 'Неизвестный преподаватель';
      const startDateTime = new Date(event.start?.dateTime);
      const endDateTime = new Date(event.end?.dateTime);

      // Определяем статус занятия
      let statusText = '';
      switch (event.status) {
        case 'confirmed':
          statusText = '✅ Подтверждено';
          break;
        case 'tentative':
          statusText = '🟡 В ожидании';
          break;
        case 'cancelled':
          statusText = '❌ Отменено';
          break;
        default:
          statusText = '🔄 Неизвестно';
      }

      return (
        `📚 **Занятие: ${event.summary}**\n\n` +
        `👨‍🏫 **Преподаватель**: ${teacherInfo}\n\n` +
        `🕒 **Дата и время**: ${startDateTime.toLocaleString('ru-RU', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })} - ${endDateTime.toLocaleString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })} (${event.start?.timeZone || 'местное время'})\n\n` +
        `📋 **Статус**: ${statusText}\n\n` +
        `🗒 **Описание**: ${teacherInfo ? teacherInfo : 'Нет описания'}\n`
      );
    })
    .join('\n');
}

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Приветственное сообщение с командами
  const welcomeMessage = `
👋 Привет, ${msg.from.first_name}! Добро пожаловать! 🎉
Команды бота: 🤖
🗓 /start - для получения расписания 💻✨
  `;

  bot.sendMessage(chatId, welcomeMessage.trim(), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Спринт 01', callback_data: 'sprint_1' },
          { text: 'Спринт 02', callback_data: 'sprint_2' },
        ],
        [
          { text: 'Спринт 03', callback_data: 'sprint_3' },
          { text: 'Спринт 04', callback_data: 'sprint_4' },
        ],
        [{ text: 'Спринт 05', callback_data: 'sprint_5' }],
      ],
    },
  });
});

// Обработчик нового пользователя
bot.on('new_chat_members', (msg) => {
  msg.new_chat_members.forEach((newUser) => {
    const welcomeMessage = `
👋 Привет, ${newUser.first_name}! Добро пожаловать в нашу группу! 🎉
Команды бота: 🤖
🗓 /start - для получения расписания,
Если тебе что-то непонятно или нужна помощь, не стесняйся задавать вопросы! 💻✨
    `;
    bot.sendMessage(msg.chat.id, welcomeMessage.trim());
  });
});

// Обработчик нажатий на инлайн-кнопки (выбор спринта и фильтров)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  // Определение видимого спринта
  if (action.startsWith('sprint_')) {
    visibleSchedule = parseInt(action.split('_')[1]);

    // Отфильтровываем данные по спринтам
    const filteredData = filterBySprint(scheduleData);
    const scheduleToShow = filteredData[`s${visibleSchedule}`];

    // Отправляем пользователю список занятий и фильтры
    sendSchedule(chatId, scheduleToShow);
  } else if (action === 'return_to_sprint_selection') {
    filter = 'all';
    returnToSprintSelection(chatId);
  } else {
    // Удаляем предыдущее сообщение, если оно существует
    if (lastMessageId) {
      try {
        await bot.deleteMessage(chatId, lastMessageId);
      } catch (error) {
        console.error('Ошибка при удалении сообщения:', error);
      }
    }

    // Обработка фильтров
    if (action === 'filter_all') {
      filter = 'all';
    } else if (action === 'filter_extra') {
      filter = 'extra';
    } else if (action === 'filter_js') {
      filter = 'js';
    } else if (action === 'filter_main') {
      filter = 'main';
    }

    // Обновляем отображение с учетом выбранного фильтра
    const filteredData = filterBySprint(scheduleData);
    const scheduleToShow = filteredData[`s${visibleSchedule}`];

    // Отправляем новое расписание и сохраняем ID сообщения
    lastMessageId = await sendSchedule(chatId, scheduleToShow);
  }
});

// Функция отправки расписания
async function sendSchedule(chatId, scheduleToShow) {
  const message = await bot.sendMessage(chatId, renderSchedule(scheduleToShow), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Все', callback_data: 'filter_all' },
          { text: 'Основные', callback_data: 'filter_main' },
          { text: 'Дополнительные', callback_data: 'filter_extra' },
          { text: 'JavaScript', callback_data: 'filter_js' },
          { text: 'Вернуться к выбору спринта', callback_data: 'return_to_sprint_selection' },
        ],
      ],
    },
  });
  return message.message_id; // Возвращаем ID отправленного сообщения
}

// Функция возврата к выбору спринта
function returnToSprintSelection(chatId) {
  bot.sendMessage(chatId, 'Выберите спринт:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Спринт 01', callback_data: 'sprint_1' },
          { text: 'Спринт 02', callback_data: 'sprint_2' },
        ],
        [
          { text: 'Спринт 03', callback_data: 'sprint_3' },
          { text: 'Спринт 04', callback_data: 'sprint_4' },
        ],
        [{ text: 'Спринт 05', callback_data: 'sprint_5' }],
      ],
    },
  });
}
