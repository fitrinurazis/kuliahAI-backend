const express = require("express");
const {
  register,
  login,
  editProfile,
  changeProfileImage,
  deleteUser,
  forgotPassword,
  getAllUsers,
  checkAuth,
  logout,
} = require("../controllers/authController");
const { auth, isAdmin } = require("../middlewares/authMiddleware");
const uploadPic = require("../middlewares/uploadPicMiddleware");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/profile", auth, editProfile);
router.post("/profile/image", auth, uploadPic, changeProfileImage);
router.post("/forgot-password", forgotPassword);
router.get("/users", auth, isAdmin, getAllUsers);
router.delete("/user/:id", auth, isAdmin, deleteUser);
router.get("/check-auth", checkAuth);
router.post("/logout", (req, res) => {
  res.clearCookie("token"); // Menghapus cookie token
  res.status(200).json({ message: "Logout successful" });
});

module.exports = router;
