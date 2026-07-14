import mongoose, { Schema, models, model } from "mongoose";
import { PRIORITIES, TASK_STATUSES } from "@shared/constants";

const TimelineSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: TASK_STATUSES, required: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    comment: { type: String, required: true }
  },
  { timestamps: true }
);

const TaskSchema = new Schema(
  {
    title: { type: String, required: true, index: "text" },
    description: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: [{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    priority: { type: String, enum: PRIORITIES, required: true },
    deadline: { type: Date, required: true, index: true },
    attachments: [{ type: String }],
    remarks: { type: String },
    status: { type: String, enum: TASK_STATUSES, default: "Pending", index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    timeline: [TimelineSchema]
  },
  { timestamps: true }
);

export default (models.Task as mongoose.Model<any>) || model("Task", TaskSchema);
