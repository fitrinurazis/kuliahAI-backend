require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

// Register
exports.register = async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  try {
    // Cek apakah pengguna sudah terdaftar dengan email atau nomor telepon
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Pengguna sudah terdaftar dengan email atau telepon ini.",
      }); // Mengembalikan status 409
    }

    // Proses pendaftaran jika pengguna belum terdaftar
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
    });

    //Setelah user berhasil dibuat
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    ); // Experied 1 hari

    // Simpan token di HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true, // Tidak bisa diakses oleh JavaScript
      secure: process.env.NODE_ENV === "production", // Secure cookie untuk production
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // Cookie akan expired dalam 1 hari
    });

    return res.status(201).json({
      message: "Daftar Berhasil!",
      user,
    });
  } catch (error) {
    return res.status(500).json({ error: "Daftar Gagal!" });
  }
};

// Login
exports.login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const user = await User.findOne({
      where: {
        [Op.or]: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user)
      return res
        .status(404)
        .json({ message: "Email atau nomor HP tidak terdaftar" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(400).json({ message: "Password Salah" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({ message: "Login berhasil", token, user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Terjadi kesalahan server", error: error.message });
  }
};

// Edit Profile
exports.editProfile = async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    await User.update({ name, email, phone }, { where: { id: req.user.id } });
    res.json({ message: "Profil berhasil diupdate" });
  } catch (error) {
    res.status(500).json({ error: "Profil gagal diupdate" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "name",
        "email",
        "phone",
        "role",
        "profilePic",
        "createdAt",
        "updatedAt",
      ],
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Handle Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set token expiration time (e.g., 1 hour)
    const resetPasswordExpire = Date.now() + 60 * 60 * 1000;

    // Update user with reset token and expiration
    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpire = resetPasswordExpire;
    await user.save();

    // Send reset email
    const resetUrl = `http://localhost:8080/api/auth/reset-password/${resetToken}`;
    const message = `Anda meminta pengaturan ulang kata sandi. Silakan ajukan permintaan PUT ke: \n\n ${resetUrl}`;

    // Configure nodemailer to send email
    const transporter = nodemailer.createTransport({
      service: "gmail", // or your email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset",
      text: message,
    };

    await transporter.sendMail(mailOptions);

    res
      .status(200)
      .json({ message: "Setel ulang kata sandi email telah dikirim" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Ganti foto profil
exports.changeProfileImage = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Hapus foto lama jika ada
    if (user.profileImage && user.profileImage !== "default.jpg") {
      const oldImagePath = path.join(
        __dirname,
        "..",
        "uploads",
        user.profileImage
      );
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Simpan foto baru
    const newProfileImage = req.file.filename;
    user.profileImage = newProfileImage;
    await user.save();

    res.status(200).json({ message: "Foto  profil telah diganti" });
  } catch (error) {
    res.status(500).json({ error: "Foto  profil tidak dapat diganti" });
  }
};

// Hapus pengguna (Admin Only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Pengguna  tidak ditemukan" });
    }

    // Hapus pengguna
    await user.destroy();
    res.status(200).json({ message: "Pengguna telah dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Pengguna tidak dapat dihapus" });
  }
};

// Middleware untuk memeriksa apakah pengguna sudah login (autentikasi)
exports.checkAuth = async (req, res) => {
  const token = req.cookies.token; // Mengambil token dari HTTP-only cookie

  if (!token) {
    return res.status(200).json({ isAuthenticated: false });
  }

  try {
    // Verifikasi token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({
      isAuthenticated: true,
      user: decoded, // Kirim data user (role, id, dll) jika token valid
    });
  } catch (error) {
    return res.status(401).json({ isAuthenticated: false });
  }
};

// Logout pengguna
exports.logout = async (req, res) => {
  // Hapus token JWT dari cookies
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0), // Cookie akan segera expire
    secure: process.env.NODE_ENV === "production", // Hanya di https untuk production
    sameSite: "strict",
  });

  return res.status(200).json({ message: "Logged out successfully" });
};
