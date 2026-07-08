import mongoose from "mongoose";

export const normalizeRoomPayload = (body = {}) => {
  const payload = { ...body };

  if (typeof payload.roomNumber === "string") {
    payload.roomNumber = payload.roomNumber.trim();
  }

  if (typeof payload.ward === "string") {
    payload.ward = payload.ward.trim();
  }

  if (typeof payload.floor === "string") {
    payload.floor = payload.floor.trim();
  }

  if (typeof payload.notes === "string") {
    payload.notes = payload.notes.trim();
  }

  if (payload.capacity !== undefined) {
    payload.capacity = Number(payload.capacity);
  }

  if (payload.currentOccupancy !== undefined) {
    payload.currentOccupancy = Number(payload.currentOccupancy);
  }

  if (Array.isArray(payload.amenities)) {
    payload.amenities = payload.amenities.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof payload.amenities === "string") {
    payload.amenities = payload.amenities
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    payload.amenities = [];
  }

  if (payload.status) {
    payload.status = String(payload.status).toLowerCase();
  }

  if (payload.type) {
    payload.type = String(payload.type).toLowerCase();
  }

  return payload;
};

export const pickRoomUpdateFields = (body = {}) => {
  const normalized = normalizeRoomPayload(body);
  const allowedFields = [
    "roomNumber",
    "ward",
    "floor",
    "capacity",
    "currentOccupancy",
    "status",
    "type",
    "amenities",
    "notes",
  ];

  return Object.fromEntries(
    Object.entries(normalized).filter(([key]) => allowedFields.includes(key))
  );
};

export const buildRoomQuery = (query = {}) => {
  const filter = {};

  if (query.roomNumber) {
    filter.roomNumber = { $regex: query.roomNumber, $options: "i" };
  }

  if (query.ward) {
    filter.ward = { $regex: query.ward, $options: "i" };
  }

  if (query.floor) {
    filter.floor = { $regex: query.floor, $options: "i" };
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true" || query.isActive === true;
  } else {
    filter.isActive = true;
  }

  if (query.roomId) {
    if (mongoose.Types.ObjectId.isValid(query.roomId)) {
      filter._id = query.roomId;
    }
  }

  return filter;
};
