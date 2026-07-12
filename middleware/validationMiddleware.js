import { body, validationResult } from "express-validator";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

export const validateUserRegistration = [
  body("firstName").notEmpty().withMessage("First name is required"),
  body("lastName").notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Please enter a valid email"),
  body("phoneNumber").notEmpty().withMessage("Phone number is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("role").isIn(["doctor", "nurse", "support_staff", "admin"]).withMessage("Invalid role"),
  body("hospital").notEmpty().withMessage("Hospital name is required"),
  validateRequest
];

export const validateLogin = [
  body("email").isEmail().withMessage("Please enter a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  validateRequest
];

export const validateIVMonitor = [
  body("deviceId").trim().notEmpty().withMessage("Device ID is required"),
  body("patientId").trim().notEmpty().withMessage("Patient ID is required"),
  body("fluidType").trim().notEmpty().withMessage("Fluid type is required"),
  body("fluidVolume").isFloat({ gt: 0 }).withMessage("Fluid volume must be greater than 0"),
  body("flowRate").isFloat({ gt: 0 }).withMessage("Flow rate must be greater than 0"),
  body("location.ward").optional().isString(),
  body("location.room").optional().isString(),
  body("location.bed").optional().isString(),
  validateRequest
];