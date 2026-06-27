import bcrypt from "bcryptjs";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { DEPARTMENTS } from "../src/lib/constants";
import { authorizedSecretaries } from "../src/lib/rbac";
import Department from "../src/models/Department";
import EPEntry from "../src/models/EPEntry";
import SponsorshipEntry from "../src/models/SponsorshipEntry";
import Task from "../src/models/Task";
import User from "../src/models/User";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("mongodb+srv://poswalmanavv_db_user:1sc1JfQhxKsgmspo@mad-club.aqsybxp.mongodb.net/?appName=mad-club");
const mongoUri = uri;

async function main() {
  await mongoose.connect(mongoUri, { dbName: "mad-club" });
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    EPEntry.deleteMany({}),
    SponsorshipEntry.deleteMany({}),
    Department.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash("Password@123", 12);
  const secretaryEmails = authorizedSecretaries();
  const seededSecretaryEmails = secretaryEmails.length > 0 ? secretaryEmails : ["123105128@nitkkr.ac.in"];
  const primarySecretaryEmail = seededSecretaryEmails[0];
  const secretaryUsers = seededSecretaryEmails.map((email, index) => ({
    name: index === 0 ? "Manav Secretary" : `Secretary ${index + 1}`,
    email,
    passwordHash,
    year: "4th Year" as const,
    role: "secretary" as const,
    departments: DEPARTMENTS,
    teamHeadRole: "None" as const
  }));
  const users = await User.insertMany([
    ...secretaryUsers,
    { name: "Diya EP Head", email: "diya@nitkkr.ac.in", passwordHash, year: "4th Year", departments: ["EP Team"], teamHeadRole: "EP Head" },
    { name: "Kabir Design Head", email: "kabir@nitkkr.ac.in", passwordHash, year: "4th Year", departments: ["Design Team"], teamHeadRole: "Design Team Head" },
    { name: "Meera Sponsorship", email: "meera@nitkkr.ac.in", passwordHash, year: "3rd Year", departments: ["Sponsorship Team"], teamHeadRole: "None", canManageTeam: true },
    { name: "Rohan Media", email: "rohan@nitkkr.ac.in", passwordHash, year: "2nd Year", departments: ["Media Team"], teamHeadRole: "None" },
    { name: "Isha Logistics", email: "isha@nitkkr.ac.in", passwordHash, year: "1st Year", departments: ["Logistics Team"], teamHeadRole: "None" }
  ]);

  const byEmail = (email: string) => users.find((user) => user.email === email)!;

  await Department.insertMany(DEPARTMENTS.map((name) => ({ name, members: users.filter((user) => user.departments.includes(name)).map((user) => user._id) })));

  await Task.insertMany([
    {
      title: "Prepare sponsor prospect list",
      description: "Create a verified list of 30 sponsor leads with contact owners.",
      createdBy: byEmail(primarySecretaryEmail)._id,
      assignedTo: [byEmail(primarySecretaryEmail)._id],
      priority: "High",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      status: "In Progress",
      progress: 45,
      timeline: [{ actor: byEmail(primarySecretaryEmail)._id, status: "Pending", progress: 0, comment: "Task created" }]
    },
    {
      title: "Design orientation poster",
      description: "Create poster and reel cover for the club orientation.",
      createdBy: byEmail("kabir@nitkkr.ac.in")._id,
      assignedTo: [byEmail("rohan@nitkkr.ac.in")._id],
      priority: "Medium",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      status: "Review",
      progress: 80,
      timeline: [{ actor: byEmail("kabir@nitkkr.ac.in")._id, status: "Pending", progress: 0, comment: "Creative brief shared" }]
    }
  ]);

  await EPEntry.create({
    epName: "Technova Cultural Exchange",
    organization: "NIT Delhi",
    contactNumber: "9876543210",
    email: "events@nitdelhi.ac.in",
    personContacted: "Event Coordinator",
    date: new Date(),
    discussionSummary: "Discussed cross-campus event participation.",
    currentStatus: "Follow-up Required",
    detailedUpdate: "Send formal event partnership deck.",
    createdBy: byEmail("diya@nitkkr.ac.in")._id
  });

  await SponsorshipEntry.create({
    companyName: "North Tech Labs",
    industry: "SaaS",
    companyWebsite: "https://example.com",
    contactPersonName: "Ankit Sharma",
    designation: "Marketing Manager",
    contactNumber: "9876501234",
    email: "marketing@example.com",
    dateContacted: new Date(),
    sponsorshipRequirement: "Title sponsorship for annual MAD showcase.",
    currentStatus: "Proposal Sent",
    followUpDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    detailedUpdate: "Proposal deck shared over email.",
    createdBy: byEmail("meera@nitkkr.ac.in")._id,
    history: [{ actor: byEmail("meera@nitkkr.ac.in")._id, update: "Proposal deck shared over email.", status: "Proposal Sent" }]
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
