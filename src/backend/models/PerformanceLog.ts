import mongoose, { Schema, models, model } from "mongoose";

const PerformanceLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["task", "ep", "sponsorship", "design"], required: true, index: true },
    action: { type: String, required: true },
    points: { type: Number, default: 1 },
    referenceId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export default (models.PerformanceLog as mongoose.Model<any>) || model("PerformanceLog", PerformanceLogSchema);
