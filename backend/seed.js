const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

mongoose.connect("mongodb://127.0.0.1:27017/employeeapp");

async function seed() {
  await User.deleteMany();

  await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: await bcrypt.hash("admin123", 10),
    role: "admin"
  });

  await User.create({
    name: "User",
    email: "user@test.com",
    password: await bcrypt.hash("user123", 10),
    role: "user"
  });

  console.log("Users created");
  process.exit();
}

seed();