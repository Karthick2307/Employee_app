const Employee = require("../models/Employee");
const ExcelJS = require("exceljs");

/* ================= LIST + SEARCH + FILTER ================= */
exports.getEmployees = async (req, res) => {
  try {
    const { search = "", status = "", department = "" } = req.query;

    const filter = {};

    /* 🔍 SEARCH */
    if (search) {
      filter.$or = [
        { employeeCode: { $regex: search, $options: "i" } },
        { employeeName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } }
      ];
    }

    /* ✅ STATUS */
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    /* 🏢 DEPARTMENT */
    if (department) filter.department = department;

    const employees = await Employee.find(filter)
      .populate("department", "name")
      .populate("designation", "name")
      .populate("sites", "name")
      .sort({ createdAt: -1 });

    res.json(employees);
  } catch (err) {
    console.error("Get employees error:", err);
    res.status(500).json({ message: "Failed to load employees" });
  }
};

/* ================= VIEW BY ID ================= */
exports.getEmployeeById = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id)
      .populate("department", "name")
      .populate("designation", "name")
      .populate("sites", "name");

    if (!emp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(emp);
  } catch (err) {
    res.status(500).json({ message: "Employee not found" });
  }
};

/* ================= CREATE ================= */
exports.createEmployee = async (req, res) => {
  try {
    const employee = new Employee({
      ...req.body,
      isActive: true, // ✅ default active
      sites: Array.isArray(req.body.sites)
        ? req.body.sites
        : req.body.sites
        ? [req.body.sites]
        : [],
      photo: req.file ? req.file.filename : null
    });

    await employee.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= UPDATE ================= */
exports.updateEmployee = async (req, res) => {
  try {
    const data = {
      ...req.body,
      sites: Array.isArray(req.body.sites)
        ? req.body.sites
        : req.body.sites
        ? [req.body.sites]
        : []
    };

    if (req.file) {
      data.photo = req.file.filename;
    }

    await Employee.findByIdAndUpdate(req.params.id, data, {
      new: true
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Update employee error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= DELETE ================= */
exports.deleteEmployee = async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

/* ================= STATUS TOGGLE ================= */
exports.toggleEmployeeStatus = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    emp.isActive = !emp.isActive;
    await emp.save();

    res.json({ success: true, isActive: emp.isActive });
  } catch (err) {
    res.status(500).json({ message: "Status update failed" });
  }
};

/* ================= EXCEL EXPORT ================= */
exports.exportEmployeesExcel = async (req, res) => {
  try {
    const { status = "", department = "" } = req.query;

    const filter = {};
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (department) filter.department = department;

    const employees = await Employee.find(filter)
      .populate("department", "name")
      .populate("designation", "name")
      .populate("sites", "name");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Employees");

    sheet.columns = [
      { header: "Employee Code", key: "employeeCode", width: 20 },
      { header: "Employee Name", key: "employeeName", width: 25 },
      { header: "Mobile", key: "mobile", width: 15 },
      { header: "Email", key: "email", width: 30 },
      { header: "Department", key: "department", width: 20 },
      { header: "Designation", key: "designation", width: 20 },
      { header: "Sites", key: "sites", width: 30 },
      { header: "Status", key: "status", width: 15 }
    ];

    employees.forEach(e => {
      sheet.addRow({
        employeeCode: e.employeeCode,
        employeeName: e.employeeName,
        mobile: e.mobile,
        email: e.email,
        department: e.department?.name || "",
        designation: e.designation?.name || "",
        sites: e.sites.map(s => s.name).join(", "),
        status: e.isActive ? "Active" : "Inactive"
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=employees.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
};