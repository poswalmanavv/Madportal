import mongoose, { Schema, models, model } from "mongoose";

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "info" },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default (models.Notification as mongoose.Model<any>) || model("Notification", NotificationSchema);
