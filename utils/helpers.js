export const formatPhoneNumber = (phoneNumber) => {
  // Format for Rwanda (+250...)
  if (!phoneNumber) return null;
  
  // Remove any non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, "");
  
  // Check if it's a Rwanda number
  if (cleaned.startsWith("250")) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith("0")) {
    return `+250${cleaned.substring(1)}`;
  } else {
    return `+250${cleaned}`;
  }
};

export const calculateEstimatedEndTime = (currentLevel, totalVolume, flowRate) => {
  if (!currentLevel || !totalVolume || !flowRate) return null;
  
  const remainingVolume = (currentLevel / 100) * totalVolume;
  const hoursRemaining = remainingVolume / flowRate;
  
  return new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
};

export const generateDeviceId = () => {
  return `IV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
};

export const sanitizeUser = (user) => {
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.__v;
  return userObj;
};