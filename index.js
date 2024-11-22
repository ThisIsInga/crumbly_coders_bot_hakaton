const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');

const token = '8058651715:AAEJZjmfjIIihhRLo1BOct69x-dYuxCVFjw';
const bot = new TelegramBot(token, { polling: true });

const db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run("CREATE TABLE votes (user_id TEXT, vote TEXT, timestamp DATETIME)");
});

// Указывайте пользователя для доступа к статистике. Id можно получить через бота написав /id
const adminUserId = '123455632';

bot.setMyCommands([
  {command: '/start', description: 'Начальное приветствие'},
  {command: '/id', description: 'Получить свой айди'},
  {command: '/vote', description: 'Пройти голосование'},
  {command: '/stats', description: 'Вся статистика из голосования'},
  {command: '/user_stats', description: 'Статистика пользователя'},
])
  

bot.onText(/\/start/, (msg) => {
    const firstName = msg.from.first_name || "Пользователь";
    const lastName = msg.from.last_name ? ` ${msg.from.last_name}` : "";

    bot.sendSticker(msg.chat.id, 'https://sl.combot.org/steamcookies/webp/0xe29c8c.webp');
    
    const welcomeMessage = `Здравствуйте, ${firstName}${lastName}! \n\n` +
        `Этот Бот создан для областного хакатона по программированию \n` +
        `Мы команда crumbly coders и готовы представить наш проект \n\n` +
        `Все команды вы можете просмотреть в меню или здесь: \n` +
        `/id - получить свой айди (он нужен для проектного менеджера для просмотра вашей статистики) \n` +
        `/vote - пройти голосование \n` +
        `/stats - просмотреть всю статистику из голосования (доступно только проектному менеджеру) \n` +
        `/user_stats [id] - просмотреть статистику пользователя (доступно только проектному менеджеру) \n`;

    bot.sendMessage(msg.chat.id, welcomeMessage);
});

bot.onText(/\/id/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    bot.sendMessage(chatId, `Ваш User ID: ${userId}`);
});

bot.onText(/\/vote/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Печенье', callback_data: 'Печенье' }, { text: 'Торты', callback_data: 'Торты' }]
      ]
    }
  };
  bot.sendMessage(chatId, "Печенье или торты?", options);
});

bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const text = callbackQuery.data;

  if (text === 'Торты') {
    bot.sendMessage(chatId, 'Надеемся, вы измените своё мнение!');
  } else {
    bot.sendMessage(chatId, 'Отличный выбор!');
  }

  bot.editMessageReplyMarkup({}, { chat_id: chatId, message_id: callbackQuery.message.message_id });
});


bot.on('callback_query', (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const vote = callbackQuery.data;

  db.run("INSERT INTO votes (user_id, vote, timestamp) VALUES (?, ?, ?)", [userId, vote, new Date()], (err) => {
    if (err) {
      return console.error(err.message);
    }
    bot.sendMessage(callbackQuery.message.chat.id, `Голос записан: ${vote}`);
  });
});

bot.onText(/\/stats/, (msg) => {
  if (msg.chat.id == adminUserId) {
    const dayStart = moment().startOf('day').toDate();
    const weekStart = moment().startOf('isoWeek').toDate();

    db.all("SELECT vote, COUNT(*) as count FROM votes WHERE timestamp >= ? GROUP BY vote", [dayStart], (err, dailyRows) => {
      if (err) return console.error(err.message);
      db.all("SELECT vote, COUNT(*) as count FROM votes WHERE timestamp >= ? GROUP BY vote", [weekStart], (err, weeklyRows) => {
        if (err) return console.error(err.message);
        db.all("SELECT vote, COUNT(*) as count FROM votes GROUP BY vote", [], (err, allRows) => {
          if (err) return console.error(err.message);

          let dailyStats = "Голоса сегодня:\n";
          dailyRows.forEach(row => dailyStats += `${row.vote}: ${row.count}\n`);

          let weeklyStats = "Голоса за эту неделю:\n";
          weeklyRows.forEach(row => weeklyStats += `${row.vote}: ${row.count}\n`);

          let overallStats = "Всего голосов:\n";
          allRows.forEach(row => overallStats += `${row.vote}: ${row.count}\n`);

          bot.sendMessage(adminUserId, dailyStats + '\n' + weeklyStats + '\n' + overallStats);
        });
      });
    });
  } else {
    bot.sendMessage(msg.chat.id, "У вас нет прав для просмотра статистики.");
  }
});


bot.onText(/\/user_stats (.+)/, (msg, match) => {
    const userId = match[1];

    if (msg.chat.id == adminUserId) {
        db.all("SELECT vote, COUNT(*) as count FROM votes WHERE user_id = ? GROUP BY vote", [userId], (err, rows) => {
            if (err) return console.error(err.message);

            let userStats = `Статистика для пользователя ID ${userId}:\n`;
            rows.forEach(row => userStats += `${row.vote}: ${row.count}\n`);

            if (rows.length === 0) {
                userStats = `Голосов не найдено для пользователя ID ${userId}.`;
            }

            bot.sendMessage(adminUserId, userStats);
        });
    } else {
        bot.sendMessage(msg.chat.id, "У вас нет прав для просмотра статистики пользователя.");
    }
});
