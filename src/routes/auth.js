// backend/src/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import Admin from "../models/Admin.js";

const router = express.Router();

// Test route (for debugging)
router.get("/test", (req, res) => {
  res.json({ message: "Auth route is working!" });
});

// POST /api/auth/login
router.post(
  "/login",
  body("username").isString(),
  body("password").isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;

    try {
      // Check ENV admin first (super-admin fallback)
      if (
        process.env.ADMIN_USERNAME &&
        process.env.ADMIN_PASSWORD_HASH &&
        username === process.env.ADMIN_USERNAME
      ) {
        const ok = await bcrypt.compare(
          password,
          process.env.ADMIN_PASSWORD_HASH
        );
        if (!ok)
          return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign(
          { username },
          process.env.JWT_SECRET,
          { expiresIn: process.env.TOKEN_EXPIRY || "1h" }
        );
        return res.json({ token });
      }

      // Fallback to DB admin
      const admin = await Admin.findOne({ username });
      if (!admin)
        return res.status(401).json({ message: "Invalid credentials" });

      const ok = await bcrypt.compare(password, admin.passwordHash);
      if (!ok)
        return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign(
        { username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.TOKEN_EXPIRY || "1h" }
      );
      res.json({ token });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
