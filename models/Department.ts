import mongoose, { Schema, models, model } from "mongoose";
import { DEPARTMENTS } from "@/lib/constants";

const DepartmentSchema = new Schema(
  {
    name: { type: String, enum: DEPARTMENTS, unique: true, required: true },
    head: { type: Schema.Types.ObjectId, ref: "User" },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export default (models.Department as mongoose.Model<any>) || model("Department", DepartmentSchema);
