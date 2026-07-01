import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendSMS = async (to, body) => {
  try {
    // Format phone number for Rwanda (+250...)
    if (!to.startsWith("+")) {
      if (to.startsWith("0")) {
        to = "+250" + to.substring(1);
      } else {
        to = "+250" + to;
      }
    }

    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });

    console.log(`SMS sent to ${to}: ${message.sid}`);
    return message;
  } catch (error) {
    console.error("Twilio SMS error:", error);
    throw error;
  }
};

export const sendBulkSMS = async (phoneNumbers, body) => {
  const promises = phoneNumbers.map(phoneNumber => sendSMS(phoneNumber, body));
  return Promise.allSettled(promises);
};