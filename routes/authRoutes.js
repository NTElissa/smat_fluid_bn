import express from "express";
import { 
  registerUser, 
  loginUser, 
  getProfile, 
  updateProfile, 
  changePassword 
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { 
  validateUserRegistration, 
  validateLogin 
} from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post("/register", validateUserRegistration, registerUser);
router.post("/login", validateLogin, loginUser);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;