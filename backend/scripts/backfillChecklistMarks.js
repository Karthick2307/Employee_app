const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const {
  calculateTaskMark,
  resolveMarkConfig,
} = require("../services/checklistWorkflow.service");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/employeeapp";

const cliMongoUri = process.argv
  .find((argument) => argument.startsWith("--mongo-uri="))
  ?.split("=")
  .slice(1)
  .join("=");
const isDryRun = process.argv.includes("--dry-run");
const envMongoUri = process.env.MONGO_URI || "";
const mongoUri = cliMongoUri || DEFAULT_MONGO_URI;

const valuesDiffer = (leftValue, rightValue) => {
  if (leftValue === null || leftValue === undefined) {
    return !(rightValue === null || rightValue === undefined);
  }

  if (rightValue === null || rightValue === undefined) return true;
  return String(leftValue) !== String(rightValue);
};

const buildChecklistUpdate = (checklist) => {
  const markConfig = resolveMarkConfig(checklist);
  const nextFields = {
    enableMark: markConfig.enableMark,
    baseMark: markConfig.baseMark,
    delayPenaltyPerDay: markConfig.delayPenaltyPerDay,
    advanceBonusPerDay: markConfig.advanceBonusPerDay,
  };

  const needsUpdate = Object.entries(nextFields).some(([key, value]) =>
    valuesDiffer(checklist[key], value)
  );

  return needsUpdate ? nextFields : null;
};

const buildTaskUpdate = (task, checklistMarkConfig) => {
  const markConfig = resolveMarkConfig({
    enableMark:
      typeof task.enableMark === "boolean" ? task.enableMark : checklistMarkConfig?.enableMark,
    baseMark:
      task.baseMark !== undefined && task.baseMark !== null
        ? task.baseMark
        : checklistMarkConfig?.baseMark,
    delayPenaltyPerDay:
      task.delayPenaltyPerDay !== undefined && task.delayPenaltyPerDay !== null
        ? task.delayPenaltyPerDay
        : checklistMarkConfig?.delayPenaltyPerDay,
    advanceBonusPerDay:
      task.advanceBonusPerDay !== undefined && task.advanceBonusPerDay !== null
        ? task.advanceBonusPerDay
        : checklistMarkConfig?.advanceBonusPerDay,
  });

  const markResult = calculateTaskMark({
    submittedAt: task.submittedAt,
    dependencyTargetDateTime: task.dependencyTargetDateTime,
    endDateTime: task.endDateTime,
    ...markConfig,
  });

  const nextFields = {
    enableMark: markConfig.enableMark,
    baseMark: markConfig.baseMark,
    delayPenaltyPerDay: markConfig.delayPenaltyPerDay,
    advanceBonusPerDay: markConfig.advanceBonusPerDay,
    finalMark: markResult.finalMark,
  };

  const needsUpdate = Object.entries(nextFields).some(([key, value]) =>
    valuesDiffer(task[key], value)
  );

  return needsUpdate ? nextFields : null;
};

async function backfillChecklistMarks() {
  if (envMongoUri && envMongoUri !== DEFAULT_MONGO_URI && !cliMongoUri) {
    console.log(
      `[checklist-mark-backfill] note=.env MONGO_URI differs from app default; using app default ${DEFAULT_MONGO_URI}. Pass --mongo-uri=... to target another database.`
    );
  }

  await mongoose.connect(mongoUri);

  try {
    const checklists = await Checklist.find(
      {},
      "enableMark baseMark delayPenaltyPerDay advanceBonusPerDay checklistMark"
    ).lean();
    const checklistConfigById = new Map();
    const checklistOperations = [];

    for (const checklist of checklists) {
      const nextFields = buildChecklistUpdate(checklist);
      const resolvedConfig = resolveMarkConfig({
        ...checklist,
        ...(nextFields || {}),
      });

      checklistConfigById.set(String(checklist._id), resolvedConfig);

      if (nextFields) {
        checklistOperations.push({
          updateOne: {
            filter: { _id: checklist._id },
            update: { $set: nextFields },
          },
        });
      }
    }

    const tasks = await ChecklistTask.find(
      {},
      "checklist enableMark baseMark delayPenaltyPerDay advanceBonusPerDay finalMark submittedAt endDateTime dependencyTargetDateTime"
    ).lean();
    const taskOperations = [];

    for (const task of tasks) {
      const checklistMarkConfig = checklistConfigById.get(String(task.checklist || ""));
      const nextFields = buildTaskUpdate(task, checklistMarkConfig);

      if (nextFields) {
        taskOperations.push({
          updateOne: {
            filter: { _id: task._id },
            update: { $set: nextFields },
          },
        });
      }
    }

    console.log(
      `[checklist-mark-backfill] mode=${isDryRun ? "dry-run" : "apply"} checklists=${
        checklistOperations.length
      } tasks=${taskOperations.length}`
    );

    if (!isDryRun) {
      if (checklistOperations.length) {
        await Checklist.bulkWrite(checklistOperations, { ordered: false });
      }

      if (taskOperations.length) {
        await ChecklistTask.bulkWrite(taskOperations, { ordered: false });
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

backfillChecklistMarks()
  .then(() => {
    console.log("[checklist-mark-backfill] complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[checklist-mark-backfill] failed", error);
    process.exit(1);
  });
