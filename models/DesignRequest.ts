import mongoose, { Schema, models, model } from "mongoose";

const DesignRequestSchema = new Schema(
  {
    designTitle: { type: String, required: true, index: "text" },
    requirement: String,
    description: String,
    assignedDesigner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deadline: Date,
    status: { type: String, enum: ["Pending", "In Progress", "Submitted", "Approved", "Rejected"], default: "Pending", index: true },
    finalSubmissionLink: String
  },
  { timestamps: true }
);

export default (models.DesignRequest as mongoose.Model<any>) || model("DesignRequest", DesignRequestSchema);
