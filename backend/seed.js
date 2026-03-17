const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

mongoose.connect("mongodb://127.0.0.1:27017/employeeapp");

async function seed() {
  await User.deleteMany();

  const defaultPassword = await bcrypt.hash("123456", 10);

  await User.create([
    {
      name: "Default Admin",
      email: "admin@test.com",
      password: defaultPassword,
      role: "admin",
    },
    {
      name: "Karthi Admin",
      email: "karthi@gmail.com",
      password: defaultPassword,
      role: "admin",
    },
    {
      name: "Priya User",
      email: "priya@gmail.com",
      password: defaultPassword,
      role: "user",
    },
    {
      name: "Ravi User",
      email: "ravi@gmail.com",
      password: defaultPassword,
      role: "user",
    },
  ]);

  console.log("Seeded users:");
  console.log("1) admin@test.com / 123456 (admin)");
  console.log("2) karthi@gmail.com / 123456 (admin)");
  console.log("3) priya@gmail.com / 123456 (user)");
  console.log("4) ravi@gmail.com / 123456 (user)");
  process.exit();
}

seed();
