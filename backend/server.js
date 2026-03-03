const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const employeeRoutes = require("./routes/employee.routes");
const departmentRoutes = require("./routes/department.routes");
const designationRoutes = require("./routes/designation.routes");
const siteRoutes = require("./routes/site.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();
const path = require("path");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= MIDDLEWARES (VERY IMPORTANT ORDER) ================= */
app.use(cors());
app.use(express.json()); // 🔥 MUST BE BEFORE ROUTES
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

/* ================= ROUTES ================= */
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/dashboard", dashboardRoutes);

/* ================= DATABASE ================= */
  mongoose
  .connect("mongodb://127.0.0.1:27017/employeeapp")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

/* ================= SERVER ================= */
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});