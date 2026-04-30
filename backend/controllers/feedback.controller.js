const Feedback = require("../models/Feedback");

const allowedCategories = new Set([
  "Bug Report",
  "Feature Request",
  "Improvement",
  "Other",
]);

const normalizeText = (value) => String(value || "").trim();
const normalizeRole = (value) => normalizeText(value).toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const employeeFeedbackFilter = {
  submittedByRole: /^employee$/i,
};

const mapFeedbackNotificationRow = (feedback) => ({
  _id: feedback._id,
  name: normalizeText(feedback.name),
  email: normalizeText(feedback.email),
  category: normalizeText(feedback.category),
  satisfaction: Number(feedback.satisfaction || 0),
  message: normalizeText(feedback.message),
  pagePath: normalizeText(feedback.pagePath),
  pageTitle: normalizeText(feedback.pageTitle),
  submittedById: normalizeText(feedback.submittedById),
  submittedByRole: normalizeRole(feedback.submittedByRole),
  submittedByName: normalizeText(feedback.submittedByName),
  createdAt: feedback.createdAt,
  adminReadAt: feedback.adminReadAt || null,
});

exports.createFeedback = async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const email = normalizeText(req.body?.email).toLowerCase();
    const category = normalizeText(req.body?.category);
    const message = normalizeText(req.body?.message);
    const satisfaction = Number(req.body?.satisfaction);

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (!allowedCategories.has(category)) {
      return res.status(400).json({ message: "Select a valid feedback category" });
    }

    if (!Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5) {
      return res.status(400).json({ message: "Select a satisfaction rating" });
    }

    if (!message) {
      return res.status(400).json({ message: "Feedback message is required" });
    }

    const feedback = await Feedback.create({
      name,
      email,
      category,
      satisfaction,
      message,
      pagePath: normalizeText(req.body?.pagePath),
      pageTitle: normalizeText(req.body?.pageTitle),
      submittedById: normalizeText(req.user?.id),
      submittedByRole: normalizeRole(req.user?.role),
      submittedByName: normalizeText(
        req.user?.name || req.user?.employeeName || req.user?.email
      ),
    });

    return res.status(201).json({
      message: "Feedback submitted successfully",
      feedbackId: feedback._id,
    });
  } catch (err) {
    console.error("CREATE FEEDBACK ERROR:", err);
    return res.status(500).json({ message: "Failed to submit feedback" });
  }
};

exports.getAdminFeedbackNotifications = async (req, res) => {
  try {
    const unreadFilter = {
      ...employeeFeedbackFilter,
      adminReadAt: null,
    };
    const [rows, unreadCount] = await Promise.all([
      Feedback.find(unreadFilter).sort({ createdAt: -1 }).limit(10).lean(),
      Feedback.countDocuments(unreadFilter),
    ]);

    return res.json({
      counts: {
        unread: unreadCount,
      },
      rows: rows.map(mapFeedbackNotificationRow),
    });
  } catch (err) {
    console.error("GET ADMIN FEEDBACK NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load feedback notifications" });
  }
};

exports.markAdminFeedbackNotificationRead = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({
      _id: req.params.id,
      ...employeeFeedbackFilter,
    });

    if (!feedback) {
      return res.status(404).json({ message: "Feedback notification not found" });
    }

    if (!feedback.adminReadAt) {
      feedback.adminReadAt = new Date();
      feedback.adminReadById = normalizeText(req.user?.id);
      feedback.adminReadByName = normalizeText(
        req.user?.name || req.user?.employeeName || req.user?.email
      );
      await feedback.save();
    }

    return res.json({
      message: "Feedback notification marked as read",
      feedback: mapFeedbackNotificationRow(feedback),
    });
  } catch (err) {
    console.error("MARK ADMIN FEEDBACK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Failed to update feedback notification" });
  }
};

exports.markAllAdminFeedbackNotificationsRead = async (req, res) => {
  try {
    const readAt = new Date();
    const result = await Feedback.updateMany(
      {
        ...employeeFeedbackFilter,
        adminReadAt: null,
      },
      {
        $set: {
          adminReadAt: readAt,
          adminReadById: normalizeText(req.user?.id),
          adminReadByName: normalizeText(
            req.user?.name || req.user?.employeeName || req.user?.email
          ),
        },
      }
    );

    return res.json({
      message: "All feedback notifications marked as read",
      updatedCount: Number(result.modifiedCount || 0),
    });
  } catch (err) {
    console.error("MARK ALL ADMIN FEEDBACK NOTIFICATIONS READ ERROR:", err);
    return res.status(500).json({ message: "Failed to update feedback notifications" });
  }
};
