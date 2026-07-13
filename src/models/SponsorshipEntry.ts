import mongoose, { Schema, models, model } from "mongoose";

const HistorySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    update: String,
    status: String
  },
  { timestamps: true }
);

const SponsorshipEntrySchema = new Schema(
  {
    companyName: { type: String, required: true, index: "text" },
    industry: String,
    companyWebsite: String,
    contactPersonName: String,
    designation: String,
    contactNumber: String,
    email: String,
    dateContacted: Date,
    sponsorshipRequirement: String,
    currentStatus: { type: String, enum: ["Proposal Sent", "Negotiation", "Interested", "Confirmed", "Rejected"], index: true },
    followUpDate: Date,
    detailedUpdate: String,
    history: [HistorySchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export default (models.SponsorshipEntry as mongoose.Model<any>) || model("SponsorshipEntry", SponsorshipEntrySchema);
