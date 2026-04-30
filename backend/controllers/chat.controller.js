const createChatController = require("./createChatController");
const chatService = require("../services/chat.service");

module.exports = createChatController(chatService);
