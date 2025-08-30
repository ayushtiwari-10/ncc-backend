// backend/src/routes/admin.js
import express from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import Admin from "../models/Admin.js";
import verify from "../middleware/verifyToken.js";

const router = express.Router();

// ================== Create admin (protected) ==================
router.post(
  "/create",
  verify,
  body("username").isLength({ min: 3 }),
  body("password").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;

    try {
      // Prevent duplicate of ENV admin
      if (
        process.env.ADMIN_USERNAME &&
        username === process.env.ADMIN_USERNAME
      ) {
        return res
          .status(409)
          .json({ message: "Use environment admin instead" });
      }

      // Check if already exists
      const exists = await Admin.findOne({ username });
      if (exists) {
        return res.status(409).json({ message: "Admin already exists" });
      }

      // Hash password & save
      const hash = await bcrypt.hash(password, 10);
      const a = new Admin({ username, passwordHash: hash });
      await a.save();

      res.json({ ok: true, username: a.username });
    } catch (err) {
      console.error("Create admin error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ================== Change password (protected) ==================
router.post(
  "/change-password",
  verify,
  body("username").isString(),
  body("newPassword").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { username, newPassword } = req.body;

    try {
      // Block ENV admin password change
      if (
        process.env.ADMIN_USERNAME &&
        username === process.env.ADMIN_USERNAME
      ) {
        return res
          .status(400)
          .json({ message: "Change ENV admin manually" });
      }

      const admin = await Admin.findOne({ username });
      if (!admin) return res.status(404).json({ message: "Admin not found" });

      admin.passwordHash = await bcrypt.hash(newPassword, 10);
      await admin.save();

      res.json({ ok: true });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
