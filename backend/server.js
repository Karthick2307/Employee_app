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
const permissionRoutes = require("./routes/permission.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const { startChecklistScheduler } = require("./services/checklistWorkflow.service");
const { startPersonalTaskScheduler } = require("./services/personalTask.service");
const { syncPermissionSeed } = require("./services/permissionCatalog.service");

const app = express();
const DEFAULT_PORT = 5000;
const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/employeeapp";
const port = Number(process.env.PORT || DEFAULT_PORT);
const mongoUri = String(
  process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_MONGODB_URI
).trim();
const corsOrigin = String(process.env.CORS_ORIGIN || "").trim();

const corsOptions = corsOrigin
  ? {
      origin: corsOrigin.split(",").map((value) => value.trim()).filter(Boolean),
      credentials: true,
    }
  : {
      origin: true,
      credentials: true,
    };

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

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
app.use("/api/permissions", permissionRoutes);
app.use("/api/attendance", attendanceRoutes);

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB Connected");
    await syncPermissionSeed();

    startChecklistScheduler();
    startPersonalTaskScheduler();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("SERVER START ERROR:", err);
    process.exit(1);
  }
};

void startServer();
