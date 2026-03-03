const Employee = require("../models/Employee");

exports.getDashboardStats = async (req, res) => {
  const total = await Employee.countDocuments();
  const active = await Employee.countDocuments({ isActive: true });
  const inactive = await Employee.countDocuments({ isActive: false });

  const byDepartment = await Employee.aggregate([
    {
      $lookup: {
        from: "departments",
        localField: "department",
        foreignField: "_id",
        as: "department"
      }
    },
    { $unwind: "$department" },
    {
      $group: {
        _id: "$department._id",
        name: { $first: "$department.name" },
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({ total, active, inactive, byDepartment });
};