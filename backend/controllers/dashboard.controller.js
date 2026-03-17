const Employee = require("../models/Employee");
const Checklist = require("../models/Checklist");
const Site = require("../models/Site");

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      total,
      active,
      inactive,
      totalChecklistTasks,
      byDepartment,
      employeeCountsBySite,
      checklistCountsBySite,
      sites,
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ isActive: true }),
      Employee.countDocuments({ isActive: false }),
      Checklist.countDocuments(),
      Employee.aggregate([
        {
          $lookup: {
            from: "departments",
            localField: "department",
            foreignField: "_id",
            as: "department",
          },
        },
        { $unwind: "$department" },
        {
          $group: {
            _id: "$department._id",
            name: { $first: "$department.name" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, name: 1 } },
      ]),
      Employee.aggregate([
        { $unwind: "$sites" },
        {
          $group: {
            _id: "$sites",
            employeeCount: { $sum: 1 },
          },
        },
      ]),
      Checklist.aggregate([
        {
          $group: {
            _id: "$employeeAssignedSite",
            checklistCount: { $sum: 1 },
          },
        },
      ]),
      Site.find({}, "name companyName").sort({ companyName: 1, name: 1 }).lean(),
    ]);

    const employeeCountBySiteId = new Map(
      employeeCountsBySite.map((item) => [String(item._id), item.employeeCount])
    );
    const checklistCountBySiteId = new Map(
      checklistCountsBySite.map((item) => [String(item._id), item.checklistCount])
    );

    const bySite = sites.map((site) => ({
      _id: site._id,
      name: site.name,
      companyName: site.companyName || "",
      employeeCount: employeeCountBySiteId.get(String(site._id)) || 0,
      checklistCount: checklistCountBySiteId.get(String(site._id)) || 0,
    }));

    res.json({
      total,
      active,
      inactive,
      totalChecklistTasks,
      byDepartment,
      bySite,
    });
  } catch (err) {
    console.error("Dashboard stats load failed:", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
};
