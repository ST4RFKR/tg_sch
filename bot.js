// Импорт необходимых библиотек
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
// Токен вашего бота
const token = process.env.TOKEN;
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
// Функция для получения данных расписания менторов с API Google Calendar
async function getMentorData() {
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/rralfc724pumjdn5n6r1gpi7k8%40group.calendar.google.com/events?key=AIzaSyB-JSBKuhkxr0ZaMf-ZXbho0YM13O-GwbY&timeMin=2024-10-07T00%3A00%3A00%2B03%3A00&timeMax=2024-10-31T00%3A00%3A00%2B03%3A00&singleEvents=true&maxResults=9999',
    );
    const data = await res.json();
    return data.items;
  } catch (error) {
    console.error('Ошибка получения данных расписания поддержки: ' + error);
    return [];
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
      const teacherInfo = event.description?.replace(/[^a-zA-Zа-яА-ЯёЁ\s]+/g, '') || ''; // Убираем неизвестного учителя
      return `📝 ${event.summary}\n👨🏻‍🏫 ${teacherInfo}\n⏳ ${new Date(
        event.start?.dateTime,
      ).toLocaleString('ru-RU', {
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

// Обработчик команды /start
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
        [{ text: 'Спринт 05', callback_data: 'sprint_5' }],
        [{ text: 'Показать расписание поддержки', callback_data: 'show_support_schedule' }], // Новая кнопка
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

    const filteredData = filterBySprint(scheduleData);
    const scheduleToShow = filteredData[`s${visibleSchedule}`];

    sendSchedule(chatId, scheduleToShow);
  } else if (action === 'return_to_sprint_selection') {
    filter = 'all';
    returnToSprintSelection(chatId);
  } else if (action === 'show_support_schedule') {
    // Обработка нажатия кнопки расписания поддержки
    const mentorData = await getMentorData();
    const groupedMentorData = groupByDay(mentorData);
    const message = renderMentorSchedule(groupedMentorData);

    bot.sendMessage(chatId, message);
  } else {
    // Обработка фильтров...
  }
});
// Функция для группировки событий по дням
function groupByDay(data) {
  return data.reduce((acc, event) => {
    const eventDate = new Date(event.start.dateTime).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    if (!acc[eventDate]) {
      acc[eventDate] = [];
    }
    acc[eventDate].push(event);
    return acc;
  }, {});
}

// Функция для отображения расписания поддержки
function renderMentorSchedule(groupedData) {
  const currentDate = new Date(); // Получаем текущую дату
  const nextWeekDate = new Date(); // Дата через 7 дней
  nextWeekDate.setDate(currentDate.getDate() + 7); // Устанавливаем дату на 7 дней вперёд
  const messages = []; // Массив для хранения сообщений
  let currentMessage = ''; // Переменная для текущего сообщения

  if (!Object.keys(groupedData).length) {
    return ['😢 Расписание поддержки не найдено...'];
  }

  Object.keys(groupedData).forEach((date) => {
    const eventDate = new Date(date);

    // Проверка, что дата события находится в пределах следующей недели
    if (eventDate < currentDate || eventDate > nextWeekDate) {
      return; // Пропускаем прошедшие и будущие мероприятия
    }

    const events = groupedData[date]
      .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime)) // Сортировка по времени
      .map((event) => {
        const mentorName = event.summary.split(' ')[1]; // Извлекаем имя ментора
        const mentorDirection = event.summary.split(' ')[2]; // Извлекаем направление (Back или Front)
        const eventTime = new Date(event.start?.dateTime).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }); // Формат времени

        return `📝 ${event.summary} ⏳ ${eventTime}\n`; // Отображение имени, направления и времени
      })
      .join('\n');

    currentMessage += `📅 ${date}:\n${events}\n\n`;

    // Проверка длины текущего сообщения
    if (currentMessage.length > 4000) {
      messages.push(currentMessage.trim()); // Сохраняем сообщение в массив
      currentMessage = ''; // Обнуляем текущее сообщение
    }
  });

  // Добавляем оставшееся сообщение, если есть
  if (currentMessage) {
    messages.push(currentMessage.trim());
  }

  return messages.length > 0 ? messages : ['😢 Нет будущих занятий...']; // Возвращаем массив сообщений
}

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
