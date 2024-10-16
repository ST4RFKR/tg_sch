// Импорт необходимых библиотек
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { format, addDays, startOfToday } from 'date-fns'; // Убедитесь, что у вас установлены date-fns
dotenv.config();

// Токен вашего бота
const token = process.env.TOKEN; // Замените на ваш токен
const bot = new TelegramBot(token, { polling: true });

// Данные и состояния
let scheduleData = [];
let mentorScheduleData = [];
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

// Функция для получения расписания менторов
async function getMentorSchedule() {
  const today = startOfToday();
  const timeMin = format(today, "yyyy-MM-dd'T'00:00:00xxx");
  const timeMax = format(addDays(today, 7), "yyyy-MM-dd'T'00:00:00xxx");

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/rralfc724pumjdn5n6r1gpi7k8%40group.calendar.google.com/events?key=AIzaSyB-JSBKuhkxr0ZaMf-ZXbho0YM13O-GwbY&timeMin=${encodeURIComponent(
        timeMin,
      )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=9999`,
    );
    const data = await res.json();
    mentorScheduleData = data.items.sort(
      (a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime),
    );
  } catch (error) {
    console.error('Ошибка получения данных: ' + error);
  }
}

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
// function renderSchedule(schedule) {
//   if (filter === 'extra') {
//     schedule = schedule.filter((el) => el.summary.includes('доп.занятие'));
//   }
//   if (filter === 'js') {
//     schedule = schedule.filter((el) => el.summary.includes('JS Native'));
//   }
//   if (filter === 'main') {
//     schedule = schedule.filter((el) =>
//       /Спринт 0\d+\s*-\s*|\s*Спринт 0\d+\/online/.test(el.summary),
//     );
//   }

//   if (schedule.length === 0) {
//     return '😢 Занятий не найдено...';
//   }

//   // Сортировка по дате в порядке возрастания
//   schedule.sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

//   return schedule
//     .map((event) => {
//       const teacherInfo = event.description?.replace(/[^a-zA-Zа-яА-ЯёЁ\s]+/g, '') || '';
//       return `📝 ${event.summary}\n👨🏻‍🏫 ${teacherInfo}\n⏳ ${new Date(
//         event.start?.dateTime,
//       ).toLocaleString('ru-RU', {
//         day: '2-digit',
//         month: '2-digit',
//         year: 'numeric',
//         hour: '2-digit',
//         minute: '2-digit',
//         hour12: false,
//       })}\n`;
//     })
//     .join('\n');
// }
function renderSchedule(schedule) {
  if (filter === 'extra') {
    schedule = schedule.filter((el) => el.summary.includes('доп.занятие'));
  }
  if (filter === 'js') {
    schedule = schedule.filter((el) => el.summary.includes('JS Native'));
  }
  if (filter === 'main') {
    schedule = schedule.filter((el) =>
      /Спринт 0\d+\s*-\s*|\s*Спринт 0\d+\/online/.test(el.summary),
    );
  }

  if (schedule.length === 0) {
    return '😢 Занятий не найдено...';
  }

  // Сортировка по дате в порядке возрастания
  schedule.sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

  return schedule
    .map((event) => {
      const teacherInfo = event.description?.replace(/[^a-zA-Zа-яА-ЯёЁ\s]+/g, '') || '';

      // Парсинг времени события
      const eventDate = new Date(event.start?.dateTime);

      // Добавляем смещение в 3 часа к исходному времени
      eventDate.setHours(eventDate.getHours() + 3); // Добавляем 3 часа

      return `📝 ${event.summary}\n👨🏻‍🏫 ${teacherInfo}\n⏳ ${eventDate.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}\n`;
    })
    .join('\n');
}

function renderMentorSchedule(schedule) {
  if (schedule.length === 0) {
    return '😢 Расписание менторов не найдено...';
  }

  const groupedByDate = schedule.reduce((acc, event) => {
    const eventDate = new Date(event.start.dateTime).toLocaleDateString('ru-RU');
    const time = new Date(event.start.dateTime).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    ё;

    // Фильтрация строк, содержащих "Back", но не "Back/Front"
    const teacherInfo = event.summary || '';
    if (/Back(?!\/Front)/.test(teacherInfo)) {
      return acc; // Пропускаем, если строка содержит "Back" без "Front"
    }

    acc[eventDate] = acc[eventDate] || [];
    acc[eventDate].push(`    \t${time} ${event.summary}`);
    return acc;
  }, {});

  return Object.entries(groupedByDate)
    .map(([date, events]) => {
      return `${date}\n${events.join('\n')}`;
    })
    .join('\n\n');
}

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

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
        [
          { text: 'Спринт 05', callback_data: 'sprint_5' },
          { text: 'Показать расписание менторов', callback_data: 'show_mentors' },
        ],
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

// Обработчик нажатий на инлайн-кнопки
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  // Определение видимого спринта
  if (action.startsWith('sprint_')) {
    visibleSchedule = parseInt(action.split('_')[1]);

    const filteredData = filterBySprint(scheduleData);
    const scheduleToShow = filteredData[`s${visibleSchedule}`];

    lastMessageId = await sendSchedule(chatId, scheduleToShow);
  } else if (action === 'show_mentors') {
    await getMentorSchedule();
    const mentorScheduleMessage = renderMentorSchedule(mentorScheduleData);
    await bot.sendMessage(chatId, mentorScheduleMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Вернуться к выбору спринта', callback_data: 'return_to_sprint_selection' }],
        ],
      },
    });
  } else if (action === 'return_to_sprint_selection') {
    filter = 'all';
    returnToSprintSelection(chatId);
  } else {
    if (lastMessageId) {
      try {
        await bot.deleteMessage(chatId, lastMessageId);
      } catch (error) {
        console.error('Ошибка при удалении сообщения:', error);
      }
    }

    if (action === 'filter_all') {
      filter = 'all';
    } else if (action === 'filter_extra') {
      filter = 'extra';
    } else if (action === 'filter_js') {
      filter = 'js';
    } else if (action === 'filter_main') {
      filter = 'main';
    }

    const filteredData = filterBySprint(scheduleData);
    const scheduleToShow = filteredData[`s${visibleSchedule}`];

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
          { text: 'Доп. занятия', callback_data: 'filter_extra' },
          { text: 'JS', callback_data: 'filter_js' },
        ],
        [{ text: 'Вернуться к выбору спринта', callback_data: 'return_to_sprint_selection' }],
      ],
    },
  });
  return message.message_id; // Возвращаем ID сообщения
}

// Функция возврата к выбору спринта
function returnToSprintSelection(chatId) {
  bot.sendMessage(chatId, 'Пожалуйста, выберите спринт:', {
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
        [
          { text: 'Спринт 05', callback_data: 'sprint_5' },
          { text: 'Показать расписание менторов', callback_data: 'show_mentors' },
        ],
      ],
    },
  });
}

//            19.10.2024
// 10:00 ❗️ДЕНИС - Front + HTML/CSS
// 10:00 👑Влад - Back (до 31 lvl включительно)
// 12:00 🐱 Игнат - Back/Front
// 13:30 🍬Маша - Front + HTML/CSS
// 15:00 🐱 Игнат - Back/Front

// 19.10.2024
//    10:00 ❗️ДЕНИС - Front + HTML/CSS
//    10:00 👑Влад - Back (до 31 lvl включительно)
//    12:00 🐱 Игнат - Back/Front
//    13:30 🍬Маша - Front + HTML/CSS
//    15:00 🐱 Игнат - Back/Front
