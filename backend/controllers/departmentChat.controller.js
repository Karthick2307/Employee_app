const createChatController = require("./createChatController");
const departmentChatService = require("../services/departmentChat.service");

module.exports = createChatController(departmentChatService);
