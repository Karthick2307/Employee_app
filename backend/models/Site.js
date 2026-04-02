const mongoose = require("mongoose");

const SubSiteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    headNames: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: []
    }
  },
  { _id: true }
);

SubSiteSchema.add({
  children: {
    type: [SubSiteSchema],
    default: []
  }
});

const SiteSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
      default: ""
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    headNames: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: []
    },
    siteLeadNames: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: []
    },
    subSites: {
      type: [SubSiteSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Site", SiteSchema);
