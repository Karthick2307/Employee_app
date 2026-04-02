require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const employeeRoutes = require("./routes/employee.routes");
const departmentRoutes = require("./routes/department.routes");
const designationRoutes = require("./routes/designation.routes");
const siteRoutes = require("./routes/site.routes");
const companyRoutes = require("./routes/company.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const checklistRoutes = require("./routes/checklist.routes");
const personalTaskRoutes = require("./routes/personalTask.routes");
const chatRoutes = require("./routes/chat.routes");
const departmentChatRoutes = require("./routes/departmentChat.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const chatbotRoutes = require("./routes/chatbot.routes");
const { startChecklistScheduler } = require("./services/checklistWorkflow.service");
const { startPersonalTaskScheduler } = require("./services/personalTask.service");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/checklists", checklistRoutes);
app.use("/api/personal-tasks", personalTaskRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/department-chat", departmentChatRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/chatbot", chatbotRoutes);

const startServer = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/employeeapp");
    console.log("MongoDB Connected");

    startChecklistScheduler();
    startPersonalTaskScheduler();

    app.listen(5000, () => {
      console.log("Server running on port 5000");
    });
  } catch (err) {
    console.error("SERVER START ERROR:", err);
    process.exit(1);
  }
};

void startServer();
