import mongoose, { Schema, models, model } from "mongoose";
import { DEPARTMENTS, TEAM_HEAD_ROLES, YEARS } from "@shared/constants";

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
    active: { type: Boolean, default: true },
    passwordChangedAt: { type: Date }
  },
  { timestamps: true }
);

// `select: false` hides passwordHash from queries, but NOT from the document returned by
// User.create() — that one is fully populated in memory. Without this transform a route
// that serialized a freshly created user shipped the bcrypt hash to the client.
UserSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    return ret;
  }
});

export default (models.User as mongoose.Model<any>) || model("User", UserSchema);
