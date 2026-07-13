import mongoose, { Schema, models, model } from "mongoose";
import { DEPARTMENTS, TEAM_HEAD_ROLES, YEARS } from "@/lib/constants";

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    year: { type: String, enum: YEARS, required: true },
    role: { type: String, enum: ["member", "secretary"], default: "member", index: true },
    departments: [{ type: String, enum: DEPARTMENTS }],
    teamHeadRole: { type: String, enum: TEAM_HEAD_ROLES, default: "None" },
    canManageTeam: { type: Boolean, default: false },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default (models.User as mongoose.Model<any>) || model("User", UserSchema);
