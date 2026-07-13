import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { DEPARTMENTS } from "@/lib/constants";
import { authorizedSecretaries } from "@/lib/rbac";
import { connectDB } from "@/lib/db";
import Department from "@/models/Department";
import EPEntry from "@/models/EPEntry";
import SponsorshipEntry from "@/models/SponsorshipEntry";
import Task from "@/models/Task";
import User from "@/models/User";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed endpoint is disabled in production" }, { status: 403 });
  }

  await connectDB();
  await Promise.all([User.deleteMany({}), Task.deleteMany({}), EPEntry.deleteMany({}), SponsorshipEntry.deleteMany({}), Department.deleteMany({})]);
  const passwordHash = await bcrypt.hash("Password@123", 12);
  const secretaryEmails = authorizedSecretaries();
  const seededSecretaryEmails = secretaryEmails.length > 0 ? secretaryEmails : ["secretary@nitkkr.ac.in"];
  const primarySecretaryEmail = seededSecretaryEmails[0];
  const secretaryUsers = seededSecretaryEmails.map((email, index) => ({
    name: index === 0 ? "Aarav Secretary" : `Secretary ${index + 1}`,
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
    { name: "Meera Sponsorship", email: "meera@nitkkr.ac.in", passwordHash, year: "3rd Year", departments: ["Sponsorship Team"], canManageTeam: true },
    { name: "Rohan Media", email: "rohan@nitkkr.ac.in", passwordHash, year: "2nd Year", departments: ["Media Team"] },
    { name: "Isha Logistics", email: "isha@nitkkr.ac.in", passwordHash, year: "1st Year", departments: ["Logistics Team"] }
  ]);

  await Department.insertMany(DEPARTMENTS.map((name) => ({ name, members: users.filter((user) => user.departments.includes(name)).map((user) => user._id) })));
  await Task.create({
    title: "Prepare sponsor prospect list",
    description: "Create a verified list of sponsor leads.",
    createdBy: users.find((user) => user.email === primarySecretaryEmail)!._id,
    assignedTo: [users.find((user) => user.email === "meera@nitkkr.ac.in")!._id],
    priority: "High",
    deadline: new Date(Date.now() + 432000000),
    status: "In Progress",
    progress: 45,
    timeline: [{ actor: users.find((user) => user.email === primarySecretaryEmail)!._id, status: "Pending", progress: 0, comment: "Task created" }]
  });
  await EPEntry.create({
    epName: "Technova Cultural Exchange",
    organization: "NIT Delhi",
    contactNumber: "9876543210",
    email: "events@nitdelhi.ac.in",
    personContacted: "Event Coordinator",
    date: new Date(),
    discussionSummary: "Discussed cross-campus event participation.",
    currentStatus: "Follow-up Required",
    detailedUpdate: "Send formal partnership deck.",
    createdBy: users.find((user) => user.email === "diya@nitkkr.ac.in")!._id
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
    sponsorshipRequirement: "Title sponsorship.",
    currentStatus: "Proposal Sent",
    detailedUpdate: "Proposal deck shared.",
    createdBy: users.find((user) => user.email === "meera@nitkkr.ac.in")!._id
  });

  return NextResponse.json({ users: users.length, password: "Password@123" });
}
