import mongoose, { Schema, models, model } from "mongoose";

const EPEntrySchema = new Schema(
  {
    epName: { type: String, required: true, index: "text" },
    organization: { type: String, required: true, index: "text" },
    contactNumber: String,
    email: String,
    personContacted: String,
    date: Date,
    discussionSummary: String,
    currentStatus: { type: String, enum: ["Interested", "Follow-up Required", "Confirmed", "Rejected"], index: true },
    detailedUpdate: String,
    attachNotes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export default (models.EPEntry as mongoose.Model<any>) || model("EPEntry", EPEntrySchema);
