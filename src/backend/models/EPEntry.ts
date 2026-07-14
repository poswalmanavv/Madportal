import mongoose, { Schema, models, model } from "mongoose";

// Mirrors the sponsorship history trail so an EP entry keeps an audit log of who moved it
// between statuses and why.
const HistorySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    update: String,
    status: String
  },
  { timestamps: true }
);

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
    history: [HistorySchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export default (models.EPEntry as mongoose.Model<any>) || model("EPEntry", EPEntrySchema);
